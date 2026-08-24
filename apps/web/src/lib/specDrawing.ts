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
 * **The one exception, added deliberately and fenced.** `fastenerStd.ts` reads
 * head diameter and head height for a recognised standard screw out of the
 * standard itself rather than out of this row. That is not the inference this
 * rule forbids: `dk` for an ISO 4762 M4 is not a measurement anyone takes, it
 * is what "ISO 4762 M4" *means*, and no supplier publishes it for exactly that
 * reason. The fence is that identifying the standard must be certain — see the
 * refusals in that file — and that the sheet names the standard beside the two
 * figures it supplied, so a reader can tell our reading from the maker's.
 *
 * Why this rather than a photograph: it is entirely our own work, so it lands
 * in `media.licence = owned` with nobody to ask, and for a fastener or a
 * bearing it is the more useful picture anyway. Nobody buys an M8 × 60 because
 * of how it photographs.
 */
import { fastener, type Fastener } from "./fastenerStd";
import { bearing, magnet, type BlockPart, type RoundPart } from "./partGeometry";
import { chipPackage, type ChipPart } from "./packageStd";

/**
 * A part whose geometry we can actually draw.
 *
 * Three producers, one union, because the sheet only ever asks two questions:
 * which views to draw, and whose figures they are. `standard` on the round and
 * block members and the fastener's own `standard` answer the second one.
 */
export type DrawnPart = Fastener | RoundPart | BlockPart | ChipPart;

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
  /**
   * A part whose real geometry the title stated unambiguously.
   *
   * Present means the sheet can draw a profile — a countersunk cone, a bearing
   * annulus, a block magnet — instead of the envelope rectangle, and can call
   * out three or four dimensions instead of two. Absent is the ordinary case
   * for most of the catalogue and changes nothing.
   *
   * Where the member carries a non-null `standard`, some of its figures came
   * out of a table rather than out of this listing — head dimensions for a
   * screw, boundary dimensions for a bearing given only by designation. That
   * is the one place this file's "nothing is inferred" rule is relaxed, and
   * only because for a standard part those figures *are* the part.
   * `SpecDrawing` prints the standard beside them so a reader can tell which
   * half is whose. A `standard` of `null` means every figure is the listing's.
   */
  part: DrawnPart | null;
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

/**
 * @param title        the listing title, when the caller has it. Read only by
 *                     `fastener()`, which refuses anything ambiguous.
 * @param categoryPath the dotted materialised path, used to *contradict* the
 *                     title rather than to supply anything.
 */
export function specDrawing(
  attrs: Record<string, unknown>,
  title?: string,
  categoryPath?: string,
): SpecDrawingModel {
  /*
    One recogniser per family, first match wins. They are mutually exclusive in
    practice — each vetoes on the category path — so the order is only a
    tie-break for a row filed nowhere, and `fastener()` is the strictest.
  */
  const part: DrawnPart | null = title
    ? (fastener(title, categoryPath) ??
       bearing(title, categoryPath) ??
       magnet(title, categoryPath) ??
       chipPackage(title, categoryPath))
    : null;
  const bolt = part?.kind === "fastener" ? part : null;
  const round = part?.kind === "round" ? part : null;

  /*
    A recognised fastener states its own length and thread better than the
    attribute row does — `thread` is populated on 4.9% of fastener rows and the
    title carries it on 69.6%. The attribute row still wins where it exists,
    because it is this SKU's own data and the title is a reading of it.
  */
  const chip = part?.kind === "chip" ? part : null;
  const length = num(attrs, "length_mm") ?? num(attrs, "body_length_mm") ?? bolt?.length ?? round?.width ?? chip?.length;
  const across = num(attrs, "outer_od_mm") ?? num(attrs, "dia_mm") ?? bolt?.threadDia ?? round?.od;

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
    part,
    // A sheet with no dimension and no spec row says nothing the plate did not
    // already say, so the caller keeps the plate rather than showing an empty
    // frame that looks like a failed load.
    empty: part === null && length === undefined && across === undefined && rows.length === 0,
  };
}
