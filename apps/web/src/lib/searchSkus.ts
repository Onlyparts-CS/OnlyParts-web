import type { Sku } from "./skus";
import { parseQuery } from "./search";
import { resolve } from "./taxonomy";
import type { Token } from "./types";

/**
 * Search across the whole generated catalogue.
 *
 * `search()` in `search.ts` backs the instant overlay over the curated demo
 * list; this runs the *same parser* over every SKU so the results page and the
 * PLP agree. One parser, three consumers — exactly the arrangement
 * `09-SEARCH-SPEC.md` §2 calls for, so client, server and BOM matcher can never
 * disagree about what `m3x10` means.
 */

const haystacks = new WeakMap<Sku, string>();

function haystack(s: Sku): string {
  const cached = haystacks.get(s);
  if (cached) return cached;
  const names = s.categories
    .map((p) => resolve(p)?.trail.map((n) => n.name).join(" ") ?? "")
    .join(" ");
  const attrs = Object.values(s.attrs).join(" ");
  const built = `${s.title} ${s.sku} ${names} ${attrs}`.toLowerCase();
  haystacks.set(s, built);
  return built;
}

export type CategoryHit = { path: string[]; name: string; full: string; count: number };

export type SkuSearchResult = {
  tokens: Token[];
  residual: string;
  results: Sku[];
  categories: CategoryHit[];
  /** non-null when the exact query returned nothing and we widened a constraint */
  relaxed: { key: string; label: string; values: (string | number)[] } | null;
  total: number;
};

/**
 * @param pool the catalogue to search. Passed in rather than fetched, because
 *   the rows now live in Postgres and this function is called from a server
 *   page, a server action and a script — each of which has its own idea of how
 *   much of the catalogue is in scope.
 */
export function searchSkus(raw: string, pool: Sku[], limit = 60): SkuSearchResult {
  const { tokens, residual } = parseQuery(raw);
  const words = residual.split(" ").filter(Boolean);

  const match = (activeTokens: Token[]) =>
    pool
      .map((s) => {
        let score = 0;
        for (const t of activeTokens) {
          if (t.key === "sku") {
            if (!s.sku.toUpperCase().includes(String(t.value))) return null;
            score += 200;
            continue;
          }
          const v = s.attrs[t.key];
          if (v === undefined) return null;
          if (!looseEq(v, t.value)) return null;
          score += 40;
        }
        const hay = haystack(s);
        for (const w of words) {
          if (hay.includes(w)) score += 12;
          else if (w.length > 3 && hay.includes(w.slice(0, -1))) score += 6;
          else score -= 16;
        }
        if (!activeTokens.length && !words.length) score = 1;
        // in stock outranks popularity — an out-of-stock bestseller helps nobody
        if (s.stock > 0) score += 8;
        score += Math.min(6, s.ratingCount / 40);
        return score > 0 ? { s, score } : null;
      })
      .filter((x): x is { s: Sku; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);

  let scored = match(tokens);
  let relaxed: SkuSearchResult["relaxed"] = null;

  // zero-result recovery — widen rather than dead-end. Never "No results found."
  if (!scored.length && tokens.length) {
    const numeric = tokens.filter((t) => typeof t.value === "number");
    if (numeric.length) {
      const drop = numeric[numeric.length - 1];
      const without = match(tokens.filter((t) => t !== drop));

      // Case 1 — the attribute exists but not at that value: offer the nearest.
      //   "m3x7" → no 7 mm, nearest 6 mm and 8 mm.
      const withAttr = without
        .filter(({ s }) => s.attrs[drop.key] !== undefined)
        .sort(
          (a, b) =>
            Math.abs(Number(a.s.attrs[drop.key]) - Number(drop.value)) -
            Math.abs(Number(b.s.attrs[drop.key]) - Number(drop.value))
        );

      if (withAttr.length) {
        scored = withAttr;
        relaxed = {
          key: drop.key,
          label: drop.label,
          values: [...new Set(withAttr.slice(0, 6).map((n) => n.s.attrs[drop.key]))].slice(0, 4),
        };
      } else if (without.length) {
        // Case 2 — nothing in these results carries that attribute at all.
        //   "neodymium disc 15mm" parses 15 mm as a length; magnets have a
        //   diameter, not a length. Drop the token instead of returning nothing.
        scored = without;
        relaxed = { key: drop.key, label: drop.label, values: [] };
      }
    }
  }

  const results = scored.map((x) => x.s);

  // "Your results span N categories" — lets a broad query be narrowed by
  // category before the user touches a single facet.
  const byCat = new Map<string, CategoryHit>();
  for (const s of results) {
    for (const path of s.categories) {
      const key = path.join("/");
      const hit = byCat.get(key);
      if (hit) { hit.count++; continue; }
      const node = resolve(path);
      if (!node) continue;
      byCat.set(key, {
        path,
        name: node.node.name,
        full: node.trail.map((n) => n.name).join(" › "),
        count: 1,
      });
    }
  }

  return {
    tokens,
    residual,
    results: results.slice(0, limit),
    total: results.length,
    categories: [...byCat.values()].sort((a, b) => b.count - a.count).slice(0, 6),
    relaxed,
  };
}

const norm = (v: string | number) => String(v).toLowerCase().replace(/[^a-z0-9.]/g, "");

const looseEq = (catalogueValue: string | number, queryValue: string | number) => {
  const A = norm(catalogueValue);
  const B = norm(queryValue);
  if (A === B) return true;
  // Catalogue values carry a human suffix the query never will:
  // "ZZ (metal shielded)" must match the parsed token "ZZ".
  return B.length >= 2 && A.startsWith(B);
};
