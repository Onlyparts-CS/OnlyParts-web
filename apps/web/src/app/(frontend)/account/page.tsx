import type { Metadata } from "next";
import { myOrders } from "@/lib/orderRead";
import { currentCustomer } from "@/lib/customerAuth";
import { AccountClient, type SessionUser } from "./AccountClient";

/**
 * The account screen.
 *
 * A server component so both halves are read before anything renders: the
 * order list from Postgres, and — since Google sign-in landed — who is
 * actually signed in. That second part used to come from a localStorage key
 * the browser wrote itself, which meant this page believed whatever the
 * browser told it about its own identity.
 */

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const [orders, customer] = await Promise.all([myOrders(), currentCustomer()]);

  const session: SessionUser | null = customer
    ? {
        name: customer.name,
        email: customer.email ?? null,
        phone: customer.phone ?? null,
        gstin: customer.gstin ?? null,
        company: customer.company ?? null,
      }
    : null;

  return <AccountClient orders={orders} session={session} />;
}
