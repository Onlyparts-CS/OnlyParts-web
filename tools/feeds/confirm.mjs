#!/usr/bin/env node
/**
 * The last pass: an LLM confirms which candidate matches are really the same
 * purchasable item, and reads the pack size the regex could not.
 *
 * ## Why this step exists
 *
 * `compare.mjs` groups listings by heuristic — part number, thread size,
 * bearing designation — and those heuristics have a long tail that regex
 * cannot close. Four separate failure classes had to be patched by hand
 * (material tokens read as part numbers, "contains" mistaken for "is", form
 * factor ignored, accessories matched to the thing they attach to) and each
 * fix revealed another. `BMP280:module` still groups a ₹27 listing with a
 * ₹622 one.
 *
 * So the heuristics are demoted to **candidate generation**, and judgement
 * happens here. This is the only part of the pipeline where a language model
 * earns its place: the scraping is plain HTTP and the mapping is a lookup
 * table, but "are these two listings the same thing you can buy" is a question
 * about meaning.
 *
 * ## Pack size
 *
 * Of 87 candidate groups, regex could read the quantity on both sides of
 * exactly one. That single number decides everything downstream — ₹272 for a
 * pack of 25 and ₹5 for one screw are the same price, and a procurement sheet
 * that misses it recommends the wrong supplier every time. The model reads it
 * from the title and description in the same call, at no extra cost.
 *
 * ## Cost control
 *
 * Every answer is cached by a hash of exactly what was asked, so re-running
 * after adding a supplier only pays for the new groups. `--limit` and
 * `--dry-run` exist so nobody discovers the bill afterwards.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node tools/feeds/confirm.mjs [--limit=50] [--model=...] [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const CACHE_PATH = join(OUT, "confirm.cache.json");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);

/*
  Sonnet rather than Haiku by default.

  A wrong confirmation is not a cosmetic error: it merges two different parts
  into one listing, and the consequence is a customer receiving the wrong
  component. At these volumes — tens to low thousands of groups — the price
  difference between models is rupees, and the cost of one bad merge is a
  return, a refund and a review. Pass `--model=claude-haiku-4-5-20251001` if a
  full 100k-product run makes that trade worth revisiting.
*/
const MODEL = args.model ?? "claude-sonnet-5";
const API = "https://api.anthropic.com/v1/messages";

/*
  Offers per request, not groups per request.

  Group sizes are not remotely uniform: 274 of them hold two offers and one
  holds seventy-five. Five groups per request is a small prompt most of the
  time and a prompt that overruns `max_tokens` when it happens to catch
  `ESP32-S3` — and the failure lands on exactly the groups that most need
  splitting, because being huge is what makes a group wrong.

  Budgeting by offer keeps every request about the same size. A group larger
  than the budget still goes out alone rather than being dropped.
*/
const MAX_OFFERS = Number(args.batch ?? 40);

function batches(items) {
  const out = [];
  let cur = [];
  let n = 0;
  for (const it of items) {
    const size = it.payload.offers.length;
    if (cur.length && n + size > MAX_OFFERS) {
      out.push(cur);
      cur = [];
      n = 0;
    }
    cur.push(it);
    n += size;
  }
  if (cur.length) out.push(cur);
  return out;
}

const SYSTEM = `You verify whether e-commerce listings from different Indian electronics and hardware suppliers are the same purchasable product.

You are given groups of candidate matches. A heuristic grouped them by part number or dimensions, and it makes these mistakes:
- an accessory FOR a part matched to the part (a cable for a NEMA17 motor is not a NEMA17 motor)
- a product CONTAINING a chip matched to the chip (a flight controller with a BMI270 is not a BMI270 IMU)
- different form factors merged (a bare BMP280 sensor die, a breakout board, and a branded module are three different products)
- different variants merged (ESP-01, ESP-12E and ESP-12S are different modules)

For each group, partition the offers into sets that are genuinely interchangeable — a buyer wanting one would accept any other in the set. Singleton sets are fine and expected.

Also read each offer's pack size: how many units one purchase delivers. Use the title and description. If it is genuinely not stated, use null. Do NOT default to 1 — "not stated" and "sold singly" are different claims and guessing wrong corrupts every price comparison downstream.

Respond with JSON only, no prose:
{"groups":[{"id":"<group id>","sets":[{"offers":[<0-based indices>],"label":"<short name>","confidence":"high|medium|low"}],"packSizes":[<one per offer, integer or null>]}]}`;

/* ------------------------------------------------------------------ */

const loadJson = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
};

const cache = loadJson(CACHE_PATH, {});
const groups = loadJson(join(OUT, "comparison.json"), []);

if (!groups.length) {
  console.error("No candidates. Run `node tools/feeds/compare.mjs` first.");
  process.exit(1);
}

/** What the model sees — and therefore what the cache key must cover. */
function describe(g, id) {
  return {
    id,
    signature: g.signature,
    offers: g.offers.map((o) => ({
      source: o.source,
      title: o.title,
      price: o.price,
      description: String(o.description ?? "").slice(0, 200) || undefined,
    })),
  };
}

const keyOf = (payload) =>
  createHash("sha256").update(`${MODEL}\n${JSON.stringify(payload)}`).digest("hex").slice(0, 32);

const pending = [];
let cached = 0;
for (const [i, g] of groups.entries()) {
  const payload = describe(g, String(i));
  const key = keyOf(payload);
  if (cache[key]) {
    cached++;
    g._verdict = cache[key];
  } else {
    pending.push({ index: i, key, payload });
  }
}

const limit = Number(args.limit ?? pending.length);
const todo = pending.slice(0, limit);

console.log(`candidate groups: ${groups.length}`);
console.log(`already cached:   ${cached}`);
console.log(`to confirm now:   ${todo.length}${todo.length < pending.length ? ` (of ${pending.length}, --limit)` : ""}`);
console.log(`model:            ${MODEL}`);

if (args["dry-run"]) {
  const offers = todo.reduce((a, t) => a + t.payload.offers.length, 0);
  const q = batches(todo);
  const biggest = Math.max(0, ...q.map((b) => b.reduce((a, t) => a + t.payload.offers.length, 0)));
  console.log(`\nDry run. Would send ${q.length} request(s) covering ${offers} offers (largest ${biggest}).`);
  process.exit(0);
}

if (!todo.length) {
  console.log("\nNothing to do — every group is cached.");
} else if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "\n  ✗ ANTHROPIC_API_KEY is not set, so nothing was confirmed.\n" +
      "    This step needs it; the rest of the pipeline does not.\n" +
      "      PowerShell:  $env:ANTHROPIC_API_KEY = 'sk-ant-...'\n" +
      "      bash:        export ANTHROPIC_API_KEY=sk-ant-...\n" +
      "    Then re-run. Use --dry-run first to see the size of the job.\n",
  );
  process.exit(3);
}

/* ------------------------------------------------------------------ */

let inTokens = 0;
let outTokens = 0;

async function ask(batch) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      // The answer carries one pack size and one index per offer, so the ceiling
      // has to follow the batch rather than sit at a constant that was fine for
      // five small groups and truncates on one large one.
      max_tokens: Math.min(8000, 600 + 60 * batch.reduce((a, b) => a + b.payload.offers.length, 0)),
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify({ groups: batch.map((b) => b.payload) }) }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const body = await res.json();
  inTokens += body.usage?.input_tokens ?? 0;
  outTokens += body.usage?.output_tokens ?? 0;

  const text = (body.content ?? []).map((c) => c.text ?? "").join("");
  // The model is told to return bare JSON; a fenced block is the common slip.
  const json = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  return JSON.parse(json);
}

const queue = batches(todo);
let done = 0;
for (const [i, batch] of queue.entries()) {
  done += batch.length;
  process.stdout.write(`  ${done}/${todo.length}…\r`);
  try {
    const answer = await ask(batch);
    for (const verdict of answer.groups ?? []) {
      const item = batch.find((b) => b.payload.id === String(verdict.id));
      if (!item) continue;
      cache[item.key] = verdict;
      groups[item.index]._verdict = verdict;
    }
    // Written every batch, so an interrupted run keeps what it paid for.
    writeFileSync(CACHE_PATH, JSON.stringify(cache));
  } catch (err) {
    console.warn(`\n  ✗ batch ${i + 1}/${queue.length}: ${err.message}`);
  }
}

/* ------------------------------------------------------------------ */

const confirmed = [];
let splitCount = 0;
let rejectedOffers = 0;

for (const g of groups) {
  const v = g._verdict;
  if (!v) continue;
  const sets = v.sets ?? [];
  if (sets.length > 1) splitCount++;

  for (const set of sets) {
    const offers = (set.offers ?? [])
      .map((idx) => {
        const o = g.offers[idx];
        if (!o) return null;
        const pack = v.packSizes?.[idx] ?? o.pack ?? null;
        return { ...o, pack, unitPrice: pack ? Number((o.price / pack).toFixed(3)) : null };
      })
      .filter(Boolean);

    // A set with one offer is not a comparison — it is just a product.
    if (offers.length < 2) { rejectedOffers += offers.length; continue; }
    if (new Set(offers.map((o) => o.source)).size < 2) { rejectedOffers += offers.length; continue; }

    const priced = offers.every((o) => o.unitPrice !== null);
    const key = (o) => (priced ? o.unitPrice : o.price);
    const sorted = [...offers].sort((a, b) => key(a) - key(b));

    confirmed.push({
      signature: g.signature,
      label: set.label ?? g.signature,
      confidence: set.confidence ?? "medium",
      basis: priced ? "unit-price" : "list-price (pack size unknown)",
      offers: sorted,
      buyFrom: { source: sorted[0].source, at: key(sorted[0]), inStock: sorted[0].inStock },
      spread: key(sorted[0]) > 0 ? Number((key(sorted[sorted.length - 1]) / key(sorted[0])).toFixed(2)) : null,
    });
  }
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "comparison.confirmed.json"), JSON.stringify(confirmed, null, 1));

/* Pricing as published, Aug 2026. Wrong-but-close beats no number at all. */
const RATE = { "claude-sonnet-5": [3, 15], "claude-haiku-4-5-20251001": [1, 5] }[MODEL] ?? [3, 15];
const usd = (inTokens / 1e6) * RATE[0] + (outTokens / 1e6) * RATE[1];

console.log(`
  ${confirmed.length} confirmed comparison sets → tools/feeds/out/comparison.confirmed.json

  groups the model split apart:  ${splitCount}
  offers dropped as not-a-match: ${rejectedOffers}
  with real unit prices:         ${confirmed.filter((c) => c.basis === "unit-price").length}
  high confidence:               ${confirmed.filter((c) => c.confidence === "high").length}

  tokens: ${inTokens} in, ${outTokens} out  ≈ $${usd.toFixed(4)}
`);

for (const c of confirmed.filter((c) => c.spread && c.confidence === "high").sort((a, b) => b.spread - a.spread).slice(0, 8)) {
  console.log(`  ${c.label}  ×${c.spread}  [${c.basis}]`);
  for (const o of c.offers.slice(0, 3)) {
    const per = o.unitPrice === null ? `₹${String(o.price).padStart(7)} (qty ?)` : `₹${String(o.unitPrice).padStart(7)}/u ×${o.pack}`;
    console.log(`    ${o.source.padEnd(17)} ${per}  ${o.inStock ? "in stock" : "out     "}  ${o.title.slice(0, 40)}`);
  }
  console.log();
}
