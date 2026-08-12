"use server";

import { getPayload } from "payload";
import config from "@payload-config";
import type { Order } from "@/payload-types";
import { allow } from "@/lib/rateLimit";

/**
 * Guest order tracking: order number plus the mobile it was placed with.
 *
 * Two things are deliberate about what comes back.
 *
 * **It is a summary, not the order.** No address, no email, no line prices —
 * where the parcel is and what it cost, which is what tracking is for. Order
 * numbers are a gapless sequence, so anyone holding one person's mobile number
 * could walk the sequence looking for a hit; returning a summary means that
 * walk yields what a courier SMS already would, rather than a home address.
 * The full invoice stays behind `canViewOrder` on `/orders/[number]`.
 *
 * **The phone must match.** Not a session — this is meant to work from a
 * phone that never visited the site — but not nothing either.
 *
 * **And it is rate limited**, which is what makes the two above hold. Without
 * it the sequence walk is merely slow, and "slow" against a gapless sequence
 * is a weekend. Ten attempts a minute is far more than a person mistyping
 * their own order number and far less than a script enumerating anybody's.
 */

export type TrackResult = {
  number: string;
  placedAt: string;
  status: Order["status"];
  paymentStatus: Order["paymentStatus"];
  paymentMethod: string;
  itemCount: number;
  grand: number;
};

export async function trackOrder(
  numberInput: string,
  phoneInput: string,
): Promise<TrackResult | null> {
  const number = numberInput.trim().toUpperCase();
  const phone = phoneInput.replace(/\D/g, "").slice(-10);

  if (!number || !/^[6-9]\d{9}$/.test(phone)) return null;

  // Checked after the shape validation so malformed input does not consume a
  // caller's budget, and before the query so a blocked caller costs no
  // database work. A refusal is indistinguishable from a miss on purpose.
  if (!(await allow("track", 10, 60))) return null;

  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "orders",
    // Both conditions in the query, so a mismatch and a miss are the same
    // database answer and cannot be told apart by how long they take.
    where: { and: [{ number: { equals: number } }, { customerPhone: { equals: phone } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const o = docs[0];
  if (!o) return null;

  return {
    number: String(o.number),
    placedAt: o.placedAt ?? o.createdAt,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod ?? "upi",
    itemCount: o.lines.length,
    grand: o.grandTotal,
  };
}
