/**
 * The dimensioned drawing, derived from the attributes we already hold.
 *
 * The gallery has always had a `drawing` slot and it has always screened the
 * same halftone plate as the other three — a silhouette where a buyer expected
 * numbers. This builds the numbers.
 *
 * **Every value on the drawing comes from this product's own attribute row.**
 * Nothing is inferred, defaulted or rounded into existence: an attribute we do
 * not hold produces no dimension line, and a drawing with one dimension is
 * correct where a drawing with three invented ones is a specification we would
 * be publishing on our own authority. This is the same rule the country-of-
 * origin field follows, for the same reason — an omission is a gap, a wrong
 * figure is a misdeclaration, and a buyer machines to the figure.
 *
 * Why this rather than a photograph: it is entirely our own work, so it lands
 * in `media.licence = owned` with nobody to ask, and for a fastener or a
 * bearing it is the more useful picture anyway. Nobody buys an M8 × 60 because
 * of how it photographs.
 */

/** Suffix → unit. The importer's keys carry their unit in the name. */
const UNITS: [RegExp, string][] = [
  [/_mm$/, "mm"],
  [/_mah$/, "mAh"],
  [/_v$/, "V"],
  [/_a$/, "A"],
  [/_w$/, "W"],
  [/_g$/, "g"],
  [/_nm$/, "N·m"],
  [/_rpm$/, "rpm"],
  [/_deg$/, "°"],
];

const unitFor = (key: string) => UNITS.find(([re]) => re.test(key))?.[1] ?? "";

/** `bore_id_mm` → `BORE ID`. The unit lives with the value, not the label. */
export function labelFor(key: string): string {
  return key
    .replace(/_(mm|mah|v|a|w|g|nm|rpm|deg)$/, "")
    .replace(/_/g, " ")
    .toUpperCase();
}

/** `10` + `length_mm` → `10 mm`. Non-numeric values pass through untouched. */
export function valueFor(key: string, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  const unit = unitFor(key);
  if (typeof raw === "number") {
    // 8.0 reads as a tolerance claim we cannot support; 8 does not.
    const n = Number.isInteger(raw) ? String(raw) : String(Number(raw.toFixed(3)));
    return unit ? `${n} ${unit}` : n;
  }
  const s = String(raw).trim();
  if (!s) return "";
  // A numeric string in a `_mm` key still deserves its unit — the importer
  // writes both shapes depending on whether the definition was typed yet.
  if (unit && /^-?\d+(\.\d+)?$/.test(s)) return `${s} ${unit}`;
  return s;
}

export type SpecDrawingModel = {
  /**
   * Along the part, as a bare figure — no unit.
   *
   * Drafting convention, and it earns its place here: `⌀26 mm` rotated into a
   * 52-unit vertical span overran its own dimension line. A drawing declares
   * its units once, in the footer, and every callout is then a number.
   */
  along: string | null;
  /** Across the part, diameters prefixed ⌀, likewise unitless. */
  across: string | null;
  /** The unit every callout is in, stated once on the sheet. */
  unit: "mm";
  /** Everything we know, for the title block. */
  rows: { label: string; value: string }[];
  /** True when there is nothing to draw and the caller should keep the plate. */
  empty: boolean;
};

const num = (attrs: Record<string, unknown>, k: string): number | undefined => {
  const v = attrs[k];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return undefined;
};

/*
  Keys that are already spoken by the dimension lines. Repeating them in the
  title block would put the same number on the sheet twice, which on a real
  drawing is how the two copies end up disagreeing after an edit.
*/
const DIMENSION_KEYS = new Set(["length_mm", "body_length_mm", "outer_od_mm", "dia_mm"]);

/** Noise on a drawing: merchandising, not specification. */
const NOT_A_SPEC = new Set(["colour", "color", "brand", "series", "pack", "pack_qty"]);

export function specDrawing(attrs: Record<string, unknown>): SpecDrawingModel {
  const length = num(attrs, "length_mm") ?? num(attrs, "body_length_mm");
  const across = num(attrs, "outer_od_mm") ?? num(attrs, "dia_mm");

  const rows = Object.entries(attrs)
    .filter(([k, v]) => {
      if (DIMENSION_KEYS.has(k) || NOT_A_SPEC.has(k)) return false;
      return valueFor(k, v) !== "";
    })
    // Stable order, so the same product draws the same sheet on every render
    // and a diff of two variants lines up row for row.
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ label: labelFor(k), value: valueFor(k, v) }));

  const figure = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3))));

  return {
    along: length !== undefined ? figure(length) : null,
    across: across !== undefined ? `⌀${figure(across)}` : null,
    unit: "mm",
    rows,
    // A sheet with no dimension and no spec row says nothing the plate did not
    // already say, so the caller keeps the plate rather than showing an empty
    // frame that looks like a failed load.
    empty: length === undefined && across === undefined && rows.length === 0,
  };
}
