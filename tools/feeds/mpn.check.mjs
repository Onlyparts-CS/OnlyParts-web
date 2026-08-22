#!/usr/bin/env node
/**
 * Assertions for the part-number split in `mpn.mjs`.
 *
 * Run: `node tools/feeds/mpn.check.mjs` from the repo root.
 *
 * Every title below is real, taken from the robu harvest. The split depends on
 * corpus frequency, so the fixture builds a corpus rather than calling the
 * splitter on one string — a brand is only a brand because thousands of other
 * titles used it, and a test that hands the function a lone title is testing
 * something the function does not do.
 */

import assert from "node:assert/strict";
import { segmentFrequency, splitTitle, DEFAULT_MIN } from "./mpn.mjs";

/*
  Enough repetitions of each manufacturer to clear DEFAULT_MIN, exactly as the
  real corpus supplies them. The part numbers are deliberately varied so no
  MPN segment can itself reach the threshold.
*/
const BRANDS = ["Texas Instruments", "Diodes Incorporated", "MICROCHIP", "CNLINKO", "YAGEO", "KEMET"];
const corpus = [];
for (const b of BRANDS) {
  for (let i = 0; i < DEFAULT_MIN + 5; i++) corpus.push(`FILLER${i}X${b.length}-${b}-a filler description`);
}

const cases = [
  // [title, expected mpn, expected brand]
  ["SN74AHCT244DWR-Texas Instruments-8mA 4.5V~5.5V Octal Buffer", "SN74AHCT244DWR", "Texas Instruments"],

  // Hyphens inside the part number. Splitting on the first one yields
  // `MCP6566T`, which is a real family and the wrong thing to order.
  ["MCP6566T-E/LT-MICROCHIP-Analogue Comparator, 1.8V", "MCP6566T-E/LT", "MICROCHIP"],

  // A trailing `-7` packaging code. The bare digit is frequent across the
  // corpus and was swallowed as the start of the brand until segments were
  // required to carry a letter.
  ["AP7383-30WW-7-Diodes Incorporated-150mA Fixed LDO", "AP7383-30WW-7", "Diodes Incorporated"],

  // Then the same failure wearing a letter: `-F` is a single character and
  // must not start a brand either.
  ["BAT54SDW-7-F-Diodes Incorporated-30V 2 Pair Schottky", "BAT54SDW-7-F", "Diodes Incorporated"],

  // Five segments of part number before the manufacturer appears.
  ["LP-24-C02PE-01-035-CNLINKO-2Pin Male Plug IP67", "LP-24-C02PE-01-035", "CNLINKO"],

  ["C0805C221K4RACTU-KEMET-SMD Multilayer Ceramic Capacitor 220pF", "C0805C221K4RACTU", "KEMET"],
];

for (const [title, mpn, brand] of cases) corpus.push(title);
const freq = segmentFrequency(corpus);

for (const [title, mpn, brand] of cases) {
  const got = splitTitle(title, freq);
  assert.ok(got, `must parse: ${title}`);
  assert.equal(got.mpn, mpn, `mpn for ${title}`);
  assert.equal(got.brand, brand, `brand for ${title}`);
}

/*
  Titles with no part number in them at all. Most of this catalogue is modules
  and mechanical parts named in English, and the only correct answer for those
  is `null` — a lookup key invented for them would be looked up.
*/
for (const plain of [
  "XING2 3110 FPV Motor Unibell - 900KV",
  "F450 / Q450 Quadcopter Frame PCB Board – Made in INDIA",
  "6000 2RS Rubber Sealed Ball Bearing (ID:10mm OD:26mm T:8mm)",
  "M4 X 50mm Phillips Pan head SS 304 Screw",
  "",
]) {
  assert.equal(splitTitle(plain, freq), null, `must not invent a part number: ${plain}`);
}

/*
  The documented ceiling, asserted so that it stays a known limit rather than
  becoming a surprise. `MICROCHIP-DC-DC Switching Boost` runs the brand into
  the description's leading `DC`, because a two-letter segment with no space in
  it is indistinguishable from a short manufacturer name at this altitude.
  The MPN — the only field a distributor API is queried on — is still exact.
*/
{
  const got = splitTitle("MCP1640CT-I/CHY-MICROCHIP-DC-DC Switching Boost Regulator", freq);
  assert.equal(got?.mpn, "MCP1640CT-I/CHY", "the part number survives the brand running on");
  assert.ok(got.brand.startsWith("MICROCHIP"), "brand is known to over-run here");
}

console.log(`mpn: ok  (${cases.length} splits, 5 non-parts, 1 known ceiling)`);
