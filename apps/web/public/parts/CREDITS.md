# Photography

## What is here

Placeholder photography from Wikimedia Commons, restricted to **Public Domain
and CC0 only**. CC BY-SA was deliberately excluded: share-alike attaches to
derivative works, and every image here is screened into a derivative before it
is shown — licensing a commercial storefront's imagery CC BY-SA is a trap.

| File | Source | Licence |
|---|---|---|
| `fasteners.jpg` | *Large machine screw with hammer for scale* | CC0 |
| `electronic-components.jpg` | *МБГО paper capacitors* | CC0 |
| `batteries-power.jpg` | *18650 and 21700 lithium-ion cells* | CC0 |
| `3d-printers-parts.jpg` | *Hotend* (V6 block, silicone sock, nozzle) | CC0 |
| `tools.jpg` | *Socket wrench set* | Public domain |
| `magnets.jpg` | *Neodymag* | Public domain |
| `industrial-electricals.jpg` | *Contactor NCH8-63* | Public domain |
| `hardware.jpg` | *Strangkkp* (extruded profile) | Public domain |

Every file passes through `components/Halftone.tsx` before display — screened
at 45°/15°, auto-levelled off its own histogram, then held to an ink limit.
Nothing is shown raw.

**Measured ink coverage**, before and after the limit was added:

| Drawer | Raw | Held |
|---|---|---|
| Fasteners | 61.2% | 43.7% |
| Electronic Components | 27.5% | 33.6% |
| Batteries & Power | 73.8% | 46.6% |
| 3D Printers & Parts | 36.3% | 37.8% |
| Tools | 44.1% | 40.6% |
| Magnets | 55.8% | 44.8% |
| Industrial Electricals | 21.1% | 34.9% |
| Hardware | 71.9% | 46.4% |

A halftone is legible as a *subject* between roughly 20% and 45%; past that the
dots bridge and it prints as a slab. Half the set was outside that band and two
were nearly solid. The engine now measures the mean each image wants and
applies the gamma that carries it to the target, so the spread went from 52.7
to 13 points and every drawer prints at the same density — which is also what a
real two-plate run would give you.

## What was learned building this

Three findings, all measured rather than assumed:

1. **Photography needs scale.** A halftoned photograph is legible at roughly
   300 × 224 and above. On a 96px thumbnail it is about 24 dots across and
   screens to noise, while a drawn plate survives. Photos are therefore used on
   the deep drawers only — which is what the Cuberto reference does too: its
   photographs are full-height panels, never thumbnails.

2. **The hero stayed drawn.** Every available public-domain photograph screened
   *worse* than the authored plate: macro crops read as abstract texture,
   assortment shots read as clutter. The hero has to be unambiguous, so it
   keeps the plate until real photography exists.

3. **The plates are not a stand-in for photography.** They encode the SKU's
   real length, bore ratio and head type, which no stock photograph can do.
   Both will coexist: photographs for atmosphere and category, plates for the
   per-SKU record.

4. **Commons is exhausted for the rest.** Eight categories are covered. The
   remaining five — Motors, Drones & Parts, Bearings, CNC Machines & Parts,
   EV Parts — were searched twice, in English and in German (Commons is much
   richer in German technical photography), across sixteen queries filtered to
   Public Domain and CC0 at 900px or wider. What came back was antique
   engineering diagrams for motors, drones in flight rather than drone parts,
   and whole electric vehicles rather than EV components. There is no usable
   free product photography for these. **The blocker is source material, not
   the pipeline** — those five drawers show their drawn plate until the shoot
   below happens, and the drawn plate is the better image today.

## The shoot OnlyParts needs

Nothing here needs a design change — set `image` and it flows through the same
screen. What the shoot must produce:

- **13 category plates.** One per drawer, landscape 4:3, minimum 1200px wide.
  A *group* of parts, not a macro of one. Even, raking light from the upper
  left. Plain mid-grey or white sweep — busy benches turn to mud at screen.
- **1 hero plate.** Portrait or square, minimum 1600px. One part, filling the
  frame, unmistakable in silhouette.
- **Per-SKU shots** are the long tail and are not urgent: the parametric plates
  already differentiate by length, bore ratio and head type, which is more than
  a generic photograph would.

Drop files in this folder using the category slug as the filename, then add the
entry to `PHOTO_FOR_CATEGORY` in `src/lib/plates.ts`.
