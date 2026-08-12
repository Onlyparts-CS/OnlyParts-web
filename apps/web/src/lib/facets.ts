import type { AttrDef } from "./taxonomy";
import type { Sku } from "./skus";

/**
 * Facet state lives in the URL, never in React state — docs/05-FRONTEND-ARCHITECTURE.md §5.
 * Shareable, back-button correct, and server-renderable, which is what makes a
 * filtered PLP indexable.
 *
 *   ?thread=M3,M4&length_mm=6-40&availability=in-stock&sort=price_asc&view=table
 */
export type Params = Record<string, string | string[] | undefined>;

export const readList = (p: Params, key: string): string[] => {
  const v = p[key];
  const raw = Array.isArray(v) ? v.join(",") : v;
  return raw ? raw.split(",").filter(Boolean) : [];
};

export const readRange = (p: Params, key: string): [number, number] | null => {
  const v = p[key];
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return null;
  const [a, b] = raw.split("-").map(Number);
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
};

export type EnumFacet = { def: AttrDef; kind: "enum"; values: { value: string; count: number }[] };
export type RangeFacet = { def: AttrDef; kind: "range"; min: number; max: number };
export type Facet = EnumFacet | RangeFacet;

/** Build facets from the leaf's attribute schema — never a hardcoded filter list. */
export function buildFacets(skus: Sku[], schema: AttrDef[]): Facet[] {
  return schema.flatMap<Facet>((def) => {
    if (def.facet === "range" || def.type === "number") {
      const nums = skus
        .map((s) => (def.key === "price" ? s.price : Number(s.attrs[def.key])))
        .filter((n) => Number.isFinite(n));
      if (!nums.length) return [];
      return [{ def, kind: "range", min: Math.min(...nums), max: Math.max(...nums) }];
    }
    const counts = new Map<string, number>();
    for (const s of skus) {
      const v = def.key === "availability" ? availabilityOf(s) : s.attrs[def.key];
      if (v === undefined) continue;
      const key = String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (!counts.size) return [];
    let values = [...counts].map(([value, count]) => ({ value, count }));
    if (def.order) {
      // engineering order: M10 must not sort between M1 and M2
      values.sort((a, b) => def.order!.indexOf(a.value) - def.order!.indexOf(b.value));
    } else {
      values = values.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    }
    return [{ def, kind: "enum", values }];
  });
}

export const availabilityOf = (s: Sku) =>
  s.stock === 0 ? "Made to order" : s.stock < 10 ? "Low stock" : "In stock";

export function applyFilters(skus: Sku[], schema: AttrDef[], p: Params): Sku[] {
  let out = skus;
  for (const def of schema) {
    if (def.facet === "range" || def.type === "number") {
      const r = readRange(p, def.key);
      if (!r) continue;
      out = out.filter((s) => {
        const v = def.key === "price" ? s.price / 100 : Number(s.attrs[def.key]);
        return Number.isFinite(v) && v >= r[0] && v <= r[1];
      });
    } else {
      const sel = readList(p, def.key);
      if (!sel.length) continue;
      out = out.filter((s) => {
        const v = def.key === "availability" ? availabilityOf(s) : s.attrs[def.key];
        return v !== undefined && sel.includes(String(v));
      });
    }
  }
  return out;
}

export const SORTS = [
  { key: "relevance", label: "Relevance" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
  { key: "stock", label: "Most in stock" },
  { key: "rating", label: "Best rated" },
] as const;

export function applySort(
  skus: Sku[],
  sort: string,
  schema: AttrDef[],
  /**
   * True when the caller already ordered the list by match quality — the search
   * page does. Without this, "relevance" re-sorted search hits by numeric axis
   * and buried the best match: querying `m3x10 ss304 socket` put a Pan Head
   * first because 10 mm ties across every head type.
   */
  incomingIsRelevance = false,
): Sku[] {
  const out = [...skus];
  switch (sort) {
    case "price_asc":  return out.sort((a, b) => a.price - b.price);
    case "price_desc": return out.sort((a, b) => b.price - a.price);
    case "stock":      return out.sort((a, b) => b.stock - a.stock);
    case "rating":     return out.sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount);
    default: {
      if (incomingIsRelevance) return out;
      // on a category listing there is no query, so relevance means:
      // in stock first, then ascending along the leaf's primary numeric axis
      const axis = schema.find((d) => d.type === "number" && d.key !== "price")?.key;
      return out.sort((a, b) => {
        const stockDiff = (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0);
        if (stockDiff) return stockDiff;
        if (axis) return Number(a.attrs[axis] ?? 0) - Number(b.attrs[axis] ?? 0);
        return a.price - b.price;
      });
    }
  }
}

/** Chips above the grid — every active filter, individually removable. */
export function activeChips(schema: AttrDef[], p: Params) {
  const chips: { key: string; label: string; value?: string }[] = [];
  for (const def of schema) {
    if (def.facet === "range" || def.type === "number") {
      const r = readRange(p, def.key);
      if (r) chips.push({ key: def.key, label: `${def.label} ${r[0]}–${r[1]}${def.unit ? " " + def.unit : ""}` });
    } else {
      for (const v of readList(p, def.key)) chips.push({ key: def.key, label: v, value: v });
    }
  }
  return chips;
}
