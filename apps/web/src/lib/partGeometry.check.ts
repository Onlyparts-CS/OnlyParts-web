import assert from "node:assert/strict";
import { bearing, magnet } from "./partGeometry.ts";

/** Run: `npx tsx src/lib/partGeometry.check.ts` from `apps/web`. */

const mustB = (t: string, c?: string) => {
  const r = bearing(t, c);
  assert.ok(r, `expected a bearing for: ${t}`);
  return r;
};
const noB = (t: string, why: string, c?: string) =>
  assert.equal(bearing(t, c), null, `should have refused (${why}): ${t}`);

const mustM = (t: string, c?: string) => {
  const r = magnet(t, c);
  assert.ok(r, `expected a magnet for: ${t}`);
  return r;
};
const noM = (t: string, why: string, c?: string) =>
  assert.equal(magnet(t, c), null, `should have refused (${why}): ${t}`);

/* ---- the five harvest rows that state both a designation and its size ---- */

/*
  These are the table's independent check. Each title carries the ISO 15
  figures written out by the supplier, so if a number below ever stops matching,
  either the table was mistyped or the parser stopped reading one of the two
  dialects — and both are the kind of error that reaches a buyer as a bearing
  that does not fit the shaft.
*/
for (const [title, des, dims] of [
  ["6001 ZZ - Deep Groove Ball Bearing (ID:12mm OD:28mm T:8mm)", "6001 ZZ", [12, 28, 8]],
  ["6003 2RS Rubber Sealed Ball Bearings (17×35×10 mm) - Double Rubber Sealed", "6003 2RS", [17, 35, 10]],
  ["605 2RS Miniature Deep Groove Ball Bearing (5×14×5 mm) - Double Rubber Sealed", "605 2RS", [5, 14, 5]],
  ["607 ZZ Miniature Deep Groove Ball Bearing (7×19×6 mm) - Double Metal Shielded", "607 ZZ", [7, 19, 6]],
  ["6005 ZZ - Deep Groove Ball Bearing (ID:25mm OD:47mm T:12mm)", "6005 ZZ", [25, 47, 12]],
] as [string, string, number[]][]) {
  const b = mustB(title);
  assert.equal(b.label, des);
  assert.deepEqual([b.bore, b.od, b.width], dims, `dimensions for ${des}`);
  // Stated on the listing, so nothing is being claimed on ISO's authority.
  assert.equal(b.standard, null, `${des} states its own size; provenance must stay null`);
}

/* ---- designation only: the table earns its keep ---- */

const skate = mustB("Radial Ball Bearing 608ZZ for 3D Printer");
assert.deepEqual([skate.bore, skate.od, skate.width], [8, 22, 7]);
assert.equal(skate.standard, "ISO 15", "no figures in the title, so the sheet must name the source");
assert.equal(skate.label, "608 ZZ");

const tt = mustB("Two Trees Miniature bearings 626ZZ");
assert.deepEqual([tt.bore, tt.od, tt.width], [6, 19, 6]);

const dash = mustB("DIY Ball Bearings (Pack of 2) — 608-ZZ");
assert.deepEqual([dash.bore, dash.od, dash.width], [8, 22, 7]);

/* ---- linear bushings ---- */

const lm = mustB("LM8UU Linear Bearing (8 mm)");
assert.deepEqual([lm.bore, lm.od, lm.width], [8, 15, 24]);
assert.equal(lm.label, "LM8UU");
assert.equal(lm.standard, "LM series");
assert.deepEqual(
  (() => { const x = mustB("LM12UU 12 MM Linear Motion Bearing for 3D Printer"); return [x.bore, x.od, x.width]; })(),
  [12, 21, 30],
);

/* ---- refusals, every one a real row ---- */

noB("D Shaft RS-775 DC Motor with Ball Bearing - 12V to 24V - High Torque", "a motor");
noB("Orion Fans OD6025-12HB DC Axial Fan 12 V Square 60 mm 25 Ball Bearing CFM", "a fan");
noB("High-Torque Drill Motor with Ball Bearings — RS-785S Single Bearing", "a motor");
noB("Iron Marble Ball Bearings 19mm — Pack of 1", "loose balls, no races");
noB("Two Trees Horizontal optical axis bracket SHF16", "a shaft support");
noB("Anabond 412 Ball Bearing Retainer (4ml)", "an adhesive");
/*
  The U-wheel carries a real 604ZZ designation because there is a 604 pressed
  inside it, and the 4x13x4 it states is the wheel. Both halves are true and
  neither describes the thing being sold.
*/
noB("Two Trees U604ZZ Rolling U-Wheel Guide Groove 4x13x4mm for Extruder (4Pcs)", "a V-groove wheel around a bearing");

// A designation the table does not carry must refuse, not approximate.
noB("Deep Groove Ball Bearing 6420 for industrial use", "6420 is not tabulated here");
// The category tree may veto.
noB("608ZZ Deep Groove Ball Bearing", "filed outside bearings.*", "electronic-components.connectors");

/* ---- a listing that disagrees with the standard is refused, not arbitrated ---- */

noB("608ZZ Deep Groove Ball Bearing (ID:8mm OD:24mm T:7mm)", "608 is 8x22x7; the listing says 24");
// ...but agreement within rounding is fine.
assert.ok(bearing("608ZZ Deep Groove Ball Bearing (8×22×7 mm)"), "agreeing figures must pass");

/* ================= magnets ================= */

const disc = mustM("15mm X 1.5mm Neodymium Disc Magnets N35 (Dia: 15mm, Thickness: 1.5mm)");
assert.equal(disc.kind, "round");
if (disc.kind === "round") {
  assert.equal(disc.od, 15);
  assert.equal(disc.width, 1.5);
  assert.equal(disc.bore, null, "a disc has no bore");
}
// No table was consulted, so the sheet must not name one.
assert.equal(disc.standard, null);

const dashed = mustM("6mm Diameter Neodymium Disc Magnets N35 — 10mm");
assert.equal(dashed.kind, "round");
if (dashed.kind === "round") assert.deepEqual([dashed.od, dashed.width], [6, 10]);

const bare = mustM("Neodymium (NdFeB) 20x6 mm Disc Magnet - High-Strength Rare Earth Magnet");
assert.equal(bare.kind, "round");
if (bare.kind === "round") assert.deepEqual([bare.od, bare.width], [20, 6]);

const cyl = mustM("Neodymium Circular Cylindrical Magnet — 8mm x 3mm / Box of 100");
assert.equal(cyl.label, "Cylinder magnet");

const ring = mustM("Neodymium Ring Magnets with Hole High Strength Rare Earth — 10x3x3mm");
assert.equal(ring.kind, "round");
if (ring.kind === "round") {
  assert.equal(ring.od, 10);
  assert.equal(ring.bore, 3);
  assert.equal(ring.width, 3);
}

const block = mustM("10mm X 10mm X 2mm Neodymium Bar Magnet N35 (Length: 10mm, Breadth: 10mm, Thickness: 2mm)");
assert.equal(block.kind, "block");
if (block.kind === "block") assert.deepEqual([block.length, block.breadth, block.thickness], [10, 10, 2]);

/*
  Regression: `\brectangul\b` cannot match "Rectangular" — the word continues
  past the boundary — so this read as a ⌀20 disc 10 thick. The assertion below
  was originally written inside a bare `if (kind === "block")`, which skipped
  itself and let the bug through a green check.
*/
const block2 = mustM("20mm x10mm x 2mm Neodymium Rectangular Magnet");
assert.equal(block2.kind, "block", "a rectangular magnet is a block, not a disc");
if (block2.kind === "block") assert.deepEqual([block2.length, block2.breadth, block2.thickness], [20, 10, 2]);

/*
  Bare triples, no unit until the end. 34 rows across two suppliers write the
  size this way and every one was refused while the block pattern said `mm?`
  (a literal `m` plus an optional second) where it meant `(?:mm)?`.
*/
const bareBlock = mustM("North-South Rectangular Pole Magnetic Bars — 50x15x7.5mm");
assert.equal(bareBlock.kind, "block");
if (bareBlock.kind === "block") assert.deepEqual([bareBlock.length, bareBlock.breadth, bareBlock.thickness], [50, 15, 7.5]);

// Zero-padded figures are still figures.
const padded = mustM("Neodymium Rectangular Magnet — 12x09x04mm / Pack of 10");
if (padded.kind === "block") assert.deepEqual([padded.length, padded.breadth, padded.thickness], [12, 9, 4]);

/* ---- magnet refusals ---- */

noM("Neodymium (NdFeB) SNJ 36 D-Hook Magnet- High-Strength Rare Earth Magnet", "a hook assembly, no geometry");
noM("45mm X 13mm Rectangular Name Badge Magnet with Self-Adhesive Foam Tape & Nickel-Plated Steel", "a badge assembly");
noM("20mm X 25mm Neodymium N35 Push Pin Magnet N35 for Whiteboards, Office & Home", "a push pin");
noM("A4 Flexible Magnetic Sheet 0.5mm Self Adhesive", "sheet stock, not a part");
noM("Neodymium Magnetic Tape 10m Roll", "tape");
noM("High Strength Rare Earth Magnet", "no dimensions at all");
noM("15x2 mm Disc", "not described as a magnet");

/* ---- a ring's bore must be inside its outside diameter ---- */

noM("Neodymium Ring Magnets with Hole — 3x10x3mm", "bore larger than the outside diameter");

console.log("partGeometry.check.ts — all assertions passed");
