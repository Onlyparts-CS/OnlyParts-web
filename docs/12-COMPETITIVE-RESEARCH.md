# OnlyParts — Competitive & Platform Research

**Version:** 1.0 · **Date:** 29 July 2026
Supersedes the two-site comparison in `01-PRD.md` §9. Findings here are folded back into the PRD, design system and search spec.

---

## 1. Who we actually looked at

| Tier | Sites | Why they matter |
|---|---|---|
| **Global gold standard** | McMaster-Carr, DigiKey, Mouser, Misumi, RS Components, Grainger, Accu | These solved parts-search a decade ago. Everything we want to do, one of them already does well |
| **Indian direct competitors** | Robu.in, Zbotic, Quartz Components, Evelta, ThinkRobotics, ElectronicsComp, Sunrom, OnlyScrews.in | Our actual market, our actual price points, our actual logistics constraints |
| **Make-on-Demand** | Xometry, Protolabs, Fictiv, Hubs, RapidDirect | The RFQ→quote→job pipeline we are building in v1 |
| **Open-source commerce** | Medusa, Saleor, Vendure, Bagisto, Spree, Sylius, Solidus | What we could adopt instead of building from scratch |

---

## 2. McMaster-Carr — the single most important reference

`mcmaster.com` is repeatedly named the best e-commerce site on the internet by engineers, and it is worth being precise about *why*, because the reasons are copyable and none of them are visual flourish.

| What McMaster does | Why it works | What we take |
|---|---|---|
| **Filter-first, not search-first.** Landing on a category immediately presents the attribute filters that define the part | Engineers don't know the product name; they know the dimensions | Our facet rail must render **above the fold on the PLP**, not behind a "Filters" button |
| **Every product is a spec, not a story.** No brands, no marketing copy, no lifestyle photography | Everything is quantitatively legible, so filtering is total | Our attribute schemas (`07-DATA-MODEL.md` §2.4) are the same bet. Reinforces: no free-text specs, ever |
| **Line-drawing product illustrations, not photographs** | A technical drawing with dimension callouts communicates more than a photo of a grey screw, and it renders in 4 KB | **Change to our plan:** dual-asset strategy — a CAD-style line illustration *and* a photograph. Illustration is the grid thumbnail; photo is the PDP hero |
| **Instant page loads** | Aggressive pre-rendering and pre-fetching; the site feels local | Already our target (LCP < 2.0 s), now with a stated benchmark to beat |
| **Zero visual noise.** Light background, one accent, black text, dense tables | Nothing competes with the data | Directly validates the user's call for **light theme only** |
| **CAD downloads on every product** | The buyer's next step after "which part" is "put it in my assembly" | Already spec'd (`04-WIREFRAMES.md` §5). Raise to P0 for Hardware/Fasteners/Bearings |

**The uncomfortable lesson:** McMaster has essentially no animation, no dark mode, no hero video, and no brand personality — and it wins. Our differentiation has to be *speed and legibility first*, with motion used only where it explains structure. Ambition and restraint both, in that order.

## 3. DigiKey / Mouser / Misumi — what to copy per category

| Site | Idea worth stealing | Where it lands for us |
|---|---|---|
| **DigiKey** | Quantity price breaks shown as a live table on the listing tile, not just the PDP | Already in `03-DESIGN-SYSTEM.md` §5.3 — confirmed correct |
| **DigiKey** | Parametric search: pick a category, then every datasheet parameter becomes a sortable column | **New:** add a *table view* toggle to the PLP alongside grid view. Engineers comparing 12 MOSFETs want rows, not cards |
| **DigiKey** | "Alternate/substitute parts" surfaced when a part is out of stock | **New requirement** — see §7 |
| **Mouser** | Datasheet link on the tile itself | Add a datasheet icon to `ProductTile` when a document exists |
| **Misumi** | *Configurator*: pick a base part, then configure length/material/tolerance and the SKU is generated | Phase 2, but it maps exactly onto our variant-axis model. Worth noting the schema already supports it |
| **Misumi** | Explicit "days to ship" on every line, per configuration | Add `leadDays` to the tile, not just the PDP |
| **RS / Grainger** | Saved lists, repeat-order, and approval workflows for business accounts | Already in the P1 backlog as saved BOMs; raise credit/approval to Q1 post-launch |
| **Accu** | Beautiful, consistent line-art thumbnails across a fastener catalogue | Confirms the illustration-first thumbnail decision |

## 4. Indian competitors — the real landscape

Robu is not the only benchmark. The segment is more crowded and more specialised than the initial PRD assumed.

| Store | Strength | Weakness | Implication for us |
|---|---|---|---|
| **Robu.in** | Widest dev-board and module catalogue; 1–2 day dispatch; strong SEO; BOM tool; ATL/institution programme | WooCommerce, slow, cluttered; weak facets; mechanical parts thin | Beat on speed + faceting; match on catalogue depth for boards/sensors |
| **Zbotic** | Free shipping over ₹999; strong drone focus; genuinely good buying guides | Narrower catalogue | **Free-shipping threshold is table stakes.** Guides drive their organic traffic — our content plan must be real, not decorative |
| **Evelta** | 24-hour dispatch; **an actual RFQ service for bulk B2B** | Less hobbyist-friendly | Confirms B2B RFQ demand is real in India, not just a Xometry-style fantasy. Validates the MoD bet |
| **ThinkRobotics** | Authorised Raspberry Pi distributor — official pricing, full accessory range | Narrow | Authorised-distributor status is a moat we can't buy quickly. Don't compete head-on on RPi at launch |
| **Quartz Components** | Broad affordable catalogue, has a mobile app | Generic UX | Nothing to fear, nothing to learn |
| **OnlyScrews.in** | No-MOQ, assorted kits, hobby entry points, 1,120 reviews | Stock Shopify Dawn theme | Copy the merchandising, replace the interface |

**Three things every one of them does that we must not skip:**

1. **A visible free-shipping threshold** with a live "add ₹X more" nudge in the cart.
2. **Dispatch-time promises stated as a hard number** ("ships in 24 hours"), not "fast shipping".
3. **Buying guides as an SEO engine.** Zbotic and Robu both rank on informational queries and convert them. Our blog is not optional content marketing — it is a primary acquisition channel.

**One thing none of them does well:** cross-category buying. Every one is a specialist. That remains our wedge, and the research strengthens rather than weakens it.

## 5. Make-on-Demand — Xometry, Protolabs, Fictiv

| Capability | Xometry | Protolabs | Fictiv | **OnlyParts v1** |
|---|---|---|---|---|
| CAD upload | STEP, STP, SLDPRT, STL, IPT, 3DXML, CATPART, SAT, DXF | Similar | Similar | **Widen our list** to match — currently too narrow |
| Instant price | Yes, deep-learning driven | Yes, pioneered it | Yes | No — human quote in 24 h (by design) |
| Process recommendation | AI analyses geometry and suggests the process | Manual | Manual | **New for v1:** a rules-based recommender ("wall thickness < 2 mm and qty < 50 → 3D printing"). Cheap, and it makes the form feel intelligent |
| DFM feedback | Yes | Yes | Yes, a headline feature | Phase 2 — but **surface a manual DFM note field in the quote**, so the engineer's advice reaches the customer as a first-class artefact, not a buried comment |
| Real-time tracking | Yes | Yes | Yes | Yes — already spec'd |

**Adjustments to `06-BACKEND-ARCHITECTURE.md` §8.3:**
- Widen accepted file types to the Xometry set.
- Add a `process_recommendation` field to `rfqs`, populated by rules in v1 and by a model in Phase 2.
- Add a `dfm_notes` field to `quotes`, rendered prominently in the customer portal.

**The strategic read:** Xometry's moat is the instant-quote engine, and it took them years plus a costed supplier network. Our 24-hour human quote is not a weak imitation — for Indian MSME buyers who currently phone four vendors and wait a week, it is already a large improvement. Ship it, collect the human-priced data, automate in Phase 2. That sequencing is now explicitly justified rather than assumed.

## 6. Open-source platforms — revisiting the build decision

The user chose fully custom Next.js + Postgres. That decision stands, but it should stand for stated reasons.

| Platform | Stack | Verdict for OnlyParts |
|---|---|---|
| **Medusa** | Node/TS, modular | Closest fit. Would give us cart, orders, payments, inventory free. **But** advanced B2B (customer-group pricing, quotes, approvals) is still maturing, and the typed-attribute/facet model we need would fight its metadata approach |
| **Vendure** | TypeScript, GraphQL | Strongest B2B of the TS options; genuinely good custom-field system. **The most credible alternative to building from scratch** |
| **Saleor** | Python/Django, GraphQL | Excellent B2B and complex pricing, but a Python service alongside a TS frontend doubles the operational surface for a small team |
| **Bagisto** | Laravel/PHP | Large Indian ecosystem and GST plugins. Wrong stack for this team |
| **Spree / Solidus** | Ruby | Mature, but Ruby hiring in India for this profile is harder |
| **Sylius** | PHP/Symfony | Strong B2B, wrong stack |

**Decision (unchanged, now justified):** build custom.

The deciding factor is not cart or checkout — every platform does those well and we are rebuilding them at some cost. It is the **typed attribute system**. Our entire product thesis is that `M3 × 10 mm` is two typed, filterable, range-queryable values rather than a string. Every off-the-shelf platform models specs as loosely-typed metadata, and retrofitting a first-class attribute schema with per-category inheritance, unit awareness and numeric faceting means fighting the framework in its most load-bearing area.

**However — two components we should not build:**

1. **Invoicing/GST.** Use a library or a service. GST is a compliance problem, not a differentiation opportunity.
2. **The admin CRUD shell.** Use Refine, React-Admin or Payload for the catalogue admin rather than hand-rolling tables and forms. The *attribute-schema editor* and *search-tuning UI* are custom; everything else is generic.

**Salvage list from Medusa/Vendure (read the code, don't adopt the framework):** cart line-item modelling, order state machine, tax-calculation strategy interface, and inventory reservation semantics. All four are well-solved there and worth mirroring.

## 7. New requirements this research generates

Added to `01-PRD.md` §6 as FR-24 … FR-31.

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-24 | **Table/parametric view** toggle on the PLP, with attribute columns sortable | P1 | DigiKey, Misumi |
| FR-25 | **Substitute parts** surfaced automatically when a variant is out of stock, matched on the attribute schema | P1 | DigiKey |
| FR-26 | **Free-shipping threshold** with a live progress nudge in cart and mini-cart | P0 | Zbotic, Robu, universal |
| FR-27 | **Dispatch promise** (`ships in N hours`) on tile, PDP and cart — a number, never an adjective | P0 | Evelta, Robu, Misumi |
| FR-28 | **Dual product imagery**: CAD-style line illustration (grid thumbnail) + photograph (PDP hero) | P0 | McMaster, Accu |
| FR-29 | **Rules-based process recommender** on the RFQ form | P1 | Xometry |
| FR-30 | **DFM notes** as a first-class field on the quote, shown prominently in the portal | P1 | Fictiv |
| FR-31 | **Buying guides** treated as an acquisition channel with its own content calendar, not marketing filler | P0 | Zbotic, Robu |

## 8. Design implications — what changes in the design system

The user's direction (light theme permanent, better imagery, animation lower on the page) is corroborated by the research. Changes now folded into `03-DESIGN-SYSTEM.md` v2:

1. **Light theme is the only theme.** McMaster, DigiKey, Mouser, Misumi, Grainger, Xometry — every high-performing parts site in the world is light. Dark reads as consumer-tech, not instrument-grade. Turquoise `#40E0D0` moves from "accent text" to "fill and surface", with `--tq-600`/`--tq-700` carrying any turquoise text. Removing the dark theme also removes an entire class of contrast bugs.
2. **Imagery is a first-class slot, not a decoration.** Every product tile, category tile and project card gets a defined, ratio-locked image frame with a designed placeholder state (line-art glyph on a tinted turquoise field) so the layout is correct before a single photograph exists.
3. **Motion moves down the page.** The hero leads with clarity — headline, search, trust. Heavy scroll choreography starts *after* the fold, where it rewards engagement rather than delaying the LCP element.
4. **Cut decorative micro-copy.** The "✓ typo tolerant · ✓ synonym aware" strip is us explaining our own cleverness. The demo already shows it. Removed.
5. **Bento-style modular sections** over uniform card grids for the marketing surfaces — current, and it lets category tiles carry imagery at different weights so the 13 don't read as a monotonous 4×4.
6. **Density is a feature.** Parts buyers want more per screen than a fashion store. Tighter line heights, smaller tiles, more columns on wide screens — closer to DigiKey than to a lifestyle brand.

## Sources

- [McMaster-Carr competitors — Similarweb](https://www.similarweb.com/website/mcmaster.com/competitors/)
- [McMaster-Carr: the smartest website you haven't heard of — Ben Edelstein](https://www.bedelstein.com/post/mcmaster-carr)
- [International hardware parts platforms compared — SFP](https://www.sfp-tw.com/en/post/international-hardware-parts-platforms-overview-comparisonmcmaster-carr-misumi-accu-pem-and-y)
- [5 B2B e-commerce sites you should learn UX from — Medusa](https://dev.to/medusajs/5-b2b-ecommerce-sites-you-should-learn-ux-from-4l08)
- [Best headless commerce platforms: 2026 comparison — Vendure](https://vendure.io/blog/best-headless-commerce-platforms)
- [Medusa vs Saleor vs Vendure (2026) — PkgPulse](https://www.pkgpulse.com/guides/medusa-vs-saleor-vs-vendure-headless-ecommerce-2026)
- [Top 20 open-source e-commerce platforms on GitHub — Magendoo](https://magendoo.ro/insights/top-20-open-source-ecommerce-platforms-on-github-a-strategic-analysis-2026/)
- [Xometry Instant Quoting Engine](https://www.xometry.com/quoting/home/)
- [Xometry vs Protolabs — RapidDirect](https://www.rapiddirect.com/blog/xometry-vs-protolabs/)
- [Fictiv — custom manufacturing](https://www.fictiv.com/)
- [10 best online electronics stores in India 2026 — Zbotic](https://zbotic.in/best-online-electronics-stores-india-2026/)
- [Zbotic vs Robu comparison](https://zbotic.in/zbotic-vs-robu-comparison/)
- [E-commerce design trends 2026 — DesignStudio](https://www.designstudiouiux.com/blog/ecommerce-web-design-trends/)
- [E-commerce product page best practices 2026 — VWO](https://vwo.com/blog/ecommerce-product-page-design/)
