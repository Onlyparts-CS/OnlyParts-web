#!/usr/bin/env node
/**
 * Price comparison across suppliers.
 *
 * The catalogue puller's job is breadth. This is the other half: deciding
 * which listings are the same physical part, and what each one actually costs
 * per unit.
 *
 * ## Why matching on titles alone does not work
 *
 * A first attempt keyed on "any token that looks like a part number" and
 * produced mostly nonsense: it grouped 110 unrelated products under `SS304` (a
 * material), 85 under `DC12V` (a voltage) and 35 under `RS485` (a protocol).
 * It also merged male-female standoffs with female-female standoffs and
 * heat-set inserts, which are three different parts that happen to share a
 * thread size.
 *
 * The structure that does work is the one `product_validator.py` uses in the
 * price-comparison project: **loose on the family, strict on the thing that
 * discriminates.** For phones that is brand + line loosely and model number
 * strictly. For industrial parts the discriminator is different per family —
 * a bearing is its designation, a fastener is thread × length × head ×
 * material, an IC is its part number — so the rules are per family here.
 *
 * ## Why pack size decides everything
 *
 *   robu       ₹272  M3x10mm Brass Standoff (pack of 25)
 *   onlyscrews ₹5    M3 X 10mm Brass Standoff
 *
 * That is not a 54× price difference, it is a unit-of-sale difference. Any
 * comparison that skips this produces confident nonsense, so a listing whose
 * pack size cannot be read is excluded from comparison rather than guessed at.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

/* ------------------------------------------------------------------ *
 * Pack size
 * ------------------------------------------------------------------ */

/**
 * How many units one listing sells.
 *
 * Returns null rather than 1 when nothing says. "No pack size stated" and
 * "sold singly" look identical in a title and are not the same claim — a wrong
 * 1 here silently turns a ₹272 pack of 25 into a ₹272 part.
 */
export function packSize(title, specs = {}) {
  const t = `${title} ${Object.entries(specs).map(([k, v]) => `${k} ${v}`).join(" ")}`;

  const patterns = [
    /\(\s*(?:pack\s*of\s*)?(\d{1,4})\s*(?:pcs?|pieces?|nos?|units?)\s*\)/i, // (25Pcs) (10 pieces)
    /\bpack\s*of\s*(\d{1,4})\b/i, //                                          pack of 25
    /\bset\s*of\s*(\d{1,4})\b/i, //                                           set of 9
    /\b(\d{1,4})\s*(?:pcs|pieces|nos)\b(?!\s*\/)/i, //                        50pcs
    /\b(\d{1,4})\s*-?\s*piece\b/i, //                                         9-piece
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = Number(m[1]);
      // A "pack of 1" is a real claim; a pack of 100,000 is a parsing error.
      if (n >= 1 && n <= 5000) return n;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Family-specific signatures
 *
 * Each returns null when it cannot speak confidently, and the caller falls
 * through to the next. Order matters: the most specific identifier wins.
 * ------------------------------------------------------------------ */

/*
  Tokens that look like part numbers and are not. This list is why the first
  attempt failed — every one of these grouped dozens of unrelated products.
*/
const NOT_A_PART_NUMBER = new Set([
  "SS304", "SS316", "SS201", "MS", "EN8", "EN19", "CRV", "CR-V",
  "DC12V", "DC24V", "DC5V", "AC220V", "AC230V", "DC3V", "DC6V", "DC9V",
  "RS485", "RS232", "USB2", "USB3", "I2C", "SPI", "UART", "PWM", "TTL",
  "IP65", "IP67", "IP68", "M2", "M3", "M4", "M5", "M6", "M8", "M10", "M12",
  "PLA", "ABS", "PETG", "TPU", "PVC", "PTFE", "POM", "HDPE",
  "LED", "LCD", "OLED", "TFT", "SMD", "SMT", "THT", "DIP", "PCB",
  "3D", "2D", "CNC", "DIY", "RC", "FPV", "ESC", "BLDC", "PWM",
]);

const BEARING = /\b(6[0-9]{3}|60[0-9]{2}|62[0-9]{2}|63[0-9]{2}|68[0-9]{2}|69[0-9]{2}|MR[0-9]{3}|LM[0-9]{1,2}UU|SBR[0-9]{1,2}L?UU)\s*-?\s*(ZZ|2RS|RS|2Z|OPEN)?\b/i;

const THREAD = /\bM(\d{1,2})\s*(?:x|X|×|\*)\s*(\d{1,3})\b/;

/** Head/style words that distinguish otherwise-identical threaded parts. */
const STYLES = [
  "male to female", "male-female", "female to female", "female-female",
  "socket head", "button head", "countersunk", "csk", "pan head", "cheese head",
  "hex head", "grub", "flange", "heat set", "knurled", "standoff", "pillar",
  "washer", "nut", "insert", "spacer", "bolt", "screw", "stud", "rod",
];

const MATERIALS = ["ss304", "ss316", "stainless", "brass", "nylon", "alloy steel", "mild steel", "titanium", "aluminium", "zinc"];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * What separates one SKU of a part from another.
 *
 * This is the fix for the worst failure the heuristics had: the signature was
 * capturing the *chip family* and calling it the product. `mpn:ESP8266:module`
 * collected thirty-five listings — ESP-01, ESP-07, ESP-12E, ESP-12F and
 * ESP-12S are five genuinely different modules, and the group also swept in
 * relay boards and starter kits. `ESP8266` is what is inside them; `ESP-12E` is
 * what you buy.
 *
 * The same shape recurs everywhere once you look: ESP32-WROVER in 4M, 8M and
 * 16M flash; NEMA17 motors from 2.6 to 7.2 kg-cm; brushless motors in CW and
 * CCW that are not interchangeable; LoRa modules at 433 and 868 MHz.
 *
 * This is the "strict on the discriminator" half of the rule
 * `product_validator.py` uses — brand and line loosely, model strictly. The
 * previous version was loose on both, which is why one signature covered a
 * dozen products.
 */
function discriminators(title) {
  const out = [];
  const add = (v) => { if (v && !out.includes(v)) out.push(v); };

  // Module variant codes: ESP-12E, ESP-01S, RA-02, E32-433T20S.
  for (const m of title.matchAll(/\b([A-Z]{2,4}-\d{2,4}[A-Z]?\d?)\b/gi)) add(m[1].toUpperCase());

  // Flash / memory size, which is a different SKU at a different price.
  for (const m of title.matchAll(/\b(\d{1,3})\s*M(?:B|bit)?\s+(?:flash|spi\s*flash)\b/gi)) add(`${m[1]}M`);
  for (const m of title.matchAll(/\bN(\d{1,2})R(\d{1,2})\b/gi)) add(`N${m[1]}R${m[2]}`);

  // Motors: speed constant, torque, and rotation direction.
  for (const m of title.matchAll(/\b(\d{3,5})\s*KV\b/gi)) add(`${m[1]}KV`);
  for (const m of title.matchAll(/\b([\d.]{1,5})\s*kg-?\s?cm\b/gi)) add(`${m[1]}KGCM`);
  for (const m of title.matchAll(/\b(CCW|CW)\b/g)) add(m[1].toUpperCase());

  // Radio band — a 433MHz LoRa module will not talk to an 868MHz one.
  for (const m of title.matchAll(/\b(\d{3})\s*MH[Zz]\b/g)) add(`${m[1]}MHZ`);

  // Channel count on relay boards.
  for (const m of title.matchAll(/\b(\d{1,2})\s*-?\s*channels?\b/gi)) add(`${m[1]}CH`);

  /*
    Switching temperature and contact type on thermostats and thermal cutouts.

    KSD9700 produced the single worst group in the report: 89 offers, a headline
    ×10.2 spread, and every one of them a different switch. The part number is
    the family; the product is the family plus the temperature it trips at and
    whether it opens or closes. A 45°C normally-closed cutout is not a
    substitute for a 95°C normally-open one at any price.

    Full-width parentheses are in the pattern because robu's titles use them —
    "（45C Normally Closed）" — and a boundary that assumes ASCII misses every one.
  */
  for (const m of title.matchAll(/[\s(（](\d{2,3})\s*°?\s*C\b/gi)) add(`${m[1]}C`);
  // "135 Degree" — KSD301 spells it out where KSD9700 uses C.
  for (const m of title.matchAll(/\b(\d{2,3})\s*degrees?\b/gi)) add(`${m[1]}C`);
  if (/normally\s*closed|\bN\.?C\.?\b/i.test(title)) add("NC");
  if (/normally\s*open|\bN\.?O\.?\b/i.test(title)) add("NO");

  return out.length ? `:${out.sort().join("+")}` : "";
}

/**
 * A signature two listings must share to be considered the same part.
 *
 * `null` means "cannot say", which is treated as "do not compare" — not as a
 * catch-all bucket.
 */
export function signature(row) {
  const title = String(row.title ?? "");
  const specText = Object.entries(row.specs ?? {}).map(([k, v]) => `${k}: ${v}`).join(" ");
  const text = `${title} ${specText}`;
  const low = text.toLowerCase();

  // 1. Bearings carry a real international designation.
  const b = text.match(BEARING);
  if (b && /bearing|bush/i.test(text)) {
    return `bearing:${b[1].toUpperCase()}${b[2] ? `-${b[2].toUpperCase()}` : ""}`;
  }

  // 2. Threaded hardware: thread and length are necessary but nowhere near
  //    sufficient — style and material are what separate an M3x10 standoff
  //    from an M3x10 screw from an M3x10 insert.
  const th = text.match(THREAD);
  if (th) {
    const style = STYLES.filter((s) => low.includes(s)).map(norm).sort().join("+");
    const mat = MATERIALS.find((m) => low.includes(m)) ?? "";
    // No style word means we cannot tell what kind of part it is.
    if (style) return `thread:M${th[1]}x${th[2]}:${style}:${norm(mat)}`;
  }

  // 3. A genuine manufacturer part number, plus whatever distinguishes one
  //    SKU of it from another. See `discriminators` for why the second half
  //    matters more than the first.
  for (const m of title.matchAll(/\b([A-Z]{2,}[0-9]{2,}[A-Z0-9-]{0,10})\b/g)) {
    const tok = m[1].toUpperCase().replace(/-$/, "");
    if (tok.length < 6 || NOT_A_PART_NUMBER.has(tok)) continue;
    if (!/[0-9]/.test(tok) || !/[A-Z]/.test(tok)) continue;

    /*
      "Is" the part, or "contains" one?

      A GrovePi+ that mentions ATMEGA328P in passing is not an ATMEGA328P, and
      a flight controller listing a BMI270 is not an IMU breakout. Products
      lead with what they are, so a part number appearing late in the title is
      almost always a component of something else.
    */
    if (m.index > 45) continue;

    /*
      And form factor is part of the identity. A bare BMP280 sensor at ₹27, a
      breakout board at ₹442 and a DFRobot module at ₹622 all match on the part
      number and are three different things to buy. Comparing across them
      produces a 23× "spread" that means nothing. Two modules, on the other
      hand, are genuinely comparable.
    */
    /*
      An accessory *for* a part is not that part.

      `NEMA17` matched a ₹44 motor cable and a ₹531 coupling hub alongside a
      ₹605 stepper motor; `CR2032` matched battery holders alongside batteries.
      Both produced spectacular, meaningless "spreads". The giveaways are the
      word "for" preceding the part number, and a small vocabulary of accessory
      nouns.
    */
    const before = title.slice(0, m.index).toLowerCase();
    const isAccessory =
      /\b(for|compatible with|suits?|fits)\s*$/.test(before.trimEnd().slice(-24)) ||
      /\b(cable|holder|case|cover|coupling|coupler|bracket|mount|adapter|adaptor|clip|stand|enclosure|spacer|connector|socket)\b/i.test(
        title,
      );
    if (isAccessory) continue;

    /*
      A kit is not the part, and neither is a jig.

      "ESP8266 IoT Starter Kit with DHT11" and "ESP8266 Burning Fixture Tool"
      both matched the bare module at ₹109. Kits are their own category with
      their own price logic, so they get their own bucket rather than being
      compared against a component.
    */
    const form = /\b(starter\s*kit|kit|bundle|fixture|jig|programmer)\b/i.test(title)
      ? "kit"
      : /\b(breakout|module|shield|hat|dev(?:elopment)?\s*board|board)\b/i.test(title)
        ? "module"
        : "bare";

    return `mpn:${tok}${discriminators(title)}:${form}`;
  }

  return null;
}

/* ------------------------------------------------------------------ */

/** Our own output is not a supplier — it lives in the same directory. */
const NOT_A_SOURCE = new Set(["comparison"]);

function load() {
  const rows = [];
  for (const f of readdirSync(OUT)) {
    if (!f.endsWith(".json") || f.endsWith(".state.json")) continue;
    const src = f.replace(/\.json$/, "");
    if (NOT_A_SOURCE.has(src)) continue;
    for (const r of JSON.parse(readFileSync(join(OUT, f), "utf8"))) rows.push({ ...r, src });
  }
  return rows;
}

const rows = load();

const groups = new Map();
let noSignature = 0;
let noPack = 0;

for (const r of rows) {
  const sig = signature(r);
  if (!sig) { noSignature++; continue; }
  const pack = packSize(r.title, r.specs);
  if (pack === null) noPack++;
  r._sig = sig;
  r._pack = pack;
  r._unit = pack && r.price ? r.price / pack : null;
  if (!groups.has(sig)) groups.set(sig, []);
  groups.get(sig).push(r);
}

/*
  Two tiers, because discarding everything without a stated pack size threw
  away almost every match — and a match whose pack size is unknown is still
  worth showing a buyer, as long as it does not pretend to be a unit price.

    confirmed  — every offer states its pack size. Directly comparable.
    unverified — matched, but at least one listing does not say how many you
                 get. Raw prices only, and labelled as such.

  Splitting them is the difference between "we cannot compare this" and "here
  are two sellers, check the quantity yourself".
*/
const crossSupplier = [...groups.entries()].filter(
  ([, v]) => v.length > 1 && new Set(v.map((r) => r.src)).size > 1,
);
const confirmed = crossSupplier.filter(([, v]) => v.every((r) => r._unit !== null));
const unverified = crossSupplier.filter(([, v]) => !v.every((r) => r._unit !== null));

console.log(`rows:                    ${rows.length}`);
console.log(`sources:                 ${[...new Set(rows.map((r) => r.src))].join(", ")}`);
console.log(`no signature:            ${noSignature}  (${((100 * noSignature) / rows.length).toFixed(0)}%)`);
console.log(`signed but no pack size: ${noPack}`);
console.log(`distinct signatures:     ${groups.size}`);
console.log(`\ncross-supplier matches:  ${crossSupplier.length}`);
console.log(`  unit-price confirmed:  ${confirmed.length}`);
console.log(`  pack size unverified:  ${unverified.length}`);
const mixedCount = crossSupplier.filter(
  ([, v]) => !v.every((r) => r._unit !== null) && v.some((r) => r._unit !== null),
).length;
if (mixedCount) {
  console.log(`  not comparable yet:    ${mixedCount}  ← quantity stated on only some offers`);
}

const report = [];
for (const [sig, v] of crossSupplier.sort((a, b) => b[1].length - a[1].length)) {
  const isConfirmed = v.every((r) => r._unit !== null);
  /*
    Mixed pack sizes produce a spread that is pure fiction.

    Falling back to list price when *some* offers state a quantity compares
    one Yageo resistor at ₹0.42 against a strip of twenty at ₹9 and reports a
    21× saving. Forty-eight of the 232 cross-supplier groups did exactly this,
    and because the report ranks by spread, those forty-eight were the entire
    top of the list — the most prominent numbers in the output were the least
    true ones.

    A spread is published only when every offer is measured the same way.
    Elsewhere it is null: the group is still a real candidate and still worth
    confirming, it just has no comparable number yet.
  */
  const mixedPacks = !isConfirmed && v.some((r) => r._unit !== null);
  const key = (r) => (isConfirmed ? r._unit : r.price);
  const sorted = [...v].sort((a, b) => key(a) - key(b));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  report.push({
    signature: sig,
    basis: isConfirmed
      ? "unit-price"
      : mixedPacks
        ? "not comparable (pack size stated on only some offers)"
        : "list-price (pack size unverified)",
    offers: sorted.map((r) => ({
      source: r.src, sku: r.sku, title: r.title,
      price: r.price, pack: r._pack, unitPrice: r._unit === null ? null : Number(r._unit.toFixed(3)),
      inStock: Boolean(r.stock), url: r.sourceUrl,
      // Carried for the confirmation pass: pack size is stated in the body far
      // more often than in the title, which is why the regex could read it on
      // only one group in eighty-seven.
      description: String(r.description ?? "").slice(0, 300),
    })),
    cheapest: { source: best.src, basis: Number(key(best).toFixed(3)) },
    spread: mixedPacks || key(best) <= 0 ? null : Number((key(worst) / key(best)).toFixed(2)),
  });
}

writeFileSync(join(OUT, "comparison.json"), JSON.stringify(report, null, 1));
console.log(`\nwrote tools/feeds/out/comparison.json`);

/*
  A group large enough to be several products usually is one.

  What survives at the top after the discriminators is a single class: boards
  named after the chip inside them. "XIAO ESP32-S3", "FireBeetle 2 ESP32-S3"
  and "ShrikeFi ESP32-S3 FPGA" share a microcontroller and nothing else — there
  is no part number to match on, because the chip is a component of the product
  rather than the product. No pattern separates those; only reading them does.

  So they stay in comparison.json as candidates for the confirmation pass, and
  they stay out of a list headed "widest spreads", where a ×60 that is really
  three different boards is worse than no number.
*/
const OVERSIZED = 7;
const oversized = report.filter((g) => g.offers.length >= OVERSIZED);
if (oversized.length) {
  console.log(`\n--- ${oversized.length} groups too large to be one product (${oversized.reduce((a, g) => a + g.offers.length, 0)} offers) ---`);
  console.log("    not ranked below; these are what the confirmation pass is for\n");
  for (const g of [...oversized].sort((a, b) => b.offers.length - a.offers.length).slice(0, 6)) {
    console.log(`  ${String(g.offers.length).padStart(3)}  ${g.signature}`);
  }
}

console.log("\n--- widest spreads ---");
for (const g of report
  .filter((g) => g.spread && g.spread < 50 && g.offers.length < OVERSIZED)
  .sort((a, b) => b.spread - a.spread)
  .slice(0, 10)) {
  console.log(`\n  ${g.signature}   ×${g.spread}   [${g.basis}]`);
  for (const o of g.offers.slice(0, 4)) {
    const per = o.unitPrice === null ? `₹${String(o.price).padStart(8)}  (qty ?)  ` : `₹${String(o.unitPrice).padStart(8)}/unit (÷${o.pack})`;
    console.log(`    ${o.source.padEnd(17)} ${per}  ${o.inStock ? "in stock" : "out     "}  ${o.title.slice(0, 42)}`);
  }
}
