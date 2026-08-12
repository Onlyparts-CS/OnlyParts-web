# OnlyParts — Admin Console & Catalogue Operations

**Version:** 1.0
**Answers:** *"How do I, as an admin, add 50,000 products? Do I always have to come and upload?"*

---

## 1. The short answer

**No. Manual entry is the exception, not the mechanism.**

A human typing product records is viable to roughly 500 SKUs. At 50,000 it is
arithmetically impossible: at an optimistic 3 minutes per SKU with complete
attributes, images and price breaks, that is **2,500 hours — 15 months of
full-time work for one person**, during which the first records are already stale.

Catalogue at this scale is a **pipeline**, not a data-entry job. Products enter
through four channels, in descending order of volume:

| # | Channel | Share of SKUs | Human effort per SKU |
|---|---|---|---|
| 1 | **Supplier feed sync** (scheduled, automatic) | ~60% | 0 — exception review only |
| 2 | **Bulk CSV / XLSX import** (admin uploads a sheet) | ~30% | seconds, amortised |
| 3 | **Duplicate & vary** (clone a product, change one axis) | ~8% | ~30 s |
| 4 | **Manual create** (one genuinely new product) | ~2% | 3–5 min |

The admin's real job is **exception handling and merchandising**, not typing.
Everything below is designed around that.

---

## 2. Where the admin lives

`admin.onlyparts.in` — the Payload CMS admin panel, generated from the same
collections that back the storefront, then customised. Gated twice: Cloudflare
Access (Google SSO) at the edge, and Payload RBAC in the application.

### 2.1 Roles

| Role | Can | Cannot |
|---|---|---|
| `catalog` | Create/edit products, attributes, media, run imports | See customer PII, change prices above a threshold, refund |
| `pricing` | Prices, price breaks, promotions | Edit product specs |
| `ops` | Orders, shipments, stock adjustments, RFQ queue | Edit the catalogue, export customers |
| `finance` | Invoices, refunds, GST reports | Edit the catalogue |
| `support` | View a **single** order by number to help a customer | **Export the user list** — the DPDP-critical restriction |
| `admin` | Everything, including role assignment | — |

The `support` restriction is deliberate and load-bearing: `16-DPDP-COMPLIANCE.md`
§3 treats bulk customer export as the highest-risk action in the system.

**MFA is mandatory for every admin role.** No exceptions, no "we'll add it later".

---

## 3. Channel 1 — Supplier feed sync (the 60%)

Most SKUs are not ours. They come from distributors who already publish machine-
readable catalogues. Typing their data by hand is the mistake.

### 3.1 Model

```
suppliers            name, contact, currency, lead time, margin rules
supplier_feeds       supplier_id, kind (csv_url|sftp|api|email), url/creds,
                     schedule (cron), field_mapping (jsonb), is_active
feed_runs            feed_id, started_at, rows_seen, created, updated,
                     skipped, failed, diff_report (jsonb), status
```

### 3.2 The run

```
cron (Payload Jobs Queue)
  → fetch feed (HTTP / SFTP / API)
  → parse to canonical rows
  → apply field_mapping         supplier column → our attribute key
  → normalise units             "10mm" → length_mm: 10
  → match existing              by supplier_sku, then MPN, then our SKU
  → classify each row: CREATE | UPDATE | UNCHANGED | CONFLICT
  → auto-apply UPDATE for price and stock only
  → queue CREATE + CONFLICT for human review
  → write feed_run + diff_report
  → emit product.updated → reindex + ISR revalidate
```

### 3.3 What is never automatic

**Price and stock sync automatically. Nothing else does.**

- A new product needs a human to confirm its category, attribute mapping and
  images before it goes live. Auto-creating live products from a feed is how
  competitors end up with the misleading descriptions described in
  `12-COMPETITIVE-RESEARCH.md` §4a.
- A **conflict** — the supplier changed a spec we already publish — always stops
  for review. Silently rewriting "metal gears" to "plastic gears" on a live
  product is exactly the failure that has cost incumbents their reputation.
- A feed that would deactivate **more than 5% of a supplier's SKUs in one run**
  halts and alerts. That pattern is almost always a broken feed, not a
  discontinued range, and blindly applying it empties the shelf.

### 3.4 Stock accuracy — the "ghost inventory" defence

The most damaging failure in this market is showing *in stock* for something
that isn't. Defences, in order:

1. Feed stock sync every **15 minutes** for A-class SKUs, hourly for the rest.
2. `available = on_hand − allocated − reserved`, computed from the ledger, never
   a free-floating counter.
3. **Soft reservation at checkout start**, 15-minute TTL — two people cannot buy
   the last unit.
4. When a supplier feed goes stale beyond its SLA, affected SKUs **automatically
   flip to "Made to order" with a lead time** rather than continuing to claim
   stock they may not have.
5. Nightly reconciliation asserting `SUM(movements.delta) == on_hand`; drift
   alerts.

Point 4 is the one competitors skip, and it is the cheapest reputation insurance
in the system.

---

## 4. Channel 2 — Bulk import (the 30%)

The screen the admin actually uses. Upload a CSV or XLSX, map columns once, and
**always see a dry-run diff before anything is written.**

### 4.1 Flow

```
Upload  →  Detect columns  →  Map to fields  →  DRY RUN  →  Review diff  →  Commit
                                (saved as a         │
                                 reusable preset)   ▼
                                             ┌──────────────────────┐
                                             │  will CREATE   412   │
                                             │  will UPDATE   1,880 │
                                             │  UNCHANGED     6,204 │
                                             │  ERRORS        37 ▼  │
                                             └──────────────────────┘
```

Nothing commits until the human has seen those four numbers. An import that
would change 8,000 prices looks identical to one that changes 3 until you show
the count.

### 4.2 Validation, before the diff

| Check | Behaviour on failure |
|---|---|
| Required attributes for the target category present | Row error |
| Attribute value matches its declared type/enum | Row error |
| Units parse and normalise | Row error with the raw value quoted |
| SKU unique and well-formed | Row error |
| HSN code present and 8 digits | Row error — blocks GST invoicing later |
| Price > 0, breaks strictly descending | Row error |
| Category exists and is a **leaf** | Row error |
| Image URL resolves | Warning — imports without the image |

Errors download as an annotated copy of the original sheet with a `_error`
column, so the supplier or colleague can fix it in place and re-upload. Nobody
should have to cross-reference a row number against an error log.

### 4.3 Scale mechanics

- Files stream and process in **chunks of 500 rows** inside a job, so a 50,000-row
  sheet never holds a request open or exhausts memory.
- Progress is written to `feed_runs`, and the admin can close the tab.
- **Every import is reversible.** A run records the previous values of everything
  it touched; one click reverts it. This is what makes bulk editing safe enough
  to actually use.
- Commits batch into transactions of 500 with `ON CONFLICT DO UPDATE`.

### 4.4 Bulk edit without a file

For "raise every SS316 fastener by 4%" the admin filters the product table,
selects all matching, and applies a patch — with the same dry-run diff, the same
reversibility, and the same audit entry.

---

## 5. Channel 3 — Duplicate & vary

Most "new" products are a variant axis away from an existing one. The admin
opens `M3 × 10 Socket Head SS304`, chooses **Duplicate & vary**, picks the axis
(`length_mm`) and the values (`12, 16, 20`), and the system generates the SKUs,
titles, prices (interpolated along the existing curve) and attribute rows.

Three products in about thirty seconds, with attributes that cannot drift from
their siblings because they were derived from them.

---

## 6. Channel 4 — Manual create

Rare, and deliberately guided. Choosing the category first loads that leaf's
attribute schema, so the form asks for exactly the fields that category needs —
never a generic "specifications" textarea. That single constraint is what keeps
search working (`09-SEARCH-SPEC.md` §1).

---

## 7. The admin's actual daily work

Not typing products. Working queues:

| Queue | Cadence | What it is |
|---|---|---|
| **Zero-result searches** | Weekly | Ranked by volume. Each is a missing product, a missing synonym, or a parser gap. The highest-leverage list in the company |
| **Feed exceptions** | Daily | New SKUs to approve, conflicts to resolve |
| **Low stock / reorder** | Daily | Below reorder point, ranked by velocity |
| **Attribute completeness** | Weekly | SKUs missing a required attribute — these are invisible to facets |
| **Missing imagery** | Weekly | Live SKUs with no photograph |
| **RFQ SLA** | Hourly | Anything approaching the 4-hour first-response deadline |
| **Order exceptions** | Daily | Failed payments, RTOs, stuck shipments |

Each of these is a screen in the admin console, not a spreadsheet someone
remembers to check.

---

## 8. Seeding 12,000 SKUs for launch

| Step | Method | Duration |
|---|---|---|
| Define attribute schemas for wave-1 leaves | Manual, ~60 leaves | 1 week |
| Onboard 4 primary distributor feeds | Feed config + mapping | 1 week |
| First feed run → review CREATE queue | Bulk approve | 3 days |
| Generate variant families (fasteners, bearings) | Duplicate & vary | 4 days |
| Photography for the top 1,200 SKUs | External studio, bulk upload by SKU-named files | 3 weeks (parallel) |
| Price break curves | Bulk edit by family | 2 days |
| QA sweep against the launch gate | Completeness queue | 1 week |

**≈ 6 weeks with one catalogue ops person**, versus 15 months of manual entry.
That ratio is the entire justification for building the pipeline first.

---

## 9. Launch gate (unchanged from `11-ROADMAP.md`)

A SKU may not go live without: complete required attributes for its leaf, ≥ 1
image, a valid 8-digit HSN, a price with at least one break, and ≥ 1 category
assignment with exactly one primary. The completeness queue enforces it; the
import refuses it.
