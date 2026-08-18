import { getPayload } from "payload";
import config from "@payload-config";

/**
 * Recording that a page was looked at.
 *
 * Same hard rule as `logSearch`: **it must never affect the page.** It runs off
 * a beacon the visitor's browser fires after the page has painted, it swallows
 * its own errors, and it returns void.
 *
 * One row per distinct path, upserted — see `collections/PageViews.ts` for why
 * a lifetime total rather than a daily series, and why this collection holds
 * nothing about the visitor.
 */

/**
 * The set of paths worth a row, and the reason this is a whitelist.
 *
 * The path arrives from the client, on an endpoint that must stay open because
 * the visitor has no session. Trusting it would let anybody grow the table one
 * row per request forever with `/aaaa`, `/aaab`, `/aaac` — the rate limit caps
 * the rate, not the total, and a table that only grows is the more expensive
 * failure. So a path is recorded only if it matches a route this site actually
 * serves; anything else is dropped silently rather than stored as noise.
 *
 * The order-scoped routes are deliberately absent. `/orders/OP-10023` and
 * `/rfqs/…` name a specific customer's document, and a table of which order
 * numbers were viewed is exactly the identifying trace this collection exists
 * not to keep.
 */
const ROUTES: RegExp[] = [
  /^\/$/,
  /^\/(about|bulk-orders|careers|cart|checkout|contact|faq|guides|login|make|register|search|track|wishlist|account)$/,
  /^\/make\/rfq$/,
  /^\/(p|b)\/[a-z0-9-]{1,80}$/,
  /^\/(guides|policies|projects)\/[a-z0-9-]{1,80}$/,
  /^\/c(\/[a-z0-9-]{1,60}){0,4}$/,
];

/** Query strings and fragments carry the search term and the anchor; neither is the page. */
export const normalisePath = (raw: string): string | null => {
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return ROUTES.some((r) => r.test(path)) ? path : null;
};

export async function logPageView(rawPath: string): Promise<void> {
  const path = normalisePath(rawPath);
  if (!path) return;

  try {
    const payload = await getPayload({ config });
    const { docs } = await payload.find({
      collection: "page-views",
      where: { path: { equals: path } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    const now = new Date().toISOString();
    const existing = docs[0];

    if (existing) {
      await payload.update({
        collection: "page-views",
        id: existing.id,
        depth: 0,
        overrideAccess: true,
        data: { count: (existing.count ?? 0) + 1, lastSeen: now },
      });
      return;
    }

    await payload.create({
      collection: "page-views",
      depth: 0,
      overrideAccess: true,
      data: { path, count: 1, lastSeen: now },
    });
  } catch {
    /*
      Swallowed for the same reason `logSearch` swallows: two views of a page
      nobody has visited before can race on the unique `path` index and one
      insert loses. The loser's count is off by one, which matters to nobody,
      and a transaction per page view is a real cost for a number used to sort
      a list.
    */
  }
}
