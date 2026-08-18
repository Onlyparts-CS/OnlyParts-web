import type { Metadata } from "next";
import { CartClient } from "./CartClient";

/**
 * A server shell over a client cart.
 *
 * It reads nothing and renders nothing of its own. Its whole job is to be a
 * server component, because route segment config is not allowed in a client
 * one and `dynamic` is what this page needs: see `proxy.ts`. A statically
 * generated page was built when no request existed, so Next has no nonce to
 * inject into it — measured, `/cart` rendered 25 script tags and nonced none
 * of them, which is why the strict policy could not be extended here.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartClient />;
}
