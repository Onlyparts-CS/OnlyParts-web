#!/usr/bin/env node
/*
  Group the harvest into families that could share one photograph.

    node tools/feeds/image-families.mjs > tools/feeds/out/image-families.csv

  The question this answers is not "which products are related" but the much
  narrower "which products are indistinguishable in a photograph". A 0603 and an
  0805 chip resistor are different parts with different footprints and the same
  picture; an M4x12 and an M4x30 socket cap differ only in a length the camera
  cannot convey at catalogue size. Suppliers already know this — one robu shot
  serves five bearing sizes — so the grouping is a formalisation of what the
  trade does by hand.

  Method: mask the tokens that vary *within* a family and group on what is left.
  Masking is deliberately aggressive, because the cost of the two errors is not
  symmetric here. Over-merging shows up as a family whose sample images differ,
  which a human spots in seconds while reviewing the list. Under-merging shows
  up as nothing at all, and quietly leaves the catalogue scraping thousands of
  near-identical photographs.

  Nothing is decided here. The output is a list to be reviewed, and the
  representative URL is a candidate, not a choice.
*/
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const DIR = "tools/feeds/out";
const feeds = readdirSync(DIR).filter(
  (f) => f.endsWith(".json") && !/state|mpn|comparison|purged|watermark|families|^_/.test(f),
);

/* Tokens that vary within a family and are invisible or near-invisible in a photo. */
const MASKS = [
  [/\(?\b(?:pack|reel|set|lot|pcs?|pieces?)\s*(?:of)?\s*\d+\s*(?:pcs?|pieces?)?\)?/gi, " ⟨qty⟩ "],
  [/\b\d+\s*(?:pcs?|nos|units?)\b/gi, " ⟨qty⟩ "],
  // Thread designations: M3, M4 x 12, M2.5X0.45
  [/\bM\d+(?:\.\d+)?(?:\s*[x×X]\s*\d+(?:\.\d+)?)*\b/g, " ⟨thread⟩ "],
  // Electrical values: 100 Ohm, 4.7kΩ, 10uF, 220nH, 12V, 1/4W, 25V
  [/\b\d+(?:\.\d+)?\s*(?:[kKmMuµnpG])?\s*(?:ohms?|Ω|ω|farads?|F|H|V|A|W|Hz|VA|mAh|Ah|VAC|VDC|ppm)\b/gi, " ⟨value⟩ "],
  [/\b\d+\/\d+\s*w\b/gi, " ⟨value⟩ "],
  // Physical sizes with a unit
  [/\b\d+(?:\.\d+)?\s*(?:mm|cm|inch|in|")\b/gi, " ⟨size⟩ "],
  // Bare dimension triples/pairs: 20x10x2, 15x2
  [/\b\d+(?:\.\d+)?(?:\s*[x×X]\s*\d+(?:\.\d+)?){1,3}\b/g, " ⟨size⟩ "],
  // Tolerance and percentage
  [/[±+-]?\s*\d+(?:\.\d+)?\s*%/g, " ⟨tol⟩ "],
  // Bare 3-5 digit codes: EIA package sizes, bearing designations, resistance codes
  [/(?<![\w.])\d{3,5}(?![\w.])/g, " ⟨code⟩ "],
  // Anything left that is a bare number
  [/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g, " ⟨n⟩ "],
];

/*
  On a passive, the part number *encodes the value* — WR06X6802FTL and
  WR06X6803FTL are the same Walsin thick-film resistor at 68k and 680k, and the
  photograph cannot tell them apart. On a board it *is* the product: masking
  ESP32 would merge every dev board ever made.

  So the MPN mask is conditional on the listing naming a passive, and never
  applies to anything that calls itself a module, board or kit.
*/
const PASSIVE = /\b(resistor|capacitor|mlcc|inductor|ferrite|bead|diode|thermistor|varistor|fuse|crystal|oscillator)s?\b/i;
const NOT_PASSIVE = /\b(module|board|shield|kit|breakout|development|sensor|display|driver|controller)\b/i;
// Mixed letters+digits, 5+ chars — a part number, not an English word.
// Leading digit allowed: a capacitor value code like 2J223J is a part number too,
// and requiring a leading letter kept CL11 …2J223J and CL11 …2A473J apart as two
// families when they are one capacitor at two values. Both lookaheads still hold,
// so a pure number (0603) can never match.
const MPN = /(?<![\w])(?=[a-z0-9-]*\d)(?=[a-z0-9-]*[a-z])[a-z0-9][a-z0-9-]{4,}(?![\w])/gi;

const familyKey = (title) => {
  let t = ` ${title} `;
  if (PASSIVE.test(t) && !NOT_PASSIVE.test(t)) t = t.replace(MPN, " ⟨mpn⟩ ");
  for (const [re, to] of MASKS) t = t.replace(re, to);
  return t
    .replace(/[–—\-_/,:;()\[\]|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

/* ---- gather ---- */
const fam = new Map();
const seenTitle = new Set();
let rows = 0;

for (const f of feeds) {
  const src = f.replace(/\.json$/, "");
  const d = JSON.parse(readFileSync(path.join(DIR, f), "utf8"));
  for (const r of Array.isArray(d) ? d : (d.rows ?? d.products ?? [])) {
    const title = (r.title ?? "").trim();
    if (!title) continue;
    const dedupe = title.toLowerCase();
    if (seenTitle.has(dedupe)) continue;
    seenTitle.add(dedupe);
    rows++;

    const key = familyKey(title);
    if (!key || key.replace(/⟨\w+⟩/g, "").trim().length < 4) continue; // masked into nothing
    if (!fam.has(key)) fam.set(key, { skus: 0, urls: new Set(), srcs: new Set(), titles: [], cats: new Set() });
    const e = fam.get(key);
    e.skus++;
    e.srcs.add(src);
    if (r.category) e.cats.add(r.category);
    for (const u of [r.image, ...(r.images ?? [])]) if (typeof u === "string" && u.startsWith("http")) e.urls.add(u);
    if (e.titles.length < 3) e.titles.push(title);
  }
}

/* ---- report ---- */
const list = [...fam.entries()]
  .map(([key, e]) => ({ key, ...e, urls: e.urls.size, candidate: [...e.urls][0] ?? "" }))
  .sort((a, b) => b.skus - a.skus);

const multi = list.filter((f) => f.skus > 1);
const totalInMulti = multi.reduce((a, f) => a + f.skus, 0);
const urlsInMulti = multi.reduce((a, f) => a + f.urls, 0);

const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
console.log(["skus", "distinct_image_urls", "sources", "family", "example_title", "candidate_url"].join(","));
for (const f of list) {
  console.log([f.skus, f.urls, esc([...f.srcs].join(" ")), esc(f.key), esc(f.titles[0] ?? ""), esc(f.candidate)].join(","));
}

console.error(`titles              ${rows.toLocaleString()}`);
console.error(`families            ${list.length.toLocaleString()}`);
console.error(`  with >1 sku       ${multi.length.toLocaleString()}  covering ${totalInMulti.toLocaleString()} titles`);
console.error(`  singletons        ${(list.length - multi.length).toLocaleString()}`);
console.error(`image urls in multi-sku families: ${urlsInMulti.toLocaleString()}  ->  ${multi.length.toLocaleString()} if one photo per family`);
