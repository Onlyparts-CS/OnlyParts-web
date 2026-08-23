"use server";

import { myOrders } from "@/lib/orderRead";

/**
 * The server's half of a DPDP data export.
 *
 * The account screen has claimed since it was built that "under the DPDP Act
 * you can export or delete everything we hold. Both are obligations, not
 * features" — above two buttons that did nothing. A dead button under a
 * statement of legal obligation is worse than no button.
 *
 * This returns the half that lives on the server: the orders this browser can
 * prove it placed. The client adds what it holds locally (addresses, wishlist,
 * cart, reviews) and offers the merged file. `myOrders` gates on the signed
 * cookie, so an export can only ever contain orders the caller already has the
 * right to read.
 *
 * **Deletion is deliberately not here.** A tax invoice must be retained for
 * 8 years, so orders can be anonymised but never deleted — an
 * erasure here is always partial, and which fields survive is a legal call
 * rather than a button. Identity is no longer the blocker: `customerSession`
 * plus the Google flow give a verified `sub` to authorise against, so when
 * this is built it can be built properly.
 */
export async function exportMyOrders(): Promise<{ orders: unknown[]; generatedAt: string }> {
  const orders = await myOrders();
  return { orders, generatedAt: new Date().toISOString() };
}
