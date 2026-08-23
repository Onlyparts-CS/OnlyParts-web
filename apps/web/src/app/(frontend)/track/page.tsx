import type { Metadata } from "next";
import { TrackClient } from "./TrackClient";

/**
 * A server shell over the client tracking form.
 *
 * Same reason as `/cart` and `/checkout`. The form here takes an order number
 * and a phone number and hands them to a server action that answers about a
 * specific customer's order, which is enough to want the strict policy over it.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Track your order",
  robots: { index: false, follow: false },
};

export default function TrackPage() {
  return <TrackClient />;
}
