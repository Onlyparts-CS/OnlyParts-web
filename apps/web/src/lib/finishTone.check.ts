import assert from "node:assert/strict";
import { finishTone } from "./finishTone.ts";

/** Run: npx tsx src/lib/finishTone.check.ts */

// Every fixture below uses values taken from the live catalogue.
const ss = finishTone({ material: "SS 304", finish: "Plain / Passivated" });
assert.ok(ss);

/*
  Finish outranks material, and this is the case that makes it matter: a black
  oxide screw is black whatever it is made of. Tinting it by `material` would
  put the wrong surface on the sheet.
*/
const blackened = finishTone({ material: "Alloy 12.9", finish: "Black Oxide" });
assert.ok(blackened);
assert.equal(blackened.label, "Black oxide");
assert.notEqual(blackened.fill, finishTone({ material: "Alloy 12.9" })?.fill);

// Case and padding are the storage's business, not the caller's.
assert.deepEqual(finishTone({ finish: "  black oxide  " }), finishTone({ finish: "Black Oxide" }));

// Magnets are the only family using `coating`.
assert.equal(finishTone({ coating: "NiCuNi" })?.label, "NiCuNi plated");

// Two materials that are genuinely different parts must not share a tone.
assert.notEqual(finishTone({ material: "Brass" })?.fill, finishTone({ material: "SS 304" })?.fill);

/* ---- refusals: no tone beats a guessed one ---- */

assert.equal(finishTone({}), null, "nothing stated");
assert.equal(finishTone({ material: "Titanium Grade 5" }), null, "not in the table");
assert.equal(finishTone({ material: "" }), null, "empty is not a value");
assert.equal(finishTone({ material: 304 }), null, "a number is not a material name");
// A substring rule would have matched this through "stainless"; the table is exact.
assert.equal(finishTone({ material: "Stainless Steel A2-70" }), null, "close is not the same value");

console.log("finishTone.check.ts — all assertions passed");
