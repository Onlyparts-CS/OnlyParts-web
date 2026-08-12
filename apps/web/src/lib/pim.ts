import { cache } from "react";
import { getPayload } from "payload";
import config from "@payload-config";

/**
 * Product Information Management, server side.
 *
 * The model is Akeneo's, not Shopify's, and the difference matters. A Shopify
 * product form assumes somebody with forty products who knows all forty. This
 * catalogue is heading for fifty thousand rows whose value is entirely in their
 * typed specs — a bearing nobody has given a bore diameter is invisible to the
 * one facet anybody would use to find it.
 *
 * So the unit of work is not "a product". It is **a category's attribute
 * template, and every variant under it that is missing part of it.**
 */

export type AttrType = "text" | "number" | "boolean" | "enum" | "dimension";

export type Definition = {
  id: string | number;
  key: string;
  label: string;
  type: AttrType;
  unit?: string | null;
  isRequired: boolean;
  isFacet: boolean;
  isVariantAxis: boolean;
  enumValues: string[];
  /** The category the definition is declared on — may be an ancestor. */
  declaredOn: { id: string | number; name: string; path: string };
  /** True when it came from an ancestor rather than this category. */
  inherited: boolean;
};

/** One row of `variants_attributes` — exactly one value field is set. */
export type SpecRow = {
  definition: string | number;
  valueText?: string;
  valueNumber?: number;
  valueBool?: boolean;
};

/**
 * Turn `{ thread: "M3", length_mm: "10" }` into typed spec rows.
 *
 * Shared because it is written three times otherwise — the create form, the
 * variant matrix and the importer all need it, and each one re-derived the same
 * union that TypeScript cannot infer through `flatMap`. The definition decides
 * the column; a value that will not coerce is dropped rather than forced,
 * because a wrong number in `value_number` silently breaks a range facet while
 * a missing one merely shows up in the enrichment queue.
 */
export function toSpecRows(defs: Definition[], values: Record<string, string>): SpecRow[] {
  return defs.flatMap((d): SpecRow[] => {
    const raw = (values[d.key] ?? "").trim();
    if (!raw) return [];
    if (d.type === "number" || d.type === "dimension") {
      const n = Number(raw.replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? [{ definition: d.id, valueNumber: n }] : [];
    }
    if (d.type === "boolean") return [{ definition: d.id, valueBool: raw === "true" }];
    return [{ definition: d.id, valueText: raw }];
  });
}

export type CategoryRow = {
  id: string | number;
  name: string;
  slug: string;
  path: string;
  depth: number;
  isLeaf: boolean;
};

export type Completeness = {
  required: number;
  variants: number;
  /** filled required cells / (required × variants), 0–1. 1 when nothing required. */
  ratio: number;
  missing: { sku: string; id: string | number; keys: string[] }[];
};

const payloadOnce = async () => getPayload({ config });

/* ------------------------------------------------------------------ */

export async function categories(): Promise<CategoryRow[]> {
  const payload = await payloadOnce();
  const { docs } = await payload.find({
    collection: "categories", limit: 1000, depth: 0, sort: "path", overrideAccess: true,
  });
  const paths = new Set(docs.map((c) => String(c.path)));
  return docs.map((c) => ({
    id: c.id,
    name: String(c.name),
    slug: String(c.slug),
    path: String(c.path ?? ""),
    depth: Number(c.depth ?? 1),
    // a leaf is a node nothing else claims as a prefix
    isLeaf: ![...paths].some((p) => p !== c.path && p.startsWith(`${c.path}.`)),
  }));
}

/**
 * Every attribute that applies to a category, its own and its ancestors'.
 *
 * `AttributeDefinitions` documents inheritance — "a definition on Bearings
 * applies to every descendant" — but nothing resolved it, so the promise was
 * only in a comment. Resolution happens here rather than being denormalised
 * onto each leaf, so moving a definition up the tree applies it downward
 * immediately and needs no backfill.
 *
 * A descendant may override an ancestor by declaring the same `key`; the
 * nearest declaration wins.
 */
export async function resolveAttributes(categoryPath: string): Promise<Definition[]> {
  const payload = await payloadOnce();

  // 'a.b.c' → ['a', 'a.b', 'a.b.c'], root first so nearer declarations overwrite
  const segments = categoryPath.split(".");
  const ancestry = segments.map((_, i) => segments.slice(0, i + 1).join("."));

  const cats = await payload.find({
    collection: "categories",
    where: { path: { in: ancestry } },
    limit: 100, depth: 0, overrideAccess: true,
  });
  if (!cats.docs.length) return [];

  const byId = new Map(cats.docs.map((c) => [String(c.id), c]));
  const defs = await payload.find({
    collection: "attribute-definitions",
    where: { category: { in: cats.docs.map((c) => c.id) } },
    limit: 500, depth: 0, sort: "position", overrideAccess: true,
  });

  const merged = new Map<string, Definition>();
  // nearest-wins: walk root → leaf and let later writes replace earlier ones
  for (const path of ancestry) {
    const cat = cats.docs.find((c) => c.path === path);
    if (!cat) continue;
    for (const d of defs.docs) {
      const owner = typeof d.category === "object" ? d.category?.id : d.category;
      if (String(owner) !== String(cat.id)) continue;
      const declared = byId.get(String(owner));
      merged.set(String(d.key), {
        id: d.id,
        key: String(d.key),
        label: String(d.label),
        type: d.type as AttrType,
        unit: d.unit as string | null,
        isRequired: Boolean(d.isRequired),
        isFacet: d.isFacet !== false,
        isVariantAxis: Boolean(d.isVariantAxis),
        enumValues: ((d.enumValues ?? []) as { value: string }[]).map((e) => e.value),
        declaredOn: {
          id: owner as string | number,
          name: String(declared?.name ?? "—"),
          path: String(declared?.path ?? ""),
        },
        inherited: path !== categoryPath,
      });
    }
  }
  return [...merged.values()];
}

/**
 * How many stocked categories have a variant missing a required attribute.
 *
 * The obvious implementation — `completeness()` per leaf — is four queries a
 * category, and there are 389 of them. Measured at **34 seconds** for one page
 * load of `/admin/queues`, which is what it cost before this existed.
 *
 * This is four queries total for the whole catalogue and does the resolution in
 * memory. It answers only the counting question; `completeness()` stays for the
 * enrichment screen, where one category is being looked at in detail and its
 * per-variant gap list is the entire point.
 */
export const catalogueGaps = cache(async (): Promise<{ categories: number; variants: number }> => {
  const payload = await payloadOnce();

  const [cats, defs, products, variants] = await Promise.all([
    payload.find({ collection: "categories", limit: 2000, depth: 0, overrideAccess: true }),
    payload.find({ collection: "attribute-definitions", limit: 1000, depth: 0, overrideAccess: true }),
    payload.find({ collection: "products", limit: 5000, depth: 0, overrideAccess: true }),
    payload.find({ collection: "variants", limit: 5000, depth: 0, overrideAccess: true }),
  ]);

  const parentOf = new Map<string, string | null>();
  for (const c of cats.docs) {
    parentOf.set(String(c.id), c.parent ? String(typeof c.parent === "object" ? c.parent.id : c.parent) : null);
  }

  // Required definitions declared directly on each category.
  const ownRequired = new Map<string, string[]>();
  for (const d of defs.docs) {
    if (!d.isRequired) continue;
    const cid = String(typeof d.category === "object" && d.category ? d.category.id : d.category);
    ownRequired.set(cid, [...(ownRequired.get(cid) ?? []), String(d.id)]);
  }

  /*
    Definitions inherit downward, so a leaf's required set is its own plus every
    ancestor's. Walked once per category and memoised, rather than re-walked per
    variant — the tree is only three deep but there are 1,200 variants.
  */
  const resolved = new Map<string, Set<string>>();
  const requiredFor = (cid: string): Set<string> => {
    const hit = resolved.get(cid);
    if (hit) return hit;
    const parent = parentOf.get(cid);
    const set = new Set(parent ? requiredFor(parent) : []);
    for (const id of ownRequired.get(cid) ?? []) set.add(id);
    resolved.set(cid, set);
    return set;
  };

  const catOfProduct = new Map<string, string>();
  for (const p of products.docs) {
    catOfProduct.set(String(p.id), String(typeof p.primaryCategory === "object" && p.primaryCategory
      ? p.primaryCategory.id : p.primaryCategory));
  }

  const gappy = new Set<string>();
  let variantsWithGaps = 0;

  for (const v of variants.docs) {
    if (v.isActive === false) continue;
    const cid = catOfProduct.get(String(typeof v.product === "object" && v.product ? v.product.id : v.product));
    if (!cid) continue;
    const need = requiredFor(cid);
    if (!need.size) continue;

    const held = new Set(
      (v.attributes ?? []).map((a) =>
        String(typeof a.definition === "object" && a.definition ? a.definition.id : a.definition)),
    );
    if ([...need].some((d) => !held.has(d))) {
      gappy.add(cid);
      variantsWithGaps++;
    }
  }

  return { categories: gappy.size, variants: variantsWithGaps };
});

/**
 * How much of one category's required schema is actually filled in.
 *
 * This is the number the whole console exists to move. It is deliberately
 * measured per *cell* — variants × required attributes — rather than per
 * product, because "80% of products have at least one spec" is a figure that
 * sounds like progress and means nothing.
 *
 * Four queries, so call it for **one** category. For a count across the whole
 * catalogue use `catalogueGaps` above.
 */
export async function completeness(categoryPath: string): Promise<Completeness> {
  const payload = await payloadOnce();
  const defs = (await resolveAttributes(categoryPath)).filter((d) => d.isRequired);

  const cat = await payload.find({
    collection: "categories", where: { path: { equals: categoryPath } },
    limit: 1, depth: 0, overrideAccess: true,
  });
  const catId = cat.docs[0]?.id;
  if (!catId) return { required: defs.length, variants: 0, ratio: 1, missing: [] };

  const products = await payload.find({
    collection: "products",
    where: { or: [{ primaryCategory: { equals: catId } }, { crossListedIn: { in: [catId] } }] },
    limit: 500, depth: 0, overrideAccess: true,
  });
  if (!products.docs.length) return { required: defs.length, variants: 0, ratio: 1, missing: [] };

  const variants = await payload.find({
    collection: "variants",
    where: { product: { in: products.docs.map((p) => p.id) } },
    limit: 1000, depth: 0, overrideAccess: true,
  });

  const missing: Completeness["missing"] = [];
  let filled = 0;

  for (const v of variants.docs) {
    const held = new Set(
      ((v.attributes ?? []) as { definition?: unknown }[])
        .map((a) => String(typeof a.definition === "object" ? (a.definition as { id: unknown })?.id : a.definition)),
    );
    const gaps = defs.filter((d) => !held.has(String(d.id)));
    filled += defs.length - gaps.length;
    if (gaps.length) missing.push({ sku: String(v.sku), id: v.id, keys: gaps.map((g) => g.key) });
  }

  const cells = defs.length * variants.docs.length;
  return {
    required: defs.length,
    variants: variants.docs.length,
    ratio: cells === 0 ? 1 : filled / cells,
    missing: missing.slice(0, 50),
  };
}
