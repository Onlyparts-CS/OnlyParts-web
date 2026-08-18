import assert from "node:assert/strict";
import { normalisePath } from "./viewLog.ts";

/**
 * Run: `npx tsx src/lib/viewLog.check.ts` from `apps/web`. (The sibling
 * `.check.ts` files say `node`, which needs a Node built with TypeScript
 * support; the one on this machine is not, and `tsx` is already a dependency.)
 *
 * `logPageView` is a Payload upsert and not worth a harness. `normalisePath` is
 * the half that decides what a stranger can put in the table, and it is the
 * only thing standing between an open endpoint and a row per request forever.
 */

/* the static routes the site actually serves */
for (const p of ["/", "/about", "/faq", "/search", "/cart", "/checkout", "/track", "/make", "/make/rfq"]) {
  assert.equal(normalisePath(p), p, `${p} is a real route`);
}

/* the dynamic ones */
assert.equal(normalisePath("/p/os-phm216"), "/p/os-phm216");
assert.equal(normalisePath("/b/wurth"), "/b/wurth");
assert.equal(normalisePath("/policies/privacy"), "/policies/privacy");
assert.equal(normalisePath("/guides/thread-pitch"), "/guides/thread-pitch");
assert.equal(normalisePath("/c"), "/c", "the catalogue root is a real page");
assert.equal(normalisePath("/c/fasteners/screws/machine-screws"), "/c/fasteners/screws/machine-screws");

/* the query string carries the search term and the fragment carries an anchor —
   neither is the page, and the search term is the one thing on the site that
   *is* a person's own words */
assert.equal(normalisePath("/search?q=m3+x+10"), "/search");
assert.equal(normalisePath("/p/os-phm216#specs"), "/p/os-phm216");
assert.equal(normalisePath("/about/"), "/about", "a trailing slash is the same page");

/* an order number names one customer's document; the collection exists not to
   hold that kind of trace */
assert.equal(normalisePath("/orders/OP-10023"), null, "order pages must never be recorded");
assert.equal(normalisePath("/rfqs/RFQ-4410"), null, "rfq pages must never be recorded");

/* anything else is dropped rather than stored as a row somebody chose */
for (const p of ["/aaa-not-a-route", "/etc/passwd", "/p/", "/p/../admin", "/c/a/b/c/d/e", "/P/OS-PHM216"]) {
  assert.equal(normalisePath(p), null, `${p} must not create a row`);
}

console.log("viewLog: ok");
