import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { unpack } from "@/lib/signedList";
import { sessionCookie } from "@/lib/customerSession";
import { OAUTH_COOKIE, exchangeCode, safeNext, sameToken } from "@/lib/googleOAuth";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Return leg of the Google sign-in flow.
 *
 * Every failure lands on `/login?error=failed` with no detail. That is
 * deliberate: telling the caller whether the state mismatched, the signature
 * failed or the email was unverified is a free oracle for whoever is probing,
 * and none of the distinctions help an actual buyer.
 */
const fail = (req: NextRequest, why = "failed") =>
  NextResponse.redirect(new URL(`/login?error=${why}`, req.nextUrl.origin));

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // The user pressed "cancel" on Google's screen. Not an error worth alarming
  // them about — put them back where they started.
  if (params.get("error")) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));

  const code = params.get("code");
  const returnedState = params.get("state");
  if (!code || !returnedState) return fail(req);

  /*
    Limited as well as the start route.

    A callback with a junk code still costs an outbound HTTPS round trip to
    Google's token endpoint before it can be rejected, so an unlimited callback
    is a request amplifier pointed at someone else's API — and at our own rate
    budget with them. Twenty a minute is generous for a flow a person completes
    once.
  */
  if (!(await rateLimit(req, "oauth-callback", 20, 60))) return fail(req, "throttled");

  const [state, nonce, verifier, next] = unpack(
    req.cookies.get(OAUTH_COOKIE)?.value,
    process.env.PAYLOAD_SECRET ?? "",
  );
  if (!state || !nonce || !verifier) return fail(req);
  if (!sameToken(state, returnedState)) return fail(req);

  const profile = await exchangeCode({
    code,
    origin: req.nextUrl.origin,
    verifier,
    nonce,
  });
  if (!profile) return fail(req);

  try {
    const payload = await getPayload({ config });

    /*
      Match on `googleSub` first, then the verified email.

      Order matters. `sub` is immutable; an email address is not — a buyer who
      changes their Google address must land on their existing orders rather
      than a fresh empty account. The email fallback exists for the other
      direction: somebody who checked out as a guest with the same address, or
      whom staff created by hand, should be adopted rather than duplicated.

      Both lookups are only safe because `exchangeCode` refuses an unverified
      email. Matching an existing customer on an unproven address is account
      takeover.
    */
    const found = await payload.find({
      collection: "customers",
      where: { or: [{ googleSub: { equals: profile.sub } }, { email: { equals: profile.email } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    const existing = found.docs[0];
    const customer = existing
      ? await payload.update({
          collection: "customers",
          id: existing.id,
          overrideAccess: true,
          data: {
            googleSub: profile.sub,
            emailVerified: true,
            // Their Google address wins over whatever was typed at guest
            // checkout, because this one is proven and that one was not.
            email: profile.email,
            // A name entered at checkout is more likely to be the real
            // delivery name than a Google display name, so it is not touched
            // once set.
            ...(existing.name ? {} : { name: profile.name }),
          },
        })
      : await payload.create({
          collection: "customers",
          overrideAccess: true,
          data: {
            googleSub: profile.sub,
            email: profile.email,
            emailVerified: true,
            name: profile.name,
            // No phone. Google does not supply one and checkout collects it at
            // the point it is needed — see `collections/Customers.ts`.
          },
        });

    /*
      `next` is re-validated even though it came out of a cookie we signed and
      `safeNext` already ran on it before packing.

      Belt and braces on purpose: this is the line that decides where a
      successfully-authenticated browser is sent, and the day somebody changes
      the start route to stop sanitising, that mistake becomes an open redirect
      on the sign-in flow rather than a wrong-looking cookie. One function call
      is a cheap place to not depend on another file staying correct.
    */
    const res = NextResponse.redirect(new URL(safeNext(next), req.nextUrl.origin));
    const session = sessionCookie(customer.id);
    res.cookies.set(session.name, session.value, session.options);
    // One-shot: leaving it would let a replayed callback reuse the same state.
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
    return res;
  } catch {
    return fail(req);
  }
}
