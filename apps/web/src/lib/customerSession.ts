import { cookies } from "next/headers";
import type { AuthStrategy } from "payload";
import { pack, unpack } from "./signedList";

/**
 * The buyer's session cookie, and the Payload strategy that reads it.
 *
 * Sign-in used to be `signIn({ name, email })` in a zustand store — a client
 * function that took whatever it was handed and wrote it to localStorage.
 * There was no server involvement at any point, so "signed in" was a claim the
 * browser made about itself and every screen behind it was decoration. Order
 * history, saved addresses and the DPDP export all hung off it.
 *
 * This is the server half. It deliberately reuses the signed-cookie mechanism
 * `orderAccess.ts` already established rather than introducing a second one:
 * same `pack`/`unpack`, same httpOnly cookie, same "the signature is what does
 * the work" reasoning. The difference is only what the note says — that one
 * says *this browser placed order X*, this one says *this browser is customer
 * Y until time T*.
 *
 * Why not Payload's own JWT: issuing one means either enabling a local
 * password strategy we never want on a Google-only login, or hand-forging
 * tokens against Payload's session internals. A signed cookie plus a custom
 * auth strategy is less machinery and no reverse-engineering.
 *
 * **Nothing here imports `@payload-config`.** `payload.config.ts` pulls in
 * `collections/Customers.ts`, which needs the strategy below — importing the
 * config back would close a cycle. The strategy takes `payload` from its own
 * arguments instead, and `currentCustomer()` lives in `customerAuth.ts` for
 * the same reason.
 */

const COOKIE = "op_customer";

/**
 * Thirty days.
 *
 * Long enough that a returning buyer is not asked to sign in again between
 * orders, short enough that a shared or stolen machine stops working within a
 * billing cycle. There is no silent refresh: re-signing in with Google is one
 * click, so extension buys nothing and costs a longer-lived credential.
 */
const TTL_SECONDS = 60 * 60 * 24 * 30;

/** Fails closed: an unconfigured deployment signs nothing and trusts nothing. */
const secret = () => process.env.PAYLOAD_SECRET ?? "";

/** Verify a raw cookie value into a customer id, or null. */
export function readSession(raw: string | undefined): string | null {
  const [id, expiresAt] = unpack(raw, secret());
  if (!id || !expiresAt) return null;

  // The expiry is inside the signed payload, not only in the cookie's Max-Age.
  // A browser is free to keep sending an expired cookie; only the signed value
  // can say when it stopped being valid.
  if (Number(expiresAt) * 1000 < Date.now()) return null;
  return id;
}

/**
 * The session cookie, as data.
 *
 * Returned rather than set, so the OAuth callback can put it on the same
 * `NextResponse` it is already attaching a deletion to. `cookies().set()` and
 * `NextResponse.cookies.set()` are two routes to the same `Set-Cookie` header
 * and mixing them in one handler is how one of them silently loses.
 */
export function sessionCookie(customerId: string | number) {
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return {
    name: COOKIE,
    value: pack([String(customerId), String(expiresAt)], secret()),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: TTL_SECONDS,
      secure: process.env.NODE_ENV === "production",
    },
  };
}

/** Start a session from a Server Function, where there is no response object. */
export async function startCustomerSession(customerId: string | number): Promise<void> {
  const c = sessionCookie(customerId);
  (await cookies()).set(c.name, c.value, c.options);
}

export async function endCustomerSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The signed-in customer's id, straight from the cookie store. */
export async function currentCustomerId(): Promise<string | null> {
  return readSession((await cookies()).get(COOKIE)?.value);
}

/**
 * The same cookie, taught to Payload.
 *
 * Registering this on the `customers` collection means `payload.auth()` and
 * every collection's access control see a signed-in buyer as a first-class
 * user. Without it there would be two notions of "who is this" — ours and
 * Payload's — and access rules written against `req.user` would silently never
 * match a customer.
 */
export const customerCookieStrategy: AuthStrategy = {
  name: "customer-cookie",
  authenticate: async ({ headers, payload }) => {
    const raw = headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);

    const id = readSession(raw && decodeURIComponent(raw));
    if (!id) return { user: null };

    try {
      const user = await payload.findByID({
        collection: "customers",
        id,
        depth: 0,
        overrideAccess: true,
      });
      if (!user) return { user: null };
      return { user: { ...user, collection: "customers", _strategy: "customer-cookie" } };
    } catch {
      return { user: null };
    }
  },
};
