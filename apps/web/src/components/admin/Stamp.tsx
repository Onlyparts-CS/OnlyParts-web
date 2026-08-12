import type { Order } from "@/payload-types";

/**
 * Order state, as a stamp rather than a pill.
 *
 * `.stamp` already carries every binary state on the storefront — in stock,
 * paid, made to order — and `globals.css` says in as many words that it exists
 * so a status never needs a coloured pill. `.stamp-flat` drops its 1.4° tilt,
 * which is charming once and crooked forty times down a column.
 *
 * Colour is spent only where it buys something. `pending` fulfilment is what
 * every order is a second after checkout, so it says nothing and is set in
 * plain ink; `pending` *payment* means the money has not arrived, which is the
 * one thing on this screen somebody has to act on. Colouring all thirteen
 * states would mean colouring none of them.
 */

const FULFILMENT: Record<Order["status"], string> = {
  pending: "text-ink-500",
  confirmed: "text-heading",
  packed: "text-heading",
  shipped: "text-info",
  delivered: "text-success",
  cancelled: "text-danger",
  returned: "text-warning",
};

const PAYMENT: Record<Order["paymentStatus"], string> = {
  pending: "text-warning",
  authorized: "text-info",
  paid: "text-success",
  failed: "text-danger",
  refunded: "text-ink-500",
  partially_refunded: "text-warning",
};

/* `.stamp` borders in `currentColor`, so one class sets edge and text together. */
export function StatusStamp({ value }: { value: Order["status"] }) {
  return <span className={`stamp stamp-flat ${FULFILMENT[value]}`}>{value}</span>;
}

export function PaymentStamp({ value }: { value: Order["paymentStatus"] }) {
  return (
    <span className={`stamp stamp-flat ${PAYMENT[value]}`}>{value.replace(/_/g, " ")}</span>
  );
}
