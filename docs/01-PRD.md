# OnlyParts — Product Requirements Document

**Version:** 1.0
**Date:** 28 July 2026
**Owner:** Founding team
**Status:** Draft for build
**Domain:** `onlyparts.<tld>` (registered via Hostinger)

---

## 1. Summary

OnlyParts is an India-first online retail store for **hardware, mechanical and electronic parts** — the physical building blocks that makers, engineers, repair shops, startups and small factories need to build things.

Two businesses under one roof:

| Line | What it is | Revenue model |
|---|---|---|
| **OnlyParts Retail** | Catalog commerce. 13 top-level categories, 3 levels deep, no minimum order quantity. Buy 4 screws or 4,000. | Product margin |
| **OnlyParts Make** | Make-on-Demand. Upload a drawing or BOM, get a quote, we manufacture or source it. Prototype to mass production. | Job margin + sourcing fee |

The competitive set is Robu.in (electronics, broad but slow and cluttered), OnlyScrews.in (fasteners, narrow, stock Shopify Dawn theme), Zbotic, Quartz Components, and the offline Lamington Road / SP Road / Ritchie Street ecosystem.

**The wedge:** nobody in India sells *all* of these categories in one cart with a search box that actually understands `M3x10 SS304 socket head` or `18650 3000mAh 10A`. Buyers today split one project's BOM across 3–5 sites and pay shipping 3–5 times.

---

## 2. Problem statement

A maker building a drone needs: a brushless motor, an ESC, a LiPo, M2.5 socket-head screws, 608 bearings, carbon rod, heat-shrink, and a soldering tip. Today that is:

1. Four different sites, four checkouts, four shipping fees, four delivery dates.
2. Search boxes that fail on the only strings that matter. Searching `m3x8` on most Indian parts sites returns nothing, or returns 400 unranked results, because the SKU attributes live in the title string and the search is a naive SQL `LIKE`.
3. Category trees that are either two levels deep and useless, or twelve levels deep and unnavigable.
4. Product pages missing the *one* spec that decides the purchase — thread pitch, KV rating, C-rating, bore diameter, pull force.
5. No path from "I need 10" to "I need 10,000" without a phone call.

## 3. Goals and non-goals

### Goals (v1)

| # | Goal | Success measure |
|---|---|---|
| G1 | A landing page that communicates breadth in under 5 seconds | Bounce rate < 45%; scroll-depth past hero > 70% |
| G2 | Search that resolves engineering strings | Zero-result rate < 3%; search→PDP CTR > 40%; p95 latency < 120 ms |
| G3 | Three-level taxonomy, products in many categories | Every SKU reachable from ≥ 1 path; ≥ 20% of SKUs in ≥ 2 trees |
| G4 | No-MOQ retail checkout | Checkout completion > 55% |
| G5 | Make-on-Demand RFQ intake with quote turnaround | ≥ 30 qualified RFQs/month by month 6; median quote < 24 business hours |
| G6 | Faster and better-looking than every competitor | LCP < 2.0 s on 4G; Lighthouse perf ≥ 90 |

### Non-goals (v1)

- Marketplace / third-party sellers. OnlyParts is first-party inventory only.
- International shipping and multi-currency. India + INR only.
- Native mobile apps. Responsive PWA.
- Instant automated quoting for Make-on-Demand (geometry analysis) — that is Phase 2.
- Subscriptions / auto-replenishment — Phase 2.
- User-generated content beyond verified-purchase reviews and Q&A.

---

## 4. Users and personas

### P1 — Arjun, the hobbyist maker (highest volume, lowest AOV)
Engineering student or weekend builder. Basket ₹400–₹2,500. Buys 8–20 distinct line items at once for a single project. Extremely price- and shipping-fee sensitive. Wants: no MOQ, assorted kits, "buy the whole project" bundles, clear photos with a coin or ruler for scale.
**Kills the sale:** MOQ of 100, ₹99 shipping on a ₹200 order, no stock indicator.

### P2 — Priya, the hardware startup engineer (core revenue)
Building a product at a 5–50 person company. Basket ₹3,000–₹40,000. Needs *exact* specs, datasheets, RoHS/compliance docs, and a GST invoice. Buys the same BOM repeatedly as revisions ship.
**Kills the sale:** missing datasheet, no GST invoice, no reorder, no lead-time visibility.

### P3 — Ramesh, the MSME / job-shop buyer (highest AOV)
Buys for a small factory or repair business. Basket ₹15,000–₹3,00,000. Wants bulk price breaks, a quote he can put in front of his boss, credit terms, and a named human on WhatsApp.
**Kills the sale:** no tiered pricing visible, no quote PDF, no phone number.

### P4 — Neha, the procurement lead sourcing custom parts (Make-on-Demand)
Has a drawing, needs 500 parts. Doesn't want to call 12 vendors. Wants: upload → spec → quote → PO → delivery, with status visible.
**Kills the sale:** a `mailto:` link instead of a real intake form.

### P5 — Internal: catalog ops
Has to onboard 20,000+ SKUs with clean attributes. Needs bulk CSV import, attribute templates per category, image pipelines, and a way to fix a spec across 400 SKUs at once. **If the admin tooling is bad, the catalog is bad, and if the catalog is bad, search is bad.** This persona is the hidden dependency for G2 and G3.

---

## 5. Product scope

### 5.1 Landing page (see `04-WIREFRAMES.md` §2)

A single scroll-driven narrative, not a template grid. Sections in order:

1. **Hero** — full-viewport. Headline, the search bar as the hero's centre of gravity, and an animated exploded-assembly / parts-field background. Turquoise on near-black.
2. **Category constellation** — the 13 categories revealed on scroll, each snapping in with its own motion.
3. **Search-is-the-product demo** — a live, interactive strip showing `M3x10` resolving into faceted results as the user scrolls past.
4. **No MOQ / Fast ship / GST invoice** trust band.
5. **Shop by project** — Drone, 3D Printer, Robot, EV, CNC, Repair Bench. Cross-cutting entry points that map to the many-to-many category model.
6. **Make-on-Demand** — the manufacturing pitch, with the RFQ CTA.
7. **Social proof** — reviews, logos, order count.
8. **Footer** — full category sitemap (also the SEO surface).

Motion spec, easing curves, and reduced-motion behaviour: `03-DESIGN-SYSTEM.md` §7.

### 5.2 Category system

13 top-level categories, up to 3 levels (Category → Subcategory → Sub-subcategory). **Products belong to many categories.** A LiPo battery is under *Battery* and under *Drone & Parts*. A stepper motor is under *Motors*, *3D Printer & Parts*, and *CNC & Parts*.

Full tree with all sub and sub-sub nodes: **`02-TAXONOMY.md`**.

Top level:

| # | Category | Notes |
|---|---|---|
| 1 | Fasteners | Seeded from the first two rows of OnlyScrews' category grid |
| 2 | Motors | BLDC, stepper, servo, geared DC, drivers |
| 3 | Electronic Components | Largest tree; passives, semis, dev boards, sensors |
| 4 | Batteries & Power | Cells, packs, BMS, chargers, SMPS |
| 5 | 3D Printers & Parts | Printers, hotends, filament, motion |
| 6 | Drones & Parts | Frames, FC/ESC, props, FPV, RC |
| 7 | Tools | Hand, power, soldering, measuring, safety |
| 8 | Bearings | Ball, roller, linear, bushings |
| 9 | Magnets | Neodymium, ferrite, assemblies |
| 10 | CNC Machines & Parts | Machines, spindles, motion, tooling |
| 11 | Industrial Electricals | Contactors, VFDs, switchgear, panel |
| 12 | EV Parts | Hub motors, controllers, BMS, chargers, kits |
| 13 | Hardware | Extrusion, brackets, couplings, springs, seals |

### 5.3 Search (the make-or-break feature)

Detailed spec in **`09-SEARCH-SPEC.md`**. Requirements at PRD level:

- **Instant** — results render as-you-type from keystroke 2, p95 < 120 ms.
- **Attribute-aware** — `M3x10` parses to `{thread: M3, length: 10mm}` and filters, not just matches text. Same for `608zz`, `18650`, `2200kv`, `SS304`, `0805 10k`.
- **Typo tolerant** — `neodimium`, `bering`, `stepr motor` all resolve.
- **Synonym-aware** — allen = hex socket = inbus; csk = countersunk = flat head; jumper wire = dupont.
- **Faceted** — every result set is filterable on the attributes that matter for *that* category (thread ⨯ length ⨯ material ⨯ head for fasteners; ID ⨯ OD ⨯ width ⨯ seal for bearings).
- **Federated dropdown** — the overlay returns Products, Categories, and Projects in one panel.
- **Zero-result recovery** — never a dead end; always widen to nearest facet and say what was relaxed.

### 5.4 Product pages

- Spec table driven by the category's attribute schema, not free text.
- Variant matrix (a screw's length/material picker must not be 60 separate SKUs in the dropdown).
- Quantity price breaks visible on the page (1–9 / 10–99 / 100–999 / 1000+).
- Live stock: In stock (n) / Low / Made to order (lead time) / Notify me.
- Datasheet / drawing / STEP file downloads.
- "Used in these projects" and "Frequently bought with" — the many-to-many graph paying off.

### 5.5 Cart, checkout, orders

- Guest checkout; account optional until payment.
- GSTIN capture for B2B invoices.
- Razorpay (UPI, cards, netbanking, wallets) + COD with limits.
- Shipping: rate-by-weight/zone via Shiprocket or Delhivery, free above a threshold.
- BOM upload → cart. Paste or upload a CSV/BOM and we match lines to SKUs, flag misses. This is a direct steal of Robu's BOM tool, done better.
- Reorder from any past order in one click.

### 5.6 Make-on-Demand (v1 = RFQ, not instant quote)

Flow: **Upload → Specify → Submit → Quote → Approve → Track**

- Accepts STEP, STL, IGES, DXF, DWG, PDF drawings, and BOM spreadsheets. Max 100 MB/file, 20 files/RFQ.
- Process selection: CNC machining, 3D printing (FDM/SLA/SLS), sheet metal, injection moulding, PCB assembly, wire harness, laser cutting, custom sourcing.
- Material, finish, tolerance class, quantity, target date, target price (optional).
- Optional NDA checkbox — gates the file from the public admin view and logs access.
- Admin console: RFQ queue → assign → cost sheet → quote PDF → send → customer approves in portal → converts to a Job with milestones.
- SLA displayed: first response 4 business hours, quote in 24.

**Explicitly out of v1:** automatic mesh analysis, instant price. The quote is produced by a human using a cost-sheet tool. Designing for the automated path is in `06-BACKEND-ARCHITECTURE.md` §9 so the schema doesn't have to change later.

### 5.7 Admin / catalog ops

- Category-scoped attribute schemas (define once for "Ball Bearings", every SKU inherits ID/OD/width/seal/material fields).
- CSV bulk import + bulk edit with dry-run diff preview.
- Image pipeline: upload once, auto-generate AVIF/WebP at 5 sizes.
- Inventory adjustments with audit trail.
- Price-break tables per SKU or per family.
- Search-tuning UI: synonyms, pinned results, and a zero-results report that becomes the catalog backlog.

---

## 6. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Browse 3-level category tree with breadcrumbs and canonical URLs | P0 |
| FR-2 | A product can be assigned to unlimited categories; one is primary (canonical) | P0 |
| FR-3 | Instant search overlay with product/category/project results | P0 |
| FR-4 | Attribute token parsing on the query string | P0 |
| FR-5 | Category-aware faceted filtering with counts | P0 |
| FR-6 | Product variants with an attribute matrix picker | P0 |
| FR-7 | Quantity price breaks, applied automatically in cart | P0 |
| FR-8 | Guest + registered checkout, Razorpay, COD | P0 |
| FR-9 | GST-compliant invoice generation with HSN codes | P0 |
| FR-10 | Order tracking with courier AWB integration | P0 |
| FR-11 | Make-on-Demand RFQ intake with multi-file upload | P0 |
| FR-12 | Admin RFQ→Quote→Job pipeline | P0 |
| FR-13 | Admin catalog CRUD, CSV import, attribute schemas | P0 |
| FR-14 | Scroll-driven landing animation with `prefers-reduced-motion` fallback | P0 |
| FR-15 | BOM upload → cart matching | P1 |
| FR-16 | Verified-purchase reviews with photos | P1 |
| FR-17 | Wishlist / saved BOMs | P1 |
| FR-18 | Back-in-stock notifications | P1 |
| FR-19 | Bulk-order enquiry form on PDP (below a qty threshold trigger) | P1 |
| FR-20 | Project/hobby landing pages (Drone, 3D Printing, EV, CNC...) | P1 |
| FR-21 | Product Q&A | P2 |
| FR-22 | Loyalty / credits | P2 |
| FR-23 | Instant-quote engine for MoD | P2 |

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | LCP < 2.0 s, INP < 200 ms, CLS < 0.1 on a mid-range Android over 4G. Search p95 < 120 ms. |
| Availability | 99.9% monthly for storefront; checkout is the highest-priority path. |
| Scale target | 50k SKUs, 200k monthly sessions, 500 orders/day peak — v1 must not architecturally block this. |
| SEO | SSR/ISR for all catalog pages, Product + BreadcrumbList + Organization JSON-LD, XML sitemaps per category. |
| Accessibility | WCAG 2.2 AA. Turquoise on dark must be verified for contrast — see design system §2.3. |
| Security | OWASP Top 10. PCI scope minimised — card data never touches our servers (Razorpay hosted). RFQ files encrypted at rest, signed short-lived URLs. |
| Compliance | Indian GST (CGST/SGST/IGST by state), HSN codes per SKU, e-invoice ready, DPDP Act consent + data-deletion flow. |
| Browser support | Last 2 versions Chrome/Edge/Safari/Firefox, iOS 16+, Android Chrome. |
| i18n | English v1; copy externalised so Hindi/Tamil can be added without refactor. |

---

## 8. Key product decisions

| Decision | Choice | Why |
|---|---|---|
| Build vs Shopify | Custom Next.js + Postgres | Shopify caps at 3 levels awkwardly, its faceting is weak for engineering attributes, and the MoD pipeline has no Shopify analogue. Search quality is the whole product thesis and we cannot outsource it. |
| Search engine | Meilisearch (self-hosted) | Sub-50 ms, typo tolerance and synonyms out of the box, free. Algolia's pricing punishes exactly our high-search-per-session pattern. Typesense is a valid swap — see `09-SEARCH-SPEC.md` §8. |
| Taxonomy depth | Exactly 3 levels, enforced | 3 is enough for every category here; unlimited depth produces unnavigable trees and ambiguous canonicals. |
| Product↔Category | Many-to-many with one primary | Required by the brief; the primary flag resolves canonical URL and breadcrumb ambiguity. |
| Attributes | Typed, per-category schemas | Free-text specs are why competitor search is bad. Attributes must be structured at ingest or facets are impossible. |
| Variants | Product → Variant, variants carry the axis attributes | A single "M3 Socket Head SS304" product with a length axis beats 40 orphan SKUs for SEO and UX. |
| MoD v1 | Human quoting | Instant quoting needs geometry analysis and a costed supply chain we don't have yet. Ship the funnel, learn the pricing, automate later. |
| Payments | Razorpay | Best UPI coverage in India, straightforward GST invoicing, hosted checkout keeps us out of PCI scope. |

## 9. Competitive positioning

| | Robu.in | OnlyScrews.in | **OnlyParts** |
|---|---|---|---|
| Breadth | Electronics/robotics deep, mechanical thin | Fasteners only + adjacent | All 13, one cart |
| Platform | WooCommerce, slow | Shopify Dawn, template | Custom Next.js, fast |
| Search | Keyword, weak facets | Shopify default | Attribute-parsing, faceted, instant |
| Taxonomy | Deep but noisy | Flat grid | 3 levels, cross-listed |
| MOQ | Mostly none | None | None |
| Custom manufacturing | Bulk enquiry form | Bulk enquiry form | Full RFQ→Quote→Job pipeline |
| Visual design | Dated | Stock theme | Scroll-driven, distinct |

The honest read on OnlyScrews: it is a stock Shopify Dawn theme (`Assistant` typeface, default section layout, a 33-tile category grid with "Click here" under every tile). Its *merchandising* is strong — no-MOQ, assorted kits, hobby entry points, 1,120 reviews — and we should copy that thinking outright. Its *interface* is a low bar to clear.

## 10. Success metrics

**North star:** weekly active BOMs fulfilled — distinct orders containing ≥ 3 line items from ≥ 2 top-level categories. It measures the one-cart thesis directly.

| Metric | Launch target | Month 6 |
|---|---|---|
| Zero-result search rate | < 5% | < 2% |
| Search → add-to-cart | 12% | 20% |
| Cross-category orders | 25% | 45% |
| Checkout completion | 50% | 60% |
| Repeat rate (90-day) | — | 35% |
| MoD RFQs / month | 10 | 30 |
| MoD RFQ → won job | 15% | 25% |
| AOV | ₹1,800 | ₹2,600 |
| LCP p75 | < 2.5 s | < 2.0 s |

## 11. Release plan

| Phase | Scope | Duration |
|---|---|---|
| **0 — Foundation** | Repo, design system, DB schema, auth, admin skeleton, catalog ingest for 2 pilot categories | 3 wks |
| **1 — Catalog & search** | Full 13-category tree, Meilisearch, PLP/PDP, facets, instant overlay | 4 wks |
| **2 — Commerce** | Cart, checkout, Razorpay, GST invoicing, shipping, order tracking, emails | 4 wks |
| **3 — Landing & brand** | Scroll-driven landing page, project pages, SEO, content | 3 wks |
| **4 — Make-on-Demand** | RFQ intake, file storage, admin quote pipeline, customer portal | 3 wks |
| **5 — Launch hardening** | Load test, a11y audit, security review, catalog QA of 10k+ SKUs | 2 wks |

~19 weeks to public launch. Full breakdown in `11-ROADMAP.md`.

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Catalog data quality** — 50k SKUs with sloppy attributes makes search bad no matter how good the engine is | Kills G2, the core thesis | Attribute schemas enforced at import; dry-run validation; launch with 8k *excellent* SKUs, not 40k mediocre ones |
| Inventory accuracy across 13 categories | Oversells, refunds, reviews | Single source of truth in Postgres, reserved-stock on cart, daily cycle counts |
| Working capital across 13 categories | Cash death | Dropship/JIT the long tail; stock only the top 20% by velocity |
| Scroll animation hurts mobile performance | Fails G6 and G1 simultaneously | Motion is CSS-driven and progressively enhanced; hard budget of 60 KB JS for the landing page; test on a real ₹12k Android |
| MoD manual quoting doesn't scale | Founder time sink | Hard SLA + templated cost sheets; instrument for Phase 2 automation from day one |
| Meilisearch ops burden | Search downtime = site down | Managed instance or a supervised container with a Postgres full-text fallback path |
| Razorpay / courier API downtime | Lost orders | Queue and retry; COD fallback; status page |

## 13. Open questions

1. Exact domain and TLD registered at Hostinger — `.in`, `.com`, or both?
2. Do we launch with owned inventory, dropship, or a hybrid? This changes the lead-time model on every PDP.
3. Which categories get real stock at launch vs made-to-order?
4. Is there an existing supplier network for Make-on-Demand, or does that need building?
5. GSTIN, business entity, and current-account status — needed before Razorpay onboarding.
6. Warehouse location(s) — drives zone-based shipping rates.
7. Do we need credit terms (30/45-day) for P3/MSME buyers at launch?

---

**Next documents:** `02-TAXONOMY.md` → `03-DESIGN-SYSTEM.md` → `04-WIREFRAMES.md` → `05-FRONTEND-ARCHITECTURE.md` → `06-BACKEND-ARCHITECTURE.md` → `07-DATA-MODEL.md` → `08-API-SPEC.md` → `09-SEARCH-SPEC.md` → `10-INFRA-DEVOPS.md` → `11-ROADMAP.md`
