---
target: the product page
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 4
timestamp: 2026-08-14T08-12-48Z
slug: apps-web-src-app-frontend-p-slug-page-tsx
---
Method: dual-agent (A: design review · B: detector + mechanical evidence)

Scope: the PDP and the surfaces the four new requests land on — kits/bundles,
an Amazon-style "frequently bought together" widget with a live total, the
"customers also viewed" carousels, and removing COD.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "Add to BOM" silently calls addToCart then navigates — no confirmation before the page changes (BuyBox.tsx:130) |
| 2 | Match System / Real World | 4 | Typed attributes, engineering-ordered thread axis, HSN/GST language. Earned. |
| 3 | User Control and Freedom | 2 | Qty chips 10/100/1000 overwrite qty with no confirm; no undo near BuyBox |
| 4 | Consistency and Standards | 3 | "Used in these builds" breaks the page's own h2 plate register; cross-sell grid declares 6 cols for a 4-item source |
| 5 | Error Prevention | 3 | buildMatrix "dim, don't hide" (product.ts:135) is genuinely good |
| 6 | Recognition Rather Than Recall | 3 | Spec table, SKU always visible, tiles carry price + stock |
| 7 | Flexibility and Efficiency | 3 | Qty chips, Add to BOM. Nothing lets a power user skip cross-sell |
| 8 | Aesthetic and Minimalist Design | 3 | Spare today; degrades fast once two more grids stack on |
| 9 | Error Recovery | 2 | PDP has zero error states — failed add, stock-changed-under-you. Only cart/checkout have orderError |
| 10 | Help and Documentation | 2 | Spec table + RFQ link are the only self-serve help |
| **Total** | | **28/40** | **Good — solid foundation, weak at cross-sell honesty and PDP error states** |

## Design Specificity Verdict

**Split: the skin is authored for OnlyParts, the skeleton is not.**

Colour, type and imagery genuinely follow globals.css. The h1 correctly avoids the
plate register. The JSON-LD block (page.tsx:71-82) actively refuses to publish
aggregateRating 0.0/0 — a truthfulness decision baked into the data layer, and the
clearest live enactment of Product Principle 3 on the page.

But the information architecture is the DigiKey/Amazon shape wearing OnlyParts paint,
and the code says so itself: substitutes() is commented "FR-25, the DigiKey pattern"
and ProductRow is "FR-24, the DigiKey pattern." Gallery-left/buybox-right, price-break
table, spec table, cross-sell grid — none derived from the cabinet/drawer/card-index
world DESIGN.md builds. Not automatically wrong for an Operate surface, but it means
the four new requests taken literally as "Amazon-style" pull the page further toward
category-interchangeable, not closer to OnlyParts.

**Deterministic scan:** `detect.mjs` over the PDP, cart, checkout, components/product/
and ProductTile returned `[]`, exit 0 — zero findings. Assessment B validated this
with a canary file seeded with `from-purple-500`, `fontFamily: 'Inter'`, a div-onClick
and Lorem ipsum, which correctly produced an `ai-color-palette` finding and exit 2.
So the clean scan is real, not a silent skip. **No AI-slop, no token violations, no
contrast failures.** Every issue below is structural or truthfulness — the class of
problem a regex detector cannot see. The detector and the design review agree: the
surface craft is not the problem.

**Visual overlays:** none. Chromium launches (151.0.7922.34, libnspr4/libnss3 now
present) but no dev server was running and none was started, so no page was rendered.
Browser-grade visual evidence is unblocked and outstanding.

## Overall Impression

This is a well-built page with one dishonest section on it, and the four new requests
would add three more. The biggest opportunity is not the widget — it is that Builds.ts
already solves "motor needs a driver" honestly, with curated membership and fail-loud
validation, and it learned that lesson the hard way (the comment trail documents a
prior bug where every fastener claimed "Build a Drone" via inferred category overlap).
The bundle widget should extend that primitive, not sit beside it as a second, weaker one.

## What's Working

1. **buildMatrix's "dim, don't hide"** (product.ts:135-137) — an unavailable M3x10 in
   12.9 alloy renders greyed with a stated reason rather than being omitted. Exactly
   right for an engineer who needs to know the part exists, just not today.
2. **The JSON-LD rating omission** (page.tsx:71-82) — refusing to publish a rating no
   customer gave. Principle 3 enforced in the data layer, not just in copy.
3. **Builds' curated-only membership** (Builds.ts:12-24) — explicit per-SKU curation,
   unknown slugs fail loud on import. The discipline boughtWith() is missing.

## Priority Issues

### [P0] `boughtWith()` cannot express a complement, and its heading claims a purchase pattern the site has no data for
- **Where:** product.ts:225-245, rendered as "Frequently bought with" at page.tsx:230-236
- **Why it matters:** Read the three branches. Fastener heads returns same thread, other
  head style — a substitute axis, not a complement. Deep-groove returns same bore,
  different bearing — again a substitute. The fallback at product.ts:244 covers
  everything else (motors, ESCs, flight controllers, batteries, electronics, tools, CNC,
  EV) and is `same L1 drawer, in stock, first 4`. A NEMA 17 motor's "frequently bought
  with" is another motor, not the driver it needs. There is no code path anywhere that
  can produce motor + driver or ESC + flight controller. And the heading asserts a
  purchase pattern on a pre-launch site with zero orders.
- **Fix:** Do not extend boughtWith() for the kit ask. Add an explicit, curated
  complement relation with the Builds.ts guardrails (fail loud on unknown slug, never
  inferred). Seed it from the compatibility data already harvested — 859 rows carry an
  explicit `Compatibility` spec (NEMA17, Raspberry Pi Zero, LCD1602, R9 series) and
  3,733 more name a target in the title (Raspberry Pi 217, Arduino 214, Jetson Nano 32,
  Drone 31). That is a supplier-stated fact, not a behavioural guess.
- **Suggested command:** `/impeccable shape`

### [P1] "Customers who viewed this item also viewed" cannot be honestly built today
- **Where:** requested feature; no view tracking, no recentlyViewed, no session or
  behavioural infrastructure exists anywhere in apps/web/src
- **Why it matters:** This is collaborative-filtering output rendered as a UI pattern.
  OnlyParts has zero logged page views and zero real orders. Building it now means
  either faking the signal — which Principle 3 forbids by name — or shipping an
  always-identical widget that reads as broken the first time a repeat visitor notices
  it never changes, eroding trust exactly where invoice-grade trust matters most.
- **Fix:** Keep the shelf space, change what fills it and what it claims. dbSkusInPath
  is already fetched once per page (page.tsx:46), so a deterministic "Also in this
  drawer" or a compatibility-matched row costs nothing extra and makes no false claim.
  Wire the real carousel post-launch behind a minimum sample size.
- **Suggested command:** `/impeccable clarify`

### [P1] There is no multi-SKU add API — the "Add all to cart" widget has nothing to call
- **Where:** store.ts:155 — `addToCart(sku: string, qty = 1)`, single SKU. Every bulk
  add loops it: BomTools.tsx:70, wishlist/page.tsx:39, projects BomActions.tsx:39,
  AccountClient.tsx:144
- **Why it matters:** set() at store.ts:125-129 does persist() plus a full listener
  broadcast on every call, so an N-SKU add fires N localStorage writes and N re-renders.
  The requested widget adds 2-6 SKUs on one click; that is the worst case of an existing
  problem, not a new one. Price-break tiers also apply per line (cartMath.ts:19-20) and
  never sum across lines, so a bundle of ten different SKUs at 10 each does not reach a
  100-piece tier — the bundle total must be computed from per-line tiers or it will be
  wrong.
- **Fix:** One `addManyToCart(entries)` that mutates once and broadcasts once, and route
  all four existing loops through it. Compute the bundle total with tierFor per line.
- **Suggested command:** `/impeccable harden`

### [P1] The import drops the specs and images that were already harvested
- **Where:** the feed CSV writer in tools/feeds/pull.mjs emits 10 columns
  (sku,title,price,stock,hsn,gst_rate,weight_g,category,projects,country_of_origin)
- **Why it matters:** the harvested JSON carries far more — 90,969 of 119,864 rows
  (76%) have specs, and 119,862 of 119,864 (99.998%) have image URLs. The 3,800-row
  demo import would therefore land with near-empty spec tables and no photography,
  when three quarters of it has real Material, Diameter, Pitch, Operating Voltage and
  Bolt Length values sitting in tools/feeds/out/*.json. Downstream this also starves
  plateParam, which reads length_mm / bore_id_mm / outer_od_mm / dia_mm / body_length_mm
  (plates.ts:545-559) and falls back to an FNV hash of the SKU string — so shapes vary
  with no dimensional meaning behind them, which a scanning engineer can misread as data.
- **Fix:** Widen the CSV writer to carry the spec keys the importer already understands
  and the image URLs. No new scraping required.
- **Suggested command:** `/impeccable harden`

### [P1] COD spans 24 sites across four layers, including a Postgres enum
- **Where:** UI — Footer.tsx:88, cart/page.tsx:214, checkout/page.tsx:17/248/318,
  track/page.tsx:105, AccountClient.tsx:163/175. Content — content.ts:86 (returns
  policy), content.ts:523 (FAQ). Model — Orders.ts:22/192/378, orders.ts:47/239,
  orderRead.ts:31. Admin — admin/orders/page.tsx:52, actions.ts:11/84,
  [number]/page.tsx:21. Generated — payload-types.ts:889/973. Schema —
  migrations/20260808_180149_baseline.ts:21, `enum_orders_payment_method`
- **Why it matters:** the risk is inconsistency, not difficulty. Miss one and the cart
  footer promises COD while checkout does not offer it — a visible contradiction on a
  site whose whole proposition is stating what is true. The layers also differ in what
  they should do: the storefront must stop offering it, but existing order records and
  the admin console must still be able to describe a COD order, so the enum stays.
  Separately: the "Available under ₹20,000" cap is copy only — grep finds the string in
  exactly two prose sites and no numeric check anywhere. It has never been enforced.
- **Fix:** Remove from storefront UI and customer-facing content. Keep the enum, the
  admin labels and the order-model comments. Delete the unenforced ₹20,000 claim wherever
  it survives.
- **Suggested command:** `/impeccable clarify`

## Persona Red Flags

**Casey (distracted mobile, thumb-only):** BuyBox quantity steppers are h-11 w-10
(44x40px) — height clears the 44px floor DESIGN.md commits to, width does not
(BuyBox.tsx:49,56). Four adjacent tap targets stack in two rows right after the price
reveal (BuyBox.tsx:118-134), and "Add to BOM" at :130 calls addToCart with no visible
confirmation before navigating — a mis-tap adds a line and says nothing. Adding the
bundle widget and a carousel grows the scroll-to-checkout distance by two more grid
sections on a 375px viewport.

**Riley (stress tester):** the `together.length > 0` guard (page.tsx:229) correctly
hides an empty grid — but for a fallback-branch category with exactly one other
in-stock item, "Frequently bought with" still fires for a single arbitrary tile. The
guard prevents empty, not misleading-at-n=1. buildMatrix returns `axes: []` when the
leaf has no declared axes (product.ts:146), so the incoming bare import renders no
variant matrix rather than crashing — good. The h1 (page.tsx:132) has no line-clamp and
no break-words, untested against a long supplier title spilling to three lines;
ProductTile's h3 does clamp (ProductTile.tsx:46) but the PDP's own title does not.

**Priya (project persona — Indian engineer mid-build, knows the spec, wants a GST
invoice):** strongly served by the qty chips, the live break table and the HSN +
GST-invoice line — the best-built part of the page for exactly this buyer. Actively
undermined by the fallback boughtWith(): they came for one part against a known spec,
and a same-drawer grab-bag labelled "Frequently bought with" is noise competing with
Product Principle 1. COD removal fits this persona without friction — a business buyer
claiming input credit already prefers a digital trail. Builds.ts already models their
real need: a curated BOM, editorially verified, one cart.

## Minor Observations

- **The PDP ignores the documented spacing tokens entirely.** Zero uses of .section-gap
  or .stack; ad hoc mt-6/mt-7/mt-12/mt-14/gap-10/gap-12/gap-14 throughout. DESIGN.md
  states "three spacing steps only" in the same register as the zero-radius and
  warm-shadow rules that are respected. Fix this before adding sections, or each new
  one invents its own margin.
- Cross-sell grid declares xl:grid-cols-6 (page.tsx:232) against a limit=4 source
  (product.ts:225) — two permanently empty cells at >=1280px, which is where the primary
  persona sits.
- No section on the page has an accessible name. The <section> elements at 194, 206,
  230 and 241 have no id, aria-label or aria-labelledby, so none is exposed as a region
  landmark. SpecTable and Reviews carry ids, but as scroll anchors, not label targets.
- ProductTile is a <Link> containing WishButton, a real <button> (ProductTile.tsx:25,41)
  — interactive content nested inside interactive content, invalid per the HTML content
  model, currently working only via preventDefault/stopPropagation.
- "Used in these builds" (page.tsx:171) is the only h2-equivalent not in the plate
  register, so it does not scan as a peer of the other section headings.
- --color-sale is declared and unused. If a kit-savings badge ships, that is its home —
  using spot-500/700 would conflate it with the "selected/active" meaning the accent
  carries everywhere else.
- The out-of-stock rescue copy ("This one is made to order. These fit the same
  envelope...") is stronger writing than the in-stock "Same size, other materials"
  variant. Carry that voice back.

## Questions to Consider

1. Builds.ts already solves "motor needs a driver" honestly. What does a checkbox-and-total
   widget do that "here is the Build, pre-checked, uncheck what you don't need" doesn't?
2. Is "frequently bought together" the real need, or is it "help me not forget the part
   this one doesn't work without"? The first needs purchase data that doesn't exist; the
   second needs one curated complements field, buildable today and honest on day one.
3. With zero traffic, what does the shelf space reserved for "customers also viewed" earn
   if it holds something deterministic and true instead — until real view data exists?
4. If COD disappears, does the BuyBox reassurance list need a line about refunds and
   disputes for online-only payment, or do GST invoice + returns already cover it?
