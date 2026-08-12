import { placeOrder } from "../src/lib/orders";
import { pack } from "../src/lib/signedList";

/**
 * The receipt page's access gate, end to end against a running dev server.
 *
 *   npm run payload -- run scripts/smoke-order-access.ts
 *
 * Places a real order, then fetches `/orders/<number>` three ways: with no
 * cookie, with a forged one, and with the signed one checkout would have set.
 * The first two must be refused and the third must render the invoice —
 * otherwise a gapless order sequence is a way to read every buyer's address.
 *
 * Needs `next dev` on :3000 and `node infra/db.mjs start`.
 */

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const SKU = process.env.SMOKE_SKU ?? "BR-6000-ZZ-CS";

let pass = 0;
let fail = 0;
const ok = (w: string) => { pass++; console.log(`  ✓ ${w}`); };
const bad = (w: string, d?: string) => { fail++; console.log(`  ✗ ${w}${d ? ` — ${d}` : ""}`); };

const secret = process.env.PAYLOAD_SECRET ?? "";
if (!secret) { console.error("PAYLOAD_SECRET is not set"); process.exit(1); }

/** Did the response render the invoice, or the refusal page? */
async function fetchReceipt(number: string, cookie?: string) {
  const res = await fetch(`${BASE}/orders/${encodeURIComponent(number)}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const html = await res.text();
  return {
    status: res.status,
    shown: html.includes("Place of supply") || html.includes("Billed to"),
    refused: html.includes("Order not found"),
  };
}

console.log(`\norder access smoke — ${BASE}\n`);

try {
  const placed = await placeOrder({
    cart: [{ sku: SKU, qty: 2 }],
    contact: { name: "Access Smoke", phone: "9876500011", email: "smoke@example.com" },
    shipTo: {
      name: "Access Smoke", phone: "9876500011",
      line1: "1 Gate Road", city: "Bengaluru", stateCode: "29", pincode: "560001",
    },
    paymentMethod: "upi",
  });

  if (!placed.ok) {
    bad("an order can be placed", JSON.stringify(placed.errors));
    throw new Error("stop");
  }
  ok(`an order can be placed (${placed.number})`);

  const n = placed.number;

  /* ---------- 1. a stranger ---------- */
  const anon = await fetchReceipt(n);
  anon.refused && !anon.shown
    ? ok("no cookie → the receipt is refused")
    : bad("no cookie → the receipt is refused", `status ${anon.status}, shown=${anon.shown}`);

  /* ---------- 2. a stranger who guessed ---------- */
  const forged = await fetchReceipt(n, `op_orders=${n}.not-a-real-signature`);
  forged.refused && !forged.shown
    ? ok("forged cookie → the receipt is refused")
    : bad("forged cookie → the receipt is refused", `status ${forged.status}, shown=${forged.shown}`);

  /* ---------- 3. someone else's validly-signed cookie ---------- */
  const otherSigned = await fetchReceipt(n, `op_orders=${pack(["OP-9999-000001"], secret)}`);
  otherSigned.refused && !otherSigned.shown
    ? ok("a validly signed cookie for a different order → refused")
    : bad("a validly signed cookie for a different order → refused", `shown=${otherSigned.shown}`);

  /* ---------- 4. the buyer ---------- */
  const mine = await fetchReceipt(n, `op_orders=${pack([n], secret)}`);
  mine.shown && !mine.refused
    ? ok("the buyer's signed cookie → the invoice renders")
    : bad("the buyer's signed cookie → the invoice renders", `status ${mine.status}, refused=${mine.refused}`);
} catch (e) {
  if ((e as Error).message !== "stop") { console.error("\nunexpected:", e); fail++; }
} finally {
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}
