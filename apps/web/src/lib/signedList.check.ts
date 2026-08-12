import assert from "node:assert/strict";
import { pack, unpack } from "./signedList.ts";

/**
 * Run: `node src/lib/signedList.check.ts` from `apps/web`.
 *
 * This guards the one thing standing between a gapless order sequence and
 * every buyer's address, so it is worth the twenty lines.
 */

const S = "test-secret";
const OTHER = "different-secret";

/* round trip */
assert.deepEqual(unpack(pack(["OP-2627-000001"], S), S), ["OP-2627-000001"]);
assert.deepEqual(unpack(pack(["a", "b", "c"], S), S), ["a", "b", "c"]);

/* nothing in, nothing out */
assert.deepEqual(unpack(undefined, S), []);
assert.deepEqual(unpack("", S), []);
assert.deepEqual(unpack(pack([], S), S), []);

/* the point: an edited value does not verify */
assert.deepEqual(unpack("OP-2627-000002.whatever", S), []);
assert.deepEqual(unpack("OP-2627-000001,OP-2627-000002.", S), []);

/* appending to a legitimately signed list is rejected, not accepted in part */
const mine = pack(["OP-2627-000001"], S);
const cut = mine.lastIndexOf(".");
const forged = `${mine.slice(0, cut)},OP-2627-000999${mine.slice(cut)}`;
assert.deepEqual(unpack(forged, S), []);

/* a MAC from a different secret is worthless */
assert.deepEqual(unpack(pack(["OP-2627-000001"], OTHER), S), []);

/* no separator at all */
assert.deepEqual(unpack("OP-2627-000001", S), []);

/* an empty secret must refuse rather than sign */
assert.throws(() => pack(["x"], ""));
assert.deepEqual(unpack(pack(["x"], S), ""), []);

console.log("signedList: ok");
