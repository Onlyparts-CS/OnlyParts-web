import { CATEGORIES } from "./catalog";
import type { Category, GlyphKey } from "./types";

/* ============================================================
   Slugs — docs/02-TAXONOMY.md §1.5
   Display names may change; slugs are the stable, unique key.
   ============================================================ */
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, (m) => " " + m.replace(/[()]/g, "") + " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/* ============================================================
   Typed attribute schemas — docs/07-DATA-MODEL.md §2.4
   Defined per L3 leaf. This is what makes faceting possible:
   "M3" is a value of `thread`, never a category.
   ============================================================ */
export type AttrDef = {
  key: string;
  label: string;
  unit?: string;
  type: "enum" | "number";
  /**
   * chips keep engineering order (M2 before M10); checkbox is alphabetical;
   * `none` records the value and builds no facet from it — either because
   * almost every value is a singleton (`compatibility`), or because coverage is
   * too thin to filter on and a rail that hides 92% of a drawer's stock is
   * worse than no rail.
   */
  facet: "chips" | "checkbox" | "range" | "none";
  order?: (string | number)[];
};

const THREAD_ORDER = ["M1.6", "M2", "M2.5", "M3", "M4", "M5", "M6", "M8", "M10", "M12"];

/**
 * Declared on every L1 drawer and inherited by everything under it.
 *
 * `resolveAttributes` merges definitions root → leaf and lets the nearer one
 * win, so a leaf in `SCHEMAS` still upgrades `thread` to a curated chip facet;
 * these are the floor, not a competing declaration.
 *
 * They exist because the importer drops silently. `toSpecRows` emits a row
 * only where a definition with that key resolves for the category, so before
 * this, 86.6% of every typed spec the feed harvested — 676 materials, 285
 * diameters, all 72 compatibility declarations in a 3,800-row sample — was
 * parsed, validated, written to the CSV and then discarded on import with no
 * warning, because only seven leaves had ever declared an attribute.
 *
 * Every key here is a generic physical descriptor: a length is a length
 * whether it is on a bolt or a heat-shrink sleeve. Nothing leaf-specific
 * belongs in this list — that is what `SCHEMAS` is for.
 */
export const UNIVERSAL: AttrDef[] = [
  // The one that pairs a part with the parts that complete it. Free text,
  // pipe-separated, as the supplier declared it — never a facet, because
  // "Hakko 900M series soldering irons" is a filter with one member.
  { key: "compatibility", label: "Declared for", type: "enum", facet: "none" },

  { key: "material", label: "Material", type: "enum", facet: "checkbox" },
  { key: "finish", label: "Finish", type: "enum", facet: "checkbox" },
  { key: "coating", label: "Coating", type: "enum", facet: "none" },
  { key: "grade", label: "Grade", type: "enum", facet: "checkbox" },
  { key: "thread", label: "Thread", type: "enum", facet: "none" },

  { key: "length_mm", label: "Length", unit: "mm", type: "number", facet: "none" },
  { key: "dia_mm", label: "Diameter", unit: "mm", type: "number", facet: "none" },
  { key: "bore_id_mm", label: "Bore (ID)", unit: "mm", type: "number", facet: "none" },
  { key: "outer_od_mm", label: "Outer (OD)", unit: "mm", type: "number", facet: "none" },
  { key: "width_mm", label: "Width", unit: "mm", type: "number", facet: "none" },
  { key: "thickness_mm", label: "Thickness", unit: "mm", type: "number", facet: "none" },
  { key: "shaft_dia_mm", label: "Shaft diameter", unit: "mm", type: "number", facet: "none" },
];

export const SCHEMAS: Record<string, AttrDef[]> = {
  "socket-head-cap": [
    { key: "thread", label: "Thread", type: "enum", facet: "chips", order: THREAD_ORDER },
    { key: "length_mm", label: "Length", unit: "mm", type: "number", facet: "range" },
    { key: "material", label: "Material", type: "enum", facet: "checkbox" },
    { key: "finish", label: "Finish", type: "enum", facet: "checkbox" },
    { key: "standard", label: "Standard", type: "enum", facet: "checkbox" },
  ],
  "button-head": [
    { key: "thread", label: "Thread", type: "enum", facet: "chips", order: THREAD_ORDER },
    { key: "length_mm", label: "Length", unit: "mm", type: "number", facet: "range" },
    { key: "material", label: "Material", type: "enum", facet: "checkbox" },
    { key: "finish", label: "Finish", type: "enum", facet: "checkbox" },
  ],
  "countersunk-csk": [
    { key: "thread", label: "Thread", type: "enum", facet: "chips", order: THREAD_ORDER },
    { key: "length_mm", label: "Length", unit: "mm", type: "number", facet: "range" },
    { key: "material", label: "Material", type: "enum", facet: "checkbox" },
    { key: "finish", label: "Finish", type: "enum", facet: "checkbox" },
  ],
  "pan-head": [
    { key: "thread", label: "Thread", type: "enum", facet: "chips", order: THREAD_ORDER },
    { key: "length_mm", label: "Length", unit: "mm", type: "number", facet: "range" },
    { key: "material", label: "Material", type: "enum", facet: "checkbox" },
    { key: "drive_type", label: "Drive", type: "enum", facet: "checkbox" },
  ],
  "deep-groove": [
    { key: "bore_id_mm", label: "Bore (ID)", unit: "mm", type: "number", facet: "range" },
    { key: "outer_od_mm", label: "Outer (OD)", unit: "mm", type: "number", facet: "range" },
    { key: "width_mm", label: "Width", unit: "mm", type: "number", facet: "range" },
    { key: "seal_type", label: "Seal", type: "enum", facet: "checkbox" },
    { key: "material", label: "Material", type: "enum", facet: "checkbox" },
  ],
  disc: [
    { key: "grade", label: "Grade", type: "enum", facet: "chips", order: ["N35", "N38", "N42", "N45", "N50", "N52"] },
    { key: "dia_mm", label: "Diameter", unit: "mm", type: "number", facet: "range" },
    { key: "thickness_mm", label: "Thickness", unit: "mm", type: "number", facet: "range" },
    { key: "coating", label: "Coating", type: "enum", facet: "checkbox" },
  ],
  "nema-17": [
    { key: "torque_ncm", label: "Holding torque", unit: "Ncm", type: "number", facet: "range" },
    { key: "body_length_mm", label: "Body length", unit: "mm", type: "number", facet: "range" },
    { key: "step_angle", label: "Step angle", unit: "°", type: "enum", facet: "checkbox" },
    { key: "shaft_dia_mm", label: "Shaft", unit: "mm", type: "enum", facet: "checkbox" },
  ],
};

/** Facets shared by every leaf, appended after the category-specific ones. */
export const COMMON_FACETS: AttrDef[] = [
  { key: "availability", label: "Availability", type: "enum", facet: "checkbox" },
  { key: "price", label: "Price", unit: "₹", type: "number", facet: "range" },
];

/* ============================================================
   Tree resolution
   ============================================================ */
export type Node = {
  level: 1 | 2 | 3;
  name: string;
  slug: string;
  path: string[];          // slugs, root → self
  count: number;
  glyph: GlyphKey;
  blurb?: string;
  children: Node[];
};

let cache: Node[] | null = null;

/** The full 3-level tree with slugs resolved. Built once. */
export function tree(): Node[] {
  if (cache) return cache;
  cache = CATEGORIES.map((c: Category) => {
    const l1Slug = c.slug;
    return {
      level: 1 as const,
      name: c.name,
      slug: l1Slug,
      path: [l1Slug],
      count: c.count,
      glyph: c.glyph,
      blurb: c.blurb,
      children: c.subs.map((s) => {
        const l2Slug = slugify(s.name);
        return {
          level: 2 as const,
          name: s.name,
          slug: l2Slug,
          path: [l1Slug, l2Slug],
          count: s.children.reduce((n, l) => n + l.count, 0),
          glyph: c.glyph,
          children: s.children.map((l) => {
            const l3Slug = slugify(l.name);
            return {
              level: 3 as const,
              name: l.name,
              slug: l3Slug,
              path: [l1Slug, l2Slug, l3Slug],
              count: l.count,
              glyph: c.glyph,
              children: [],
            };
          }),
        };
      }),
    };
  });
  return cache;
}

/** Resolve a URL path (`["fasteners","screws-by-head","socket-head-cap"]`). */
export function resolve(path: string[]): { node: Node; trail: Node[] } | null {
  const trail: Node[] = [];
  let level: Node[] = tree();
  let node: Node | null = null;
  for (const seg of path) {
    const hit = level.find((n) => n.slug === seg);
    if (!hit) return null;
    trail.push(hit);
    node = hit;
    level = hit.children;
  }
  return node ? { node, trail } : null;
}

/** Every valid path, for generateStaticParams and the sitemap. */
export function allPaths(): string[][] {
  const out: string[][] = [];
  for (const l1 of tree()) {
    out.push(l1.path);
    for (const l2 of l1.children) {
      out.push(l2.path);
      for (const l3 of l2.children) out.push(l3.path);
    }
  }
  return out;
}

/* ============================================================
   Schema resolution, with inference for cross-listed leaves
   ============================================================ */

/** Display metadata for attribute keys, shared across every category. */
const LABELS: Record<string, { label: string; unit?: string; chips?: boolean }> = {
  thread:         { label: "Thread", chips: true },
  length_mm:      { label: "Length", unit: "mm" },
  pitch_mm:       { label: "Pitch", unit: "mm" },
  head_dia_mm:    { label: "Head diameter", unit: "mm" },
  material:       { label: "Material" },
  finish:         { label: "Finish" },
  grade:          { label: "Grade", chips: true },
  drive_type:     { label: "Drive" },
  head_type:      { label: "Head" },
  standard:       { label: "Standard" },
  bore_id_mm:     { label: "Bore (ID)", unit: "mm" },
  outer_od_mm:    { label: "Outer (OD)", unit: "mm" },
  width_mm:       { label: "Width", unit: "mm" },
  seal_type:      { label: "Seal" },
  max_rpm:        { label: "Max speed", unit: "rpm" },
  dia_mm:         { label: "Diameter", unit: "mm" },
  thickness_mm:   { label: "Thickness", unit: "mm" },
  pull_force_kg:  { label: "Pull force", unit: "kg" },
  coating:        { label: "Coating" },
  max_temp_c:     { label: "Max temp", unit: "°C" },
  torque_ncm:     { label: "Holding torque", unit: "Ncm" },
  body_length_mm: { label: "Body length", unit: "mm" },
  shaft_dia_mm:   { label: "Shaft", unit: "mm" },
  step_angle:     { label: "Step angle", unit: "°" },
  voltage_v:      { label: "Voltage", unit: "V" },
  current_a:      { label: "Current", unit: "A" },
};

const CHIP_ORDER: Record<string, (string | number)[]> = {
  thread: THREAD_ORDER,
  grade: ["N35", "N38", "N42", "N45", "N50", "N52"],
};

type HasAttrs = { attrs: Record<string, string | number> };

/**
 * Derive a facet schema from the attributes actually present on a leaf's SKUs.
 *
 * Needed because a leaf can receive products by cross-listing — Drones › Drone
 * Screws is populated entirely by M2/M2.5/M3 fasteners — and those leaves have
 * no schema of their own. Without this the rail degrades to price + availability
 * on exactly the pages where cross-listing is meant to shine. In production this
 * is the same job the inherited `attribute_definitions` do (07-DATA-MODEL.md §2.4).
 */
export function inferSchema(skus: HasAttrs[], max = 6): AttrDef[] {
  if (!skus.length) return [];
  const present = new Map<string, number>();
  const distinct = new Map<string, Set<string>>();
  for (const s of skus) {
    for (const [k, v] of Object.entries(s.attrs)) {
      if (v === undefined || v === null) continue;
      present.set(k, (present.get(k) ?? 0) + 1);
      if (!distinct.has(k)) distinct.set(k, new Set());
      distinct.get(k)!.add(String(v));
    }
  }
  // Derived attributes: real spec-table content, but useless as filters because
  // they're fully determined by another attribute (pitch and head dia follow
  // from thread). Nobody filters by pitch; they filter by thread.
  const DERIVED = new Set(["pitch_mm", "head_dia_mm", "max_rpm", "pull_force_kg"]);

  return [...present]
    .filter(([k, n]) => LABELS[k] && !DERIVED.has(k) && n / skus.length >= 0.6 && (distinct.get(k)?.size ?? 0) > 1)
    .sort((a, b) => (distinct.get(b[0])!.size > 1 ? 0 : 1) - 0 || b[1] - a[1])
    .slice(0, max)
    .map(([key]) => {
      const meta = LABELS[key];
      const numeric = skus.every((s) => s.attrs[key] === undefined || typeof s.attrs[key] === "number");
      const manyValues = (distinct.get(key)?.size ?? 0) > 12;
      return {
        key,
        label: meta.label,
        unit: meta.unit,
        type: numeric && manyValues ? "number" : "enum",
        facet: numeric && manyValues ? "range" : meta.chips ? "chips" : "checkbox",
        order: CHIP_ORDER[key],
      } as AttrDef;
    });
}

/** A leaf's own schema, falling back to inference for cross-listed leaves. */
export function schemaFor(node: Node, skus: HasAttrs[] = []): AttrDef[] {
  const own = SCHEMAS[node.slug];
  return own?.length ? own : inferSchema(skus);
}
