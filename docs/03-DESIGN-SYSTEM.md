# OnlyParts — Design System

**Version:** 2.0 — *light theme only*
**Brand colour:** Turquoise `#40E0D0`
**Design principle:** *Engineered, not decorated.* The interface should feel like a precision instrument — bright, high-contrast, dense with real information, with turquoise used as a signal rather than a wash.

> **v2 change log.** Dark mode removed; light is the only theme. Every high-performing parts retailer in the world — McMaster-Carr, DigiKey, Mouser, Misumi, Grainger, Xometry — is light, because dark reads as consumer-tech rather than instrument-grade, and because a white field makes product photography and line drawings legible. See `12-COMPETITIVE-RESEARCH.md` §8. Also new in v2: ratio-locked image frames with designed placeholder states (§6), motion moved below the fold (§7.3), and denser grids (§4.4).

---

## 1. Brand foundation

### 1.1 Positioning in visual terms

| We are | We are not |
|---|---|
| Bright, technical, drafting-table | Moody, dark, consumer-gadget |
| Monospace part numbers, real specs on the tile | Marketing adjectives on the tile |
| Turquoise as a *signal* — active, in-stock, selected, CTA | Turquoise as a background wash |
| Dense — more parts per screen than a fashion store | Generous whitespace for its own sake |
| Motion that reveals structure, below the fold | Motion that delays the first paint |
| CAD line drawings in the grid, photography on the PDP | Stock photos of smiling engineers |

### 1.2 Logo

Wordmark `only` in ink-950 + `parts` in turquoise-700, set in the display face at weight 700, `-0.03em` tracking. Mark: a hexagonal socket-head silhouette that doubles as the favicon and the loading spinner (rotates 60° per step — a hex has 6-fold symmetry, so the rotation reads as continuous).

Minimum clear space = cap-height on all sides. Minimum width 96 px desktop / 84 px mobile.

---

## 2. Colour

### 2.1 Turquoise ramp

`#40E0D0` is a **light** colour (relative luminance 0.59). On a light interface that is a constraint with one clean resolution:

- **`--tq-400` is a fill, never text.** As a button fill with `--ink-950` text on it, it hits 12.8:1 — AAA, and it is the single most recognisable element of the brand.
- **`--tq-700` is turquoise text.** 6.5:1 on white — AAA for large text, AA everywhere.
- **`--tq-50` / `--tq-100` are surfaces.** Tinted panels, selected states, image-placeholder fields.

Everything below follows from that split.

| Token | Hex | Use |
|---|---|---|
| Token | Hex | Use |
|---|---|---|
| `--tq-50` | `#EAFCFA` | Tinted section backgrounds, image-placeholder field |
| `--tq-100` | `#C9F7F2` | Hover tint, selected chip background |
| `--tq-200` | `#98EFE7` | Borders on tinted surfaces, disabled fill |
| `--tq-300` | `#63E7DB` | Decorative line-art on tinted fields |
| **`--tq-400`** | **`#40E0D0`** | **Brand. Primary button fill, active fill, focus ring, brand rules and accents** |
| `--tq-500` | `#21C4B4` | Hover state of the brand fill |
| `--tq-600` | `#12A096` | Pressed state of the brand fill; icon strokes (4.6:1) |
| `--tq-700` | `#107F78` | **Turquoise text and links** (6.5:1 on white) |
| `--tq-800` | `#126561` | Emphasised turquoise text, chart series |
| `--tq-900` | `#135350` | Deep accent |
| `--tq-950` | `#04302F` | Deepest accent; the one place turquoise goes near-black |

**Hard rule:** `--tq-400` is never text. Turquoise text is `--tq-700` or darker, always.

### 2.2 Ink ramp (cool neutrals, subtly turquoise-tinted)

| Token | Hex | Use |
|---|---|---|
| `--white` | `#FFFFFF` | Card and panel surface |
| `--ink-50` | `#F6F9FA` | Page background |
| `--ink-100` | `#EDF2F4` | Sunken surface, zebra stripe, skeleton base |
| `--ink-200` | `#DCE5E8` | Dividers, subtle borders |
| `--ink-300` | `#C2CFD3` | Default border |
| `--ink-400` | `#9BABB1` | Strong border, disabled fill |
| `--ink-500` | `#6B7F86` | Disabled text, decorative numerals (4.6:1) |
| `--ink-600` | `#4B5C63` | Tertiary / meta text (7.0:1) |
| `--ink-700` | `#33454B` | Secondary text (9.9:1) |
| `--ink-800` | `#26343A` | Body text (12.4:1) |
| `--ink-900` | `#131D21` | Headings (16.6:1) |
| `--ink-950` | `#0A1114` | Maximum-contrast text, text on turquoise fills |

### 2.3 Contrast audit (WCAG 2.2, all against the surface stated)

| Pair | Ratio | Verdict |
|---|---|---|
| `--ink-950` on `--tq-400` fill | **12.8:1** | AAA — the primary button |
| `--ink-900` on `--white` | **16.6:1** | AAA — headings |
| `--ink-800` on `--white` | **12.4:1** | AAA — body |
| `--ink-700` on `--white` | **9.9:1** | AAA — secondary |
| `--ink-600` on `--white` | **7.0:1** | AAA — tertiary/meta |
| `--ink-500` on `--white` | **4.6:1** | AA — disabled and decorative only, never body |
| `--tq-700` on `--white` | **6.5:1** | AAA (large) / AA (body) — links, turquoise text |
| `--tq-800` on `--tq-50` | **7.9:1** | AAA — text on tinted panels |
| `--tq-400` on `--white` | 1.6:1 | ❌ **banned as text** |
| `--tq-400` 2 px focus ring on `--white` | 1.6:1 | ❌ insufficient alone — see below |
| `--tq-600` 2 px focus ring on `--white` | **4.6:1** | ✅ exceeds the 3:1 non-text requirement |

**Focus rings use `--tq-600`, not `--tq-400`.** This is the one place the brand colour loses to accessibility, and it is not negotiable: a `#40E0D0` ring on white is invisible to a meaningful share of users. The ring is `2px --white` + `2px --tq-600`, so it reads on any surface.

### 2.4 Semantic colours

Chosen for hue separation from turquoise (hue 175°) so status never reads as brand.

| Token | Hex | On white | Surface pair | Use |
|---|---|---|---|---|
| `--success` | `#0E9F5B` | 4.6:1 | `#E7F7EF` | In stock, order confirmed, quote accepted |
| `--warning` | `#B8730A` | 4.6:1 | `#FDF3E2` | Low stock, lead time, action needed |
| `--danger` | `#D42133` | 4.9:1 | `#FDEBEC` | Out of stock, failure, destructive |
| `--info` | `#2563EB` | 5.9:1 | `#EAF0FE` | Neutral notices, "made to order" |
| `--sale` | `#E2551F` | 4.5:1 | `#FDEEE7` | Discount badges — orange, never turquoise |

**Stock semantics on the tile:** In stock = `--success` dot. Low stock (< 10) = `--warning` dot + count. Made to order = `--info` dot + lead time. Out of stock = `--ink-500` dot + "Notify me".

### 2.5 Semantic layer — one theme

There is no theme switcher. `color-scheme: light` is declared so form controls and scrollbars render correctly, and `prefers-color-scheme: dark` is deliberately **not** honoured.

```css
:root {
  color-scheme: light;

  --bg:            var(--ink-50);    /* page */
  --bg-elevated:   var(--white);     /* cards, panels, header */
  --bg-sunken:     var(--ink-100);   /* inset sections, image frames */
  --bg-tint:       var(--tq-50);     /* branded section bands */

  --surface:       var(--white);
  --surface-hover: var(--ink-50);
  --surface-active:var(--tq-50);

  --border:        var(--ink-300);
  --border-subtle: var(--ink-200);
  --border-strong: var(--ink-400);

  --text:          var(--ink-900);   /* headings */
  --text-body:     var(--ink-800);
  --text-muted:    var(--ink-700);
  --text-faint:    var(--ink-600);
  --text-disabled: var(--ink-500);

  --accent:        var(--tq-400);    /* FILL ONLY */
  --accent-hover:  var(--tq-500);
  --accent-press:  var(--tq-600);
  --accent-text:   var(--tq-700);    /* TEXT ONLY */
  --on-accent:     var(--ink-950);
  --focus:         var(--tq-600);
}
```

Two tokens, one rule: **`--accent` fills, `--accent-text` reads.** Mixing them is the only way to get the contrast wrong, so the naming makes it hard to.

---

## 3. Typography

### 3.1 Faces

| Role | Face | Fallback | Why |
|---|---|---|---|
| Display / headings | **Space Grotesk** | `ui-sans-serif, system-ui` | Technical grotesk with mechanical detailing; reads as engineering, not fashion |
| UI / body | **Inter** | `system-ui, -apple-system, Segoe UI` | Best-in-class at small sizes; tabular numerals; huge language coverage for later Hindi/Tamil |
| Mono / specs | **JetBrains Mono** | `ui-monospace, SFMono-Regular, Menlo` | Part numbers, dimensions, SKUs, thread callouts. Unambiguous `0/O`, `1/l/I` — a hard requirement when the string is `M3x10 SS304 vs M3x1O` |

All three are SIL Open Font License, self-hosted as `woff2` subsets. `font-display: swap`. Latin + Latin-Ext subsets only at launch (~110 KB total, preloaded).

**Mono is not decorative.** Every SKU, part number, dimension, thread spec, and price break table uses it. It is what makes the catalog feel authoritative.

### 3.2 Type scale (1.250 major third, 16 px base)

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `display-1` | `clamp(3rem, 8vw, 6rem)` / 0.95 | 700 | -0.04em | Hero headline |
| `display-2` | `clamp(2.25rem, 5vw, 3.75rem)` / 1.0 | 700 | -0.03em | Section headlines |
| `h1` | `2.5rem` / 1.1 | 700 | -0.02em | Page titles |
| `h2` | `2rem` / 1.15 | 600 | -0.02em | Section |
| `h3` | `1.5rem` / 1.25 | 600 | -0.01em | Subsection, PDP blocks |
| `h4` | `1.25rem` / 1.3 | 600 | -0.01em | Card titles |
| `body-lg` | `1.125rem` / 1.6 | 400 | 0 | Lead paragraphs |
| `body` | `1rem` / 1.6 | 400 | 0 | Default |
| `body-sm` | `0.875rem` / 1.55 | 400 | 0 | Dense UI, table cells |
| `caption` | `0.75rem` / 1.45 | 500 | 0.01em | Meta, helper text |
| `overline` | `0.6875rem` / 1.2 | 700 | **0.14em**, uppercase | Section eyebrows, category labels |
| `mono-lg` | `1rem` / 1.5 | 500 | 0 | PDP spec values |
| `mono` | `0.875rem` / 1.5 | 500 | 0 | SKUs, dimensions |
| `mono-sm` | `0.75rem` / 1.4 | 500 | 0.01em | Tile part codes |

Prices always use `font-variant-numeric: tabular-nums` so they align in columns.

---

## 4. Space, radius, elevation

### 4.1 Spacing — 4 px base

`--s-1: 4px · --s-2: 8px · --s-3: 12px · --s-4: 16px · --s-5: 20px · --s-6: 24px · --s-8: 32px · --s-10: 40px · --s-12: 48px · --s-16: 64px · --s-20: 80px · --s-24: 96px · --s-32: 128px`

Section vertical rhythm: `clamp(64px, 10vh, 128px)` top and bottom.

### 4.2 Radius

`--r-xs: 4px` (chips, badges) · `--r-sm: 6px` (inputs, buttons) · `--r-md: 10px` (cards) · `--r-lg: 16px` (panels, modals) · `--r-xl: 24px` (hero surfaces) · `--r-full: 999px` (pills, avatars)

Deliberately restrained. Over-rounded corners read as consumer app; parts retail should read as machined.

### 4.3 Elevation

On a light UI, elevation is carried by **a 1 px border plus a soft, low-opacity shadow**. Shadows stay tinted toward the ink hue rather than pure black, so they read as depth rather than grime.

```css
--e-0: none;                                                      /* flush */
--e-1: 0 1px 2px rgb(10 17 20 / .06);                             /* card at rest */
--e-2: 0 6px 16px -4px rgb(10 17 20 / .12),
       0 2px 4px rgb(10 17 20 / .06);                             /* hovered card, dropdown */
--e-3: 0 24px 48px -12px rgb(10 17 20 / .18),
       0 4px 12px rgb(10 17 20 / .08);                            /* modal, search overlay */
--e-ring: 0 0 0 1px var(--tq-400),
          0 6px 20px -6px rgb(64 224 208 / .45);                  /* active/selected emphasis */
```

`--e-ring` is the turquoise signature — the focused search bar, the selected variant chip, the hovered product tile. Used sparingly, it is the thing people remember.

### 4.4 Grid & layout

- Container: `1440px` max, `--s-5` gutters mobile, `--s-10` desktop.
- 12-column grid, `20px` gap desktop / `16px` tablet / `12px` mobile.
- Breakpoints: `sm 480 · md 768 · lg 1024 · xl 1280 · 2xl 1536`.
- **Product grid: 2 cols mobile, 3 tablet, 4 desktop, 5 at xl, 6 at 2xl.** Density is a feature — parts buyers scan far more items per session than a fashion shopper, and DigiKey/Misumi both run denser than typical retail. The 6-column tier drops the spec line and keeps title + price + stock.
- PLP layout: 256 px filter rail (sticky, own scroll) + fluid grid. Rail becomes a bottom sheet below `lg`. The rail is **open by default on desktop** — filter-first is the McMaster lesson.
- **Bento layout for marketing sections.** The 13 category tiles are not a uniform 4×4; the first four run at double width with imagery, the rest at single. It stops the grid reading as a spreadsheet and lets the highest-intent categories carry a real photograph.

---

## 5. Components

### 5.1 Buttons

| Variant | Rest | Hover | Active | Use |
|---|---|---|---|---|
| **Primary** | `--tq-400` bg, `--ink-950` text | `--tq-300` bg, `translateY(-1px)` | `--tq-500` bg, `translateY(0)` | Add to cart, Get quote |
| **Secondary** | transparent, `1px --border-strong`, `--text` | `--surface-hover` bg, border → `--tq-400` | `--surface` bg | Compare, Add to BOM |
| **Ghost** | transparent, `--text-muted` | `--surface-hover`, `--text` | — | Icon actions, tertiary |
| **Danger** | `--danger` bg, white text | `#D62A3C` | | Remove, cancel order |
| **Link** | `--accent` text, underline on hover | `--accent-hover` | | Inline |

Sizes: `sm 32px · md 40px · lg 48px · xl 56px` (hero CTA). Min touch target 44×44 always, padded if the visual box is smaller.

Every button has a `:focus-visible` ring: `0 0 0 2px var(--bg), 0 0 0 4px var(--focus)`.

Loading state = label stays in place at 0 opacity, spinner overlays. No width jump.

### 5.2 Search bar — the hero component

This is the most important component on the site. It has three states:

**Rest (hero):** 64 px tall, `--ink-900` bg, `2px solid --ink-700`, `--r-full`. Left: search glyph in `--tq-400`. Placeholder cycles through real engineering queries with a typewriter effect — `M3x10 SS304 socket head` → `608ZZ bearing` → `NEMA 17 stepper` → `18650 3000mAh` → `N52 disc magnet 15x3`. Right: a `⌘K` / `Ctrl K` hint chip.

**Focused:** border → `--tq-400`, `--e-glow` applied, page behind dims to `rgb(0 0 0 / .6)` with a 8 px backdrop blur. The bar rises to the top of the viewport and the results panel expands beneath it.

**Results panel:** max 720 px wide (960 on desktop hero), `--e-3`, four regions:
1. **Parsed tokens** — when the query contains recognised attributes, they render as removable turquoise chips: `[M3 ×] [10 mm ×] [SS304 ×]`. This is the single feature that will make people talk about the search.
2. **Products** — 6 rows: 44 px thumb, title, mono SKU, price, stock dot.
3. **Categories** — 3 rows with full breadcrumb path.
4. **Projects & Guides** — 2 rows.
Footer: `↑↓ navigate · ↵ open · esc close` and "View all N results".

Full behaviour spec: `09-SEARCH-SPEC.md`.

### 5.3 Product tile

```
┌──────────────────────────┐
│  [image, 1:1, dark bg]   │  hover: image swaps to alt angle,
│                     ♡    │  border → --tq-400, --e-2, lifts 2px
│  ● In stock (240)        │  stock dot, top-left, over image
├──────────────────────────┤
│  M3 × 10mm Socket Head   │  h4, 2-line clamp
│  SS304 Screw             │
│  ⌗ FS-SHC-M3-010-SS304   │  mono-sm, --text-faint
│  ₹4.20 /pc               │  h4 tabular-nums, --text
│  ₹3.10 @ 100+            │  caption, --accent
│  [ M3 ] [M4] [M5]        │  variant quick-chips, selected = tq fill
│  [    Add to cart     ]  │  appears on hover desktop; always on mobile
└──────────────────────────┘
```

Non-negotiables: price break visible on the tile (drives the no-MOQ+bulk story), stock state visible without a click, and the SKU always shown — buyers search by SKU and screenshot tiles into WhatsApp.

### 5.4 Category tile (landing)

Dark card, product silhouette in turquoise line-art, category name in display face, subcategory count in `overline`. On hover: the silhouette animates (a screw rotates and drives in, a bearing's races counter-rotate, a prop spins, a magnet snaps two poles together). Each of the 13 has its **own** hover animation — this is where the personality lives.

### 5.5 Facet rail

Grouped, collapsible, with live counts. Numeric attributes (length, bore, capacity) get a dual-thumb range slider **plus** a mono text input pair, because engineers type exact values. Selected facets appear as removable chips above the grid. `Clear all` always visible when any facet is active. Counts update optimistically then reconcile.

### 5.6 Spec table (PDP)

Two-column, zebra-striped with `--surface-hover`. Labels in `body-sm --text-muted`, values in `mono-lg --text`. Grouped by section (Dimensions / Material / Mechanical / Compliance). A `Copy specs` action yields tab-separated text that pastes cleanly into Excel — a small feature P2 and P3 will love.

### 5.7 Price break table

```
Qty        Unit price    You save
1–9        ₹4.20          —
10–99      ₹3.80          9%
100–999    ₹3.10          26%
1000+      ₹2.60          38%      [ Request bulk quote → ]
```
Mono, tabular. The active tier highlights as the user changes quantity — a live, legible reason to buy more.

### 5.8 Other components

Badges/chips · breadcrumbs (with a category switcher when the product is cross-listed) · quantity stepper (mono input, +/- buttons, respects MOQ/pack multiples) · toast (bottom-right desktop, top mobile, 4 s) · empty states (always with a recovery action) · skeletons (shimmer travelling left→right, 1.4 s) · modal/drawer · tabs · accordion · pagination (infinite scroll + a real "Load more" button, plus numbered pages in the footer for SEO) · file dropzone (MoD) · stepper/progress (RFQ status) · data table (admin).

---

## 6. Iconography & imagery

**Icons:** Lucide, 1.5 px stroke, 20/24 px. Custom set for the 13 category glyphs, drawn on the same 24 px grid and same stroke weight — hex socket, rotor, resistor, cell, nozzle, propeller, spanner, race+balls, horseshoe/pole pair, end mill, contactor, hub motor, extrusion profile.

### 6.1 Dual-asset strategy

McMaster-Carr and Accu both use **CAD-style line drawings, not photographs, as the grid thumbnail** — a technical drawing with dimension callouts communicates more about a grey screw than a photo of a grey screw, and it renders in 4 KB. We adopt both assets with distinct jobs:

| Asset | Where | Why |
|---|---|---|
| **Line illustration** (SVG) | Grid thumbnail, category tile, mega-menu, search overlay row | Legible at 120 px, uniform across a catalogue, tiny, and renders instantly |
| **Photograph** | PDP hero and gallery, project cards, marketing | Proves the part is real and shows finish, colour and packaging |

### 6.2 Image frames and placeholders — a first-class component

**Every** image slot in the system is a `<Frame>`: a ratio-locked box that renders a designed placeholder when no asset exists. Layout is therefore correct on day one, before a single photograph is shot, and a missing image never collapses a grid.

| Frame | Ratio | Placeholder |
|---|---|---|
| Product thumbnail | 1:1 | `--tq-50` field, category line-art glyph at 40% in `--tq-300`, faint 8 px technical grid |
| Product hero (PDP) | 1:1 | Same, plus the SKU in mono, centred below the glyph |
| Category tile | 4:3 | `--tq-50` field, large category glyph, diagonal hairline rule |
| Project card | 3:2 | `--ink-100` field, glyph in `--ink-400` |
| Guide/blog | 16:9 | `--ink-100` field, no glyph |

Placeholders are **CSS + inline SVG, never a raster file** — they cost nothing, tint correctly, and scale.

### 6.3 Photography standard (a launch gate, not a nice-to-have)

- Seamless `#FFFFFF` background, single key light from upper-left, soft fill, subtle contact shadow so the part doesn't float.
- Minimum 3 angles: hero 3/4, top-down, and one **with a scale reference** (₹1 coin or a rule).
- 2000×2000 master, square. AVIF primary, WebP fallback, at 400/800/1200/1600.
- Threads, knurls and markings must be in focus — this is a parts store; the macro detail *is* the product description.

### 6.4 Illustration language

Turquoise `--tq-600` line-art on white or `--tq-50`, 1.5 px stroke, technical-drawing grammar — section views, centre lines, leader lines with dimension callouts. Blueprint, not cartoon.

---

## 7. Motion

### 7.1 Principles

1. Motion explains structure and hierarchy. If it doesn't, cut it.
2. Scroll owns the landing page; clicks own everything else.
3. Nothing on the landing page may block the LCP element or the search bar's interactivity.
4. Everything degrades to a static, complete layout under `prefers-reduced-motion`.

### 7.2 Tokens

```css
--dur-instant: 80ms;    /* state flicks: hover, chip toggle */
--dur-fast:   160ms;    /* buttons, tooltips */
--dur-base:   240ms;    /* cards, dropdowns, drawers */
--dur-slow:   400ms;    /* section reveals, overlays */
--dur-scene:  800ms;    /* hero orchestration */

--ease-out:   cubic-bezier(.16, 1, .3, 1);      /* the default — decisive arrival */
--ease-in-out:cubic-bezier(.65, 0, .35, 1);
--ease-spring:cubic-bezier(.34, 1.56, .64, 1);  /* chips, add-to-cart pop only */
--ease-mech:  cubic-bezier(.83, 0, .17, 1);     /* "machine" moves: threading, indexing */
```

`--ease-mech` is the brand's signature curve: slow start, fast middle, hard stop — how a machine actually indexes. Used for the hero parts animation and the category tile hovers.

### 7.3 Landing page scroll narrative

Implemented with **CSS scroll-driven animations** (`animation-timeline: view()` / `scroll()`) with an IntersectionObserver fallback. Zero animation library on the critical path.

**v2 rule: the fold is a motion-free zone.** The hero leads with clarity — headline, search bar, trust facts — and animates only its own entrance (opacity + 24 px rise, complete in 900 ms). Heavy scroll choreography begins at beat 2 and peaks in the middle of the page, where it rewards engagement instead of delaying the LCP element and the search bar's interactivity.

| # | Section | Trigger | Motion |
|---|---|---|---|
| 1 | **Hero** | load only | Headline words rise 24 px and fade in, 60 ms stagger. Search bar scales 0.98→1. A **light, slow drift of line-art part silhouettes** sits behind at ≤ 12% opacity in `--tq-300` — decorative texture, not a performance, and it never overlaps the headline's bounding box. No scroll-linked behaviour above the fold. |
| 2 | **Category bento** | `view()` 0→40% | Tiles enter on a staggered ripple, `translateY(24px) scale(.98)` → rest, 40 ms stagger. Each line-art glyph draws itself via `stroke-dashoffset`. On hover: the image frame scales 1.04 under `overflow:hidden`, and the glyph plays its own signature move (a screw drives in, a bearing's races counter-rotate, a prop spins). |
| 3 | **Search demo** | across the whole section traversal | The centrepiece. A pinned, vertically-centred panel: as the user scrolls, a query types itself, tokens pop into turquoise chips, result rows resolve out of skeletons. Scrubbed to scroll position so it reads as *the user's own* scroll driving it. **Two rules learned the hard way — see below.** |

**The two rules for a pinned scrub, both of which we got wrong first:**

1. **Map progress to the whole section traversal, not the pinned range.** A vertically-centred sticky panel becomes *visible* long before it *pins*. Scrubbing only the pinned range means the panel sits on screen at progress 0 — an empty box — for a full viewport of scrolling. Mapping from "section enters the bottom edge" to "section clears the top edge" means the query is already ~55% typed by the time the panel reaches centre, and it reads as alive on arrival.
2. **The zero-progress frame must be a designed state, not an absence.** The results area holds skeleton rows from the first frame and cross-fades them into real rows; the query line shows a placeholder with a blinking caret rather than nothing. There is no scroll position at which the panel looks broken.
| 4 | **Trust band** | `view()` | Counters roll up (`0 → 12,000`), a hairline rule draws left-to-right beneath each figure. |
| 5 | **Shop by project** | `view()` | Horizontal parallax: cards translate on X at differing rates as the section passes through, with their image frames counter-translating slightly for depth. |
| 6 | **Make-on-Demand** | `view()` | Split reveal — a technical-drawing part rotates on one side (CSS transform sequence, not WebGL), the four steps tick in on the other with the connector line drawing between them. |
| 7 | **Reviews** | `view()` | Marquee that slows to a stop when hovered or focused. |

**Removed in v2:** the "✓ typo tolerant · ✓ synonym aware · ✓ unit aware" strip under the search demo. The demo already proves all three; the strip was the interface explaining its own cleverness.

**Performance budget for the landing page: ≤ 60 KB JS (gzipped) and ≤ 180 KB of imagery above the fold.** Only `transform` and `opacity` are animated. Layers are promoted with `will-change` on approach and released after. The parts field is a single `<canvas>` capped at 30 fps on mobile and disabled entirely below 480 px width or when `navigator.hardwareConcurrency < 4`.

### 7.4 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```
Plus JS gating: the canvas parts field never initialises, the pinned search demo becomes a static annotated screenshot, and the marquee becomes a static grid. **The reduced-motion page must contain every piece of information the animated page does.**

---

## 8. Accessibility

- WCAG 2.2 AA across the storefront; the checkout and RFQ paths are audited to AAA on contrast.
- Visible focus everywhere; the search overlay is a proper focus trap with `Esc` to exit and focus returned to the trigger.
- Search results are an ARIA combobox/listbox with `aria-activedescendant`; result counts announced via a polite live region.
- Facet changes announce "Showing 128 results" politely; never assertively.
- All imagery has descriptive alt text generated from the attribute schema, e.g. *"M3 × 10 mm stainless steel 304 socket head cap screw, hex drive, shown beside a one rupee coin for scale."*
- Colour is never the only signal: stock state is dot **+ text**, validation is icon **+ text**, selected facets are fill **+ checkmark**.
- Target size ≥ 24×24 CSS px (2.2 AA), 44×44 for primary commerce actions.
- Full keyboard operation of the variant matrix, the quantity stepper, and the file dropzone (which must accept a real `<input type="file">`, not a drag-only surface).
- Tested with NVDA/Chrome, VoiceOver/Safari, and at 200% zoom and 320 px width.

---

## 9. Design tokens (implementation)

Single source of truth: `packages/tokens/tokens.json` (W3C Design Tokens format). Style Dictionary builds it to:

- `tokens.css` — CSS custom properties, consumed by Tailwind via `@theme`
- `tokens.ts` — typed exports for JS-driven animation values
- `tokens.json` — Figma variables sync

Nothing in the codebase may hardcode a hex value. Lint rule: `no-hardcoded-colors` fails CI on any `#RRGGBB` outside the tokens package.

```css
:root {
  --tq-50:#EAFCFA; --tq-100:#C9F7F2; --tq-200:#98EFE7; --tq-300:#63E7DB;
  --tq-400:#40E0D0; --tq-500:#21C4B4; --tq-600:#12A096; --tq-700:#107F78;
  --tq-800:#126561; --tq-900:#135350; --tq-950:#04302F;

  --white:#FFFFFF;  --ink-50:#F6F9FA;  --ink-100:#EDF2F4; --ink-200:#DCE5E8;
  --ink-300:#C2CFD3; --ink-400:#9BABB1; --ink-500:#6B7F86; --ink-600:#4B5C63;
  --ink-700:#33454B; --ink-800:#26343A; --ink-900:#131D21; --ink-950:#0A1114;

  --success:#0E9F5B; --warning:#B8730A; --danger:#D42133;
  --info:#2563EB;    --sale:#E2551F;

  --font-display:"Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-ui:"Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono:"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

**Semantic colours were re-darkened for v2.** The dark-theme values (`#2FBF71`, `#F5A524`, `#F0384B`) sat at 1.9–2.6:1 on white — fine as dots on a dark card, illegible as text on a light one. The values above all clear 4.5:1 on white. Where a status needs a *fill* (an "In stock" pill), the fill is the 50-tint of the same hue with the dark value as its text.

## 10. Voice & tone

Direct, technical, confident. We assume the reader knows what a thread pitch is; we never talk down and never oversell.

| Do | Don't |
|---|---|
| "M3 × 10 mm, SS304, hex socket. In stock, 240 pcs." | "Premium quality high-grade screw for all your needs!" |
| "Buy one. Buy ten thousand. No minimum." | "Amazing deals on bulk orders!!" |
| "Ships today if ordered before 4 PM." | "Super fast delivery!" |
| "We couldn't find `M3x7`. Nearest: M3×6 and M3×8." | "No results found." |
| "Upload your drawing. We'll quote in 24 hours." | "Contact us for a customised solution." |

Error messages state what happened, why, and the next action — in that order, in one sentence where possible.
