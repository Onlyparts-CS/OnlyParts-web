/**
 * A rate limit, in memory.
 *
 * There was none anywhere. Order tracking takes an order number and a phone
 * number and answers as fast as it is asked, against a **gapless** order
 * sequence — `orderAccess.ts` already documents why guessable order numbers
 * are dangerous, and the missing half of that argument is that guessing is
 * currently free.
 *
 * ponytail: single-process counters. They reset on deploy and do not add up
 * across instances, so two app servers means twice the real limit. That is
 * fine for one droplet and wrong the moment there are two — move the map to
 * the Redis that Phase 1 of the hosting plan adds anyway, keeping this
 * signature.
 *
 * Deliberately not a dependency. The whole mechanism is a Map and a timestamp
 * array; `@upstash/ratelimit` and friends bring a client, a protocol and a
 * network hop to do the same arithmetic.
 */

type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();

/*
  Sweep on write rather than on a timer: an interval keeps the process alive
  and, in a serverless deploy, runs in an instance nobody is using. This costs
  one pass over a small map on the rare occasion the map has grown.
*/
const MAX_KEYS = 10_000;

function sweep(now: number, windowMs: number) {
  for (const [key, b] of buckets) {
    if (b.hits.length === 0 || now - b.hits[b.hits.length - 1] > windowMs) buckets.delete(key);
  }
}

/**
 * The caller's IP, as far as it can be trusted.
 *
 * Behind Cloudflare, `cf-connecting-ip` is set by the edge and cannot be
 * spoofed by the client. `x-forwarded-for` can be, so its *first* entry is
 * only used as a fallback and only when nothing better exists — a limiter
 * keyed on a spoofable header limits nobody.
 */
async function callerKey(): Promise<string> {
  // Imported here rather than at the top so the arithmetic below stays runnable
  // outside Next — `rateLimit.check.ts` is a plain `node` script, and a
  // framework import at module scope would make it un-runnable. Same reasoning
  // as the purity note in `signedList.ts`.
  const { headers } = await import("next/headers");
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Sliding window. Returns false when the caller is over the limit.
 *
 * @param scope  what is being limited — keeps sign-in and search on separate budgets
 * @param limit  requests allowed per window
 * @param windowSeconds  the window
 */
export async function allow(scope: string, limit: number, windowSeconds: number): Promise<boolean> {
  return allowFor(await callerKey(), scope, limit, windowSeconds);
}

/** As `allow`, but for a caller you have already identified. */
export function allowFor(caller: string, scope: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const key = `${scope}:${caller}`;

  if (buckets.size > MAX_KEYS) sweep(now, windowMs);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    // Recorded anyway, so a caller hammering a limit keeps their window open
    // rather than getting back in the moment the oldest hit ages out.
    buckets.set(key, bucket);
    return false;
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return true;
}

/**
 * Route-handler form, where `next/headers` is not available but the request is.
 */
export async function rateLimit(
  req: { headers: Headers },
  scope: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const caller =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return allowFor(caller, scope, limit, windowSeconds);
}
