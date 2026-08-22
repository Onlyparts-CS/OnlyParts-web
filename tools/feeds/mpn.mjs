#!/usr/bin/env node
/**
 * Manufacturer part numbers, recovered from titles we already hold.
 *
 * ## Why this is not a scraper
 *
 * robu.in went behind Cloudflare and now answers 403 to everything but a real
 * browser. That closed 107,509 rows — 80% of the catalogue — to any refresh.
 * The reflex is to climb the ladder in `pull.mjs`'s header (curl-impersonate,
 * then a browser). The better move is to notice that the rows are already
 * keyed for something else entirely:
 *
 *     OPA340UA-TEXAS INSTRUMENTS-Single Supply, Rail-to-Rail Op Amp
 *     RT0603BRD071K01L-YAGEO-1.01kOhms ±0.5% 0.1W 0603 Thick Film Resistor
 *     IRFH5015TRPBF-INFINEON TECHNOLOGIES-MOSFET N-CH 30V 100A PQFN
 *
 * That is `<MPN>-<MANUFACTURER>-<description>`, and an MPN is the join key
 * every parts API takes. For the rows this file can parse, robu is not the
 * source of truth and never was — it was a courier for the manufacturer's own
 * data, and the manufacturer will still hand that data over.
 *
 * ## How the split is decided
 *
 * Not by a regex on hyphens. MPNs contain hyphens constantly — `MCP6001T-I/OT`,
 * `AC0603FR-07392RL`, `LP-12-J08SX-02-401` — so splitting on the first one
 * truncates roughly half of them, silently, into something that still looks
 * like a part number.
 *
 * The signal that actually separates the two is **corpus frequency**. A
 * manufacturer's name repeats across thousands of titles; a part number is
 * close to unique. So: walk the hyphen-separated segments and keep taking them
 * into the MPN until one turns up that the corpus has seen many times before.
 * That segment begins the manufacturer.
 *
 * Two adjustments, both from watching it get things wrong:
 *
 *   - **Segment 0 is always the MPN**, never a stop. `RC0402FR` opens 819
 *     titles and `RC0603FR` opens 751 — Yageo's resistor prefixes are as
 *     frequent as some brands, and they are unmistakably part numbers. Position
 *     settles what frequency cannot.
 *   - **A brand may span several segments.** `Uniohm/Royal-ohm` and
 *     `Ever Ohms Tech` are single manufacturers wearing hyphens and spaces.
 *     The brand therefore runs from the first frequent segment to the last one
 *     before prose starts, rather than being a single token.
 *
 * ## Known ceiling
 *
 * When a manufacturer's own suffix is frequent enough to look like a brand, the
 * MPN stops early: `MCP6001T-I/OT` can come back as `MCP6001T`. That yields the
 * part family rather than the exact orderable part, which a keyword search still
 * resolves — so it degrades into a worse lookup, not a wrong one. Anything that
 * matters commercially should be confirmed against the API's response, not
 * trusted from here.
 *
 * This reads titles. It fetches nothing and asks no supplier for permission,
 * because it is reading data we already lawfully hold.
 *
 * Usage:
 *   node tools/feeds/mpn.mjs --source=robu [--min=25] [--limit=20]
 *
 * Writes tools/feeds/out/<source>.mpn.json.
 */

import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);

/** Segments seen this many times are a brand, not a part number. */
export const DEFAULT_MIN = 25;

/**
 * How often each hyphen-separated segment occurs across every title.
 *
 * Counted once per title, not once per occurrence: a part number that repeats
 * a segment inside itself must not vote itself into the brand vocabulary.
 */
export function segmentFrequency(titles) {
  const freq = new Map();
  for (const t of titles) {
    const seen = new Set();
    for (const raw of String(t).split("-")) {
      const s = raw.trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      freq.set(s, (freq.get(s) ?? 0) + 1);
    }
  }
  return freq;
}

/** True for a segment that reads as prose — where the description begins. */
const isProse = (s) => /\s/.test(s) && !/^[A-Za-z][A-Za-z.&/]*(\s[A-Za-z][A-Za-z.&/]*)*$/.test(s);

/**
 * `{ mpn, brand }` for one title, or `null` when it does not have the shape.
 *
 * `null` is the common case and not a failure: most of this catalogue is
 * modules and mechanical parts named in English, which have no part number to
 * find. Returning something for those would be inventing one.
 */
export function splitTitle(title, freq, min = DEFAULT_MIN) {
  const segs = String(title).split("-").map((s) => s.trim());
  if (segs.length < 3) return null;

  let i = 1; // segment 0 is the MPN by position, whatever its frequency
  /*
    A brand has letters in it and is longer than one character. Part numbers
    end in short frequent codes — tolerance, packaging, reel — and each one in
    turn walked into the brand as the vocabulary grew: first the bare `7` of
    `BAT54-7-Diodes Incorporated-…`, giving the MPN `BAT54` under the brand
    `7-Diodes Incorporated`, then the `F` of `…-F-Diodes Incorporated-…` once
    the digit was excluded. `BAT54-7` is the orderable part and `BAT54` is its
    family; both look right in a list, which is what makes this worth a test
    rather than an eyeball.
  */
  const startsBrand = (s) => s.length > 1 && /[A-Za-z]/.test(s) && (freq.get(s) ?? 0) >= min;
  while (i < segs.length && !startsBrand(segs[i]) && !isProse(segs[i])) i++;
  if (i >= segs.length || i === segs.length - 1) return null;

  const mpn = segs.slice(0, i).join("-");

  /*
    The brand runs on until prose starts, across at most three segments.

    The cap is doing real work. `Texas Instruments` and `DC Switching Boost
    Regulator` are the same shape — capitalised words, no digits — so nothing
    local distinguishes a two-word manufacturer from a description that happens
    to open with words. Uncapped, the brand ate the whole description and the
    row was thrown away for having no description left. Three segments covers
    every manufacturer in the corpus (`Uniohm/Royal-ohm` needs two) and bounds
    the damage when the guess is wrong.

    Brand accuracy is explicitly the lesser goal here. The MPN is the only
    field a distributor API is queried on, and it is already fixed by this
    point — so an over-running brand degrades an annotation, not the key.
  */
  let j = i;
  while (j < segs.length && j < i + 3 && !isProse(segs[j])) j++;
  const brand = segs.slice(i, j).join("-");

  // An MPN with no digit at all is a word, not a part number.
  if (!mpn || !brand || !/\d/.test(mpn)) return null;
  return { mpn, brand };
}

/* ------------------------------------------------------------------ *
 * CLI, behind a main-module guard so the check file can import the above.
 * ------------------------------------------------------------------ */

async function main() {
  const source = args.source;
  if (!source) {
    console.error("Usage: node tools/feeds/mpn.mjs --source=<name> [--min=25] [--limit=20]");
    process.exit(1);
  }

  const rows = JSON.parse(readFileSync(join(OUT, `${source}.json`), "utf8"));
  const min = Number(args.min ?? DEFAULT_MIN);
  const freq = segmentFrequency(rows.map((r) => r.title));

  const found = [];
  for (const r of rows) {
    const hit = splitTitle(r.title, freq, min);
    if (hit) found.push({ sku: r.sku, mpn: hit.mpn, brand: hit.brand, title: r.title });
  }

  writeFileSync(
    join(OUT, `${source}.mpn.json`),
    JSON.stringify({ source, min, total: rows.length, matched: found.length, parts: found }, null, 1),
  );

  const brands = {};
  for (const f of found) brands[f.brand] = (brands[f.brand] ?? 0) + 1;
  const top = Object.entries(brands).sort((a, b) => b[1] - a[1]);

  console.log(`
  ${rows.length} rows in ${source}

  part number found  ${found.length}   ← has an MPN a distributor API can resolve
  no part number     ${rows.length - found.length}   ← named in English; nothing to look up
  distinct brands    ${top.length}

  Written to tools/feeds/out/${source}.mpn.json
`);

  console.log("  Most common manufacturers:");
  for (const [b, n] of top.slice(0, Number(args.limit ?? 20))) {
    console.log(`    ${String(n).padStart(6)}  ${b}`);
  }
  console.log("");
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) await main();
