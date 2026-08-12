# OnlyParts — Layouts & Wireframes

**Version:** 1.0
ASCII wireframes are the source of truth for *structure and hierarchy*. Visual treatment comes from `03-DESIGN-SYSTEM.md`. A running implementation of §2 lives in `prototype/`.

---

## 1. Global chrome

### 1.1 Header (sticky, 72 px → 56 px condensed on scroll)

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ ⬡ only|parts  ▾All Categories │ 🔎 Search 20,000+ parts…          ⌘K │ 🇮🇳 ₹ ♡ 👤 🛒3│
└───────────────────────────────────────────────────────────────────────────────────┘
│ Fasteners  Motors  Electronics  Batteries  3D Printing  Drones  Tools  ⋯  MAKE→   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

- Row 1 always visible. Row 2 (category strip) hides on scroll-down, returns on scroll-up.
- `MAKE →` is visually distinct: turquoise outline pill. It is the second business and must not read as another category.
- On the landing page the header search is *hidden* until the hero search scrolls out of view, then it fades in — the two never compete.
- Mobile: hamburger + logo + search icon + cart. Category strip becomes a horizontally scrollable chip row.

### 1.2 Mega menu (hover/focus on "All Categories" or any L1)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FASTENERS                                                                    │
│ ┌────────────────┬──────────────────────────┬───────────────────────────────┐│
│ │ ▸ Screws–Drive │  Screws — by Head        │  ┌─────────────────────────┐  ││
│ │ ▸ Screws–Head  │  ─────────────────────   │  │  [featured image]       │  ││
│ │ ▸ Bolts        │  Pan Head       (412)    │  │  M3 3D-Printing Kit     │  ││
│ │ ▸ Nuts         │  Countersunk    (388)    │  │  486 pcs · ₹1,540       │  ││
│ │ ▸ Washers      │  Button Head    (301)    │  └─────────────────────────┘  ││
│ │ ▸ Grub Screws  │  Socket Head    (524)    │   POPULAR IN FASTENERS        ││
│ │ ▸ Inserts      │  Cheese Head    (140)    │   · M3 Socket Head SS304      ││
│ │ ▸ Spacers      │  Flange Head     (96)    │   · Brass Heat-Set Inserts    ││
│ │ ▸ Rivets&Pins  │  Truss Head      (72)    │   · Nyloc Nuts M3–M8          ││
│ │ ▸ Self-Tapping │                          │                               ││
│ │ ▸ Rods & Studs │  [ View all Fasteners → ]│   [ Bulk enquiry → ]          ││
│ └────────────────┴──────────────────────────┴───────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
    L2 list (hover)      L3 list of hovered L2      Merchandising panel
```

Three-panel pattern: L2 spine on the left, L3 grid for the hovered L2 in the middle, merchandising on the right. Counts on every L3 node. Fully keyboard navigable (arrow keys move within a panel, `→` descends, `←` ascends, `Esc` closes).

Mobile: full-screen drill-down with a persistent back row showing the current path.

### 1.3 Footer

```
┌────────────────────────────────────────────────────────────────────────────┐
│ SHOP           BUILD           COMPANY        SUPPORT       STAY IN TOUCH  │
│ 13 categories  Drone           About          Track order   [email      ]  │
│ listed with    3D Printer      Make-on-Demand Shipping      [ Subscribe ]  │
│ every L2 as    Robot           Bulk orders    Returns                      │
│ a link (SEO    EV              Careers        GST invoices  💬 WhatsApp    │
│ surface)       CNC             Blog           FAQ           📞 +91 …       │
│ ────────────────────────────────────────────────────────────────────────── │
│ ⬡ only|parts   © 2026   Privacy · Terms · GST · Refunds   [UPI][Visa][…]  │
└────────────────────────────────────────────────────────────────────────────┘
```

The footer is the full category sitemap. Every L1 and L2 is a crawlable link.

---

## 2. Landing page — the scroll narrative

Total ≈ 7 viewport heights. Each section is a "beat" with one job.

> **Build note (v2).** The hero carries the headline, the search bar and the two
> CTAs — nothing else. The dispatch / no-MOQ / GST facts and the scroll indicator
> were removed: the facts are already carried by the trust band at beat 4, and
> repeating them in the hero pushed the CTAs below the fold. **Those three facts
> belong on the About page**, expanded into real copy (why no MOQ, what the
> dispatch cut-off actually is, how GST invoicing works for B2B buyers) rather
> than compressed into a one-line row.

### Beat 1 — Hero (100 vh)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║   ·  ⬡      ○         ⚙                                    ⌾        ·     ║
║       ·          [ animated parts field, turquoise line-art on near-black ]║
║                                                                            ║
║                    E V E R Y   P A R T .   O N E   C A R T.               ║
║                                                                            ║
║        Fasteners, motors, electronics, batteries, bearings, magnets       ║
║          and 6 more categories. No minimum order. Ships from India.       ║
║                                                                            ║
║      ┌──────────────────────────────────────────────────────────┐         ║
║      │ 🔎  M3x10 SS304 socket head▌                        ⌘K   │         ║
║      └──────────────────────────────────────────────────────────┘         ║
║        Try:  [608ZZ]  [NEMA 17]  [18650 3000mAh]  [N52 15x3]              ║
║                                                                            ║
║      [ Browse all categories ]        [ Make my part → ]                  ║
║                                                                            ║
║   ● 12,000+ SKUs      ● No MOQ      ● 2-day metro delivery    ● GST bills ║
║                              ↓ scroll                                      ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

- **LCP element is the headline**, not the canvas. The canvas mounts after first paint.
- The search field is the visual centre of gravity — it is 64 px tall and the brightest object on screen.
- Suggestion chips are real queries; clicking one runs it. They teach the search's capability in one glance.
- Two CTAs, and only two: browse (retail) and make (MoD). The whole business in one row.

### Beat 2 — Category constellation (~140 vh)

```
        ONE STORE.  THIRTEEN CATEGORIES.  ZERO COMPROMISES.

  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
  │  ⬡     │ │  ◎     │ │  ⌁     │ │  ▤     │ │  ⬙     │
  │Fasteners│ │ Motors │ │Electronic│ │Battery │ │3D Print│
  │ 14 subs │ │ 8 subs │ │ 14 subs │ │ 8 subs │ │ 9 subs │
  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
  │Drones  │ │ Tools  │ │Bearings│ │Magnets │ │  CNC   │
  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
  ┌────────┐ ┌────────┐ ┌────────┐
  │Ind.Elec│ │EV Parts│ │Hardware│
  └────────┘ └────────┘ └────────┘

           Same part, many shelves — we cross-list so you find it.
```

Tiles ripple in from the centre on a 40 ms stagger. Each glyph draws itself. Hover reveals the top 4 L2s inside the tile and plays that category's signature micro-animation.

### Beat 3 — "Search that speaks engineering" (pinned, ~200 vh of scroll → 100 vh of stage)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Type what's in your head. Not what's in our database.                     ║
║                                                                            ║
║   ┌────────────────────────────────────────────────────────────┐          ║
║   │ 🔎  m3x10 ss304 socket▌                                     │          ║
║   └────────────────────────────────────────────────────────────┘          ║
║     understood:  [M3 ×] [10 mm ×] [SS 304 ×] [Socket Head ×]              ║
║   ┌────────────────────────────────────────────────────────────┐          ║
║   │ ▣  M3×10mm Hex Socket Head SS304   FS-SHC-M3-010  ₹4.20 ●  │          ║
║   │ ▣  M3×10mm Hex Socket Head 12.9    FS-SHC-M3-010B ₹3.10 ●  │          ║
║   │ ▣  M3×10mm Button Head SS304       FS-BTN-M3-010  ₹4.60 ●  │          ║
║   │ 📁 Fasteners › Screws by Head › Socket Head Cap    524 items│          ║
║   └────────────────────────────────────────────────────────────┘          ║
║                                                                            ║
║   ✓ typo tolerant   ✓ synonym aware   ✓ unit aware   ✓ <100 ms            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

The section pins; the query types itself as a function of scroll progress; tokens pop in; rows slide up. Scroll backwards and it un-types. This is the beat that sells the product.

### Beat 4 — Trust band (40 vh)

```
  ┌──────────┬──────────┬──────────┬──────────┬──────────┐
  │  12,000+ │   NO     │  2-DAY   │   GST    │  1,120+  │
  │   SKUs   │   MOQ    │  METRO   │ INVOICES │ REVIEWS  │
  │ in stock │ buy 1 pc │ delivery │ B2B ready│  4.8 ★   │
  └──────────┴──────────┴──────────┴──────────┴──────────┘
```
Counters roll from 0 when the band enters view.

### Beat 5 — Shop by project (~90 vh, horizontal parallax)

```
  BUILDING SOMETHING?  START WITH THE WHOLE BOM.

  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
  │  DRONE    │  │3D PRINTER │  │   ROBOT   │  │    EV     │  │   CNC     │
  │ 340 parts │  │ 520 parts │  │ 410 parts │  │ 280 parts │  │ 360 parts │
  │ from ₹2.1k│  │ from ₹8.4k│  │ from ₹1.9k│  │ from ₹14k │  │ from ₹22k │
  └───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘
       ↑ cards translate on X at differing rates as the section passes
```

### Beat 6 — Make-on-Demand (~110 vh)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║  ┌────────────────────────┐   CAN'T BUY IT? WE'LL MAKE IT.                ║
║  │                        │                                                ║
║  │   [ part rotating,     │   ① Upload  STEP · STL · DXF · PDF · BOM       ║
║  │     technical-drawing  │   ② Specify process, material, finish, qty     ║
║  │     style, turquoise   │   ③ Quote   in 24 hours from a real engineer   ║
║  │     wireframe ]        │   ④ Track   from PO to doorstep                ║
║  │                        │                                                ║
║  └────────────────────────┘   CNC · 3D Printing · Sheet Metal · Moulding   ║
║                               PCB Assembly · Harnesses · Custom Sourcing   ║
║                                                                            ║
║          Prototype quantities to mass production. One vendor.              ║
║                    [ Start an RFQ → ]   [ Talk to an engineer ]            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Beat 7 — Proof + close

Review marquee, brand logos ("trusted by"), latest guides from the blog (SEO), then the footer.

---

## 3. Category landing (L1)

```
Home › Fasteners
┌────────────────────────────────────────────────────────────────────────┐
│  FASTENERS                                            3,412 products   │
│  Screws, bolts, nuts, washers, inserts and pins. SS304, SS316, 12.9    │
│  alloy, brass and nylon. No minimum order.                             │
└────────────────────────────────────────────────────────────────────────┘

SHOP BY SUBCATEGORY
┌────────┬────────┬────────┬────────┬────────┬────────┐
│Screws  │Screws  │ Bolts  │ Nuts   │Washers │Inserts │   … 14 tiles
│by Drive│by Head │        │        │        │        │
└────────┴────────┴────────┴────────┴────────┴────────┘

SHOP BY THREAD          M2 · M2.5 · M3 · M4 · M5 · M6 · M8 · M10 · M12
SHOP BY MATERIAL        SS304 · SS316 · Alloy 12.9 · MS Zinc · Brass · Nylon
                        ↑ these are facet shortcuts, not categories

BESTSELLERS IN FASTENERS      [ 5-across product tile row ]
ASSORTED KITS                 [ 5-across product tile row ]
GUIDES                        How to measure screw length · Hex nut vs nyloc
```

L2 pages use the same template with L3 tiles. The "shop by X" rows are pre-built facet links — they're the SEO long-tail surface and they teach the facet vocabulary before the user hits the PLP.

---

## 4. Product listing page (PLP)

```
Home › Fasteners › Screws by Head › Socket Head Cap Screws

Socket Head Cap Screws                                    524 products
Active: [M3 ×] [SS304 ×]  Clear all              Sort: [ Relevance ▾ ]
────────────────────────────────────────────────────────────────────────
┌──── 264px ────┐ ┌───────────────────────────────────────────────────┐
│ THREAD        │ │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│ ☑ M3    (128) │ │ │        │ │        │ │        │ │        │       │
│ ☐ M4    (116) │ │ │ tile   │ │ tile   │ │ tile   │ │ tile   │       │
│ ☐ M5     (98) │ │ └────────┘ └────────┘ └────────┘ └────────┘       │
│ ▸ show 6 more │ │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│               │ │ │        │ │        │ │        │ │        │       │
│ LENGTH (mm)   │ │ └────────┘ └────────┘ └────────┘ └────────┘       │
│ ├──●─────●──┤ │ │                                                   │
│ [ 6 ]  [ 40 ] │ │              [ Load more ]  (24 of 524)           │
│               │ │                                                   │
│ MATERIAL      │ └───────────────────────────────────────────────────┘
│ ☑ SS304  (86) │
│ ☐ SS316  (22) │  Filter rail is sticky with its own scroll.
│ ☐ 12.9   (20) │  Below lg: collapses to a [ Filters (2) ] button
│               │  that opens a bottom sheet.
│ FINISH        │
│ AVAILABILITY  │  URL carries state:
│ ☑ In stock    │  ?thread=M3&material=ss304&length=6-40&sort=relevance
│ PRICE         │  → server-rendered, shareable, indexable when canonical
│ BRAND         │
└───────────────┘
```

Sort options: Relevance · Price ↑ · Price ↓ · Newest · Bestselling · Thread size · Length. The last two are category-aware sorts pulled from the attribute schema — competitors don't have them and engineers want them.

**Zero results is never a dead end:**
```
  No Socket Head Cap Screws match M3 + SS316 + 45mm.
  We relaxed length → 40 mm. 6 results.        [ undo ]
  Or: request it made to order →
```

---

## 5. Product detail page (PDP)

```
Home › Fasteners › Screws by Head › Socket Head Cap Screws › M3×10 SS304
                                              (also in: 3D Printing ▾ · Drones ▾)
┌───────────────────────────┐ ┌─────────────────────────────────────────────┐
│                           │ │ M3 × 10mm Hex Socket Head Cap Screw, SS304  │
│    [ main image 1:1 ]     │ │ ⌗ FS-SHC-M3-010-SS304        ★4.8 (142)     │
│                           │ │                                             │
│                           │ │ ₹4.20 /pc        incl. GST                  │
│  ┌──┐┌──┐┌──┐┌──┐┌──┐    │ │ ● In stock — 2,480 pcs · ships today         │
│  └──┘└──┘└──┘└──┘└──┘    │ │                                             │
│   thumbs (hover to swap)  │ │ THREAD    [M2][M2.5][M3•][M4][M5][M6]       │
│   incl. one with a coin   │ │ LENGTH mm [6][8][10•][12][16][20][25][30]   │
│   for scale + a drawing   │ │ MATERIAL  [SS304•][SS316][12.9][Brass]      │
└───────────────────────────┘ │           ↑ unavailable combos are dimmed,   │
                              │             not hidden, and say why         │
                              │                                             │
                              │ Qty [ − ][  100  ][ + ]   pack of 1         │
                              │ ┌─────────────────────────────────────────┐ │
                              │ │ 1–9   ₹4.20    100–999  ₹3.10  ← active │ │
                              │ │ 10–99 ₹3.80    1000+    ₹2.60           │ │
                              │ └─────────────────────────────────────────┘ │
                              │ Total ₹310.00 · you save ₹110 (26%)         │
                              │                                             │
                              │ [   ADD TO CART   ] [ ♡ ] [ ⇄ ]             │
                              │ [ Add to BOM ]      [ Bulk quote 1000+ → ]  │
                              │                                             │
                              │ 🚚 Delivered by 30 Jul to 560001  [change]  │
                              │ 🧾 GST invoice · HSN 73181500               │
                              │ ↩ 7-day returns on unopened packs           │
                              └─────────────────────────────────────────────┘

┌── SPECIFICATIONS ──────────────────────────────────────────────────────────┐
│ DIMENSIONS                          MATERIAL & FINISH                      │
│ Thread            M3                Material        Stainless Steel 304    │
│ Pitch             0.50 mm           Finish          Plain / Passivated     │
│ Length            10.00 mm          Grade           A2-70                  │
│ Head diameter     5.50 mm           MECHANICAL                             │
│ Head height       3.00 mm           Tensile         700 MPa                │
│ Drive             Hex 2.5 mm        Max torque      1.35 Nm                │
│ Standard          DIN 912 / ISO 4762  Magnetic       No                    │
│                                     COMPLIANCE                             │
│                                     RoHS            Yes                    │
│                                     HSN             73181500               │
│                            [ Copy specs ]  [ Download drawing (PDF/STEP) ] │
└────────────────────────────────────────────────────────────────────────────┘

[ Description ] [ Q&A (12) ] [ Reviews (142) ] [ Shipping & Returns ]

FREQUENTLY BOUGHT TOGETHER   → M3 hex nut · M3 washer · 2.5mm hex key
USED IN THESE PROJECTS       → 3D Printer Build · Drone Frame · Robot Chassis
SIMILAR PARTS                → M3×12 SS304 · M3×10 12.9 · M3×10 Button Head
```

The variant matrix is the hard UX problem: 6 threads × 12 lengths × 4 materials = 288 combinations. Rules: dim-don't-hide unavailable combinations, always show *why* ("M3×10 in 12.9 alloy — made to order, 7 days"), and keep the URL on the selected variant so it can be shared and indexed.

---

## 6. Search results page (full page, not the overlay)

Same skeleton as the PLP, with three additions:
1. **Parsed-token bar** above the grid showing what we understood, each token removable.
2. **Category rail** at the top — "Your results span 4 categories" with counts, so a broad query like `bearing` can be narrowed by category before facets.
3. **Did you mean / also searched** row when the corrected spelling changed the result set.

---

## 7. Cart & checkout

```
CART (7 items from 4 categories)
┌────────────────────────────────────────────────┬───────────────────────┐
│ ▣ M3×10 SS304 Socket Head   ×100  ₹3.10 ₹310  │  Subtotal    ₹4,820   │
│   ⌗ FS-SHC-M3-010    [qty −100+] [♡] [remove] │  Bulk savings −₹640   │
│   ✓ tier 100–999 applied                       │  Shipping       ₹79   │
│ ▣ 608ZZ Bearing              ×10  ₹18.0 ₹180  │  GST (18%)     ₹868   │
│ ▣ NEMA 17 Stepper 1.8°        ×2  ₹640 ₹1280  │  ─────────────────── │
│ ▣ LiPo 4S 1500mAh             ×1  ₹1,890      │  Total       ₹5,127   │
│                                                │                       │
│ ⚡ Add ₹180 more for free shipping             │  [ CHECKOUT → ]       │
│ [ Import BOM (CSV) ]  [ Save as BOM ]         │  UPI · Cards · COD    │
└────────────────────────────────────────────────┴───────────────────────┘
```

Checkout: single page, 4 collapsible blocks — Contact → Delivery → GST details (optional, expands for B2B) → Payment. Guest by default; account creation offered *after* the order is placed, pre-filled. Cart is never lost on login.

---

## 8. Make-on-Demand flow

```
STEP 1 ─ UPLOAD                                          ○──○──○──○
┌────────────────────────────────────────────────────────────────┐
│         ⬆  Drop files or browse                                │
│    STEP · STL · IGES · DXF · DWG · PDF · XLSX/CSV BOM          │
│              max 100 MB per file, 20 files                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ▣ bracket_v3.step   4.2 MB  ✓ uploaded          [remove] │  │
│  │ ▣ drawing_v3.pdf    880 KB  ✓ uploaded          [remove] │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ☐ This is confidential — require an NDA before review         │
└────────────────────────────────────────────────────────────────┘

STEP 2 ─ SPECIFY                                         ●──○──○──○
  Process    [CNC Machining ▾]  Material [Aluminium 6061 ▾]
  Finish     [Anodised, clear ▾] Tolerance [±0.1 mm ▾]
  Quantity   [ 500 ]  + add another qty break (50 / 500 / 5000)
  Need by    [ 25 Aug 2026 ]     Target price/pc [ ₹ optional ]
  Notes      [ ................................................ ]

STEP 3 ─ CONTACT                                         ●──●──○──○
  Name · Company · Email · Phone · GSTIN (optional) · City

STEP 4 ─ SUBMITTED                                       ●──●──●──○
  RFQ #MOD-2026-0417 received.
  An engineer responds within 4 business hours.
  Quote within 24 hours.        [ Track in your portal → ]
```

**Customer portal RFQ states:** `Submitted → Under review → Quoted → Approved → In production → QC → Shipped → Delivered`, each with a timestamp, an owner, and a comment thread. Files, revisions and quote PDFs live on the same page.

**Admin console** mirrors it as a queue: filter by state/age/value, assign an engineer, open a cost sheet (material + machining time + finishing + tooling + margin + GST), generate the quote PDF, send, and convert an approved quote into a Job with milestones. SLA breaches (> 4 h unanswered) surface in red at the top of the queue.

---

## 9. Responsive rules

| Element | Mobile (< 768) | Tablet (768–1023) | Desktop (≥ 1024) |
|---|---|---|---|
| Header | Logo + 🔎 + 🛒, hamburger nav | + category chip row | Full, two rows |
| Mega menu | Full-screen drill-down | Full-screen drill-down | 3-panel hover |
| Hero | Stacked, canvas off < 480 px | Stacked, canvas at 30 fps | Full, canvas on |
| Search overlay | Full screen | Full screen | 960 px centred panel |
| Product grid | 2 cols | 3 cols | 4 cols (5 at ≥ 1536) |
| Filters | `[Filters (n)]` → bottom sheet | Bottom sheet | 264 px sticky rail |
| PDP | Gallery → info → specs, stacked; sticky add-to-cart bar at the bottom | 2 col, specs full-width | 2 col, sticky right column |
| Price break table | Horizontal scroll | Full | Full |
| Cart | Stacked, summary sticky at bottom | 2 col | 2 col |

**Mobile-first is not optional here.** Indian maker traffic to comparable stores runs 65–75% mobile, and much of it is a buyer standing at a workbench with a broken part in one hand.
