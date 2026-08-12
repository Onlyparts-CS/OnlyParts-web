import { allSkus, type Sku } from "./skus";
import { resolve, type Node } from "./taxonomy";
import { PROJECTS } from "./catalog";
import type { GlyphKey } from "./types";

/* ============================================================
   Variant axes — docs/04-WIREFRAMES.md §5
   A product is the merchandising unit; a variant is what you buy.
   These are the attributes that vary *within* one product family.
   ============================================================ */
export const VARIANT_AXES: Record<string, string[]> = {
  "socket-head-cap": ["thread", "length_mm", "material"],
  "button-head":     ["thread", "length_mm", "material"],
  "countersunk-csk": ["thread", "length_mm", "material"],
  "pan-head":        ["thread", "length_mm", "material"],
  "deep-groove":     ["bearing_code", "seal_type", "material"],
  disc:              ["grade", "dia_mm", "thickness_mm"],
  "nema-17":         ["body_length_mm", "shaft_dia_mm"],
};

const AXIS_LABELS: Record<string, { label: string; unit?: string }> = {
  thread: { label: "Thread" },
  length_mm: { label: "Length", unit: "mm" },
  material: { label: "Material" },
  bearing_code: { label: "Bearing code" },
  seal_type: { label: "Seal" },
  grade: { label: "Grade" },
  dia_mm: { label: "Diameter", unit: "mm" },
  thickness_mm: { label: "Thickness", unit: "mm" },
  body_length_mm: { label: "Body length", unit: "mm" },
  shaft_dia_mm: { label: "Shaft", unit: "mm" },
};

const THREAD_ORDER = ["M1.6", "M2", "M2.5", "M3", "M4", "M5", "M6", "M8", "M10", "M12"];

/* ============================================================
   Spec table grouping — docs/03-DESIGN-SYSTEM.md §5.6
   ============================================================ */
export const SPEC_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Dimensions", keys: ["thread", "pitch_mm", "length_mm", "head_dia_mm", "bore_id_mm", "outer_od_mm", "width_mm", "dia_mm", "thickness_mm", "body_length_mm", "shaft_dia_mm"] },
  { title: "Material & finish", keys: ["material", "finish", "grade", "coating"] },
  { title: "Mechanical & electrical", keys: ["drive_type", "head_type", "seal_type", "max_rpm", "pull_force_kg", "max_temp_c", "torque_ncm", "step_angle", "voltage_v", "current_a", "phases", "shape"] },
  { title: "Standards", keys: ["standard", "precision_class", "nema_size"] },
];

export const SPEC_LABELS: Record<string, { label: string; unit?: string }> = {
  thread: { label: "Thread" },
  pitch_mm: { label: "Pitch", unit: "mm" },
  length_mm: { label: "Length", unit: "mm" },
  head_dia_mm: { label: "Head diameter", unit: "mm" },
  bore_id_mm: { label: "Bore (ID)", unit: "mm" },
  outer_od_mm: { label: "Outer (OD)", unit: "mm" },
  width_mm: { label: "Width", unit: "mm" },
  dia_mm: { label: "Diameter", unit: "mm" },
  thickness_mm: { label: "Thickness", unit: "mm" },
  body_length_mm: { label: "Body length", unit: "mm" },
  shaft_dia_mm: { label: "Shaft diameter", unit: "mm" },
  material: { label: "Material" },
  finish: { label: "Finish" },
  grade: { label: "Grade" },
  coating: { label: "Coating" },
  drive_type: { label: "Drive" },
  head_type: { label: "Head type" },
  seal_type: { label: "Seal" },
  max_rpm: { label: "Max speed", unit: "rpm" },
  precision_class: { label: "Precision class" },
  pull_force_kg: { label: "Pull force", unit: "kg" },
  max_temp_c: { label: "Max operating temp", unit: "°C" },
  torque_ncm: { label: "Holding torque", unit: "Ncm" },
  step_angle: { label: "Step angle", unit: "°" },
  voltage_v: { label: "Rated voltage", unit: "V" },
  current_a: { label: "Rated current", unit: "A" },
  phases: { label: "Phases" },
  shape: { label: "Shape" },
  standard: { label: "Standard" },
  nema_size: { label: "Frame size", unit: "NEMA" },
  bearing_code: { label: "Bearing code" },
};

/** GST HSN codes by top-level category — required on every invoice. */
const HSN: Record<string, { code: string; rate: number }> = {
  fasteners:               { code: "73181500", rate: 18 },
  bearings:                { code: "84821011", rate: 18 },
  magnets:                 { code: "85051190", rate: 18 },
  motors:                  { code: "85013119", rate: 18 },
  "electronic-components": { code: "85411000", rate: 18 },
  "batteries-power":       { code: "85065000", rate: 18 },
  "3d-printers":          { code: "84779000", rate: 18 },
  "3d-printing":          { code: "84771000", rate: 18 },
  "drones-parts":          { code: "88062400", rate: 18 },
  tools:                   { code: "82055900", rate: 18 },
  "cnc-machines-parts":    { code: "84592900", rate: 18 },
  "industrial-electricals":{ code: "85363000", rate: 18 },
  "ev-parts":              { code: "87089900", rate: 18 },
  hardware:                { code: "76041000", rate: 18 },
};

export const hsnFor = (sku: Sku) => HSN[sku.categories[0][0]] ?? { code: "—", rate: 18 };

/* ============================================================
   Lookups
   ============================================================ */
/** By URL slug — used by the product route. */
export const findSku = (slug: string): Sku | undefined =>
  allSkus().find((s) => s.slug === slug);

/**
 * By SKU code — used by the cart, BOM import and reorder.
 *
 * These are deliberately separate lookups: the slug is a URL concern and can be
 * changed with a redirect, while the SKU is the business identifier a customer
 * types, pastes and puts on a purchase order. Cart lines key on the SKU.
 */
export const findBySku = (sku: string): Sku | undefined => {
  const needle = sku.trim().toUpperCase();
  return allSkus().find((s) => s.sku.toUpperCase() === needle);
};

export type AxisOption = {
  value: string;
  label: string;
  /** a variant exists for this value given the other axes' current selections */
  available: boolean;
  /** the variant to navigate to, if one exists */
  slug?: string;
  /** why it isn't available, when it isn't */
  reason?: string;
};

export type Axis = { key: string; label: string; unit?: string; options: AxisOption[] };

/**
 * Build the variant matrix.
 *
 * Rule from the wireframes: dim, don't hide. A buyer who can't see that M3×10
 * exists in 12.9 alloy assumes we don't sell it. Showing it greyed with a
 * reason is the difference between "unavailable" and "invisible".
 */
export function buildMatrix(current: Sku, pool: Sku[]): { axes: Axis[]; family: Sku[] } {
  const leaf = current.categories[0].at(-1)!;
  const keys = VARIANT_AXES[leaf];
  const family = pool.filter((s) =>
    // same family = same non-axis identity (e.g. same head type)
    s.categories[0].join("/") === current.categories[0].join("/")
  );
  if (!keys) return { axes: [], family };

  const axes: Axis[] = keys.map((key) => {
    const values = [...new Set(family.map((s) => String(s.attrs[key])))];
    values.sort(byEngineeringOrder(key));

    const options: AxisOption[] = values.map((value) => {
      // hold the other axes fixed, vary this one — that's what the buyer means
      const target = family.find((s) =>
        String(s.attrs[key]) === value &&
        keys.every((k) => k === key || String(s.attrs[k]) === String(current.attrs[k]))
      );
      if (target) {
        return { value, label: fmtAxis(key, value), available: true, slug: target.slug };
      }
      // exists somewhere in the family, just not with this combination
      const anywhere = family.find((s) => String(s.attrs[key]) === value);
      return {
        value,
        label: fmtAxis(key, value),
        available: false,
        reason: anywhere
          ? "Not made in this combination — available on request, 7–10 days"
          : "Not stocked",
      };
    });

    const meta = AXIS_LABELS[key] ?? { label: key };
    return { key, label: meta.label, unit: meta.unit, options };
  });

  return { axes, family };
}

const fmtAxis = (key: string, value: string) => {
  const unit = AXIS_LABELS[key]?.unit;
  return unit ? `${value} ${unit}` : value;
};

function byEngineeringOrder(key: string) {
  return (a: string, b: string) => {
    if (key === "thread") return THREAD_ORDER.indexOf(a) - THREAD_ORDER.indexOf(b);
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  };
}

/** Resolve the price-break tier that applies at a given quantity. */
export const tierFor = (sku: Sku, qty: number) =>
  [...sku.breaks].reverse().find((b) => qty >= b.qty) ?? sku.breaks[0];

/** Every category this SKU is listed in, resolved to nodes. Primary first. */
export function listings(sku: Sku): { trail: Node[]; primary: boolean }[] {
  return sku.categories
    .map((path, i) => {
      const hit = resolve(path);
      return hit ? { trail: hit.trail, primary: i === 0 } : null;
    })
    .filter((x): x is { trail: Node[]; primary: boolean } => x !== null);
}

/**
 * Substitutes — FR-25, the DigiKey pattern. When a part is out of stock the
 * buyer's question is "what else fits?", and the attribute schema can answer it:
 * same dimensions, different material or finish.
 */
export function substitutes(sku: Sku, pool: Sku[], limit = 4): Sku[] {
  const leaf = sku.categories[0].at(-1)!;
  const keys = VARIANT_AXES[leaf] ?? [];
  const dimensional = keys.filter((k) => k !== "material" && k !== "finish" && k !== "coating");
  return pool
    .filter((s) => s.sku !== sku.sku && s.stock > 0)
    .filter((s) => dimensional.every((k) => String(s.attrs[k]) === String(sku.attrs[k])))
    .sort((a, b) => b.stock - a.stock)
    .slice(0, limit);
}

/** "Frequently bought with" — hand-plausible pairings across the tree. */
export function boughtWith(sku: Sku, pool: Sku[], limit = 4): Sku[] {
  const leaf = sku.categories[0].at(-1)!;
  const all = pool;
  const thread = sku.attrs.thread;

  if (["socket-head-cap", "button-head", "countersunk-csk", "pan-head"].includes(leaf)) {
    // same thread in other head styles, plus a bearing that fits nothing — no:
    // keep it honest, pair with the same thread in other heads and lengths
    return all
      .filter((s) => s.sku !== sku.sku && s.stock > 0 && s.attrs.thread === thread)
      .filter((s) => s.categories[0].at(-1) !== leaf || s.attrs.length_mm !== sku.attrs.length_mm)
      .slice(0, limit);
  }
  if (leaf === "deep-groove") {
    return all
      .filter((s) => s.categories[0].at(-1) === "deep-groove" && s.sku !== sku.sku && s.stock > 0)
      .filter((s) => Number(s.attrs.bore_id_mm) === Number(sku.attrs.bore_id_mm))
      .slice(0, limit);
  }
  return all.filter((s) => s.sku !== sku.sku && s.stock > 0 && s.categories[0][0] === sku.categories[0][0]).slice(0, limit);
}

/**
 * Project collections this SKU has been curated into.
 *
 * This used to derive membership from L1 category overlap, which meant every
 * fastener in the catalogue advertised "Build a Drone" and "Build a Repair
 * Bench" — a drone contains fasteners, therefore an M2.5 pan-head screw is a
 * drone part. That is a claim on a product page, and it was not true.
 *
 * Membership is now an explicit per-SKU field (`Sku.projects`), set on upload
 * via the CSV importer or the admin. Unknown slugs are dropped rather than
 * rendered, so a typo in a spreadsheet cannot invent a collection.
 */
export function projectsFor(sku: Sku): { name: string; slug: string; glyph: GlyphKey }[] {
  if (!sku.projects?.length) return [];
  const bySlug = new Map(PROJECTS.map((p) => [p.slug, p]));
  return sku.projects
    .map((slug) => bySlug.get(slug))
    .filter((p): p is (typeof PROJECTS)[number] => Boolean(p))
    .map((p) => ({ slug: p.slug, name: p.name, glyph: p.glyph }));
}

