/**
 * Surface-mount chip package outlines, keyed by the EIA size code.
 *
 * The electronics half of `fastenerStd.ts`, and it earns its place the same
 * way: "0805" is not a description of a part, it is a *designation* whose
 * meaning is a published length and width. Reading 2.00 × 1.25 out of that code
 * is not inference any more than reading a head diameter out of ISO 4762 is —
 * deciding that a given listing is talking about an 0805 at all is the
 * inference, and that is where every refusal below lives.
 *
 * Why this family first: 23,536 of the 168,717 harvested titles carry one of
 * these eight codes — more than any other package, and more than the entire
 * mechanical catalogue put together. Eight rows of table reach all of them.
 */

export type ChipPart = {
  kind: "chip";
  /** The EIA imperial code as written: "0805". */
  code: string;
  /** Its metric equivalent: "2012". Printed because half the trade uses it. */
  metric: string;
  length: number;
  width: number;
  /**
   * `null` unless the listing stated it, which is the ordinary case.
   *
   * Height is deliberately absent from this table. The size code fixes length
   * and width and says nothing about thickness: an 0805 resistor is about
   * 0.45 mm, an 0805 MLCC runs from 0.6 mm to over 1.3 mm depending on
   * capacitance and voltage, and both are honestly called 0805. Printing a
   * height here would be the one figure on the sheet that came from nowhere.
   */
  height: number | null;
  standard: string;
};

/*
  EIA-198 / IPC-7351 nominal body sizes, in millimetres.

  The imperial code is hundredths of an inch, length then width — 0805 is
  0.08" × 0.05" — and the metric code is tenths of a millimetre the same way.
  The figures below are the metric designation, which is the exact one; the
  imperial name is a rounding of it and always has been.
*/
const SMD_CHIP: Record<string, { metric: string; length: number; width: number }> = {
  "0201": { metric: "0603", length: 0.6, width: 0.3 },
  "0402": { metric: "1005", length: 1.0, width: 0.5 },
  "0603": { metric: "1608", length: 1.6, width: 0.8 },
  "0805": { metric: "2012", length: 2.0, width: 1.25 },
  "1206": { metric: "3216", length: 3.2, width: 1.6 },
  "1210": { metric: "3225", length: 3.2, width: 2.5 },
  "2010": { metric: "5025", length: 5.0, width: 2.5 },
  "2512": { metric: "6332", length: 6.35, width: 3.2 },
};

/*
  A code alone proves nothing — "GW Instek PSP 2010 Bench Power Supply" is a
  model number, and 2,511 harvested titles carry a code in some other role. The
  listing has to say what the part *is*.
*/
const COMPONENT = /\b(resistor|capacitor|mlcc|inductor|ferrite|bead|led|fuse|thermistor|varistor|resistors|capacitors|inductors|leds)\b/i;
const SURFACE = /\b(smd|smt|surface[\s-]?mount|chip)\b/i;

/*
  Two of the eight codes need the listing to say "SMD" as well; six do not.

  There is no through-hole 0805, so "470 Ohm 1/4w 1206 Resistor" is a chip
  resistor whether or not the seller typed SMD — demanding the word refused
  1,084 rows that state their size perfectly clearly, which is a bug rather
  than strictness.

  But `2010` and `2512` are also readable as resistance codes (201 Ω and
  25.1 kΩ) and turn up inside part numbers like `2MR-2512`, whereas a code
  beginning `0` cannot be a resistance code at all and `1206`/`1210` would have
  to mean 120 MΩ and 121 Ω·10^10 to be one. So those two keep the second
  witness, and it costs 20 rows to hold the line there.
*/
const NEEDS_SURFACE_WITNESS = new Set(["2010", "2512"]);

/*
  Another package system named in the same title means the code is describing a
  land pattern, not the body — "1N4148W SOD-123 1206 Diode" is a SOD-123 part
  that happens to fit an 1206 footprint, and drawing it as a chip would be
  drawing the wrong object.
*/
const OTHER_PACKAGE =
  /\b(SOD-?\d+|SOT-?\d+|TO-?\d+|DIP-?\d*|PDIP|SOIC|SOP-?\d*|SSOP|TSSOP|MSOP|QFN|QFP|TQFP|LQFP|BGA|DO-?\d+|MELF|axial|radial|through[\s-]?hole)\b/i;

/*
  An assortment is many parts in one listing. Where every one shares a size the
  geometry would still be right, but the sheet would be describing a bag, and
  "30 Values ... Kit" is a listing whose subject is the range, not the part.
  Ten rows. Refusing is cheaper than being clever about it.
*/
const ASSORTMENT = /\b(kit|kits|assortment|assorted|sample book|\d+\s*values?)\b/i;

/** Codes cannot come out of the middle of a part number: `VJ0805Y105` is not an 0805 claim. */
const CODE = /(?<![\w.])(0201|0402|0603|0805|1206|1210|2010|2512)(?![\w.])/g;

/*
  "0201 [0603 Metric]" is one part named twice, and 0603 is *also* a valid
  imperial code — for a part 2.7× larger. 286 harvested titles are written this
  way, and reading the wrong half is the single worst error available here: a
  0.6 × 0.3 mm chip drawn as 1.6 × 0.8.

  So the metric annotation is lifted out and used the way `fastenerStd` uses a
  second length dialect — as agreement. Matching pair, and the reading is
  confirmed by two independent statements; mismatch, and the listing is
  contradicting itself and gets refused.
*/
const METRIC_NOTE = /\[?\s*(\d{4})\s*Metric\s*\]?/i;

/** A stated height is the listing's own figure and outranks silence. */
const HEIGHT = /\b(?:height|thickness|thk)\s*:?\s*(\d+(?:\.\d+)?)\s*mm\b/i;

/**
 * @param title        the listing title.
 * @param categoryPath the dotted materialised path, used only to contradict.
 */
export function chipPackage(title: string, categoryPath?: string): ChipPart | null {
  const t = (title ?? "").trim();
  if (!t) return null;
  if (ASSORTMENT.test(t)) return null;
  if (OTHER_PACKAGE.test(t)) return null;
  if (!COMPONENT.test(t)) return null;
  // A chip resistor filed under fasteners is a mis-filing, not a chip resistor.
  if (categoryPath && /^(fasteners|bearings|magnets|tools)\./.test(categoryPath)) return null;

  const note = t.match(METRIC_NOTE);
  const metricStated = note?.[1];
  // Scanned with the annotation removed, so its digits cannot be read as a code.
  const scanned = note ? t.replace(METRIC_NOTE, " ") : t;

  const codes = [...new Set([...scanned.matchAll(CODE)].map((m) => m[1]))];
  if (codes.length !== 1) return null;

  const code = codes[0];
  const dims = SMD_CHIP[code];
  if (!dims) return null;
  if (NEEDS_SURFACE_WITNESS.has(code) && !SURFACE.test(t)) return null;

  // Two statements of the same size, or none. Never two that disagree.
  if (metricStated && metricStated !== dims.metric) return null;

  const h = t.match(HEIGHT);
  const height = h ? Number(h[1]) : null;
  if (height !== null && (!Number.isFinite(height) || height <= 0)) return null;

  return {
    kind: "chip",
    code,
    metric: dims.metric,
    length: dims.length,
    width: dims.width,
    height,
    standard: "EIA-198",
  };
}
