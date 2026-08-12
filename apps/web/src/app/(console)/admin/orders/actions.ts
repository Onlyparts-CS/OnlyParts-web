"use server";

import { revalidatePath } from "next/cache";
import { actionStaff } from "@/lib/actionAuth";
import { ORDER_TRANSITIONS, type OrderStatus, type PaymentStatus } from "@/collections/Orders";

/**
 * Moving an order along.
 *
 * The ops console was read-only, which meant the daily job — pack it, ship it,
 * mark the cash-on-delivery paid — happened in the CMS panel on a different
 * screen from the one showing what needed doing.
 *
 * These write through Payload with `overrideAccess: false`, so the status
 * machine and the frozen-invoice rule in `collections/Orders.ts` still decide
 * what is legal. Nothing about the rules is re-implemented here; the transition
 * check below is only so the *buttons* are honest, and the collection remains
 * the thing that actually refuses.
 */

const session = () => actionStaff("admin", "ops");

export type OrderActionResult = { ok: true } | { ok: false; error: string };

/** Every state change appends to the timeline. That array is the audit trail. */
async function withEvent(
  payload: Awaited<ReturnType<typeof actionStaff>>["payload"],
  user: NonNullable<Awaited<ReturnType<typeof actionStaff>>["user"]>,
  number: string,
  patch: Record<string, unknown>,
  event: { kind: string; detail: string },
): Promise<OrderActionResult> {
  const { docs } = await payload.find({
    collection: "orders",
    where: { number: { equals: number } },
    limit: 1, depth: 0, user, overrideAccess: false,
  });
  const order = docs[0];
  if (!order) return { ok: false, error: "That order no longer exists." };

  try {
    await payload.update({
      collection: "orders",
      id: order.id,
      user,
      overrideAccess: false,
      data: {
        ...patch,
        events: [
          ...(order.events ?? []),
          { at: new Date().toISOString(), kind: event.kind, actor: user.email, detail: event.detail },
        ],
      } as never,
    });
    revalidatePath(`/admin/orders/${number}`);
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (e) {
    // The collection writes its refusals for a human — "Delivered is final,
    // this order cannot be moved to Packed" — so pass them straight through.
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ------------------------------------------------------------------ */

export async function advanceOrder(
  number: string,
  to: OrderStatus,
  note: string,
): Promise<OrderActionResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  return withEvent(payload, user, number, { status: to }, {
    kind: "status",
    detail: note.trim() ? `Moved to ${to} — ${note.trim()}` : `Moved to ${to}`,
  });
}

/**
 * Marking payment.
 *
 * Kept for the cases a gateway cannot cover: cash on delivery collected at the
 * door, a bank transfer that arrived, a refund raised by hand. Once the
 * Razorpay webhook lands it will call the same collection and the invoice
 * number will be issued by the same hook.
 */
export async function markPayment(
  number: string,
  to: PaymentStatus,
  note: string,
): Promise<OrderActionResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  return withEvent(payload, user, number, { paymentStatus: to }, {
    kind: "payment",
    detail: note.trim() ? `Payment ${to} — ${note.trim()}` : `Payment marked ${to}`,
  });
}

/** A note on the record, with a name and a time against it. */
export async function addOrderNote(number: string, text: string): Promise<OrderActionResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };
  if (!text.trim()) return { ok: false, error: "Nothing to add." };

  return withEvent(payload, user, number, {}, { kind: "note", detail: text.trim() });
}

/** Where this order may legally go, for the buttons. The collection re-checks. */
export async function nextStates(from: OrderStatus): Promise<readonly OrderStatus[]> {
  return ORDER_TRANSITIONS[from] ?? [];
}
