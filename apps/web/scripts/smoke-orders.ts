import { getPayload } from "payload";
import config from "@payload-config";
import { placeOrder } from "../src/lib/orders";
import { SELLER_STATE } from "../src/lib/gst";

/**
 * Exercises the order invariants.
 *
 *   npm run payload -- run scripts/smoke-orders.ts
 *
 * The things worth proving here are the ones that cost money when they are
 * wrong: that the server prices the order rather than believing the browser,
 * that a price break applies at the right quantity, that intra-state splits
 * CGST+SGST and inter-state does not, that two buyers cannot be sold the same
 * last unit, that a paid invoice cannot be edited, and that an order cannot
 * jump from delivered back to pending.
 *
 * Builds its own catalogue island, prices it in round numbers so the arithmetic
 * is checkable by eye, and deletes everything on the way out.
 */
const payload = await getPayload({ config });
const req = { overrideAccess: true } as const;

let pass = 0;
let fail = 0;
const ok = (w: string) => { pass++; console.log(`  ✓ ${w}`); };
const bad = (w: string, d?: string) => { fail++; console.log(`  ✗ ${w}${d ? ` — ${d}` : ""}`); };
const eq = (w: string, actual: unknown, expected: unknown) =>
  actual === expected ? ok(w) : bad(w, `got ${actual}, expected ${expected}`);

async function refuses(what: string, expect: RegExp, fn: () => Promise<unknown>) {
  try {
    await fn();
    bad(what, "it was allowed");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (expect.test(msg)) ok(what);
    else bad(what, `refused, but for the wrong reason: ${msg.slice(0, 120)}`);
  }
}

const tag = `ord${Date.now().toString(36)}`;
const made: { collection: string; id: string | number }[] = [];

/**
 * `payload.create` is overloaded per collection, so a generic wrapper collapses
 * the union to something with no common index signature. Through `unknown`
 * deliberately — the alternative is a per-collection helper six times over.
 */
async function make(collection: string, data: Record<string, unknown>) {
  const doc = (await payload.create({ collection, data, ...req } as never)) as unknown as {
    id: string | number;
    [k: string]: unknown;
  };
  made.push({ collection, id: doc.id });
  return doc;
}

/** Sweeps this run and any earlier run that died before its cleanup. */
async function purge() {
  for (const collection of ["orders", "customers", "inventory-movements", "inventory", "variants", "products", "categories", "warehouses"] as const) {
    const field = collection === "customers" ? "name" : collection === "orders" ? "customerName" : collection === "variants" ? "sku" : "name";
    try {
      const rows = await payload.find({
        collection, where: { [field]: { like: "ord" } }, limit: 500, depth: 0, ...req,
      } as never);
      for (const row of (rows as { docs: { id: string | number }[] }).docs) {
        try { await payload.delete({ collection, id: row.id, ...req } as never); } catch { /* fk order */ }
      }
    } catch { /* collection may have no such field */ }
  }
}

/* ------------------------------------------------------------------ */

try {
  console.log(`\norders smoke — tag ${tag}\n`);

  /* ---------- an island to sell from ---------- */
  const wh = await make("warehouses", {
    code: `${tag}-WH`, name: `${tag} warehouse`,
    stateCode: SELLER_STATE, pincode: "560001", isActive: true,
  });
  const cat = await make("categories", { name: `${tag}-cat`, slug: `${tag}-cat` });
  const product = await make("products", {
    title: `${tag} widget`, slug: `${tag}-widget`,
    primaryCategory: cat.id, hsnCode: "73181500", gstRate: "18", status: "active",
  });

  // ₹100.00 each, ₹90.00 from 10 up. Round numbers on purpose.
  const variant = await make("variants", {
    product: product.id, sku: `${tag}-A`.toUpperCase(),
    basePrice: 10000, weightG: 10, isActive: true,
    priceTiers: [{ minQty: 10, unitPrice: 9000 }],
  });

  await make("inventory-movements", {
    variant: variant.id, warehouse: wh.id, delta: 50, reason: "purchase",
  });

  const address = {
    name: `${tag} buyer`, phone: "9876543210",
    line1: "1 Test Road", city: "Bengaluru", stateCode: SELLER_STATE, pincode: "560001",
  };
  const contact = { name: `${tag} buyer`, phone: "9876543210", email: "t@example.com" };

  /* ---------- 1. the server prices it ---------- */
  console.log("pricing");
  const r1 = await placeOrder({
    cart: [{ sku: `${tag}-A`.toUpperCase(), qty: 2 }],
    contact, shipTo: address, paymentMethod: "upi",
  });

  if (!r1.ok) { bad("a valid order is accepted", JSON.stringify(r1.errors)); throw new Error("stop"); }
  ok("a valid order is accepted");

  const o1 = await payload.findByID({ collection: "orders", id: r1.id, depth: 0, ...req });
  eq("2 × ₹100 subtotal is 20000 paise", o1.subtotal, 20000);
  // under ₹999 so shipping applies: 20000 + 7900
  eq("shipping is added under the free threshold", o1.shipping, 7900);
  eq("grand total is subtotal + shipping", o1.grandTotal, 27900);
  eq("order number is this financial year's series", /^OP-\d{4}-\d{6}$/.test(String(o1.number)), true);

  /* ---------- 2. GST splits by place of supply ---------- */
  console.log("\ngst");
  // 27900 inclusive at 18% → taxable 23644, tax 4256
  eq("intra-state charges CGST", (o1.cgst ?? 0) > 0, true);
  eq("intra-state charges SGST", (o1.sgst ?? 0) > 0, true);
  eq("intra-state charges no IGST", o1.igst, 0);
  eq("CGST + SGST equal the total tax", (o1.cgst ?? 0) + (o1.sgst ?? 0), o1.grandTotal - (o1.taxable ?? 0));

  const r2 = await placeOrder({
    cart: [{ sku: `${tag}-A`.toUpperCase(), qty: 2 }],
    contact, shipTo: { ...address, stateCode: "27", pincode: "400001", city: "Mumbai" },
    paymentMethod: "upi",
  });
  if (!r2.ok) { bad("an inter-state order is accepted", JSON.stringify(r2.errors)); throw new Error("stop"); }
  const o2 = await payload.findByID({ collection: "orders", id: r2.id, depth: 0, ...req });
  eq("inter-state charges IGST", (o2.igst ?? 0) > 0, true);
  eq("inter-state charges no CGST", o2.cgst, 0);
  eq("inter-state charges no SGST", o2.sgst, 0);

  /* ---------- 3. price breaks ---------- */
  console.log("\nprice breaks");
  const r3 = await placeOrder({
    cart: [{ sku: `${tag}-A`.toUpperCase(), qty: 10 }],
    contact, shipTo: address, paymentMethod: "upi",
  });
  if (!r3.ok) { bad("a bulk order is accepted", JSON.stringify(r3.errors)); throw new Error("stop"); }
  const o3 = await payload.findByID({ collection: "orders", id: r3.id, depth: 0, ...req });
  eq("the ₹90 break applies at qty 10", (o3.lines as { unitPrice: number }[])[0].unitPrice, 9000);
  eq("10 × ₹90 subtotal is 90000 paise", o3.subtotal, 90000);
  // ₹900 is *under* the ₹999 free-shipping threshold — the break makes the
  // order cheaper and therefore chargeable. Worth asserting precisely because
  // it is the counter-intuitive direction.
  eq("a bulk order still under ₹999 pays shipping", o3.shipping, 7900);

  const r3b = await placeOrder({
    cart: [{ sku: `${tag}-A`.toUpperCase(), qty: 12 }],
    contact, shipTo: address, paymentMethod: "upi",
  });
  if (!r3b.ok) { bad("a ₹1,080 order is accepted", JSON.stringify(r3b.errors)); throw new Error("stop"); }
  const o3b = await payload.findByID({ collection: "orders", id: r3b.id, depth: 0, ...req });
  eq("12 × ₹90 crosses the threshold", o3b.subtotal, 108000);
  eq("and ships free", o3b.shipping, 0);

  /* ---------- 4. lines are snapshots ---------- */
  console.log("\nsnapshots");
  await payload.update({
    collection: "variants", id: variant.id, data: { basePrice: 50000 }, ...req,
  });
  const o1again = await payload.findByID({ collection: "orders", id: r1.id, depth: 0, ...req });
  eq("repricing the variant does not move a placed order", o1again.subtotal, 20000);
  eq("the line keeps the price it was sold at", (o1again.lines as { unitPrice: number }[])[0].unitPrice, 10000);
  await payload.update({ collection: "variants", id: variant.id, data: { basePrice: 10000 }, ...req });

  /* ---------- 5. stock is allocated, not consumed ---------- */
  console.log("\nstock");
  const level = (await payload.find({
    collection: "inventory", where: { variant: { equals: variant.id } }, limit: 1, depth: 0, ...req,
  })).docs[0];
  eq("on-hand is untouched by placing an order", level.onHand, 50);
  eq("allocated holds 2 + 2 + 10 + 12", level.allocated, 26);

  const r4 = await placeOrder({
    cart: [{ sku: `${tag}-A`.toUpperCase(), qty: 40 }],
    contact, shipTo: address, paymentMethod: "upi",
  });
  eq("an order beyond available-to-sell is refused", r4.ok, false);
  if (!r4.ok) {
    // 50 on hand − 26 allocated = 24 sellable, not 50. This is the assertion
    // that would fail if availability were read off `onHand` alone.
    eq("and says how many are actually left", /Only 24/.test(r4.errors.cart ?? ""), true);
  }

  /* ---------- 6. the state machine ---------- */
  console.log("\nstate machine");
  await refuses("pending cannot jump to shipped", /can only become/, () =>
    payload.update({ collection: "orders", id: r1.id, data: { status: "shipped" }, ...req }));

  await payload.update({ collection: "orders", id: r1.id, data: { status: "confirmed" }, ...req });
  ok("pending → confirmed is allowed");
  await payload.update({ collection: "orders", id: r1.id, data: { status: "packed" }, ...req });
  await payload.update({ collection: "orders", id: r1.id, data: { status: "shipped" }, ...req });
  await payload.update({ collection: "orders", id: r1.id, data: { status: "delivered" }, ...req });
  ok("confirmed → packed → shipped → delivered walks through");

  await refuses("delivered cannot go back to pending", /can only become/, () =>
    payload.update({ collection: "orders", id: r1.id, data: { status: "pending" }, ...req }));

  await payload.update({ collection: "orders", id: r2.id, data: { status: "cancelled" }, ...req });
  await refuses("cancelled is final", /is final/, () =>
    payload.update({ collection: "orders", id: r2.id, data: { status: "confirmed" }, ...req }));

  /* ---------- 7. a paid invoice is frozen ---------- */
  console.log("\ninvoice");
  await payload.update({ collection: "orders", id: r3.id, data: { paymentStatus: "paid" }, ...req });
  await refuses("a paid invoice cannot have its total edited", /cannot change/, () =>
    payload.update({ collection: "orders", id: r3.id, data: { grandTotal: 1 }, ...req }));
  await refuses("a paid invoice cannot have its lines edited", /cannot change/, () =>
    payload.update({
      collection: "orders", id: r3.id,
      data: { lines: [{ sku: "X", title: "X", qty: 1, unitPrice: 1, lineTotal: 1, hsnCode: "1", gstRate: 18, taxable: 1 }] },
      ...req,
    }));
  await payload.update({ collection: "orders", id: r3.id, data: { staffNotes: "still editable" }, ...req });
  ok("but staff notes on a paid order still save");

  /* ---------- 8. orders are never deleted ---------- */
  await refuses("orders cannot be deleted, even by an administrator", /not allowed|forbidden|Unauthorized/i, () =>
    payload.delete({
      collection: "orders", id: r3.id,
      overrideAccess: false,
      user: { id: 0, email: "root@onlyparts.local", collection: "users", roles: ["admin"] } as never,
    }));

  /* ---------- 9. the customer is joined, not duplicated ---------- */
  console.log("\ncustomer");
  const customers = await payload.find({
    collection: "customers", where: { phone: { equals: "9876543210" } }, limit: 10, depth: 0, ...req,
  });
  eq("repeat orders from one phone make one customer", customers.totalDocs, 1);
  // Four placed, one refused for stock — a refused order must not be counted.
  eq("order count counts placed orders only", customers.docs[0].orderCount, 4);

  /* ---------- 10. rubbish in ---------- */
  console.log("\nvalidation");
  const bad1 = await placeOrder({
    cart: [{ sku: "NOPE-DOES-NOT-EXIST", qty: 1 }], contact, shipTo: address, paymentMethod: "upi",
  });
  eq("an unknown SKU is refused", bad1.ok, false);

  const bad2 = await placeOrder({
    cart: [{ sku: `${tag}-A`.toUpperCase(), qty: 1 }],
    contact: { ...contact, phone: "12345" }, shipTo: address, paymentMethod: "upi",
  });
  eq("a bad phone number is refused", bad2.ok, false);

  const bad3 = await placeOrder({
    cart: [{ sku: `${tag}-A`.toUpperCase(), qty: 1 }],
    contact: { ...contact, gstin: "NOTAGSTIN" }, shipTo: address, paymentMethod: "upi",
  });
  eq("an invalid GSTIN is refused", bad3.ok, false);

  const bad4 = await placeOrder({
    cart: [], contact, shipTo: address, paymentMethod: "upi",
  });
  eq("an empty cart is refused", bad4.ok, false);
} catch (e) {
  if ((e as Error).message !== "stop") {
    console.error("\nunexpected:", e);
    fail++;
  }
} finally {
  await purge();
  for (const m of [...made].reverse()) {
    try { await payload.delete({ collection: m.collection, id: m.id, ...req } as never); } catch { /* already gone */ }
  }
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}
