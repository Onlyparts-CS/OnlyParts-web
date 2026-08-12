import type { Sku } from "../src/lib/skus";
import { VARIANT_AXES } from "../src/lib/product";

/**
 * Naming and weighing, factored out of the seed itself.
 *
 * Not merely tidiness: `seed-catalogue.ts` runs `await main()` at the top
 * level, so a script that imported a helper from it re-seeded the entire
 * database as a side effect of the import. A pure module can be tested without
 * wiping 1,172 rows to find out what a string would have been.
 */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Matches an axis value as a whole token, allowing the unit that usually
 * follows it. `\b20\b` does **not** match "20mm" — there is no word boundary
 * between "0" and "m" — which is why the stepper family was called "NEMA 17
 * Stepper Motor 1.8° 13Ncm body shaft": the numbers were stripped and the
 * words they described were left standing.
 */
const token = (v: string) => new RegExp(`(^|[^\\w.])${escape(v)}\\s?(mm\\b|\\b)`, "i");

/**
 * The family name — what the *product* is called, as opposed to the variant.
 *
 * `VARIANT_AXES` is the authority on what varies inside a family. For screws
 * that is thread × length × material, so "M3 × 10mm Hex Socket Head Cap Screw,
 * SS 304" is a **variant** and "Hex Socket Head Cap Screw" is the product.
 *
 * The seed used to write `` `${sku.title.split("—")[0]} Series` `` — the title
 * of whichever SKU happened to create the product first — which is how the
 * catalogue ended up with a product called "M2 × 4mm Hex Socket Head Cap Screw,
 * SS 304 Series" holding 272 variants, 271 of which are not that.
 */
export function familyTitle(sku: Sku, leafSlug: string, leafName: string): string {
  const axes = VARIANT_AXES[leafSlug];
  if (!axes) return sku.title;

  const values = axes.map((k) => String(sku.attrs[k] ?? "").trim()).filter(Boolean);

  // "623ZZ Deep Groove Ball Bearing — ID 3 · OD 10 · W 4" — everything after
  // the dash is dimensional marginalia belonging to one specific variant.
  let t = sku.title.split(" — ")[0];

  /*
    Removed by *clause*, not by value. A clause is the unit a human would
    delete: ", 20mm body" goes as a whole, rather than leaving "body" behind.
    The first clause always survives — it carries the noun.
  */
  t = t
    .split(",")
    .filter((clause, i) => i === 0 || !values.some((v) => token(v).test(clause)))
    .join(",");

  /*
    A leading part code absorbs its own axis values with no separator —
    `${b.code}${s.code}` renders "623ZZ", where "623" is the bearing_code axis
    and "ZZ" the seal. Word boundaries cannot see inside that, so a value at
    the very start is allowed to take a trailing alphanumeric suffix with it.
  */
  for (const v of values) {
    t = t.replace(new RegExp(`^${escape(v)}[A-Za-z0-9]*\\s+`), "");
  }

  // Whatever survives in the middle — "M3 × 10mm", "N35" — strip in place.
  for (const v of values) {
    t = t.replace(new RegExp(`\\s*[,×x·]?\\s*(^|[^\\w.])?${escape(v)}\\s?(mm\\b|\\b)`, "i"), " ");
  }

  t = t
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[,·×x-]\s*$/, "")
    .replace(/^[\s,·×x-]+/, "")
    .trim();

  // Anything left this short is surgery gone wrong, not a product name.
  return t.length >= 4 ? t : `${leafName} Series`;
}

/**
 * What distinguishes this variant inside its family — "M3 × 10mm × SS 304".
 *
 * Payload renders a variant as `product.title` + `titleSuffix`, so putting the
 * whole SKU title in the suffix printed "Hex Socket Head Cap Screw — M3 × 10mm
 * Hex Socket Head Cap Screw, SS 304". The suffix is the axes and nothing else.
 */
export function variantSuffix(sku: Sku, leafSlug: string): string {
  const axes = VARIANT_AXES[leafSlug];
  if (!axes) return "";
  return axes
    .map((k) => {
      const v = sku.attrs[k];
      if (v === undefined || v === "") return null;
      return k.endsWith("_mm") ? `${v}mm` : String(v);
    })
    .filter(Boolean)
    .join(" × ");
}

/**
 * A shipping weight that is at least the right order of magnitude.
 *
 * Every variant was seeded at a flat `weightG: 5`, which is roughly right for
 * an M3 screw and wrong by seventy times for a NEMA 17. Weight drives the
 * shipping charge, so a constant is not a harmless placeholder — it is a
 * courier bill nobody reconciled.
 *
 * Estimated from the part's own dimensions where it has them, and a per-drawer
 * default otherwise. Real weights arrive with supplier feeds; until then this
 * is honest about being approximate rather than uniformly wrong.
 */
const DRAWER_WEIGHT_G: Record<string, number> = {
  fasteners: 3, bearings: 30, magnets: 4, motors: 280,
  "electronic-components": 5, "batteries-power": 45, "3d-printers": 8000,
  "3d-printing": 1000, "drones-parts": 20, tools: 150,
  "cnc-machines-parts": 400, "industrial-electricals": 120,
  "ev-parts": 500, hardware: 25,
};

export function weightFor(sku: Sku, drawer: string): number {
  const a = sku.attrs;
  const num = (k: string) => Number(a[k]);

  // Steel screw ≈ π/4 · d² · L · 7.85 g/cm³, plus a head allowance.
  if (a.thread && a.length_mm) {
    const d = Number(String(a.thread).replace(/[^\d.]/g, ""));
    const l = num("length_mm");
    if (Number.isFinite(d) && Number.isFinite(l)) {
      return Math.max(1, Math.round((Math.PI / 4) * d * d * l * 0.00785 * 1.35));
    }
  }
  // Bearing ≈ annulus of steel.
  if (a.outer_od_mm && a.bore_id_mm && a.width_mm) {
    const od = num("outer_od_mm"), id = num("bore_id_mm"), w = num("width_mm");
    if ([od, id, w].every(Number.isFinite)) {
      return Math.max(1, Math.round((Math.PI / 4) * (od * od - id * id) * w * 0.00785 * 0.82));
    }
  }
  // Disc magnet ≈ cylinder of NdFeB, 7.5 g/cm³.
  if (a.dia_mm && a.thickness_mm) {
    const d = num("dia_mm"), t = num("thickness_mm");
    if (Number.isFinite(d) && Number.isFinite(t)) {
      return Math.max(1, Math.round((Math.PI / 4) * d * d * t * 0.0075));
    }
  }
  return DRAWER_WEIGHT_G[drawer] ?? 25;
}
