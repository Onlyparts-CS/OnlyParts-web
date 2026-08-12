import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Google sign-in, by hand.
 *
 * Authorisation Code flow with PKCE. No dependency: the whole exchange is two
 * HTTPS calls and one signature check, and `jose` — which Payload already
 * ships and uses for exactly this — does the hard part. An auth library here
 * would be more surface area than the ~120 lines it replaces.
 *
 * Four things are checked, and all four matter:
 *
 * - **`state`** — a random value pinned to an httpOnly cookie and compared in
 *   constant time. Without it, an attacker can complete a login flow in a
 *   victim's browser and silently attach their own Google account to the
 *   victim's session (login CSRF).
 * - **PKCE (`code_verifier`)** — proves the client redeeming the code is the
 *   one that started the flow. Google does not require it for confidential
 *   clients; it costs three lines and closes code interception anyway.
 * - **`nonce`** — carried into the ID token by Google and compared back. Stops
 *   a token minted for one sign-in being replayed into another.
 * - **The ID token signature**, against Google's published keys, with issuer
 *   and audience pinned. This is the only thing that makes any of the claims
 *   trustworthy; parsing the JWT without verifying it would accept anything.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/*
  Cached across requests by `jose`, which refetches on key rotation. Building
  it per request would mean an extra round trip to Google on every sign-in.
*/
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const OAUTH_COOKIE = "op_oauth";

/** Ten minutes. The flow is a redirect and a form post; it does not take longer. */
export const OAUTH_TTL = 600;

export function clientId(): string {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}

/**
 * All three, not just the Google pair.
 *
 * `PAYLOAD_SECRET` belongs in this check because the flow signs its state
 * cookie with it, and `signedList.pack()` deliberately *throws* on an empty
 * secret rather than signing with one. Without it here, a deployment missing
 * `PAYLOAD_SECRET` answers the sign-in route with an unhandled 500 instead of
 * the "not configured yet" panel. It still fails closed either way — this is
 * about failing legibly.
 */
export function isConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.PAYLOAD_SECRET,
  );
}

/** The redirect URI, which must match the Google console entry byte for byte. */
export function redirectUri(origin: string): string {
  return `${new URL(origin).origin}/api/auth/google/callback`;
}

const b64url = (b: Buffer) => b.toString("base64url");

export function newVerifier(): string {
  return b64url(randomBytes(32));
}

export function challengeFor(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

export function newToken(): string {
  return b64url(randomBytes(24));
}

/**
 * Where to send the browser after sign-in.
 *
 * Only same-site paths. A `next` of `https://evil.example` or `//evil.example`
 * would otherwise turn our own sign-in into an open redirect — a link that
 * genuinely starts on onlyparts.in, genuinely signs the user in, and lands
 * them somewhere else entirely.
 */
export function safeNext(raw: string | null | undefined): string {
  const v = String(raw ?? "");
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/account";
  return v;
}

export function authorizeUrl(args: {
  origin: string;
  state: string;
  nonce: string;
  challenge: string;
}): string {
  const q = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(args.origin),
    response_type: "code",
    scope: "openid email profile",
    state: args.state,
    nonce: args.nonce,
    code_challenge: args.challenge,
    code_challenge_method: "S256",
    // No refresh token is requested: we do not act on the buyer's behalf
    // against Google afterwards, so storing one would be a credential kept for
    // no reason.
    prompt: "select_account",
  });
  return `${AUTH_URL}?${q}`;
}

/** Constant-time string compare that tolerates length mismatch. */
export function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // timingSafeEqual throws rather than returning false on a length mismatch,
  // and a differing length is already a failed comparison — nothing leaks.
  return x.length === y.length && timingSafeEqual(x, y);
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
};

/**
 * Exchange the code and verify the ID token. Returns null on any failure —
 * callers show one generic message, because distinguishing "bad code" from
 * "bad signature" for the user tells an attacker more than it tells them.
 */
export async function exchangeCode(args: {
  code: string;
  origin: string;
  verifier: string;
  nonce: string;
}): Promise<GoogleProfile | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: args.code,
      client_id: clientId(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(args.origin),
      grant_type: "authorization_code",
      code_verifier: args.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return null;
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) return null;

  try {
    const { payload } = await jwtVerify(body.id_token, jwks, {
      issuer: ISSUERS,
      audience: clientId(),
    });

    // Google echoes the nonce we sent. If it does not match, this token was
    // minted for a different sign-in attempt than the one this browser started.
    if (typeof payload.nonce !== "string" || !sameToken(payload.nonce, args.nonce)) return null;

    const sub = String(payload.sub ?? "");
    const email = String(payload.email ?? "").toLowerCase();
    if (!sub || !email) return null;

    /*
      An unverified Google email must not be trusted for account matching.
      Google will issue a token for an address the holder has not proven they
      own, and matching an existing customer on it would hand over that
      customer's order history.
    */
    if (payload.email_verified !== true) return null;

    return {
      sub,
      email,
      emailVerified: true,
      name: String(payload.name ?? email.split("@")[0]),
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}
