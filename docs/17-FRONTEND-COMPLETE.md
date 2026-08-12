# OnlyParts — Frontend Completion & End-to-End UX

**Date:** 31 July 2026
**Purpose:** Confirm the frontend and the user experience before backend connectivity begins.

---

## 1. Route inventory — 25 routes, all verified

Every route below returns 200 and renders real content. Verified by fetching all
of them against a running server; the only non-200 is the deliberate 404 test.

### Storefront

| Route | Type | What it does |
|---|---|---|
| `/` | Static | Hero, category bento, scroll-scrubbed search demo, trust band, projects, MoD, reviews |
| `/c` | Dynamic | Index of all 13 categories |
| `/c/[...path]` | Dynamic | L1 and L2 landings; L3 product listing with facet rail, table view, sort |
| `/p/[slug]` | Dynamic | Variant matrix, price breaks, spec table, cross-listing switcher, substitutes |
| `/search` | Dynamic | Token bar, category rail, inferred facets, relaxation, zero-result → MoD |
| `/projects/[slug]` | **SSG ×6** | Build-a-X: categories the build spans, curated picks, BOM actions |

### Commerce

| Route | Type | What it does |
|---|---|---|
| `/cart` | Static shell | Live tier resolution, next-tier nudge, free-shipping progress |
| `/checkout` | Static shell | 4 blocks, pincode → place of supply, CGST/SGST vs IGST, GSTIN validation |
| `/orders/[number]` | Dynamic | Confirmation + GST invoice, tax columns adapt to intra/inter-state |
| `/track` | Static shell | Order lookup by number, stage timeline |

### Account

`/login` · `/register` · `/account` — mock session, orders with invoices, addresses, GST profile, reorder.

### Make-on-Demand

`/make` (capabilities, honest lead-time ranges) · `/make/rfq` (3-step wizard, process recommender, NDA) · `/rfqs/[number]` (SLA clock, stage timeline).

### Content — **new this phase**

| Route | Type | Notes |
|---|---|---|
| `/about` | Static | **Carries the dispatch / no-MOQ / GST facts moved off the hero**, each expanded with the reasoning |
| `/contact` | Static | WhatsApp, phone, email with real hours; routed by reason; Grievance Officer for DPDP |
| `/faq` | Static | 10 questions with `FAQPage` JSON-LD |
| `/guides` | Static | Index of 6 guides — the acquisition channel from `12` §4 |
| `/guides/[slug]` | **SSG ×6** | Full articles with `Article` JSON-LD |
| `/policies/[slug]` | **SSG ×5** | Shipping, Returns, GST invoices, Privacy, Terms |
| `/bulk-orders` | Static | B2B and institutional |

### Admin

`/admin` · `/admin/products` · `/admin/import` · `/admin/queues`.

### Infrastructure — **new this phase**

`not-found.tsx` (branded 404 routing to categories and MoD) · `error.tsx` (with a quotable digest) · `loading.tsx` (skeleton matching catalogue layout, protects the CLS budget) · `sitemap.xml` · `robots.txt`.

---

## 2. Demo data can no longer reach a deployment

This was the sharpest requirement, so it is worth stating exactly how it works.

### The mechanism

`lib/demo.ts` exports one flag, read from `NEXT_PUBLIC_DEMO_DATA`. It is
**opt-in**: absent, empty or any value other than `on` means off. A deployment
that forgets to configure anything therefore fails safe.

`allSkus()` returns `[]` when the flag is off, so every downstream surface —
listings, search, cart, admin — falls through to its empty state. There is no
second place to remember to change.

Because `NEXT_PUBLIC_` values are **inlined at build time**, a production build
physically cannot contain the demo catalogue. It is not a runtime toggle someone
can flip by accident.

### Verified against a real production build

Built with `NEXT_PUBLIC_DEMO_DATA=off` and served:

| Page | Demo banner | Product links | SKU counts | Result |
|---|---|---|---|---|
| `/` | absent | 0 | 0 | clean |
| `/c/fasteners` | absent | 0 | 0 | "Coming soon" |
| `/c/…/socket-head-cap` | absent | 0 | 0 | "Coming soon" |
| `/search?q=m3x10` | absent | 0 | 0 | zero-state → MoD |
| `/projects/drone` | absent | 0 | 0 | empty state |

### What else the flag governs

Category counts are **planned targets** from `02-TAXONOMY.md` §6, not inventory.
They are rendered only through `skuCountLabel()`, which returns null when there
is no catalogue behind them, and the UI shows "Coming soon" instead. Presenting
a target as live stock is the ghost-inventory lie in a different costume.

The trust band swaps to pre-launch claims: SKU count and review count are
replaced by facts that are true today (13 categories, no MOQ, 24-hour dispatch
target, GST, MoD).

The home page search demo is now labelled **"example"**, because its rows come
from a fixed illustration set rather than live inventory.

### Demo mode is impossible to mistake

With the flag on, a warning strip sits above the header on every page: *"Demo
catalogue — products, prices and stock are generated. Not a live store."*

---

## 3. Navigation completeness

Every page is reachable, and no link is dead.

- **Footer** — five columns covering all 13 categories, 6 projects, company,
  support and legal. Every href now resolves; the previous `#` placeholders are gone.
- **Header** — three-panel mega menu with L2/L3 drill-down, `MAKE →` distinct
  from categories, cart badge counting only lines that resolve, account state.
- **Cross-links** — guides → categories and MoD; policies → each other and
  contact; projects → their categories and to other projects; 404 → categories,
  search and MoD; PDP → primary category, cross-listings, projects, substitutes.

---

## 4. The end-to-end journey

Walked and verified:

```
Land → search "m3x10 ss304 socket"  → tokens parsed, socket head ranked first
     → PDP                          → variant matrix, price breaks, specs
     → add 250                      → tier 100+ applies automatically
     → cart                         → bulk savings, free shipping unlocked
     → checkout, PIN 560058         → Karnataka → CGST ₹108.32 + SGST ₹108.31
     → switch to Maharashtra        → IGST ₹216.63, same total
     → place order                  → OP-2026-000001, invoice OP/2026-27/000001
     → invoice                      → per line: ₹470.34 taxable + ₹84.66 IGST = ₹555.00
     → register                     → account, order visible, reorder works
```

Parallel path: `/make` → RFQ wizard → recommender suggests by quantity, flatness
and tolerance → submit → `MOD-2026-0001` with a 4-business-hour SLA deadline.

Failure paths verified: out-of-stock PDP disables the CTA and offers substitutes;
zero-result search routes to MoD; unseeded category shows the right message for
the audience; 404 offers categories and search.

---

## 5. Known gaps — deliberate, not oversight

| Gap | Why |
|---|---|
| No backend | Deferred by decision. Cart, session, orders and RFQs are in `localStorage` |
| RFQ files not uploaded | Validated client-side; needs S3 + virus scanning |
| Auth is mock | No server, no session token, no real OTP |
| Wishlist / BOM import / reviews | Buttons present, behaviour needs the API |
| No real imagery | Every `<Frame>` is a designed placeholder waiting for assets |
| Search is a linear scan | Fine at 1,172 SKUs, fatal at 50,000. Meilisearch is a launch blocker |
| `/careers` | Not built — no roles to post yet |

---

## 6. Verification performed

- `tsc --noEmit` — clean
- `eslint` — clean
- `next build` — succeeds; 6 guides, 5 policies and 6 projects pre-rendered
- 37 route fetches — all 200, plus 404 on a deliberately bad path
- Production build with demo off — no demo data on any storefront page

---

## 7. Review round — nine defects found and fixed

Found by walking the built pages and reading a printed invoice. Every figure
below was measured in the running app, before and after.

### 7.1 The GST invoice could not be printed

There was no print stylesheet anywhere in the app — `@media print` returned zero
matches. `window.print()` handed Chrome the live page.

| | Before | After |
|---|---|---|
| Site chrome on the sheet | header, nav, cart icon, footer | hidden via `.print-hide` |
| Announcement strip | `ink-200` on white ≈ 1.2:1 — invisible | not printed |
| Line-items table | `min-w-[760px]` in ~700px of paper, `overflow-x-auto` clips → **Total column falls off** | `colgroup` + `table-layout: fixed`, 0px overflow |
| Page setup | browser default | `@page { size: A4; margin: 14mm 12mm }` |
| Row splitting | any | `break-inside: avoid` on rows and blocks |

Backgrounds are re-enabled with `print-color-adjust: exact` on the sheet only,
so the table head and footer note survive. Verified by lifting the print block
out of the cascade at a 700px viewport: all 8 columns present, Total ends at the
page edge, `scrollWidth == clientWidth`.

This is still browser print. Server-side PDF generation remains the plan for the
connectivity phase; this makes the interim path correct rather than broken.

### 7.2 Cart rows broke on bulk quantities

The price column was a `shrink-0` sibling of the detail column. At 12,58,987.41
it inflated to 120px and starved the detail column to 83.5px — while the
quantity stepper has a hard intrinsic width of 130px.

| | Before | After |
|---|---|---|
| Stepper vs its column | 130px in 83.5px — **46.5px overflow** | 74px of slack |
| `scrollWidth` / `clientWidth` | 130 / 84 | 220 / 220 |
| Thumbnail (1:1, 80px) | stretched to **80 × 337px** | 80 × 80 |
| Row height at 390px | 369px | 256px |

Price moved inside the detail column's own header row, so it wraps to its own
line instead of competing; `self-start` on the thumbnail stops the flex stretch.

### 7.3 The spec table was not a table

| | Before | After |
|---|---|---|
| Label → value gap | **541px** on a 632px row | 16px on a 438px row |
| Dead column | 170px stranded bottom-right | none — cards size to content |
| Rules between rows | none (zebra fill only) | `divide-y`, header strip per group |
| Elevation | flat | `shadow-e1` per card |

Two long columns became one card per group on `items-start`, so a one-row group
("Standards") no longer forces a four-row hole beside it.

### 7.4 Project membership was inferred, and wrong

`projectsFor()` derived membership from L1 category overlap, so **every fastener
in the catalogue** claimed "Build a Drone" and "Build a Repair Bench" — a drone
contains fasteners, therefore an M2.5 pan-head screw is a drone part.

Now an explicit `Sku.projects` field, set on upload:

- **CSV importer** — `projects` column, pipe-separated slugs, validated against
  `PROJECTS`; an unknown slug fails the row rather than inventing a collection.
  The sample file carries a deliberate bad slug so the check is visible.
- **Admin products table** — a Projects column, so what a part claims is auditable.
- **Storefront** — unknown slugs are dropped, never rendered.

Demo curation is deliberately narrow: M2–M3 short screws are drone and
repair-bench hardware, M5–M8 are CNC, and an M8 cap screw is no longer a drone part.

### 7.5 "Used in these projects" was buried

Moved from **y=2495 on a 3652px page (68% down)** to directly under the buy box
at **y=1273 (35%)**, and restyled from two outline chips into a turquoise panel
with the project glyph. It only renders for curated SKUs.

### 7.6 The top shelf overflowed its own fill

At 390px both bars wrap to two lines inside fixed `h-7` / `h-8`, so the second
line rendered **outside** the coloured band on white — where the "white fonts
mismatch" came from. Both now use `min-h` with vertical padding (text spill: 3px
and 2px → 0). The demo banner moved off amber onto the same `ink-950` base with
amber text, so the top of the page is one dark shelf instead of three stacked
bands in 60px.

### 7.7 Content pages wasted half the canvas

`Prose` was `max-w-2xl` with **no `mx-auto`**.

| Page | Before | After |
|---|---|---|
| Guide body | 672px pinned left, **713px dead** | 672px centred, 217px each side |
| Guide header vs body | different left edges | both at 217px |
| About header | h1 ended at 734px, lead at 712px | spans 40 → 1385px, aligned with the cards below |

The measure is unchanged at 672px — 65–75 characters is the right target. What
was missing was anything on the other side of it: guides gained a sticky
contents rail (4 anchors on the screw-length guide) plus related reading,
policies gained a policy index. `PageHeader` gained a `split` variant that puts
the lead in a second column for pages whose content runs full width.

### 7.8 The reveal animation was invisible

Present and armed, but `i * 40` across a 3-column grid read as one block fade —
below ~90ms the eye cannot resolve a sequence.

- Stagger 40ms → **80ms diagonal** by `(row + col)`, so the wave sweeps top-left
  to bottom-right. Measured on `/make`: 0 / .08 / .16, .08 / .16 / .24, .16 / .24 / .32.
- Travel 24px → 34px, plus a 0.982 scale so a card lands rather than drifts.
- Duration 550ms → 620ms. Applied to every `Reveal` caller, not just this grid.

### 7.9 Three search bars on the home page, and the biggest one was fake

| | Before | After |
|---|---|---|
| Search fields | 3 — header, hero, and a **div** in the demo | 2, both usable |
| Home page height | 8,699px | **5,642px (−35%)** |
| Demo section | 3,061px pinned scroller | 0 — folded into the hero |
| Queries demonstrated | 1 | 6, cycling |

`SearchDemo.tsx` is deleted. The hero's right-hand panel now parses whatever the
real field on the left currently holds: tokens pop in as the query types itself,
and the placeholder render follows the match. The argument it was making never
needed a viewport of scrolling.

**Deployment safety held.** Result rows are gated on `CATALOGUE_EMPTY`, so with
`NEXT_PUBLIC_DEMO_DATA` off the panel shows the parse — a true claim about the
parser — and no rows, no prices, no SKU codes, no "example" badge. Verified
against a production build: `understood:` present with 3 token chips, zero
product rows.

### Verification

`tsc --noEmit` clean · `eslint` clean · `next build` succeeds (6 guides, 5
policies, 6 projects SSG) · 12-route sweep on a demo-off production build: all
200, zero product links, zero SKU counts, no demo banner.

---

## 8. Remaining pages built, and what the screenshot pass caught

### 8.1 The last gaps closed

| Was | Now |
|---|---|
| `/careers` not built | Built. Says nothing is open, names the four areas that will open first, invites an application anyway |
| Header heart was decoration | `/wishlist` with a working store, a toggle on every tile and the buy box, a badge that uses the same drop-the-delisted rule as the cart |
| "Import BOM (CSV)" was a stub | Parses a customer's file with the same `parseCsv` as the admin importer, merges quantities, and **reports unmatched rows instead of dropping them** |
| "Save as BOM" was a stub | Downloads the cart as CSV with SKU, qty, title and line totals |
| Rating with nothing behind it | Reviews list and form; the verified badge is earned from a real order, never granted |
| "New product" was a stub button | `/admin/products/new` — full form, validation mirroring the importer, and the project-tag picker |

Route count: **25 → 28** (`/careers`, `/wishlist`, `/admin/products/new`).

### 8.2 Verified by exercising, not by looking

- **BOM import** — a 6-row file: 3 matched and merged (251 + 500 = 751 on the M3), 2 unmatched reported with quantities and offered to Make-on-Demand, 1 blank row skipped.
- **Wishlist** — toggle → button reads "Saved" → store holds the SKU → header announces "Wishlist, 1 saved".
- **Reviews** — published against `FS-SHC-M3-010-SS304`, and because order `OP-2026-000001` contains that line, the verified badge was awarded by the rule rather than by the form.

### 8.3 The screenshot pass found one real bug

33 routes captured at 1440×900. Mobile was **not** validated from images: headless
Chromium ignores the viewport meta at narrow widths and clips text rather than
wrapping it, which produced convincing-looking overflow on pages that are fine in
a real browser. Measuring layout is the reliable test, so all 31 routes were
audited at 390px for horizontal overflow instead.

That audit caught a genuine defect nobody had seen:

**Checkout scrolled sideways on a phone.** `grid-cols-[1fr_360px]` collapses to a
single `auto` column below `lg`, and an `auto` track takes its minimum from the
widest min-content in it. The order summary's product titles are `nowrap` —
"608ZZ Deep Groove Ball Bearing — ID 8 · OD 22 · W 7" has a min-content width of
**408px** — so the column refused to go below **442px** inside a 350px container.
Every form field rendered 400px wide and the page scrolled 72px sideways, on the
one screen where that costs an order.

Fixed with `minmax(0,1fr)` at both levels (the page grid and the summary list),
which removes the min-content floor and lets the titles truncate as they were
already told to. Applied to the cart for the same reason.

| | Before | After |
|---|---|---|
| `/checkout` page overflow at 390px | **72px** | 0 |
| Widest form field | 400px in a 350px container | 306px |
| Routes clean at 390px | 30/31 | **31/31** |

---

## 9. Ready for the connectivity phase

Frontend and UX are complete and confirmed. The next phase resumes the work
paused mid-flight:

1. **Payload CMS 3.0 + PostgreSQL** — packages installed (`payload@3.86`,
   `@payloadcms/db-postgres`), Postgres binaries hydrated in `/infra`. Nothing
   wired yet.
2. **Collections** from `07-DATA-MODEL.md`, admin at `/cms`, keeping the bespoke
   console at `/admin`.
3. **Seed** the taxonomy and a real catalogue; delete the generated demo module
   entirely once real data exists.
4. **Invoice** generation server-side to PDF, stored in S3, attached to email and
   WhatsApp.
5. **Razorpay** with HMAC webhook verification.
