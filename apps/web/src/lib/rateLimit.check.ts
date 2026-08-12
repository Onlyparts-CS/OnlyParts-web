import assert from "node:assert/strict";
import { allowFor } from "./rateLimit.ts";

/**
 * Run: `node src/lib/rateLimit.check.ts` from `apps/web`.
 *
 * `allowFor` is the whole limiter; `allow` only wraps it with the caller's IP.
 * What is worth asserting is that the window actually slides, that scopes and
 * callers do not share a budget, and that a blocked caller stays blocked
 * rather than being let straight back in.
 */

/* the limit is the limit */
assert.equal(allowFor("1.1.1.1", "t1", 3, 60), true);
assert.equal(allowFor("1.1.1.1", "t1", 3, 60), true);
assert.equal(allowFor("1.1.1.1", "t1", 3, 60), true);
assert.equal(allowFor("1.1.1.1", "t1", 3, 60), false, "fourth call in the window must be refused");

/* a different caller has their own budget */
assert.equal(allowFor("2.2.2.2", "t1", 3, 60), true, "one caller must not exhaust another's budget");

/* a different scope has its own budget — search must not lock out sign-in */
assert.equal(allowFor("1.1.1.1", "t2", 3, 60), true);

/* the window slides: a one-second window frees up after a second */
assert.equal(allowFor("3.3.3.3", "t3", 1, 1), true);
assert.equal(allowFor("3.3.3.3", "t3", 1, 1), false);
await new Promise((r) => setTimeout(r, 1100));
assert.equal(allowFor("3.3.3.3", "t3", 1, 1), true, "window must slide, not latch forever");

/*
  A refused attempt is still recorded.

  Otherwise a caller sitting exactly on the limit gets one free request every
  time the oldest hit ages out, which turns a "10 per minute" cap into a steady
  10 per minute forever — the opposite of backing off.
*/
assert.equal(allowFor("4.4.4.4", "t4", 1, 2), true);
assert.equal(allowFor("4.4.4.4", "t4", 1, 2), false);
assert.equal(allowFor("4.4.4.4", "t4", 1, 2), false, "refusals must extend the window");

/* zero budget refuses everything, rather than allowing one through */
assert.equal(allowFor("5.5.5.5", "t5", 0, 60), false);

console.log("rateLimit: ok");
