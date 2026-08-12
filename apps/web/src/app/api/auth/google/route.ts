import { NextResponse, type NextRequest } from "next/server";
import { pack } from "@/lib/signedList";
import { rateLimit } from "@/lib/rateLimit";
import {
  OAUTH_COOKIE,
  OAUTH_TTL,
  authorizeUrl,
  challengeFor,
  isConfigured,
  newToken,
  newVerifier,
  safeNext,
} from "@/lib/googleOAuth";

/**
 * Start of the Google sign-in flow.
 *
 * The three secrets this leg generates — state, nonce and the PKCE verifier —
 * plus the return path all go into one signed httpOnly cookie rather than four
 * plain ones. Signing them matters: the callback compares what Google echoes
 * against what it finds here, and if the browser could edit this cookie it
 * could simply make both sides agree.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.redirect(new URL("/login?error=unconfigured", req.nextUrl.origin));
  }

  // Cheap, but not free: each start burns a Google authorisation and sets a
  // cookie. Ten a minute is far above any human and well below a script.
  if (!(await rateLimit(req, "oauth-start", 10, 60))) {
    return NextResponse.redirect(new URL("/login?error=throttled", req.nextUrl.origin));
  }

  const state = newToken();
  const nonce = newToken();
  const verifier = newVerifier();
  const next = safeNext(req.nextUrl.searchParams.get("next"));

  const res = NextResponse.redirect(
    authorizeUrl({
      origin: req.nextUrl.origin,
      state,
      nonce,
      challenge: challengeFor(verifier),
    }),
  );

  res.cookies.set(OAUTH_COOKIE, pack([state, nonce, verifier, next], process.env.PAYLOAD_SECRET ?? ""), {
    httpOnly: true,
    // Must survive Google's cross-site redirect back to us. `lax` allows it on
    // a top-level GET navigation, which is exactly what the callback is;
    // `strict` would drop the cookie and break every sign-in.
    sameSite: "lax",
    path: "/api/auth",
    maxAge: OAUTH_TTL,
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}
