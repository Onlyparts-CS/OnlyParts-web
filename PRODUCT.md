# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Indian engineers, makers, small manufacturers and workshop buyers who need
mechanical *and* electronic parts for the same build. The concrete scene is someone
mid-build — a 3D printer, a drone, a jig, a control panel, a small production run —
who knows the spec they need (`M3x10 SS304`, `608ZZ`, `NEMA 17`, `18650`) and wants it
in a cart today, with a GST invoice that books cleanly against input credit.

Secondary: students and college robotics/FSAE teams buying single pieces; procurement
staff at small firms placing repeat orders against a BOM.

## Product Purpose

OnlyParts is an India-first online retail store for hardware, mechanical and electronic
parts, plus Make-on-Demand custom manufacturing for what is not stocked.

It exists because the buyer above currently splits one build across five vendors — a
fastener trader, an electronics store, a bearings distributor, a 3D-printing shop, a
magnet supplier — paying five shipping fees, reconciling five invoices, and waiting on
the slowest of them. Success is that a single build's entire bill of materials leaves
in one box, on one invoice.

Search is a flagship capability, not the shopfront. The catalogue is what sells; search
is how a buyer who already knows the part skips to it.

## Positioning

Breadth across categories that are normally split between vendors, held together by
**typed attributes**: `M3` is a value of `thread`, never a category. That is what makes
one search bar work across a screw, a bearing and a stepper motor, what makes facets
work over 50,000 SKUs, and what makes cross-listing a part into several categories safe
(canonical URL is always `/p/{slug}`).

Second mechanism: **Make-on-Demand**. When a part is not stocked in the material or
size needed, the same site quotes custom fabrication rather than returning zero results.

## Operating Context

- Buying happens against a spec, not a picture. Thread, length, material, finish,
  standard (DIN/ISO), bore/OD/width, torque, grade. Substitution decisions are made on
  dimensions, not on brand.
- Price breaks matter: no minimum order, buy 1 or 10,000, with break quantities applied
  automatically in the cart.
- A GST tax invoice is a legal artefact the buyer files. Per-line tax, CGST+SGST for
  intra-state and IGST for inter-state, HSN per line, gapless per-financial-year invoice
  numbering.
- BOMs arrive as CSV/spreadsheets and need to become carts.
- Company is in Peenya, Bengaluru, beside the suppliers. Not remote-first.
- Pre-launch: the catalogue is still being onboarded, there are no funded job openings,
  and nothing on the site may claim otherwise.

## Capabilities and Constraints

**Confirmed and built:** 13-category taxonomy to L3; spec-parsing search; faceted
listing; product pages with variant matrix, spec table, substitutes and reviews; cart
with price breaks and BOM import/export; GST checkout and printable invoice; wishlist;
RFQ flow for Make-on-Demand; bespoke admin console at `/admin`; content pages (about,
guides, projects, policies, careers, FAQ, contact, track, bulk orders).

**Planned, not built:** Payload CMS 3.0 + PostgreSQL wiring (Payload admin will live at
`/cms`, the bespoke console stays at `/admin`); server-side invoice PDF generation;
Razorpay with HMAC webhook verification; Meilisearch (search is currently a linear scan
and is a launch blocker at catalogue scale).

**Hard constraints:**
- Demo/sample catalogue data must never be present at deployment. It is behind a flag
  and the flag must stay off in production.
- Stack is fixed: Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4.
- Prices are integers in paise. Currency is INR.

**Terminology:** SKU, BOM, RFQ, price break, HSN, dispatch hours, L1/L2/L3 category,
facet, leaf, cross-listing.

## Brand Commitments

- Name: **OnlyParts**. Domain registered at Hostinger.
- **Light ground is permanent. There is no dark theme.** (User, stated twice, binding.)
- Volunteered visual guardrails, recorded verbatim as binding:
  - Always: one monumental image anchors the page; imagery is processed, never raw
    (halftone, dither, grain, ASCII, linework); technical marginalia (coordinates, IDs,
    ruler ticks, timestamps); type at extremes — monumental display or tiny mono labels,
    little middle; near-monochrome ground with a single warm accent.
  - Never: purple gradients, glossy 3D SaaS blobs, untextured stock photography,
    rounded-everything friendliness, icon-grid feature rows, Inter/system-font-only
    typography, evenly-distributed colorful palettes.
- Named references the user made binding for direction (structure, not styling):
  Dribbble VEXO futuristic e-commerce (hero + scroll), Dribbble e-commerce UI
  interactions (switch animation on a category's main image), Dribbble hardware store
  concept (category presentation, **without** its left sidebar), Dribbble hardware store
  cover (an opening cover that resolves into the page).
- **Decided 2026-08-06.** The accent is the green of the mark, `#5FAF42`, sampled from
  the supplied logo artwork. It replaces the red-oxide primer that replaced turquoise.
  Turquoise is retained for Make-on-Demand only, where it measures dE 53.8 from the new
  accent and so still reads as a different answer.
  - This retires the "single *warm* accent" clause, deliberately: the accent is now cool
    and the **paper stays warm**. A green plate on warm uncoated stock is what a real
    two-colour job looks like, and the tension between the two is the point rather than
    a mistake to correct. Everything else in the guardrail stands.
  - The mark stayed the hex-and-bore rather than becoming the chip on the artwork. The
    catalogue is fourteen drawers and most of them are mechanical; a hex speaks for nine
    of them, an IC for two. `components/Logo.tsx` carries the reasoning, and swapping it
    is that one file.

## Evidence on Hand

- Real: the 13-category taxonomy and its L2/L3 tree (`docs/02-TAXONOMY.md`), the GST
  engine and invoice format, the HSN mapping, the attribute schemas per leaf.
- Synthetic and labelled: every product, price, stock figure, review, order number and
  RFQ in the app is demonstration data behind `CATALOGUE_EMPTY`. Robu.in and comparable
  Indian retailers were used to size and shape the *taxonomy*; no competitor pricing or
  stock has been copied and none may be presented as OnlyParts' own.
- Absent, must not be fabricated: customer names, testimonials, order volumes, funding,
  supplier names, delivery SLAs beyond the stated dispatch hours, and any job opening.

## Product Principles

1. **The catalogue is the shopfront.** Breadth is the product; search is the shortcut
   for people who already know the spec. Never let the search UI outweigh the parts.
2. **A spec is the unit of meaning.** Typed attributes, not free text, and never a
   dimension promoted to a category.
3. **State what is true.** Pre-launch is pre-launch, made-to-order is made-to-order,
   an out-of-stock part offers a real substitute or a quote — never an invented figure.
4. **The invoice is part of the product.** What an auditor accepts is a feature, not
   an afterthought.
5. **One cart, one box, one invoice.** Every feature is judged on whether it removes a
   second vendor from the buyer's day.

## Accessibility & Inclusion

WCAG 2.1 AA is the working standard; the current colour system was audited across 15
routes at 0 contrast failures and that floor must be held through any restyle. Motion
must degrade fully under `prefers-reduced-motion` with no information lost.
