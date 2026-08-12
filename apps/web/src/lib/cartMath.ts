import { tierFor, hsnFor } from "./product";
import { taxOnInclusive, type InvoiceLine } from "./gst";
import type { Sku } from "./skus";

/**
 * Turns a resolved cart into priced, taxed invoice lines.
 *
 * Shared by the cart, the checkout and the invoice so all three agree — a cart
 * that quotes one number and an invoice that prints another is the single most
 * damaging bug in commerce. Prices are re-resolved from the price-break table
 * on every call, never stored on the line, so a cart left open for a week can't
 * transact at a stale price (docs/07-DATA-MODEL.md §4).
 */
export function toInvoiceLines(
  items: { sku: Sku; qty: number }[],
  placeOfSupply: string,
): InvoiceLine[] {
  return items.map(({ sku, qty }) => {
    const tier = tierFor(sku, qty);
    const lineTotal = tier.price * qty;
    const hsn = hsnFor(sku);
    return {
      sku: sku.sku,
      title: sku.title,
      hsn: hsn.code,
      rate: hsn.rate,
      qty,
      unitPrice: tier.price,
      lineTotal,
      tax: taxOnInclusive(lineTotal, hsn.rate, placeOfSupply),
    };
  });
}

/** Per-line savings against the qty-1 price — the no-MOQ + bulk story. */
export function savingsFor(sku: Sku, qty: number) {
  const tier = tierFor(sku, qty);
  const listTotal = sku.price * qty;
  const actual = tier.price * qty;
  return { tier, listTotal, actual, saved: listTotal - actual };
}

/** "Add 40 more → ₹2.22/pc" — the live reason to size up. */
export function nextTierHint(sku: Sku, qty: number) {
  const next = sku.breaks.find((b) => b.qty > qty);
  if (!next) return null;
  return { addQty: next.qty - qty, unitPrice: next.price, atQty: next.qty };
}
