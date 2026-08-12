import { getPayload } from "payload";
import config from "@payload-config";
import type { Order } from "@/payload-types";
import { canViewOrder, ownedOrderNumbers } from "./orderAccess";

/**
 * Reading orders back out of Postgres, for the buyer.
 *
 * One module because three screens ask the same question — the receipt, the
 * account order list, and tracking — and three separate lookups is three
 * places for the access check to drift out of agreement. Everything here goes
 * through `canViewOrder`.
 *
 * `overrideAccess: true` is deliberate and safe *only* because of that gate:
 * `orders.access.read` is staff-only, so Payload's own check would lock out
 * the guest who just paid. The gate above replaces it with the narrower
 * question this module actually needs answered.
 */

/**
 * The shape the storefront renders.
 *
 * Kept deliberately close to the old localStorage `Order` type so the invoice,
 * account and tracking markup did not have to be rewritten around the swap —
 * the database is the change, not the screens. Two real differences, both
 * because the database knows things localStorage was faking:
 *
 * - `invoiceNumber` is nullable. A tax invoice number is issued when payment
 *   succeeds, never at placement, so before then there genuinely isn't one.
 * - fulfilment and payment are separate fields, matching `collections/Orders.ts`.
 *   COD ships unpaid; one combined status cannot say that.
 */
export type OrderView = {
  number: string;
  invoiceNumber: string | null;
  placedAt: string;
  status: Order["status"];
  paymentStatus: Order["paymentStatus"];
  paymentMethod: string;
  email: string | null;
  phone: string;
  gstin: string | null;
  address: Order["shipTo"];
  placeOfSupply: string;
  lines: {
    sku: string;
    title: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    hsn: string;
    rate: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
  }[];
  subtotal: number;
  shipping: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  grand: number;
};

/** Payload row → what the storefront renders. The only place that mapping lives. */
function toView(o: Order): OrderView {
  return {
    number: String(o.number),
    invoiceNumber: o.invoiceNumber ?? null,
    placedAt: o.placedAt ?? o.createdAt,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod ?? "upi",
    email: o.customerEmail ?? null,
    phone: o.customerPhone,
    gstin: o.gstin ?? null,
    address: o.shipTo,
    placeOfSupply: o.placeOfSupply,
    lines: o.lines.map((l) => ({
      sku: l.sku,
      title: l.title,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      hsn: l.hsnCode,
      rate: l.gstRate,
      taxable: l.taxable,
      cgst: l.cgst ?? 0,
      sgst: l.sgst ?? 0,
      igst: l.igst ?? 0,
    })),
    subtotal: o.subtotal,
    shipping: o.shipping,
    taxable: o.taxable,
    cgst: o.cgst ?? 0,
    sgst: o.sgst ?? 0,
    igst: o.igst ?? 0,
    grand: o.grandTotal,
  };
}

/** One order, or null if it does not exist *or* this visitor may not see it. */
export async function getOrder(number: string): Promise<OrderView | null> {
  if (!(await canViewOrder(number))) return null;

  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "orders",
    where: { number: { equals: number } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  return docs[0] ? toView(docs[0]) : null;
}

/**
 * Every order placed from this browser, newest first.
 *
 * Fetched by number rather than by customer, because guest checkout means
 * there is no signed-in identity to filter on — the signed cookie is the only
 * claim available, so it is the only one trusted.
 */
export async function myOrders(): Promise<OrderView[]> {
  const numbers = await ownedOrderNumbers();
  if (!numbers.length) return [];

  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "orders",
    where: { number: { in: numbers } },
    limit: numbers.length,
    depth: 0,
    overrideAccess: true,
  });

  // The cookie is already newest-first; the query is not, so restore its order
  // rather than sorting on a date the database may have rounded.
  const rank = new Map(numbers.map((n, i) => [n, i]));
  return docs
    .map(toView)
    .sort((a, b) => (rank.get(a.number) ?? 0) - (rank.get(b.number) ?? 0));
}
