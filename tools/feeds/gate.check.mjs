import assert from "node:assert/strict";

/**
 * Run: `node tools/feeds/gate.check.mjs`
 *
 * The limiter this asserts is the difference between a polite crawl and an
 * incident. The first implementation *looked* correct and, under eight
 * concurrent workers, allowed 7.6 requests per second while advertising 2.9 —
 * so "it reads right" is not evidence here. This measures it.
 *
 * A copy of the real implementation rather than an import, because `pull.mjs`
 * starts crawling on import. If one changes, change both.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeGate(gapMs) {
  let nextSlot = 0;
  return async () => {
    const now = Date.now();
    const at = Math.max(now, nextSlot);
    nextSlot = at + gapMs;
    if (at > now) await sleep(at - now);
  };
}

const GAP = 50;
const WORKERS = 8;
const EACH = 5;

const gate = makeGate(GAP);
const stamps = [];
const start = Date.now();

await Promise.all(
  Array.from({ length: WORKERS }, async () => {
    for (let i = 0; i < EACH; i++) {
      await gate();
      stamps.push(Date.now());
    }
  }),
);

stamps.sort((a, b) => a - b);
const total = WORKERS * EACH;

/* No two requests share a slot. This is the assertion the old version failed. */
let minGap = Infinity;
for (let i = 1; i < stamps.length; i++) minGap = Math.min(minGap, stamps[i] - stamps[i - 1]);
assert.ok(
  minGap >= GAP - 15,
  `consecutive requests were ${minGap}ms apart, expected >= ${GAP}ms — the gate is bursting`,
);

/* The whole run takes about as long as the slots it reserved. */
const elapsed = Date.now() - start;
const expected = (total - 1) * GAP;
assert.ok(elapsed >= expected * 0.9, `finished in ${elapsed}ms, too fast for ${total} slots of ${GAP}ms`);

/* And the effective rate is at or under the advertised ceiling. */
const rate = (total / elapsed) * 1000;
assert.ok(rate <= 1000 / GAP + 1, `${rate.toFixed(1)} req/s exceeds the ${(1000 / GAP).toFixed(1)} req/s ceiling`);

console.log(
  `gate: ok — ${total} requests, ${WORKERS} workers, min spacing ${minGap}ms, ${rate.toFixed(1)} req/s`,
);
