import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A short list of strings the browser may hold but must not be able to edit.
 *
 * Format is `a,b,c.<mac>` — the values, then an HMAC over exactly those values.
 * Tamper with any part and the MAC stops matching, so `unpack` returns nothing
 * rather than something attacker-chosen.
 *
 * The secret is a parameter rather than read from the environment here, which
 * keeps this file pure — no I/O, no framework — and therefore runnable on its
 * own. See `signedList.check.ts`, which is the test for it.
 */

const sign = (body: string, secret: string): string => {
  // An empty key is a *valid* HMAC key: it would sign happily and verify
  // forgeries just as happily. Refuse instead of pretending.
  if (!secret) throw new Error("A signing secret is required.");
  return createHmac("sha256", secret).update(body).digest("base64url");
};

/** Values → a cookie-safe signed string. */
export function pack(values: string[], secret: string): string {
  const body = values.join(",");
  return `${body}.${sign(body, secret)}`;
}

/** A signed string → its values, or `[]` if the signature does not hold. */
export function unpack(raw: string | undefined, secret: string): string[] {
  if (!raw) return [];

  // lastIndexOf: the MAC is base64url and never contains a dot, so the final
  // dot is the separator even if a value somehow held one.
  const cut = raw.lastIndexOf(".");
  if (cut < 0) return [];

  const body = raw.slice(0, cut);
  const mac = raw.slice(cut + 1);

  let expected: string;
  try {
    expected = sign(body, secret);
  } catch {
    return [];
  }

  // timingSafeEqual throws on a length mismatch rather than returning false,
  // so lengths are compared first. Nothing leaks: a different length is
  // already a failed comparison.
  if (mac.length !== expected.length) return [];
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return [];

  return body ? body.split(",") : [];
}
