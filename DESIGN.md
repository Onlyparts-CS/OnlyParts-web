# Design

<!-- impeccable:design v1 · world: parts-index · seed 1a1935f1 -->

Recorded from the built system, not from intention. Source of truth is
`apps/web/src/app/globals.css`; this file explains what the tokens are *for*.

## The world

A steel parts cabinet and the visible-edge card file that sits on top of it,
printed as a two-colour job: one black plate, one spot plate, on uncoated
stock. That single constraint enforces the whole brief — a two-plate press
cannot produce a purple gradient, a glossy 3D blob, or an evenly-distributed
palette.

Every surface is one of four objects: a **drawer front** (a category), an
**index card** (a product, a build, a review), a **plate** (any image), or the
**cabinet rail** (global chrome).

## Colour

Near-monochrome ground, **one** working accent. Turquoise is defined and
reserved for Make-on-Demand, but nothing renders it today — `.btn-make`,
`.tab-make` and `.stamp-make` are the only references and no page uses them.
Make-on-Demand is separated by a tinted ground and the "specimen · not a
stocked part" label instead, which is the better answer: a band arguing in a
second hue competes with the accent that does the selling.

| Role | Token | Value | Rule |
|---|---|---|---|
| Paper | `--color-bg` | `#F7F5F1` | page ground, warm neutral |
| Card | `--color-surface` | `#FFFFFF` | card stock |
| Ink | `--color-ink-950…50` | `#0F0D0A` → `#F7F5F1` | warm-neutral, **not** blue-grey |
| **Spot** | `--color-spot-*` | fill `#5FAF42`, rule `#3E8A2C`, text `#2A6721` | the single accent, every page |
| Turquoise | `--color-tq-*` | `#40E0D0` | Make-on-Demand only |

The accent was red-oxide primer until 2026-08-06 and is now the green of the
mark, sampled from the logo artwork. The token is named for its **role** — the
second plate on a two-colour job — and not for its colour, so the next re-plate
is values and nothing else. Anything reading `ox-*` predates the change.

What separates Make-on-Demand is the tinted ground and the "specimen · not
a stocked part" label — it says what it is instead of using a colour to say it.
Turquoise measures dE 53.8 from the new spot green, so it still reads as a
different answer if that surface is ever built.

Hard rules, all verified by measurement:

- **Three steps, three jobs, never swapped.** `spot-500` (`#5FAF42`) is fill
  only at 2.51:1 — never text, and never a border or focus ring either, because
  it misses the 3:1 that WCAG 1.4.11 asks of non-text UI. `spot-600`
  (`#3E8A2C`, 3.95:1) carries rules, focus rings and the halftone plate.
  `spot-700` (`#2A6721`, 6.30:1) carries text.
- **Reversed type sits on `spot-700`, not 600.** Green is a lighter ink than
  oxide: `--color-on-accent` (`#F2F7F0`) on 600 is 4.01:1 and misses AA; on 700
  it is 6.32:1. So `.btn-primary`, `.token-chip` and the logo tile all fill 700.
  Dark type on `spot-500` is the other legal pairing at 7.11:1.
- `ink-500` (`#6E6656`) is the smallest legible label colour, 5.2:1 on paper.
- Status colours stay clear of the accent: **success moved to `#1E6B5E`** —
  against `spot-700` the old `#2F6B41` measured dE 15.7, close enough that a
  green link and a green success message read as one thing. It is now dE 33.
  warning `#7A5510`, danger `#9B1C2E`, info `#2C4A7C`. All ≥5.4:1 on paper.
- `--color-sale` keeps the retired oxide, so a future sale badge cannot vanish
  into the green. It and `--shadow-ring` are declared but unused; Tailwind
  drops them from the build.
- **Light ground is permanent. There is no dark theme.**

Audited across 15 routes: **zero functional contrast failures.** One deliberate
exemption — the footer's `Onlyparts` watermark at 1.35:1, `aria-hidden`, pure
decoration under WCAG 1.4.3, with the same wordmark set legibly above it.

## Type

Two families. **Archivo** (variable, with the `wdth` axis) and **Azeret Mono**.
Neither is a system stack; both were chosen against the training-data defaults.

Type lives at the extremes — plate lettering or an agate label, as little as
possible in between:

- `.monumental` — `font-stretch: 118%`, weight 800, uppercase, `line-height .86`,
  tracking `-0.045em`. Drawer labels, page titles, the footer base plate.
- `h2` takes the plate register **by default** (uppercase, 116% stretch). `h1`
  does not — a product title is a name, and shouting it is wrong.
- `.bin` — 9px Azeret Mono, `0.22em` tracking, uppercase. Bin coordinates,
  drawer addresses, dimensions, timestamps. This is the marginalia voice.
- `.overline` — a *field label* naming an adjacent datum. It is **not** an
  eyebrow: a kicker above a heading is banned outright and all ten call sites
  were removed.

## Layout and shape

- Radii are **zero**, all five steps. A card index has square corners; every
  inherited `rounded-*` de-rounds through the token. The steps survive only
  because Tailwind's scale expects them — they are one decision, not five.
- `.rack` is the panel primitive: `grid; gap: 1px` over `--color-line`, so a
  run of cells is a ruled sheet rather than a tray of separately-bordered
  tiles. Children carry their own background and no border. Used across the
  admin console; the storefront keeps `.card-index`, which is a *lifted* card
  and genuinely wants its own edge. Nothing lifts on hover inside a rack — a
  cell that rises tears the rule it is ruled against, so hover is a
  background change.
- `.stamp-flat` drops the stamp's 1.4° tilt for tables. Forty tilted stamps
  down a column read as a crooked table, not as forty stamps.
- Three spacing steps only: `.page-shell` (40/64px), `.section-gap`, `.stack`.
- `.container-page` max 1560px.
- Shadows are warm — a neutral-grey shadow on warm paper reads as dirt.

## Components

- **The rack** (`home/DrawerRack.tsx`) — the thirteen drawers stood on edge, the
  home page's one interactive set piece. Thirteen spines; hovering one grows it
  from 111px to 602px on `--ease-drawer` while the rest fall to 70px, the face
  develops from a ghost to full ink, its subject re-screens from the drawing
  into the photograph, and the record slides up from the foot. A closed drawer
  shows only its address, its pull and its label — thirteen full-strength
  halftones side by side is a wall, not a cabinet. Below `lg` it is a list: a
  73px spine cannot be pulled with a finger.
- `.card-index` — white, hairline border, a 2px darker top edge (the only part
  of a filed card you can see), lifts 3px on hover.
- `.tab` / `.tab-make` — the signal tab clipped to a card's top edge. The spot
  plate means "this one"; turquoise means "made to order".
- `.stamp` — every binary state on the site. Rotated −1.4°, bordered, tracked.
  Replaces coloured status pills, so a grid of 48 cards is not 48 green badges
  competing with the one accent that means something.
- `.filetab` — the drawer tabs in the header, cut as a real folder tab.
- `.ruler-x` / `.ruler-y`, `.bin` — technical marginalia. Functional: a bin
  coordinate is how you find the drawer.
- `.struck` — filed but not in stock.

## Imagery — the halftone engine

**All imagery is processed. There is no raw photography path.** Photographs and
authored plates go through the *same* screen, so they sit in one world; see
`public/parts/CREDITS.md` for the sourcing rules and the shoot brief.

Real photography is screened on eight of the thirteen drawer faces, and only
when a drawer is pulled. It is **not** used on 96px thumbnails — about 24 dots
across, where a photograph becomes noise and a drawn plate survives — and
**not** on the hero, where no available public-domain photograph screened as
clearly as the authored part.

Two corrections happen automatically, both taken from the press rather than
from taste, so a future product shot needs no number of its own:

1. **Auto-levels**, from the image's own histogram, 2% clipped each end. A part
   on a white sweep and the same part on a bench have different ranges; a fixed
   black point turns one to mud and the other to noise.
2. **An ink limit.** Levelling fixes contrast but not density, and uncoated
   stock cannot take 74% coverage — the dots bridge and it prints as a slab.
   Half the sourced set did exactly that. The engine measures the mean each
   image wants and applies the gamma that carries it to target. Measured across
   the eight photographs, the spread went from **21–74% to 34–47%** — every
   drawer at one density, which is what a real two-plate run gives you.

`components/Halftone.tsx` rasterises an authored plate (`lib/plates.ts`) and
re-screens it as a two-plate dot lattice: black at 45°, spot at 15°, the
angles a real two-colour job uses to stop the rosette moiréing. Dot radius goes
as `√coverage`, because area must be proportional to coverage — using coverage
directly is what makes a halftone look like a scatter plot.

Three things that make it more than a texture:

1. **Plates are lit.** A raking light is composited with `destination-out`
   (not `source-atop`, whose output alpha is the backdrop's by definition), so
   the silhouettes gain a full tonal range and read as printed objects.
2. **The silhouette is data.** `plateParam()` reads the SKU's own attributes —
   `length_mm`, `bore_id_mm/outer_od_mm`, `dia_mm` — so an M8×60 is visibly
   longer and fatter than an M2×8. `plateFor()` then picks the head shape from
   `head_type`, so a listing filtered to `M3` + `10mm` still shows button vs
   countersunk vs pan-with-cross-recess. Below 120px the tone is dropped and
   the crisp silhouette kept.
3. **The pointer is a loupe.** Ink blooms under it and settles behind it —
   measured at +3.7pp coverage held, returning to rest on leave.

## Motion

One authored moment per surface. The cabinet's native motion is a drawer
sliding out and a card being lifted; everything is one of those two.

- `--ease-drawer: cubic-bezier(.32,.72,0,1)` — heavy start, long glide, dead
  stop. `--ease-out` for arrivals, `--ease-snap` for chips that land.
- **No spring.** An overshoot reads playful; everything here is a measurement.
- `.reveal` — 30px, 620ms, stagger ~90ms apart and capped at 8 steps (below
  ~90ms the eye cannot resolve a sequence at all; past 8 nobody is counting).
  The hiding rule is scoped to `[data-reveal-ready]`, an attribute `Reveal.tsx`
  puts on `<html>` only once it is running and motion is allowed — no JS, or
  reduced motion, and content is simply visible. This gate was documented long
  before it existed: the selector was bare `.reveal` until 2026-08-06, so a
  page without JS rendered blank, which is the one failure a reveal must not
  have.
- Plate switching **re-screens** rather than cross-fades: coverage lerps
  per-cell, so dots swell from one part into the next.
- Everything is off under `prefers-reduced-motion` with no information lost.

## Refused

Kickers/eyebrows · coloured status pills in dense grids · icon-in-a-tinted-
rounded-square category tiles · counters that tick up · the infinite review
marquee · gradient text · glass · the decorative blueprint grid (`.techgrid`,
deleted) · rounded-everything.

## Known follow-ups

- Five drawers — Motors, Drones, Bearings, CNC, EV — still show their drawn
  plate. Not a pipeline gap: Commons has no usable PD/CC0 product photography
  for them (searched twice, sixteen queries, English and German). The shoot
  brief is in `public/parts/CREDITS.md`; a file plus one map entry is the whole
  integration.
- ~~The checkout and order dead-end states are functional but plain.~~ **Closed
  2026-08-06.** `components/DeadEnd.tsx` gives both a halftone plate, a bin
  coordinate, a monumental line and two ways out — the empty cart was always
  right and these two were a centred `h1`, which is the layout every framework
  ships as its 404. The order one carries the number that was tried as
  marginalia and names both causes, so it does not read as an accusation.
- ~~Product grids still do not reveal on scroll.~~ **Closed 2026-08-06.** They do,
  and it is measured rather than asserted — `e2e/reveal.spec.ts`, run with
  `npm run test:e2e`. Playwright was installed for exactly this; measuring found
  two defects reading had missed, both recorded in `globals.css`.
- ~~Bulk import has no revert.~~ **Closed 2026-08-06.** `collections/ImportBatches.ts`
  records the prior values per row at commit time and `admin/import/revert.ts`
  restores them. Three rules make it safe: restore from the snapshot rather than
  recomputing, retire a created product rather than deleting it (an order line
  may already point at the variant), and correct stock with a *new* counted
  movement rather than deleting the original, so the ledger can still explain its
  own total. Only the newest applied batch is revertable — undoing an older one
  under a newer one would leave the catalogue in neither state.

~~The admin console hides the storefront chrome through a client-side path
check (`StorefrontOnly`).~~ **Closed 2026-08-06.** `/admin` moved to its own
`(console)` route group with its own root layout, alongside `(frontend)` and
`(payload)`. `StorefrontOnly` is deleted. The console had been shipping 19 of
the storefront's 21 JavaScript chunks — search provider, cart, wishlist — in
order to hide them; it now ships 17 and none of that.
