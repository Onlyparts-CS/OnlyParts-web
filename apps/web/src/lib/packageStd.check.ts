import assert from "node:assert/strict";
import { chipPackage } from "./packageStd.ts";

/**
 * Run: npx tsx src/lib/packageStd.check.ts
 *
 * Every fixture is a title taken verbatim from the harvest. The refusals matter
 * more than the readings: a code appears in 2,511 titles that are not chip
 * components at all, and the metric/imperial collision would silently draw an
 * 0201 at 2.7× its size.
 */

const must = (t: string, path?: string) => {
  const p = chipPackage(t, path);
  assert.ok(p, `expected a chip package from: ${t}`);
  return p;
};
const no = (t: string, why: string, path?: string) =>
  assert.equal(chipPackage(t, path), null, `should have refused (${why}): ${t}`);

/* ---- the table, read through real titles ---- */

const r0805 = must("0805 SMD Surface Mount Chip Resistors — 100-Ohm (101) / Pack of 20");
assert.equal(r0805.code, "0805");
assert.equal(r0805.metric, "2012");
assert.deepEqual([r0805.length, r0805.width], [2.0, 1.25]);
assert.equal(r0805.height, null, "the code fixes length and width only");

const c0603 = must("0603 SMD SMT MLCC Capacitor — 1.0uF (104) / Pack of 10");
assert.deepEqual([c0603.length, c0603.width], [1.6, 0.8]);

const l0603 = must("120 nH 0603 Surface Mount High Frequency Inductor");
assert.deepEqual([l0603.length, l0603.width], [1.6, 0.8]);

const led = must("SMD LED 1206 RGB - Full Spectrum RGB LED");
assert.deepEqual([led.length, led.width], [3.2, 1.6]);

// The two 32xx codes share a length and differ in width. If these ever collapse
// the table has been transcribed wrong.
const w1210 = must("1210 SMD SMT MLCC Capacitor — 10uF / Pack of 10");
assert.deepEqual([w1210.length, w1210.width], [3.2, 2.5]);
assert.notDeepEqual([w1210.width], [led.width]);

const big = must("2512 SMD Surface Mount Chip Resistors — 0.1-Ohm / Pack of 5");
assert.deepEqual([big.length, big.width], [6.35, 3.2]);

/* ---- the metric collision: 0201 imperial is 0603 metric ---- */

const tiny = must(
  "CC0201JRNPO8BN100-YAGEO-SMD Multilayer Ceramic Capacitor, 10 pF, 25 V, 0201 [0603 Metric], NP0",
);
assert.equal(tiny.code, "0201", "the bracketed 0603 is this part's metric name, not a second part");
assert.deepEqual([tiny.length, tiny.width], [0.6, 0.3]);
// The failure this guards: 0603 imperial is 2.7x longer than 0201 imperial.
assert.notDeepEqual([tiny.length, tiny.width], [c0603.length, c0603.width]);

no(
  "SMD Multilayer Ceramic Capacitor, 0.1 µF, 0805 [1608 Metric]",
  "1608 is 0603's metric name, so the listing contradicts itself",
);

/* ---- a code is not a claim ---- */

no("GW Instek PSP 2010 Bench Power Supply", "2010 is a model number");
no("1N4148W SOD-123 1206 Diode", "a SOD-123 body that fits an 1206 land pattern");
no("30 Values 0805 SMD Resistor Kit from 1 Ohm to 1M Ohm 1/8 Watt with 5% Tolerance - 600Pcs", "an assortment");
no("SMD LED Packs 100-Pcs 5-Colors RGBWY Assorted Kits — 1206", "an assortment");
no("0805 SMD Surface Mount Chip Resistors and 0603 SMD Chip Resistors", "two sizes, no single subject");
no("100 Ohm Resistor 1/4W Carbon Film", "no code and not surface mount");
no("0805 Reel Holder Bracket", "a code with no component word");
no("Chip Resistor 100 Ohm 1%", "a component with no code");
no("0603 SMD Chip Resistor 100 Ohm", "filed as a fastener", "fasteners.screws.socket-head");

/* ---- a code inside a part number is not a code ---- */

// The standalone "0805" later in the same title is what makes this readable;
// VJ0805Y105KXJTW1BC on its own must not be enough.
no("VJ0805Y105KXJTW1BC VISHAY MLCC", "the code is inside a manufacturer part number");

/* ---- a stated height is the listing's own and is kept ---- */

const withH = must("0805 SMD MLCC Capacitor 10uF 25V X5R, Thickness: 1.25mm");
assert.equal(withH.height, 1.25);

console.log("packageStd.check.ts — all assertions passed");

/* ---- the size code is itself a statement that the part is surface-mount ---- */

// There is no through-hole 1206, so the seller need not also type "SMD".
const bare1206 = must("470 Ohm 1/4w 1206 Resistor");
assert.deepEqual([bare1206.length, bare1206.width], [3.2, 1.6]);

const mlcc = must("CL10B475KQ8NQNC SAMSUNG ELECTRO-6.3V 4.7uF X7R ±10% 0603 Ceramic Capacitors");
assert.equal(mlcc.code, "0603");

// ...except the two codes that are also readable as resistance codes.
no("2 Mega Ohm RESISTOR 2MR-2512 (pack of 10)", "2512 here may be part of the part number");
must("2512 SMD Chip Resistor 0.1 Ohm");   // with the witness, it reads

console.log("packageStd.check.ts — surface-witness assertions passed");
