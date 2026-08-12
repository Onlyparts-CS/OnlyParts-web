import { getPayload } from "payload";
import config from "@payload-config";

/**
 * Recording what people searched for.
 *
 * The zero-result queue is only as good as this function, and this function has
 * exactly one hard rule: **it must never affect the search page.** A visitor
 * typing "m3x10" is not waiting on our bookkeeping, and a logging failure is
 * not a reason to show them an error. So it runs inside `after()`, it swallows
 * its own errors, and it returns void.
 *
 * One row per distinct query, upserted. Per-search rows would be a firehose;
 * the queue needs a list of questions, ranked by how often they were asked.
 */

/**
 * Lowercased, collapsed, trimmed — so "M3 x 10" and "m3  x  10" are one row.
 *
 * Deliberately *not* the search tokeniser's normalisation. This is the string a
 * person typed, and the whole value of the queue is reading it back in their
 * words: "608zz bearing" and "608zz" are different questions even though search
 * resolves them identically.
 */
export const normaliseQuery = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

/** Longer than this is a paste, not a search, and it is never worth a row. */
const MAX_LENGTH = 120;

export async function logSearch(rawQuery: string, resultCount: number): Promise<void> {
  const q = normaliseQuery(rawQuery);
  if (!q || q.length > MAX_LENGTH) return;

  try {
    const payload = await getPayload({ config });
    const { docs } = await payload.find({
      collection: "search-queries",
      where: { q: { equals: q } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    const now = new Date().toISOString();
    const existing = docs[0];

    if (existing) {
      await payload.update({
        collection: "search-queries",
        id: existing.id,
        depth: 0,
        overrideAccess: true,
        data: {
          count: (existing.count ?? 0) + 1,
          // The newest answer wins: a query that returned nothing last month and
          // returns forty results today has been solved, and the queue should
          // stop showing it without anybody closing it by hand.
          resultCount,
          lastSeen: now,
        },
      });
      return;
    }

    await payload.create({
      collection: "search-queries",
      depth: 0,
      overrideAccess: true,
      data: { q, resultCount, count: 1, lastSeen: now, triage: "untriaged" },
    });
  } catch {
    /*
      Swallowed on purpose, and this is the one place in the codebase where that
      is right. Two searches for a new term can race on the unique `q` index and
      one insert loses; the loser's count is off by one, which matters to nobody,
      and the alternative — a transaction per search — is a real cost on the
      hottest path on the site for a number used to rank a to-do list.
    */
  }
}
