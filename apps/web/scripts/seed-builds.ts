import { getPayload } from "payload";
import config from "@payload-config";

/**
 * Seed the curated project BOMs.
 *
 * `collections/Builds.ts` is emphatic that membership is an editorial
 * judgement and must never be synthesised from categories — the prototype did
 * exactly that once, and every fastener in the catalogue ended up claiming to
 * be a drone part. So every line below is a deliberate choice, and a part is
 * absent unless it genuinely belongs.
 *
 * That is why the drone BOM has two entries and not seven. A drone needs M3
 * frame hardware from this catalogue; it does not need loose deep-groove
 * bearings, even though drone motors contain bearings. Padding a build to make
 * it look complete is the failure this file exists to avoid.
 *
 * Idempotent — matches on slug, updates in place. Safe to re-run.
 *
 *   npm run payload -- run scripts/seed-builds.ts
 */

type Seed = {
  slug: string;
  name: string;
  blurb: string;
  /** Key into PLATE_FOR_GLYPH in src/lib/plates.ts. */
  glyph: string;
  position: number;
  /** Product slug -> why it is in *this* build. The note is per-membership. */
  items: [productSlug: string, note: string][];
};

const BUILDS: Seed[] = [
  {
    slug: "drone",
    name: "Drone",
    blurb:
      "A 5-inch freestyle quad, from frame stack to arms. The hardware is almost entirely M3 — " +
      "stack mounting, arm bolts and camera plate — and getting the lengths right is most of the job.",
    glyph: "prop",
    position: 1,
    items: [
      ["socket-head-cap-product", "M3 stack and arm hardware — 8, 10 and 12 mm cover most 5-inch frames."],
      ["button-head-product", "Low-profile M3 for the camera plate and anywhere a cap head would foul a prop."],
    ],
  },
  {
    slug: "3d-printer",
    name: "3D Printer",
    blurb:
      "A CoreXY or bed-slinger from parts. Three consumables dominate the bill: motion bearings, " +
      "stepper motors, and a great deal of M3 into extrusion.",
    glyph: "nozzle",
    position: 2,
    items: [
      ["nema-17-product", "X, Y, Z and extruder axes. 13 Ncm suits a direct-drive extruder; go higher for the gantry."],
      ["deep-groove-product", "Idler pulleys and belt tensioners — 625 and 608 are the two sizes a printer actually eats."],
      ["socket-head-cap-product", "Into T-slot extrusion, all day. Buy more than you think."],
    ],
  },
  {
    slug: "robot",
    name: "Robot",
    blurb:
      "A wheeled or armed platform. Motion parts and the fasteners that hold a chassis square — " +
      "the electronics vary far more than the mechanics do.",
    glyph: "rotor",
    position: 3,
    items: [
      ["nema-17-product", "Drive and joint actuation where a servo is not precise enough."],
      ["deep-groove-product", "Wheel and idler shafts. A supported shaft outlasts a cantilevered one every time."],
      ["socket-head-cap-product", "Chassis assembly. Cap heads because you will take this apart repeatedly."],
    ],
  },
  {
    slug: "cnc",
    name: "CNC",
    blurb:
      "A benchtop router or mill. Rigidity is the whole game, so the fasteners matter as much as " +
      "the motors — a flexing joint shows up in the finish.",
    glyph: "endmill",
    position: 4,
    items: [
      ["nema-17-product", "Axis drive on a benchtop router. Step up a frame size for anything cutting metal."],
      ["deep-groove-product", "Lead screw supports and idlers."],
      ["socket-head-cap-product", "Structural joints, where a cap head's larger bearing face is worth having."],
      ["countersunk-csk-product", "Flush into spoilboards and fixture plates, so nothing catches the work."],
    ],
  },
  {
    slug: "ev",
    name: "EV",
    blurb:
      "Light electric vehicle work — hub motors, battery packs and the brackets between them. " +
      "A short list here because most of an EV build is cells and controllers.",
    glyph: "hub",
    position: 5,
    items: [
      ["disc-product", "N52 discs for rotor and sensor work on a hub motor rebuild."],
      ["socket-head-cap-product", "Bracketry and battery box assembly."],
    ],
  },
  {
    slug: "repair-bench",
    name: "Repair Bench",
    blurb:
      "Not a project — a stocked bench. The assortment you want in the drawer before the thing " +
      "you are fixing is already in pieces on the mat.",
    glyph: "wrench",
    position: 6,
    items: [
      ["socket-head-cap-product", "The default. If you keep one head type, keep this one."],
      ["button-head-product", "Where a cap head would sit proud of a case."],
      ["countersunk-csk-product", "Flush into plastic housings and panel work."],
      ["pan-head-product", "Sheet metal, brackets, and anything a Phillips driver is already in your hand for."],
      ["disc-product", "Parts trays and holding small steel work while you solder."],
    ],
  },
];

/* ------------------------------------------------------------------ */

const payload = await getPayload({ config });

const { docs: products } = await payload.find({
  collection: "products",
  limit: 500,
  depth: 0,
  overrideAccess: true,
});
const idBySlug = new Map(products.map((p) => [p.slug, p.id]));

let created = 0;
let updated = 0;
const skipped: string[] = [];

for (const b of BUILDS) {
  const items = b.items.flatMap(([slug, note], i) => {
    const id = idBySlug.get(slug);
    if (!id) {
      // Loud, not silent. A build quietly missing a part is the failure mode
      // `Builds.ts` warns about, and a wrong BOM is worse than a short one.
      skipped.push(`${b.slug} -> ${slug} (no such product)`);
      return [];
    }
    return [{ product: id, note, position: i }];
  });

  if (!items.length) {
    skipped.push(`${b.slug} — every product missing, build not written`);
    continue;
  }

  const existing = await payload.find({
    collection: "builds",
    where: { slug: { equals: b.slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const data = { name: b.name, slug: b.slug, blurb: b.blurb, glyph: b.glyph, position: b.position, items };

  if (existing.docs[0]) {
    await payload.update({
      collection: "builds",
      id: existing.docs[0].id,
      data: data as never,
      overrideAccess: true,
    });
    updated++;
  } else {
    await payload.create({ collection: "builds", data: data as never, overrideAccess: true });
    created++;
  }
  console.log(`${existing.docs[0] ? "updated" : "created"}  ${b.slug.padEnd(13)} ${items.length} parts`);
}

console.log(`\n${created} created, ${updated} updated`);
if (skipped.length) {
  console.log("\nSKIPPED:");
  for (const s of skipped) console.log("  " + s);
}
process.exit(0);
