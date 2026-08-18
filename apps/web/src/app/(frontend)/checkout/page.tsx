import type { Metadata } from "next";
import { CheckoutClient } from "./CheckoutClient";

/**
 * A server shell over the client checkout.
 *
 * Same reason as `/cart` — a client component cannot carry route segment
 * config, and without `dynamic` there is no request at render time and so no
 * nonce for Next to inject. It matters more here than anywhere: this page
 * takes a name, an address, a GSTIN and a payment method, and it was being
 * served as a cached static shell.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
