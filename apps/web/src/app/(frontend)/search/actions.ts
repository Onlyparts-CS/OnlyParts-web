"use server";

import { dbAllSkus, dbFindManySkus } from "@/lib/catalogDb";
import { searchSkus, type SkuSearchResult } from "@/lib/searchSkus";
import type { Sku } from "@/lib/skus";
import { allow } from "@/lib/rateLimit";

/**
 * Search and SKU resolution for the parts of the storefront that run in the
 * browser.
 *
 * The instant overlay and the cart used to call into the generated catalogue
 * directly, which worked only because that catalogue was a JavaScript array
 * shipped to every visitor. Postgres cannot be, so the browser asks instead.
 *
 * Both actions are deliberately **unauthenticated** — this is the public
 * catalogue, the same rows anyone can read by walking `/c`. Nothing here
 * returns cost price or stock beyond what the product page already shows.
 *
 * They are still rate limited, for a different reason than the tracking
 * endpoint: not confidentiality but cost. `dbAllSkus()` is cached per request,
 * not globally, so a script calling this in a loop is a script running the
 * catalogue query in a loop. The ceiling is set well above human typing.
 */

/** The instant overlay: a handful of hits, ranked, as the user types. */
export async function instantSearch(q: string): Promise<SkuSearchResult | null> {
  const query = q.trim();
  if (query.length < 2) return null;
  // 60/min: a debounced typeahead sends a few per search, so this is roughly
  // twenty searches a minute before anyone notices — and still two orders of
  // magnitude below a scraper.
  if (!(await allow("search", 60, 60))) return null;
  return searchSkus(query, await dbAllSkus(), 6);
}

/**
 * Resolve cart and wishlist codes to live catalogue rows.
 *
 * Returns only what still exists and is still sellable, which is the point:
 * a cart holding a delisted SKU should lose that line rather than carry a
 * price nobody will honour.
 */
export async function resolveSkus(codes: string[]): Promise<Sku[]> {
  if (!codes.length) return [];
  return dbFindManySkus(codes);
}
