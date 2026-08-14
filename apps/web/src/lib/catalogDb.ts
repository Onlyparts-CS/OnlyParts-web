import "server-only";
import { cache } from "react";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Sku, PriceBreak } from "./skus";
import type { GlyphKey } from "./types";
import { CATEGORIES } from "./catalog";
import { imageUrl } from "./import";

/**
 * The catalogue, read from Postgres.
 *
 * `skus.ts` says of its own generated data: "swapping this for a Postgres query
 * later changes the source, not the shape." This is that swap. Every function
 * here returns the same `Sku` shape the storefront already consumes, so the
 * product card, the facet rail, the spec table and the variant matrix are
 * untouched — only where the rows come from changes.
 *
 * Two things this file deliberately does **not** do:
 *
 * - **It is not synchronous.** `skus.ts` could be, because it computed rows in
 *   memory. A database cannot, so every caller becomes a server component or
 *   asks through a server action. `import "server-only"` makes that a build
 *   error rather than a runtime surprise — a client component that imports this
 *   would otherwise ship the Payload config to the browser.
 * - **It does not cache across requests.** `unstable_cache` around a 1,200-row
 *   read looks like a win until stock is wrong on the page for sixty seconds.
 *   Availability is the one number this catalogue must not lie about.
 *
 * It *does* memoise **within** one request, through React's `cache()`. That is a
 * different thing and it costs nothing in freshness: two calls in the same
 * render return the same rows because they were read at the same instant
 * anyway, and the next request reads again. Without it a product page paid for
 * the catalogue three times over — once in `generateMetadata`, once in the page
 * body, and once more for the drawer it sits in.
 */

type VariantRow = {
  id: string | number;
  sku: string;
  titleSuffix?: string | null;
  basePrice: number;
  weightG?: number | null;
  isActive?: boolean | null;
  product?: unknown;
  priceTiers?: { minQty: number; unitPrice: number }[] | null;
  attributes?: {
    definition?: unknown;
    valueText?: string | null;
    valueNumber?: number | null;
    valueBool?: boolean | null;
  }[] | null;
};

/**
 * Which drawn plate a part is rendered with, taken from the drawer it lives in.
 *
 * Derived from `CATEGORIES` rather than restated here — a second copy of this
 * mapping is a second thing to forget when a drawer is added, and the drawer
 * already declares its own glyph for the cabinet on the home page.
 */
const GLYPH_BY_DRAWER: Record<string, GlyphKey> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.glyph]),
);

/**
 * A drawer is too coarse to draw with.
 *
 * `motors` covers steppers, drivers, couplers and brackets, and keying the
 * plate off the drawer alone gave all four the same rotor — a "Works with this
 * part" shelf where the driver, the coupler and the mounting bracket were
 * seven copies of one picture. The leaf is what the eye is actually being
 * asked to tell apart.
 *
 * Keyword rules rather than a table of 566 leaves: the taxonomy grows, and a
 * map keyed by leaf slug is a map somebody has to remember to extend. A leaf
 * that matches nothing falls back to its drawer, which is the old behaviour.
 */
const GLYPH_BY_LEAF: [RegExp, GlyphKey][] = [
  [/driver|controller|board|module|shield|sensor|relay|ic$|mcu|logic|display|converter/, "chip"],
  [/coupler|pulley|gear|bearing-|spindle|rotor|servo|motor$/, "rotor"],
  [/bracket|mount|extrusion|rail|profile|plate|frame|chassis|standoff/, "extrusion"],
  [/batter|cell|lipo|li-ion|18650|power-bank|charger/, "cell"],
  [/smps|psu|power-suppl|transformer|regulator/, "chip"],
  [/nozzle|hotend|extruder|filament|heatbed|bowden/, "nozzle"],
  [/prop|blade|rotor-arm|esc|flight/, "prop"],
  [/magnet/, "magnet"],
  [/screw|bolt|nut|washer|rivet|anchor|insert/, "hex"],
  [/bearing/, "bearing"],
  [/wrench|plier|spanner|driver-set|tool|cutter|file$|clamp/, "wrench"],
];

const glyphFor = (path: string[]): GlyphKey => {
  const leaf = path.at(-1) ?? "";
  return GLYPH_BY_LEAF.find(([re]) => re.test(leaf))?.[1]
    ?? GLYPH_BY_DRAWER[path[0]]
    ?? "hex";
};

const payloadOnce = () => getPayload({ config });

/* ------------------------------------------------------------------ */

type Ctx = {
  /** category id → dotted path, e.g. 'fasteners.screws-by-head.pan-head' */
  pathById: Map<string, string>;
  /** attribute definition id → its key, e.g. 'length_mm' */
  keyByDef: Map<string, string>;
  /** variant id → sellable units across all warehouses */
  stockByVariant: Map<string, number>;
  /** product id → the build slugs that list it, e.g. ['drone', '3d-printer'] */
  buildsByProduct: Map<string, string[]>;
  /** product id → every uploaded image with its role, gallery order preserved */
  mediaByProduct: Map<string, { role: string; url: string; alt: string }[]>;
};

/**
 * The three lookups every row needs, fetched once instead of per row.
 *
 * Resolving these with Payload's `depth` would issue a join per variant —
 * 1,200 variants became 3,600 queries in the naive version. These are three
 * reads regardless of catalogue size.
 */
const context = cache(async (): Promise<Ctx> => {
  const payload = await payloadOnce();

  const [cats, defs, levels, builds, products] = await Promise.all([
    payload.find({ collection: "categories", limit: 2000, depth: 0, overrideAccess: true }),
    payload.find({ collection: "attribute-definitions", limit: 1000, depth: 0, overrideAccess: true }),
    payload.find({ collection: "inventory", limit: 5000, depth: 0, overrideAccess: true }),
    payload.find({ collection: "builds", limit: 200, depth: 0, overrideAccess: true }),
    /*
      Products at depth 1, purely for the media join — but only the ones that
      actually have media.

      Going to depth 2 on the variants query to reach `media.image` would
      populate the whole product graph once per variant, so a separate read is
      the cheaper shape. Reading *every* product, however, was paying for the
      whole catalogue hydrated at depth 1 on every request in order to build a
      map that is empty: uploaded media is currently 0 rows, and even when it
      fills it will cover a handful of products, not 3,807.

      Measured on the 3,807-row catalogue: 519 ms and several hundred MB of
      short-lived objects per request. In production that was most of a 1.2 s
      page; in `next dev` it grew the heap to 3.5 GB and the page took 38 s,
      almost all of it garbage collection.
    */
    payload.find({
      collection: "products",
      where: { "media.image": { exists: true } },
      limit: 5000, depth: 1, overrideAccess: true,
    }),
  ]);

  const stockByVariant = new Map<string, number>();
  for (const l of levels.docs) {
    const vid = String(typeof l.variant === "object" ? (l.variant as { id: unknown })?.id : l.variant);
    // What a buyer may actually have, not what is on the shelf.
    const sellable = (l.onHand ?? 0) - (l.allocated ?? 0) - (l.reserved ?? 0);
    stockByVariant.set(vid, (stockByVariant.get(vid) ?? 0) + Math.max(0, sellable));
  }

  /*
    Built by walking the builds, not the products.

    `toSku` used to read `product.projects`, and there is no such field — the
    relationship lives on `builds.items`, pointing the other way. So every
    product carried an empty `projects` array and the "Used in these projects"
    block on every PDP has been silently blank since the field was renamed.
    Inverting the list here is one query for the whole catalogue.
  */
  const buildsByProduct = new Map<string, string[]>();
  for (const b of builds.docs) {
    for (const item of b.items ?? []) {
      const pid = String(typeof item.product === "object" && item.product ? item.product.id : item.product);
      buildsByProduct.set(pid, [...(buildsByProduct.get(pid) ?? []), b.slug]);
    }
  }

  /*
    One photograph per product: whichever entry is marked `hero`, else the
    first. Everything else in `media` — scale shots, drawings, datasheet pages —
    belongs to the product page's gallery, not to a 96px tile.
  */
  const mediaByProduct = new Map<string, { role: string; url: string; alt: string }[]>();
  for (const p of products.docs) {
    const entries = ((p.media ?? []) as { image: unknown; role?: string | null }[]).flatMap((m) => {
      const img = m.image;
      if (typeof img !== "object" || !img) return [];
      const doc = img as { url?: string | null; alt?: string | null };
      return doc.url ? [{ role: m.role ?? "gallery", url: doc.url, alt: doc.alt ?? "" }] : [];
    });
    if (entries.length) mediaByProduct.set(String(p.id), entries);
  }

  return {
    pathById: new Map(cats.docs.map((c) => [String(c.id), String(c.path ?? "")])),
    keyByDef: new Map(defs.docs.map((d) => [String(d.id), String(d.key)])),
    stockByVariant,
    buildsByProduct,
    mediaByProduct,
  };
});

/** One `variants` row, plus its product, rendered as the storefront's `Sku`. */
/*
  `product` is `Record<string, unknown>`, so a Rule 6(1) field read off it is
  `unknown` and an empty string is falsy but still a string. Both of these
  collapse "we hold no declaration" and "we hold a blank one" to `undefined`,
  which is what `SpecTable` tests to decide whether to print the row at all.
*/
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function toSku(v: VariantRow, ctx: Ctx): Sku | null {
  const product = typeof v.product === "object" && v.product ? (v.product as Record<string, unknown>) : null;
  if (!product) return null;

  const primary = product.primaryCategory;
  const primaryId = String(typeof primary === "object" && primary ? (primary as { id: unknown }).id : primary);
  const primaryPath = ctx.pathById.get(primaryId);
  if (!primaryPath) return null;

  const categories: string[][] = [primaryPath.split(".")];
  for (const x of (product.crossListedIn ?? []) as unknown[]) {
    const id = String(typeof x === "object" && x ? (x as { id: unknown }).id : x);
    const p = ctx.pathById.get(id);
    if (p && p !== primaryPath) categories.push(p.split("."));
  }

  const attrs: Record<string, string | number> = {};
  for (const a of v.attributes ?? []) {
    const defId = String(typeof a.definition === "object" && a.definition
      ? (a.definition as { id: unknown }).id
      : a.definition);
    const key = ctx.keyByDef.get(defId);
    if (!key) continue;
    if (a.valueNumber !== null && a.valueNumber !== undefined) attrs[key] = a.valueNumber;
    else if (a.valueBool !== null && a.valueBool !== undefined) attrs[key] = String(a.valueBool);
    else if (a.valueText) attrs[key] = a.valueText;
  }

  // qty 1 is the base price; the collection stores only genuine breaks above it.
  const breaks: PriceBreak[] = [
    { qty: 1, price: v.basePrice },
    ...(v.priceTiers ?? []).map((t) => ({ qty: t.minQty, price: t.unitPrice })),
  ].sort((a, b) => a.qty - b.qty);

  const title = [product.title, v.titleSuffix].filter(Boolean).join(" — ");

  // The hero is whichever entry says so, else the first. Everything else is
  // the gallery, and the PDP maps role onto its four named slots.
  const shots = ctx.mediaByProduct.get(String(product.id)) ?? [];
  const hero = shots.find((m) => m.role === "hero") ?? shots[0];
  const sourceImage = imageUrl(
    typeof product.sourceImageUrl === "string" ? product.sourceImageUrl : undefined,
  );

  return {
    sku: v.sku,
    slug: v.sku.toLowerCase(),
    title,
    productId: Number(product.id),
    /*
      An upload we own beats a hotlink beats the drawn plate.

      `media` is empty for every imported row and will be for a while, so
      without the middle term the whole catalogue renders as one of thirteen
      screened plates and a shelf of six complements looks like the same part
      six times.
    */
    image: hero
      ? { url: hero.url, alt: hero.alt }
      : sourceImage
        ? { url: sourceImage, alt: title }
        : undefined,
    images: shots.length ? shots : undefined,
    price: v.basePrice,
    breaks,
    stock: ctx.stockByVariant.get(String(v.id)) ?? 0,
    dispatchHours: 24,
    glyph: glyphFor(categories[0]),
    attrs,
    categories,
    projects: ctx.buildsByProduct.get(String(product.id)) ?? [],
    /*
      Rule 6(1) declarations, passed through exactly as stored and never
      defaulted. `SpecTable` omits any row that is absent — the thing it must
      not do is fill one in, which is what it used to do with a hardcoded
      "Country of origin: India" on every product in the catalogue.
    */
    legal: {
      countryOfOrigin: str(product.countryOfOrigin),
      mrp: num(product.mrp),
      netQuantity: str(product.netQuantity),
      importerName: str(product.importerName),
      importerAddress: str(product.importerAddress),
    },
    /*
      No reviews collection exists yet, so there is genuinely nothing to
      average. Zero is the honest value and the *renderers* are what must not
      print it — a part showing "0.0 (0)" reads as universally disliked rather
      than as new, and that is a worse lie than showing nothing at all.
    */
    rating: 0,
    ratingCount: 0,
    hasDatasheet: Boolean(product.datasheet),
  };
}

/* ------------------------------------------------------------------ */

/** Every sellable variant. Used by search and the admin table. */
export const dbAllSkus = cache(async (): Promise<Sku[]> => {
  const payload = await payloadOnce();
  const ctx = await context();

  const rows = await payload.find({
    collection: "variants",
    where: { isActive: { equals: true } },
    depth: 1,
    limit: 5000,
    sort: "sku",
    overrideAccess: true,
  });

  return rows.docs
    .map((v) => toSku(v as VariantRow, ctx))
    .filter((s): s is Sku => s !== null);
});

/**
 * Everything filed at or below a category path.
 *
 * Matched on the materialised path with a prefix, so `['fasteners']` returns
 * the whole drawer and `['fasteners','screws-by-head','pan-head']` returns one
 * shelf — the same containment rule `skusInPath` had, done in the query.
 */
export const dbSkusInPath = cache(async (path: string[]): Promise<Sku[]> => {
  if (!path.length) return dbAllSkus();
  const payload = await payloadOnce();
  const ctx = await context();
  const prefix = path.join(".");

  const ids = [...ctx.pathById.entries()]
    .filter(([, p]) => p === prefix || p.startsWith(`${prefix}.`))
    .map(([id]) => id);
  if (!ids.length) return [];

  const products = await payload.find({
    collection: "products",
    where: {
      and: [
        { status: { equals: "active" } },
        { or: [{ primaryCategory: { in: ids } }, { crossListedIn: { in: ids } }] },
      ],
    },
    limit: 1000, depth: 0, overrideAccess: true,
  });
  if (!products.docs.length) return [];

  const rows = await payload.find({
    collection: "variants",
    where: {
      and: [
        { isActive: { equals: true } },
        { product: { in: products.docs.map((p) => p.id) } },
      ],
    },
    depth: 1, limit: 5000, sort: "sku", overrideAccess: true,
  });

  return rows.docs
    .map((v) => toSku(v as VariantRow, ctx))
    .filter((s): s is Sku => s !== null);
});

/** One variant by its slug (the lowercased SKU) — the PDP's entry point. */
export const dbFindSku = cache(async (slug: string): Promise<Sku | null> => {
  const payload = await payloadOnce();
  const rows = await payload.find({
    collection: "variants",
    where: { sku: { equals: slug.toUpperCase() } },
    depth: 1, limit: 1, overrideAccess: true,
  });
  if (!rows.docs.length) return null;
  return toSku(rows.docs[0] as VariantRow, await context());
});

/**
 * Resolve a list of SKU codes in one read.
 *
 * The cart and the wishlist hold codes, not rows, and resolving them one at a
 * time is what turns a ten-line cart into ten round trips.
 */
export async function dbFindManySkus(codes: string[]): Promise<Sku[]> {
  const wanted = [...new Set(codes.map((c) => c.trim().toUpperCase()))].filter(Boolean);
  if (!wanted.length) return [];

  const payload = await payloadOnce();
  const ctx = await context();
  const rows = await payload.find({
    collection: "variants",
    where: { sku: { in: wanted } },
    depth: 1, limit: 500, overrideAccess: true,
  });

  return rows.docs
    .map((v) => toSku(v as VariantRow, ctx))
    .filter((s): s is Sku => s !== null);
}

/** True when the database has a catalogue worth reading. */
export const dbHasCatalogue = cache(async (): Promise<boolean> => {
  try {
    const payload = await payloadOnce();
    const r = await payload.find({ collection: "variants", limit: 0, depth: 0, overrideAccess: true });
    return r.totalDocs > 0;
  } catch {
    return false;
  }
});
