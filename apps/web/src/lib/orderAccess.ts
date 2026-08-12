import { cookies } from "next/headers";
import { pack, unpack } from "./signedList";
import { actionStaff } from "./actionAuth";

/**
 * Who is allowed to look at an order.
 *
 * Orders moved from localStorage to Postgres, and that swap opens a hole the
 * old design did not have: order numbers are a **gapless sequence**
 * (`OP-2627-000001`, `-000002`, …) because GST filing requires it. Anything
 * that renders an order from its number alone therefore hands out every
 * buyer's name, phone number and delivery address to whoever can count.
 *
 * `orders.access.read` is staff-only, which is correct and also not enough:
 * guest checkout has no session to check, so the buyer who just paid would be
 * locked out of their own receipt.
 *
 * So the browser carries a note saying which orders it placed, and the note is
 * signed. The cookie is httpOnly — but httpOnly only stops scripts reading it,
 * not the owner editing it in devtools, so the signature is what actually does
 * the work: an unsigned or edited value verifies to nothing and grants nothing.
 *
 * Not a session and not identity. It answers exactly one question — "did this
 * browser place this order" — which is all the receipt page needs to know.
 */

const COOKIE = "op_orders";

/** Newest first, and bounded: a cookie is not an order history. */
const KEEP = 20;

const YEAR = 60 * 60 * 24 * 365;

/** Fails closed: an unconfigured deployment signs nothing and trusts nothing. */
const secret = () => process.env.PAYLOAD_SECRET ?? "";

/**
 * Record that this browser placed this order.
 *
 * Called from the checkout action immediately after a successful write, which
 * is the only moment the server can vouch for the claim.
 */
export async function grantOrderAccess(number: string): Promise<void> {
  const jar = await cookies();
  const kept = unpack(jar.get(COOKIE)?.value, secret()).filter((n) => n !== number);

  jar.set(COOKIE, pack([number, ...kept].slice(0, KEEP), secret()), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: YEAR,
    secure: process.env.NODE_ENV === "production",
  });
}

/** Every order this browser placed, newest first. Empty for a fresh visitor. */
export async function ownedOrderNumbers(): Promise<string[]> {
  return unpack((await cookies()).get(COOKIE)?.value, secret());
}

/**
 * May the current request read this order?
 *
 * Staff may read any order — that is what the admin console is for, and
 * routing it through the same gate means the receipt page can be linked from
 * `/admin/orders` without a second access path to keep in sync.
 */
export async function canViewOrder(number: string): Promise<boolean> {
  if ((await ownedOrderNumbers()).includes(number)) return true;
  const { user } = await actionStaff();
  return Boolean(user);
}
