"use server";

import { placeOrder, type PlaceOrderInput, type PlaceOrderResult } from "@/lib/orders";
import { grantOrderAccess } from "@/lib/orderAccess";

/**
 * The checkout button's one call into the server.
 *
 * Deliberately thin: every rule — validation, pricing, price breaks, GST,
 * stock, the transaction — lives in `lib/orders.ts` and stays there. This
 * exists only because a `"use server"` module may export nothing but async
 * functions, so `lib/orders.ts` (which also exports its types) cannot itself be
 * the boundary.
 *
 * Unauthenticated on purpose — guest checkout is the common case. That is safe
 * because the browser sends SKUs and quantities and nothing else: prices,
 * tax and totals are all re-derived server-side against the catalogue, so a
 * tampered payload buys the same parts at the same price.
 */
export async function submitOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const result = await placeOrder(input);

  // Only a successful write can vouch for the buyer, so the receipt cookie is
  // granted here and never on the way in.
  if (result.ok) await grantOrderAccess(result.number);

  return result;
}
