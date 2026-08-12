import Link from "next/link";
import { DeadEnd } from "@/components/DeadEnd";
import type { Metadata } from "next";
import { getOrder } from "@/lib/orderRead";
import { InvoiceSheet } from "./InvoiceSheet";

/**
 * The receipt, now read from Postgres.
 *
 * A server component because the order is no longer in the browser that placed
 * it — and because the access check has to happen somewhere the visitor cannot
 * edit. `getOrder` returns null both for an order that does not exist and for
 * one that is not this visitor's, deliberately: telling the two apart would
 * turn a gapless order sequence into a way to count the shop's sales.
 */

export const metadata: Metadata = {
  title: "Your order",
  // A receipt carries a name, an address and a phone number.
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const order = await getOrder(decodeURIComponent(number));

  if (!order) {
    return (
      <DeadEnd
        label="Not in this file"
        title="No such order"
        plate="gear"
        caption={decodeURIComponent(number)}
        actions={
          <>
            <Link href="/track" className="btn btn-primary">Track with your mobile</Link>
            <Link href="/contact" className="btn btn-secondary">Contact support</Link>
          </>
        }
      >
        {/*
          Two causes, one screen, and the difference matters to the reader:
          "does not exist" is a typo and "not placed from this browser" is the
          far commoner case of a different device. Naming both stops it reading
          as an accusation that the order was imagined.
        */}
        <p>
          Either that number does not exist, or the order was placed from a different
          browser. Orders are tied to the device that placed them unless you sign in,
          which is why tracking asks for the mobile number instead.
        </p>
      </DeadEnd>
    );
  }

  return <InvoiceSheet order={order} />;
}
