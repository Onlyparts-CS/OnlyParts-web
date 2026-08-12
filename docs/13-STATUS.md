# OnlyParts — Build Status vs. Documentation

> **Superseded in part.** The backend architecture pivoted to **Payload CMS 3.0**
> after this audit was written — see `06-BACKEND-ARCHITECTURE.md` v2. The three
> new documents (`14` admin/catalogue ops, `15` scale, `16` DPDP) answer the
> "50,000 SKUs live" and "how does an admin add products" questions that §6 of
> this audit left open. An admin console prototype now exists at `/admin`.

> **Superseded again, 4 August 2026 — §0 is out of date.** "No server, no
> database" is no longer true. Postgres 18 is running, Payload 3.86 is mounted
> at `/cms`, and the schema is live. See **§0a** immediately below; the rest of
> this audit still stands.

**Date:** 31 July 2026
**Scope:** `apps/web` measured against `01-PRD.md`, `04-WIREFRAMES.md`, `09-SEARCH-SPEC.md`, `11-ROADMAP.md` and `12-COMPETITIVE-RESEARCH.md`.

**Legend:** ✅ built & verified · 🟡 partial · ⚪ not started · ⛔ deliberately out of scope for the prototype

---

## 0. The one-line summary

**The entire storefront is navigable end to end** — landing → category → product → cart → checkout → GST invoice → account, plus search and the Make-on-Demand RFQ. What does *not* exist is a **backend**: no server, no database, no payment gateway, no auth, and a catalogue seeded for 5 of 372 leaf categories.

In roadmap terms: **Phases 1–4 are complete on the frontend, and Phase 0's backend half has not started.**

---

## 0a. Backend — phase 1: connectivity *(4 August 2026)*

The database exists and the CMS reaches it. Scope was deliberately connectivity
only; the catalogue collections are the next phase.

| | Status | Evidence |
|---|---|---|
| PostgreSQL 18 | ✅ | Embedded cluster, `infra/db.mjs`, port 5433. Extensions created: `pgcrypto`, `ltree`, `pg_trgm`, `citext` |
| Payload 3.86 mounted | ✅ | `/cms` returns 200; `/api/[...slug]`, `/api/graphql`, `/api/graphql-playground` built |
| Schema pushed | ✅ | `users`, `users_roles`, `users_sessions`, `media`, `payload_*` — verified against `information_schema` |
| Local API → Postgres | ✅ | `scripts/smoke.ts` creates, resizes, reads back and deletes a media record in-process |
| Uploads | ✅ | sharp generates `thumb` 400w and `face` 1200w; served same-origin at `/api/media/file/…`, which the halftone engine requires |
| Staff auth + RBAC | ✅ *schema* | Real salt/hash, `login_attempts`, `lock_until`, 8-hour tokens; roles `admin` / `catalog` / `ops` with **field-level** access so a user cannot self-promote |
| First admin user | ⚪ | `/cms/create-first-user` is live and waiting. Nobody has been created |
| Catalogue collections | ✅ | See §0b |
| Orders / payments / RFQs | ⚪ | Later phase |
| Storefront reads from DB | ⚪ | Still the generated demo catalogue behind `NEXT_PUBLIC_DEMO_DATA` |
| Customer auth | ⚪ | Separate collection by design — see `collections/Users.ts` |

### The app is now two root layouts

Payload's panel renders its own `<html>`, so `app/layout.tsx` was replaced by
`app/(frontend)/layout.tsx` and `app/(payload)/layout.tsx`. Route groups do not
affect URLs, so **every storefront path is unchanged**.

Two consequences worth knowing:

- Crossing between `/cms` and the shop is a full page load. This is the
  documented cost of multiple root layouts and is the right trade here.
- With no single root layout, unmatched URLs stopped reaching our styled 404.
  `app/(frontend)/[...unmatched]/page.tsx` routes them back into it.

## 0b. Backend — phase 2: the catalogue *(4 August 2026)*

Nine collections, 26 tables. `scripts/smoke-catalogue.ts` asserts the rules
themselves — **21 checks, all passing** — because anyone can prove a column
exists; what is worth proving is that the rules refuse what they claim to.

| Collection | Enforces |
|---|---|
| `categories` | `depth` and `path` derived, never typed. Three levels, hard-stopped. Cycles refused. A rename rewrites every descendant path |
| `attribute-definitions` | Typed spec schema, inherited down the tree. An enum with no values is refused |
| `brands` | `isGeneric` keeps "Generic" out of the brand facet as if it were a manufacturer |
| `products` | Leaf-only filing. Exactly one primary category — **structurally**, not by validation. HSN is 8 digits or the row fails |
| `variants` | Money in integer paise. Specs type-checked against their definition. A bulk break priced above the single-unit price is refused |
| `builds` | Curated project BOMs. Membership is never derived |
| `warehouses` | Two-digit GST state code — the place-of-supply origin |
| `inventory` | `onHand` read-only; available to sell = `onHand − allocated − reserved` |
| `inventory-movements` | Append-only. `update` and `delete` refused at the access layer |

Four decisions that depart from `07-DATA-MODEL.md`, each on purpose:

1. **`path` is `text`, not `ltree`.** Payload's Drizzle adapter has no ltree
   field type, and at 475 nodes a prefix scan is not the bottleneck. Converting
   the column and adding the GiST index is a migration, worth doing when the
   tree grows or `<@` semantics are genuinely needed.
2. **One `primaryCategory` + `crossListedIn`, not a `product_categories` join
   with an `is_primary` flag.** The doc gets "exactly one primary" from a
   partial unique index. This shape has no state with two primaries, so there
   is no rule to enforce and no way for an import to violate it.
3. **Attributes and price breaks are inline arrays.** Payload writes them to
   `variants_attributes` and `variants_price_tiers` with real typed columns
   (`value_text`, `value_number`, `value_bool`) — the shape §2.4 asks for, and
   the reason it rejects a `specs jsonb` blob. Verified against
   `information_schema`.
4. **The collection is called `builds`, not `collections`.** "Collection"
   already means something else in Payload; an operator should not have to work
   out which kind a sidebar entry is.

**Not yet done:** definition inheritance is declared but not resolved at read
time (`resolveAttributes` does not exist); `productCount` is a field nobody
refreshes; no migrations have been generated — dev pushes, production must not.

---

### ~~Known issue: every 404 answers `200`~~ — fixed *(5 August 2026)*

Every unknown URL used to render the correct 404 page and return **HTTP 200**.
The diagnosis above blamed Next 16 streaming in general. The real cause was
narrower and ours: **`app/(frontend)/loading.tsx`**. A `loading.tsx` creates a
Suspense boundary, which is exactly what makes the response stream — Next sends
the shell and its headers before the page body runs, so `notFound()` can only
swap the markup, never the status. Sitting at the route-group root, that one
file put all eight `notFound()` routes behind a streamed 200.

Measured, dev server, before and after moving it to `search/loading.tsx`:

| URL | before | after |
|---|---|---|
| `/this-route-does-not-exist` | 200 | **404** |
| `/p/does-not-exist` | 200 | **404** |
| `/c/nope-not-real` | 200 | **404** |
| `/b/no-brand`, `/guides/no-guide`, `/policies/no-policy`, `/projects/no-project` | 200 | **404** |
| `/`, `/search?q=m3`, `/cart`, `/c/fasteners`, `/admin`, `/cms` | 200 | 200 |

Search keeps the skeleton because it is the slowest storefront page and the only
slow one that *cannot* 404 — an empty result set is not a missing page. When the
storefront starts reading Postgres, the pattern for the eight 404-capable routes
is a `<Suspense>` **inside** the page, below the `notFound()` check: status
decided first, expensive half streamed after.

---

### Admin access model *(5 August 2026)*

**One identity, two consoles.** Staff sign in at `/cms/login` — Payload's own
screen, backed by Postgres, bcrypt, an HTTP-only cookie, an 8-hour token, and a
10-minute lockout after 5 failed attempts. `/admin` reads that same cookie. The
storefront `/login` is a *separate, still-prototype* customer session that lives
in `localStorage` and reaches nothing here; `actionStaff()` rejects it on
`user.collection !== "users"` regardless.

Roles are `admin`, `catalog`, `ops`. Until this pass they were **decoration** —
declared on the collection, `can()` written and exported, and called from
nowhere. Every signed-in staff member reached every screen, and an `ops` user
discovered the truth only when a save failed after they had filled the form.

Three fences now, and all three are needed:

| Fence | Where | Stops |
|---|---|---|
| Nav filter | `admin/layout.tsx` | Drawing doors the account cannot open |
| Page guard | `guard()` at the top of each page | Reaching the screen by typing the URL |
| Action guard | `actionStaff()` in every `"use server"` file | Calling the endpoint directly |

The third is not redundant. A Server Action compiles to a POST route addressable
by its action id — the page guard protects the *screen*, and nothing else.
`templateFor()` had no check at all and was callable unauthenticated.

`SURFACE_ROLES` in `lib/adminAuth.ts` is the single table both the nav and the
guards read, matched longest-prefix-first so `/admin/products/1/variants`
inherits `/admin/products`. Asserted by `scripts/rbac-check.ts` — 19 cases,
including the prefix-collision case (`/admin/productsomething` is not a child).

**Launch gate:** `/cms/create-first-user` is open until the first user exists.
It must be unreachable in production, and `docs/06` §9 still wants Cloudflare
Access in front of both consoles. Payload RBAC is the second fence, not the
first.

---

## 0c. Backend — phase 3: orders *(5 August 2026)*

`orders` and `customers` are in Postgres. Checkout no longer computes anything
that matters.

**The browser sends SKUs and quantities. It does not send prices.** Every figure
— unit price, price break, HSN code, GST rate, shipping, each tax component — is
re-derived in `lib/orders.ts` from the database. The previous flow computed the
invoice in `store.ts` and kept it in `localStorage`, which meant the price a
buyer paid was decided by their own browser.

Four rules the schema enforces rather than documents:

- **Lines are snapshots.** `sku`, `title`, `unitPrice`, `hsnCode` and `gstRate`
  are frozen at placement. Asserted: repricing a variant from ₹100 to ₹500 left
  a placed order at ₹100.
- **Fulfilment and payment are separate fields.** One enum cannot express "paid,
  not yet packed" and "shipped, payment pending" — which is what COD *is*.
- **Transitions are checked.** `ORDER_TRANSITIONS` is a table, not a convention;
  `delivered → pending` and any move out of `cancelled` are refused.
- **A paid invoice is frozen.** Once `paymentStatus` is `paid`, lines and totals
  cannot change. Staff notes still can. Orders can never be deleted at all, by
  anyone, including an administrator.

Stock is **allocated, not consumed**: `onHand` does not move until dispatch, and
availability is `onHand − allocated − reserved`, so the same last unit cannot be
sold twice. Everything writes in one transaction — an order whose lines landed
but whose allocation did not is a sale nobody can fulfil.

`scripts/smoke-orders.ts` — **38 assertions, 0 failures**, including intra-state
CGST+SGST vs inter-state IGST, price-break resolution, the free-shipping
threshold in both directions, oversell refusal naming the true remaining count,
the full state machine, and invoice immutability.

**Not done:** no Razorpay yet, so `paymentStatus` never leaves `pending` on its
own; no `/admin/orders`; the storefront checkout page still writes to
`localStorage` and does not call `placeOrder` yet (it needs task #57 first —
the cart holds demo SKUs that are not in Postgres).

---

### Dev database was WIN1252, not UTF-8 *(5 August 2026)*

Found while an order insert failed on its own timeline entry. `embedded-postgres`
runs `initdb` with no encoding, so on Windows it inherited the system ANSI
codepage. Measured directly:

```
server_encoding = WIN1252
select '₹100.00'::text  →  failed
```

For an India-first catalogue this is not a corner case: WIN1252 has no ₹
(U+20B9), no Devanagari, no Tamil, and no em-dash — a character this codebase's
own product copy is full of. Any of them would have failed at insert, in
production, on a real order.

`infra/db.mjs` now passes `--encoding=UTF8 --locale=C` and prints a loud warning
plus recreate instructions if it finds itself on a cluster that is anything else.
Verified by standing up a scratch UTF-8 cluster on port 5434 (`PGDATA` is now
overridable for exactly this) and running the order suite against it: 38/38.

**Encoding is fixed at initdb time and cannot be altered in place.** The existing
dev cluster still needs recreating — see §0c notes and the warning the script
prints. Catalogue data is regenerated by the seed; staff accounts are not.

---

## 0d. The storefront reads Postgres *(5 August 2026)*

`lib/catalogDb.ts` returns the same `Sku` shape `skus.ts` generated, so the
product card, facet rail, spec table and variant matrix are untouched — only
the source changed. Live on: PLP, PDP, search, sitemap, project pages, and the
three admin screens that were still showing generated rows.

**The browser holds SKU codes; everything attached to them comes from the
server.** Cart, wishlist and BOM import resolve through a server action rather
than a catalogue array shipped to every visitor. Cart and search are tagged
with the query they answered, so a slow response can never overwrite a newer
one.

Three helpers now take their candidate pool as an argument — `buildMatrix`,
`substitutes`, `boughtWith` — instead of fetching it themselves. Against
generated data that cost nothing; against Postgres it was three scans of the
same shelf per page view.

### The seed was naming families after one of their members

`VARIANT_AXES` says a screw family varies by thread × length × material, so 272
variants under one "Hex Socket Head Cap Screw" is **correct** merchandising —
the same shape as a shirt in sizes and colours. What was wrong was the name:
the product took the title of whichever SKU created it first.

| before | after |
|---|---|
| M2 × 4mm Hex Socket Head Cap Screw, SS 304 Series | Hex Socket Head Cap Screw |
| 623ZZ Deep Groove Ball Bearing — ID 3 · OD 10 · W 4 | Deep Groove Ball Bearing |
| NEMA 17 Stepper Motor 1.8° 13Ncm, 20mm body, 5mm shaft | NEMA 17 Stepper Motor 1.8° 13Ncm |

Removal is by **clause**, not by value: deleting 20 and 5 from the stepper left
"…13Ncm body shaft" standing. `scripts/check-family-titles.ts` asserts no family
name still carries a value that varies inside it — 7 clean, 0 leaking — without
re-seeding to find out.

Weights were a flat `weightG: 5` on every variant, right for an M3 screw and
wrong by seventy times for a NEMA 17. Now derived from the part's own dimensions
(π/4·d²·L·density) with a per-drawer fallback: M2 × 4 screw 1 g, 623 bearing
2 g, NEMA 17 280 g. Weight drives the shipping charge, so a constant was not a
harmless placeholder.

**Still generated:** ratings. The database has no reviews, so every product
reads 0.0 (0) where the demo invented a number. Honest, but it should be hidden
rather than shown as a zero.

---

## 1. Pages

| Page | Doc | Status | Notes |
|---|---|---|---|
| Landing | `04` §2 | ✅ | Hero, category bento, scroll-scrubbed search demo, trust band, projects, MoD, reviews |
| Category L1 | `04` §3 | ✅ | Subcategory tiles, "shop by thread/material/bore" facet shortcuts, bestsellers |
| Category L2 | `04` §3 | ✅ | Same template, L3 tiles |
| Category L3 (PLP) | `04` §4 | ✅ | Schema-driven facet rail open by default, dense tiles, parametric table view, sort, URL state |
| Product detail | `04` §5 | ✅ | Variant matrix, price breaks, spec table, cross-listing switcher, substitutes, JSON-LD |
| Search results | `04` §6 | ✅ | Token bar, category rail, inferred facets, relaxation, zero-result → MoD |
| Cart | `04` §7 | ✅ | Live tier resolution, next-tier nudge, free-shipping progress |
| Checkout | `04` §7 | ✅ | 4 blocks, pincode → place of supply, CGST/SGST vs IGST, GSTIN validation |
| Order + GST invoice | `06` §8.2 | ✅ | Per-line HSN, taxable value, tax columns adapt to intra/inter-state |
| Account | `05` | ✅ | Orders, GST invoices, reorder, addresses, GST profile |
| Auth | `08` §7 | 🟡 | UI complete (OTP + password); **mock only** — no server, no real OTP, no session token |
| Make-on-Demand pitch | `04` §8 | ✅ | Capabilities, lead times, process cards |
| RFQ wizard | `04` §8 | ✅ | Upload → specify → contact, NDA flag, process recommender, SLA clock |
| RFQ status portal | `04` §8 | 🟡 | Timeline, request summary, files. Quote panel is a placeholder — needs the admin side |
| Project collections | `01` FR-20 | ⚪ | Linked from home and PDP; `/projects/[slug]` not built |
| Blog / guides | `01` FR-31 | ⚪ | Named as a P0 acquisition channel in `12` §4; no engine, no articles |
| Admin console | `08` §8 | ⚪ | Not started. Catalogue ops, RFQ queue, search tuning all live here |

---

## 2. PRD functional requirements

| ID | Requirement | Status | Notes |
|---|---|---|---|
| FR-1 | 3-level category tree, breadcrumbs, canonical URLs | ✅ | 13 / 86 / 372 nodes, all routing |
| FR-2 | Product in unlimited categories, one primary | ✅ | Verified: M2–M3 fasteners surface under Drones › Drone Screws |
| FR-3 | Instant search overlay (products/categories/projects) | 🟡 | Products + categories. Projects section not wired |
| FR-4 | Attribute token parsing | ✅ | 18-query regression suite passing |
| FR-5 | Category-aware faceting with counts | ✅ | Plus schema inference for cross-listed leaves |
| FR-6 | Variant matrix | ✅ | Dim-don't-hide with reasons, URL follows selection |
| FR-7 | Price breaks applied automatically in cart | ✅ | Re-resolved on every render, never stored on the line |
| FR-8 | Guest + registered checkout, Razorpay, COD | 🟡 | Flow complete; **no payment gateway** |
| FR-9 | GST invoice with HSN | ✅ | Per-line tax, gapless per-FY numbering, intra/inter-state |
| FR-10 | Order tracking with courier AWB | ⚪ | Order status exists; no courier integration |
| FR-11 | RFQ intake with multi-file upload | 🟡 | Full UI incl. validation; files are **not uploaded** anywhere |
| FR-12 | Admin RFQ → Quote → Job pipeline | ⚪ | Not started |
| FR-13 | Admin catalogue CRUD, CSV import, schemas | ⚪ | Not started |
| FR-14 | Scroll-driven landing with reduced-motion fallback | ✅ | `useReducedMotion` via `useSyncExternalStore` |
| FR-15 | BOM upload → cart | ⚪ | Buttons present, disabled |
| FR-16 | Verified-purchase reviews | 🟡 | Ratings shown on tiles/PDP; no review submission or display |
| FR-17 | Wishlist / saved BOMs | ⚪ | Icons present, no behaviour |
| FR-18 | Back-in-stock notifications | ⚪ | |
| FR-19 | Bulk-order enquiry on PDP | ✅ | "Bulk quote 1000+" routes into the RFQ |
| FR-20 | Project/hobby landing pages | 🟡 | Cards on home; target pages missing |
| FR-21 | Product Q&A | ⚪ | |
| FR-22 | Loyalty / credits | ⚪ | Phase 2 by design |
| FR-23 | Instant-quote engine | ⛔ | Phase 2 by design |
| FR-24 | Parametric table view on PLP | ✅ | From `12` §3 (DigiKey) |
| FR-25 | Substitutes when out of stock | ✅ | Matched on the attribute schema |
| FR-26 | Free-shipping threshold + live nudge | ✅ | Header strip, cart progress bar |
| FR-27 | Dispatch promise as a number | ✅ | Tile, PDP and cart |
| FR-28 | Dual imagery (line art + photograph) | 🟡 | `<Frame>` slots and placeholders everywhere; **no real assets** |
| FR-29 | Rules-based process recommender | ✅ | 5 branches verified |
| FR-30 | DFM notes on the quote | ⚪ | Field designed; needs the admin quote tool |
| FR-31 | Buying guides as an acquisition channel | ⚪ | |

**Score: 15 ✅ · 8 🟡 · 12 ⚪ · 2 ⛔**

---

## 3. Search spec (`09`)

| Item | Status |
|---|---|
| Query pipeline: normalise → tokenise → pattern match → synonyms → units → residual | ✅ |
| Token chips, individually removable | ✅ |
| Typo tolerance | 🟡 dictionary-based, not edit-distance |
| Synonyms (allen/hex socket, csk, nyloc, seal codes) | ✅ |
| Unit normalisation (cm → mm) | ✅ |
| Faceting from the category schema | ✅ |
| Zero-result cascade — relax numeric, drop inapplicable, offer MoD | ✅ |
| Ranking: exactness → in-stock → popularity | ✅ |
| **Meilisearch** | ⚪ in-memory scan over ~900 SKUs |
| Instant p95 < 120 ms | 🟡 fast locally; untested at 50k SKUs |
| Federated overlay + full results page sharing one parser | ✅ |
| 40-query regression suite | 🟡 18 of 40 run manually; not in CI |

---

## 4. Design system (`03` v2)

| Item | Status |
|---|---|
| Light theme only, dark removed | ✅ |
| Turquoise as fill / `--tq-700` as text | ✅ |
| Contrast audit — all AA+ | ✅ |
| Type scale, Space Grotesk / Inter / JetBrains Mono | ✅ |
| Ratio-locked `<Frame>` with designed placeholders | ✅ |
| Motion below the fold, reduced-motion parity | ✅ |
| Bento layout, density | ✅ |
| Real photography, CAD line art | ⚪ **the biggest visual gap** |
| Custom 13-category icon set | ✅ |

---

## 5. Backend (`06`, `07`, `08`) — the honest picture

**Nothing in these three documents is built.** No NestJS app, no PostgreSQL, no Prisma, no Redis, no Meilisearch, no BullMQ, no S3, no Razorpay, no Shiprocket.

What exists instead, deliberately shaped to be swappable:

| Doc concept | Prototype stand-in |
|---|---|
| `products` / `variants` / `attribute_values` | `lib/skus.ts` — generated, same typed-attribute shape |
| `categories` + `attribute_definitions` | `lib/catalog.ts` + `lib/taxonomy.ts` with schema inference |
| Cart / orders / sessions API | `lib/store.ts` — `useSyncExternalStore` over `localStorage` |
| GST engine (`06` §8.2) | `lib/gst.ts` — **fully implemented and correct** |
| Price-break resolution | `lib/cartMath.ts` — shared by cart, checkout and invoice |
| RFQ tables (`07` §5) | `lib/mod.ts` + store |
| Meilisearch | `lib/searchSkus.ts` in-memory |

The GST engine is the one piece written to production standard, because tax rules do not change when a database appears.

---

## 6. What I'd do next, in order

1. **Backend Phase 0** — Postgres + Prisma schema from `07`, NestJS skeleton, real auth. Everything else is blocked behind this.
2. **Catalogue seeding** — 367 of 372 leaves are empty. This is the single largest gap between the prototype and a shippable store, and it's a data job, not an engineering one.
3. **Meilisearch** — swap `searchSkus` for the real index; put the 40-query suite in CI.
4. **Admin console** — without it, catalogue ops and the RFQ queue can't function, so MoD can't actually run.
5. **Imagery** — hero render plus the first category photographs. Every slot is waiting.
6. **Payments + shipping** — Razorpay and a courier; both need business onboarding started in parallel.
7. **The gap-fillers** — project pages, guides engine, BOM import, reviews, wishlist.

---

## 7. Risk check against `01` §12

| Risk | Now |
|---|---|
| Catalogue data quality | **Materialised.** 5 seeded leaves. Confirms it is the critical path |
| Scroll animation hurting mobile performance | Contained — CSS-driven, reduced-motion parity, no canvas on the landing page |
| Meilisearch ops burden | Deferred — the interface is isolated in one module |
| Working capital across 13 categories | Unchanged, a business decision |
| MoD manual quoting not scaling | Unchanged; the SLA clock and structured cost fields are in place to measure it |

**One risk the docs did not name, now visible:** the prototype's search runs a linear scan over every SKU. That is invisible at 900 records and fatal at 50,000 — a reminder that the Meilisearch swap is a launch blocker, not a nice-to-have.
