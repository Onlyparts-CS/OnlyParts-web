# OnlyParts

India-first online retail for hardware, mechanical and electronic parts — plus **Make-on-Demand**, where a customer uploads a drawing or BOM and we manufacture or source it.

Two businesses, one site:

| | |
|---|---|
| **OnlyParts Retail** | 13 categories, 3 levels deep, no minimum order. Buy 4 screws or 4,000. |
| **OnlyParts Make** | Upload STEP/STL/DXF/BOM → quote in 24 h → production → delivery. |

Brand colour: **turquoise `#40E0D0`** on near-black.

---

## Documentation

Read in order — each builds on the last.

| # | Document | What's in it |
|---|---|---|
| 01 | [PRD](docs/01-PRD.md) | Vision, personas, scope, functional/non-functional requirements, metrics, competitive positioning, risks |
| 02 | [Taxonomy](docs/02-TAXONOMY.md) | All 13 categories with every L2 and L3 node, the many-to-many cross-listing model, seeding plan |
| 03 | [Design System](docs/03-DESIGN-SYSTEM.md) | Colour ramps with a full WCAG contrast audit, type scale, components, motion spec, tokens |
| 04 | [Layouts & Wireframes](docs/04-WIREFRAMES.md) | Header, mega menu, the 7-beat landing narrative, PLP, PDP, cart, MoD flow, responsive rules |
| 05 | [Frontend Architecture](docs/05-FRONTEND-ARCHITECTURE.md) | Next.js 15 App Router, rendering strategy per route, cart engine, performance budgets, SEO |
| 06 | [Backend Architecture](docs/06-BACKEND-ARCHITECTURE.md) | NestJS modular monolith, checkout flow, GST engine, MoD pipeline, caching, jobs, security |
| 07 | [Data Model](docs/07-DATA-MODEL.md) | Full PostgreSQL schema, ERD, typed attribute system, inventory ledger, retention policy |
| 08 | [API Specification](docs/08-API-SPEC.md) | Every endpoint, error codes, idempotency, admin surface, webhooks |
| 09 | [Search Specification](docs/09-SEARCH-SPEC.md) | The query parser, Meilisearch index design, synonyms, facets, zero-result recovery, test corpus |
| 10 | [Infrastructure & DevOps](docs/10-INFRA-DEVOPS.md) | Hosting topology from the Hostinger domain, CI/CD, cost model, launch checklist |
| 11 | [Roadmap](docs/11-ROADMAP.md) | 19-week phased plan with exit criteria per phase |
| 12 | [Competitive Research](docs/12-COMPETITIVE-RESEARCH.md) | McMaster/DigiKey/Misumi teardown, Indian competitor landscape, Xometry vs our RFQ, open-source platform evaluation, and the 8 new requirements it generated |
| 13 | [**Build Status**](docs/13-STATUS.md) | Requirement-by-requirement audit of what's built vs. what the docs specify, and the ordered list of what's next |
| 14 | [Admin & Catalogue Ops](docs/14-ADMIN-CATALOG-OPS.md) | **How 50,000 products actually get in** — supplier feeds, bulk import, duplicate-and-vary, and the queues the admin works daily |
| 15 | [Scale & Performance](docs/15-SCALE-PERFORMANCE.md) | **How 50,000+ SKUs stay fast live** — ISR caching, PostgreSQL index strategy (B-tree/GIN/GiST/ltree/partial), planner tuning, AWS ap-south-1 |
| 16 | [DPDP Compliance](docs/16-DPDP-COMPLIANCE.md) | India's DPDP Act 2023 — ₹250 crore exposure, encryption, RBAC, breach 72-hour clock, retention schedule |
| 17 | [**Frontend Complete**](docs/17-FRONTEND-COMPLETE.md) | Route inventory, the demo-data gate and how it's verified, navigation completeness, the end-to-end journey, and §7 the nine review defects with before/after measurements |

## ⚠️ Demo data

The app ships with a generated catalogue (~1,172 SKUs) so the UI can be reviewed
before a database exists. It is **opt-in and off by default**:

```bash
NEXT_PUBLIC_DEMO_DATA=on   # local only — see apps/web/.env.local
```

With the flag off — which is what any deployment gets — `allSkus()` returns
empty, every surface falls to an honest "Coming soon" state, and no invented
price, stock level or SKU count is rendered anywhere. Because `NEXT_PUBLIC_`
values are inlined at build time, **a production build physically cannot contain
demo data**. When the flag is on, a warning strip sits above the header on every
page. Verified against a real production build — see
[17-FRONTEND-COMPLETE.md](docs/17-FRONTEND-COMPLETE.md) §2.

## The application (`apps/web`)

The real build. Next.js 16 · React 19 · TypeScript · Tailwind v4. **Light theme only** — see `12-COMPETITIVE-RESEARCH.md` §8 for why.

```bash
npm run dev --prefix apps/web
```

Then open **http://localhost:3000**.

| Page | Status |
|---|---|
| Home | ✅ hero with a live parse panel wired to the real search field, category bento, trust band, projects, Make-on-Demand, reviews |
| Category L1/L2 landing | ✅ subcategory tiles, "shop by thread/material/bore" facet shortcuts, bestsellers |
| Category L3 listing (PLP) | ✅ schema-driven facet rail (open by default), dense tiles, parametric table view, sort, URL state, zero-result recovery |
| Product detail | ✅ variant matrix, price-break table, spec table, cross-listing switcher, substitutes, JSON-LD |
| Search results page | ✅ parsed-token bar, category rail, inferred facets, relaxation, zero-result → MoD |
| Cart | ✅ live price-break resolution, next-tier nudge, free-shipping progress |
| Checkout | ✅ 4 blocks, pincode → place of supply, per-line CGST/SGST vs IGST, GSTIN validation |
| GST invoice | ✅ HSN per line, taxable value, tax columns adapt to intra/inter-state, gapless FY numbering |
| Auth & account | ✅ mock OTP/password sign-in, orders, GST invoices, addresses, reorder |
| Make-on-Demand | ✅ pitch page, 3-step RFQ wizard with process recommender + NDA, status portal |
| Project pages | ✅ 6 build guides, categories spanned, curated picks |
| Guides & policies | ✅ 6 guides, 5 policies, About, Contact, FAQ, Bulk orders, Track |
| Admin console | ✅ overview, product table, bulk import with dry-run diff, work queues |
| 404 / error / loading / sitemap / robots | ✅ |
| **Backend + connectivity** | ⏳ next — Payload CMS 3.0 + PostgreSQL |

**Pages worth opening:**

- `/c` — all 13 categories
- `/c/fasteners` — L1 landing with facet shortcuts
- `/c/fasteners/screws-by-head/socket-head-cap` — 272 SKUs, full facet rail
- `…/socket-head-cap?thread=M3&material=SS%20304&length_mm=6-20` — filters as shareable URL state
- `/c/bearings/ball-bearings/deep-groove?view=table&sort=price_asc` — parametric table view
- `/c/drones-parts/drone-hardware/drone-screws` — **cross-listing**: 284 fasteners surfacing under Drones, with an inferred facet schema
- `/c/tools/hand-tools/pliers` — an unseeded leaf's empty state
- `/p/fs-shc-m3-010-ss304` — PDP: 3-axis variant matrix, live price breaks, spec table, cross-listing switcher
- `/p/fs-shc-m3-004-ss304` — **out-of-stock rescue**: disabled CTA, made-to-order lead time, and in-stock substitutes matched on the attribute schema
- `/p/br-6202-2rs-cs` — a bearing PDP (different axes: code / seal / material)
- `/p/mg-n52-15x3` — a magnet PDP (grade / diameter / thickness)
- `/search?q=m3x10 ss304 socket` — parsed-token bar, category rail, inferred facets
- `/search?q=608zz` · `?q=6202rs` — bearing codes with seal shorthand
- `/search?q=m3x7` — relaxation to the nearest stocked length
- `/search?q=neodymium disc 15mm` — a token that doesn't apply is dropped, not fatal
- `/search?q=zzzqqq` — the zero-result state that routes to Make-on-Demand
- `/cart` → `/checkout` → `/orders/…` — the full money path. Add a few hundred screws to see price breaks apply, then set the delivery state to Karnataka (CGST+SGST) vs anywhere else (IGST) and watch the tax split change
- `/register` · `/login` · `/account` — mock session, orders with GST invoices, saved addresses, reorder
- `/make` → `/make/rfq` → `/rfqs/…` — Make-on-Demand: process recommender, NDA flag, SLA clock
- **`/admin`** — catalogue overview and work queues
- **`/admin/import`** — bulk CSV import. Click *Try the sample file* to see the dry-run diff: per-field before→after, validation errors, and the guard rail that blocks any run touching more than 50% of the catalogue
- **`/admin/products`** — 1,172 SKUs, searchable by SKU, title or any attribute value (`m3 12.9`), bulk select
- **`/admin/queues`** — the 369 empty leaf categories ranked by planned SKU count

> **Prototype boundaries.** Cart, session and orders live in `localStorage`; there
> is no server, no stock reservation and no payment. The **GST engine is real** —
> per-line tax, place-of-supply routing, gapless per-FY invoice numbering — because
> that is the part worth getting right before there's a backend to attach it to.

### Adding real imagery

Every image slot is a `<Frame>` with a designed placeholder, so the layout is
already correct. To drop in real assets: put the file in `apps/web/public/` and
pass `src="/your-file.png"` — nothing else changes.

- Hero visual: `src/components/home/Hero.tsx` → the `<Frame ratio="4/3" …>` (1600×1200)
- Category tiles: `src/components/home/CategoryBento.tsx` → wide tiles use 4:3
- Project cards: `src/components/home/ProjectRail.tsx` → 3:2

## Design prototype (`prototype/`)

The original dependency-free sketch, kept for reference. **Superseded by `apps/web`** — it still carries the dark theme and the older hero. Use it only to compare directions.

```bash
node prototype/serve.js
```

Then open **http://localhost:5173**.

### What to try

| Action | What it demonstrates |
|---|---|
| Press `Ctrl+K` (or `/`) | The instant-search overlay |
| Type `m3x10 ss304 sockte` | Attribute parsing into removable chips + typo tolerance (`sockte` → `socket`) |
| Type `m3x7 ss304` | **Zero-result recovery** — relaxes length to the nearest stocked values instead of dead-ending |
| Type `608zz`, `nema17`, `18650 3000mah`, `n52 15x3`, `0805 10k` | Bearing codes, motor frames, cell formats, magnet dimensions, SMD packages |
| Scroll past the hero | The parts field converges toward centre — "assembly" |
| Watch the hero without touching anything | The search field types itself through six queries; the panel beside it parses each one into tokens live, and the placeholder render follows the match |
| Open an order and hit **Print invoice** | Site chrome drops away, the sheet prints A4 with every tax column on the page |
| Hover a top-level category in the nav | Three-panel mega menu with live L3 counts |
| Click the sun/moon in the header | Light theme — note turquoise drops to `--tq-600` for text contrast |
| Enable OS "reduce motion" and reload | Every animation stops; **no information is lost** |

### Files

```
prototype/
├─ index.html    structure
├─ styles.css    the design system as CSS custom properties
├─ data.js       13 categories + ~45 product documents (Meilisearch doc shape)
├─ app.js        query parser, search, overlay, canvas, scroll choreography
└─ serve.js      zero-dependency static server
```

> The prototype is a **design and interaction reference**, not production code. It has no build step, no backend, and its search runs over an in-memory array. The parser logic in `app.js` mirrors what `packages/search` should implement against Meilisearch — see [09-SEARCH-SPEC.md](docs/09-SEARCH-SPEC.md) §2.

---

## The three decisions everything else follows from

1. **Search is the product.** The competitive gap isn't catalogue size, it's that typing `m3x10` into any Indian parts store returns nothing. Every architectural choice — typed attributes instead of a JSON blob, Meilisearch queried directly from the browser, the query parser shared across client/server/BOM-matcher — exists to serve a p95 under 120 ms and a zero-result rate under 2%.

2. **Products live in many categories.** A NEMA 17 stepper belongs under Motors, 3D Printing *and* CNC. Cross-listing is the defence against "I had to visit four sites", and it's an SEO asset. One assignment per product is `is_primary` and resolves the canonical URL.

3. **Catalogue quality gates launch, not catalogue size.** 12,000 SKUs with complete attributes, three photographs and price breaks beats 40,000 mediocre ones — because search quality is downstream of attribute quality, and attribute quality is a full-time job.

## Open questions

Listed in full at [01-PRD.md §13](docs/01-PRD.md). The ones that block work:

- Exact domain/TLD registered at Hostinger (`.in`, `.com`, or both)
- Owned inventory vs dropship vs hybrid — this sets the lead-time model on every product page
- Whether an MoD supplier network exists or needs building
- GSTIN / entity / current account status — **start Razorpay KYC in week 1**, it is the longest lead-time item on the roadmap and engineering cannot unblock it
