import assert from "node:assert/strict";
import { specDrawing, labelFor, valueFor } from "./specDrawing.ts";

/**
 * Run: `npx tsx src/lib/specDrawing.check.ts` from `apps/web`.
 *
 * The failure this file exists to catch is a drawing that asserts a dimension
 * nobody measured. Every other bug here is cosmetic; that one publishes a
 * specification a buyer machines to.
 */

/* ---- units come from the key, never from a guess ---- */
assert.equal(valueFor("length_mm", 60), "60 mm");
assert.equal(valueFor("capacity_mah", 2200), "2200 mAh");
assert.equal(valueFor("voltage_v", 3.7), "3.7 V");
assert.equal(valueFor("thread", "M8"), "M8", "an untyped key gets no invented unit");
// The importer writes numbers as strings until the definition is typed. Both
// shapes have to reach the sheet identically or the same part draws two ways.
assert.equal(valueFor("length_mm", "60"), "60 mm");
assert.equal(valueFor("material", "Stainless 304"), "Stainless 304");
// 8.0 on a drawing reads as a tolerance claim. We hold no tolerances.
assert.equal(valueFor("length_mm", 8.0), "8 mm");

assert.equal(labelFor("bore_id_mm"), "BORE ID");
assert.equal(labelFor("head_type"), "HEAD TYPE");

/* ---- nothing is drawn that we do not hold ---- */
const bare = specDrawing({});
assert.equal(bare.along, null);
assert.equal(bare.across, null);
assert.equal(bare.empty, true, "an attribute-less part must keep the plate");

const lengthOnly = specDrawing({ length_mm: 60 });
assert.equal(lengthOnly.along, "60", "callouts are bare figures; the unit is on the sheet");
assert.equal(lengthOnly.across, null, "no diameter held means no diameter drawn");
assert.equal(lengthOnly.empty, false);

/* ---- a dimension is never also a title-block row ---- */
const screw = specDrawing({
  length_mm: 60,
  outer_od_mm: 8,
  thread: "M8",
  material: "Stainless 304",
  colour: "silver",
});
assert.equal(screw.along, "60");
assert.equal(screw.across, "⌀8");
assert.equal(screw.unit, "mm");
assert.ok(
  !screw.rows.some((r) => r.label === "LENGTH" || r.label === "OUTER OD"),
  "a dimension line and a title row would be two copies of one number",
);
assert.ok(
  !screw.rows.some((r) => r.label === "COLOUR"),
  "colour is merchandising, not specification",
);
assert.deepEqual(
  screw.rows.map((r) => r.label),
  ["MATERIAL", "THREAD"],
  "rows are sorted, so two variants of one part line up row for row",
);

/* ---- empty values never reach the sheet ---- */
const sparse = specDrawing({ thread: "M3", finish: "", material: null, size: undefined });
assert.deepEqual(sparse.rows.map((r) => r.label), ["THREAD"]);

/* ---- a part with specs but no dimensions still earns a sheet ---- */
const chip = specDrawing({ voltage_v: 5, package: "SOIC-8" });
assert.equal(chip.along, null);
assert.equal(chip.across, null);
assert.equal(chip.empty, false, "specs without dimensions are still worth drawing");

console.log("specDrawing.check.ts — all assertions passed");
