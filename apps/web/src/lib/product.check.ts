import assert from "node:assert/strict";
import { worksWith, substitutes, compatTokens, complementDrawers } from "./product.ts";
import type { Sku } from "./skus.ts";

/**
 * Run: `npx tsx src/lib/product.check.ts` from `apps/web`.
 *
 * The failure this file exists to catch is the one the old `boughtWith` shipped
 * with: a "works with" shelf that quietly returns alternatives. A NEMA 17
 * motor's complement is the driver that turns it, never a second motor, and
 * every case below is a way that can silently regress.
 */

let n = 0;
const part = (over: Partial<Sku> & { categories: string[][] }): Sku =>
  ({
    sku: `T-${++n}`,
    slug: `t-${n}`,
    title: `part ${n}`,
    price: 10000,
    breaks: [{ qty: 1, price: 10000 }],
    stock: 5,
    dispatchHours: 24,
    glyph: "screw",
    attrs: {},
    ...over,
  }) as Sku;

const cat = (path: string) => [path.split(".")];

/* a motor's complement is the driver, and never another motor */
{
  const motor = part({ categories: cat("motors.stepper-motors.nema-17"), title: "NEMA 17 stepper" });
  const other = part({ categories: cat("motors.stepper-motors.nema-17"), title: "NEMA 17, longer body" });
  const driver = part({ categories: cat("motors.motor-drivers.dc-motor-drivers"), title: "A4988 driver" });

  const out = worksWith(motor, [motor, other, driver]);
  const codes = out.map((c) => c.sku.sku);

  assert.ok(codes.includes(driver.sku), "the driver must be offered");
  assert.ok(!codes.includes(other.sku), "another motor is a substitute, not a complement");
  assert.equal(out.find((c) => c.sku.sku === driver.sku)?.why, "Drives this motor");
}

/* a checked dimension is marked proven; a category-level pairing is not */
{
  const bolt = part({ categories: cat("fasteners.screws-by-head.socket-head-cap"), attrs: { thread: "M4" } });
  const nut = part({ categories: cat("fasteners.nuts.nyloc-nuts"), attrs: { thread: "M4" } });
  assert.equal(worksWith(bolt, [bolt, nut])[0]?.proven, true, "the thread agreed, so say so");

  const cell = part({ categories: cat("batteries-power.lithium-cells.18650") });
  const holder = part({ categories: cat("batteries-power.pack-building.cell-holders") });
  assert.equal(worksWith(cell, [cell, holder])[0]?.proven, false, "nothing recorded which cell this holder takes");
}

/* unproven pairings never crowd out a proven one */
{
  const motor = part({ categories: cat("motors.stepper-motors.nema-17"), attrs: { shaft_dia_mm: 5 } });
  const coupler = part({ categories: cat("motors.motor-accessories.shaft-couplers"), attrs: { shaft_dia_mm: 5 } });
  const noise = Array.from({ length: 20 }, () => part({ categories: cat("motors.motor-drivers.dc-motor-drivers") }));
  const out = worksWith(motor, [motor, ...noise, coupler], 6);
  assert.ok(out.some((c) => c.sku.sku === coupler.sku), "the measured match survives twenty guesses");
  assert.equal(out[0]?.proven, true, "and it leads");
}

/* the drone stack the request named: motor -> ESC, ESC -> flight controller */
{
  const motor = part({ categories: cat("drones-parts.motors-drone.2004-2306") });
  const esc = part({ categories: cat("drones-parts.escs.single-escs") });
  const fc = part({ categories: cat("drones-parts.flight-controllers.fc-boards") });
  const pool = [motor, esc, fc];

  assert.ok(worksWith(motor, pool).some((c) => c.sku.sku === esc.sku), "motor -> ESC");
  assert.ok(worksWith(esc, pool).some((c) => c.sku.sku === fc.sku), "ESC -> flight controller");
  assert.ok(worksWith(fc, pool).some((c) => c.sku.sku === esc.sku), "flight controller -> ESC");
}

/* a fit-constrained pairing only fires when the dimension actually agrees */
{
  const bolt = part({ categories: cat("fasteners.screws-by-head.socket-head-cap"), attrs: { thread: "M4" } });
  const m4nut = part({ categories: cat("fasteners.nuts.nyloc-nuts"), attrs: { thread: "M4" } });
  const m6nut = part({ categories: cat("fasteners.nuts.nyloc-nuts"), attrs: { thread: "M6" } });

  const codes = worksWith(bolt, [bolt, m4nut, m6nut], 1).map((c) => c.sku.sku);
  assert.deepEqual(codes, [m4nut.sku], "the M4 nut outranks the M6 one");
}

/* blank on both sides is not a match — the bug that pairs every unspecified
   part with every nut in the drawer */
{
  const bolt = part({ categories: cat("fasteners.screws-by-head.socket-head-cap") });
  const nut = part({ categories: cat("fasteners.nuts.nyloc-nuts") });
  const out = worksWith(bolt, [bolt, nut]);
  assert.equal(out[0]?.why, "Locks this bolt", "still pairs, but on the leaf rather than a fit it cannot prove");
}

/* out of stock is never offered as part of a set */
{
  const motor = part({ categories: cat("motors.stepper-motors.nema-17") });
  const driver = part({ categories: cat("motors.motor-drivers.dc-motor-drivers"), stock: 0 });
  assert.deepEqual(worksWith(motor, [motor, driver]), []);
}

/* the anchor never appears in its own complements */
{
  const motor = part({ categories: cat("motors.stepper-motors.nema-17") });
  const driver = part({ categories: cat("motors.motor-drivers.dc-motor-drivers") });
  assert.ok(!worksWith(motor, [motor, driver]).some((c) => c.sku.sku === motor.sku));
}

/* a supplier-declared platform token pairs parts no leaf map anticipated */
{
  const board = part({
    categories: cat("electronic-components.development-boards.arduino-compatible"),
    attrs: { compatibility: "Raspberry Pi 5|NEMA17" },
  });
  const hat = part({
    categories: cat("electronic-components.displays.tft-graphic"),
    attrs: { compatibility: "raspberry pi 5" },
  });
  const unrelated = part({ categories: cat("electronic-components.displays.tft-graphic") });

  const out = worksWith(board, [board, hat, unrelated]);
  assert.equal(out.find((c) => c.sku.sku === hat.sku)?.why, "Listed for raspberry pi 5");
  assert.ok(!out.some((c) => c.sku.sku === unrelated.sku), "no token, no claim");
}

/* tokens parse the way the feed writes them, and an absent one is empty */
{
  assert.deepEqual(compatTokens(part({ categories: cat("a.b.c"), attrs: { compatibility: "NEMA17 | Arduino Uno |" } })), ["NEMA17", "Arduino Uno"]);
  assert.deepEqual(compatTokens(part({ categories: cat("a.b.c") })), []);
}

/* the limit is honoured, and an unmapped leaf claims nothing at all */
{
  const motor = part({ categories: cat("motors.stepper-motors.nema-17") });
  const pool = [motor, ...Array.from({ length: 9 }, () => part({ categories: cat("motors.motor-drivers.dc-motor-drivers") }))];
  assert.equal(worksWith(motor, pool, 4).length, 4);

  const orphan = part({ categories: cat("tools.hand-tools.spanners") });
  assert.deepEqual(worksWith(orphan, [orphan, ...pool]), [], "no pairing map, no fallback to the drawer");
}

/* the drawers a part reaches into include the cross-drawer ones */
{
  const drone = part({ categories: cat("drones-parts.motors-drone.2004-2306") });
  const drawers = complementDrawers(drone);
  assert.ok(drawers.includes("batteries-power"), "the LiPo pack is in another drawer and must be fetched");
}

/* substitutes still return alternatives — the two shelves must not converge */
{
  const a = part({ categories: cat("fasteners.screws-by-head.socket-head-cap"), attrs: { thread: "M4", length_mm: 10, material: "steel" } });
  const b = part({ categories: cat("fasteners.screws-by-head.socket-head-cap"), attrs: { thread: "M4", length_mm: 10, material: "a2-stainless" } });
  assert.deepEqual(substitutes(a, [a, b]).map((s) => s.sku), [b.sku]);
}

/* the shelf spans the build rather than draining one leaf */
{
  const motor = part({ categories: cat("motors.stepper-motors.nema-17") });
  // dc-motor-drivers is the first pairing and has enough stock to fill every
  // slot on its own — which is exactly what it used to do.
  const drivers = Array.from({ length: 20 }, () =>
    part({ categories: cat("motors.motor-drivers.dc-motor-drivers") }));
  const coupler = part({ categories: cat("motors.motor-accessories.shaft-couplers") });
  const bracket = part({ categories: cat("motors.motor-accessories.mounts-brackets") });
  const psu = part({ categories: cat("electronic-components.power-supplies.smps-modules") });

  const out = worksWith(motor, [motor, ...drivers, coupler, bracket, psu], 6);
  const leaves = new Set(out.map((c) => c.sku.categories[0].at(-1)));

  assert.ok(leaves.has("shaft-couplers"), "a coupler must survive twenty drivers");
  assert.ok(leaves.has("mounts-brackets"), "so must a bracket");
  assert.ok(leaves.has("smps-modules"), "and the power supply");
  assert.ok(leaves.size >= 4, `a kit spans leaves, got ${[...leaves].join(", ")}`);
  assert.equal(out.length, 6, "and still fills the shelf");
}

/* a leaf with only one complement still fills up from it */
{
  const bolt = part({ categories: cat("fasteners.screws-by-head.socket-head-cap") });
  const nuts = Array.from({ length: 8 }, () => part({ categories: cat("fasteners.nuts.nyloc-nuts") }));
  assert.equal(worksWith(bolt, [bolt, ...nuts], 4).length, 4, "breadth must not cost depth when there is no breadth");
}

console.log("product.check.ts — ok");
