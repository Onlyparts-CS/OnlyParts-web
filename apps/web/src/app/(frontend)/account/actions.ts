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
 * **Deletion is deliberately not here.** Two reasons, and neither is effort:
 * a tax invoice must be retained for six years under GST, so orders can be
 * anonymised but never deleted; and sign-in is still a prototype that accepts
 * any six digits, so there is no identity to authorise an erasure against.
 * Implementing it now would mean building a destructive operation on top of an
 * authentication check that does not exist.
 */
export async function exportMyOrders(): Promise<{ orders: unknown[]; generatedAt: string }> {
  const orders = await myOrders();
  return { orders, generatedAt: new Date().toISOString() };
}
