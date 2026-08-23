/**
 * Bearings and magnets, recovered from a listing title.
 *
 * The sibling of `fastenerStd.ts`, and the same argument: the attribute row is
 * thin (`bore_id_mm` is populated on 46 of 2,050 onlyscrews rows, 2.2%) while
 * the title carries the whole geometry, because a bearing's designation *is*
 * its dimensions and a magnet is sold by its size.
 *
 * Two differences from the fastener file are worth stating, because they change
 * what the sheet may claim:
 *
 *   **Bearings** have a standard, so a designation with no stated dimensions
 *   can still be drawn — ISO 15 fixes 608 at 8 × 22 × 7 and there is nothing
 *   to infer. Those rows come back with `standard` set and the sheet prints it,
 *   exactly as the fastener sheet prints ISO 4762.
 *
 *   **Magnets** have no standard and need none: every drawable magnet in the
 *   harvest states its own diameter and thickness. They come back with
 *   `standard: null` and the sheet keeps the ordinary "AS LISTED" footer. No
 *   figure on a magnet drawing comes from anywhere but the listing.
 *
 * Both shapes collapse into two renderable forms — a round part (an outside
 * diameter, an optional bore, a width) and a block (three edges). A ring magnet
 * and a ball bearing are the same drawing with different numbers, and pretending
 * otherwise would have meant a third renderer for no gain.
 */

export type RoundPart = {
  kind: "round";
  /** What to call it on the sheet: a bearing designation, or a shape word. */
  label: string;
  od: number;
  /** `null` for a solid disc. */
  bore: number | null;
  width: number;
  /**
   * Set only when `od`/`bore`/`width` were read out of a table rather than off
   * the listing. `null` means every figure came from the title, and the sheet
   * then makes no claim beyond "as published".
   */
  standard: string | null;
};

export type BlockPart = {
  kind: "block";
  label: string;
  length: number;
  breadth: number;
  thickness: number;
  standard: null;
};

/*
  ISO 15 boundary dimensions: bore × outside diameter × width, in mm.

  Only the metric deep-groove series this catalogue actually stocks. The table
  is worth the space because a third of the bearing listings give a designation
  and no dimensions at all — "Radial Ball Bearing 608ZZ for 3D Printer" is the
  whole title — and 608 means 8 × 22 × 7 to everyone who sells them.

  Five rows in the harvest state both a designation and its dimensions, which
  makes them a free check on this table rather than a competing source:
  6001 (12×28×8), 6003 (17×35×10), 605 (5×14×5), 607 (7×19×6) and 604 (4×12×4)
  all agree with the entries below. `partGeometry.check.ts` pins those five.
*/
const ISO_15: Record<string, [number, number, number]> = {
  // 3-digit miniature, 60x / 62x / 63x
  "604": [4, 12, 4], "605": [5, 14, 5], "606": [6, 17, 6], "607": [7, 19, 6],
  "608": [8, 22, 7], "609": [9, 24, 7],
  "623": [3, 10, 4], "624": [4, 13, 5], "625": [5, 16, 5], "626": [6, 19, 6],
  "627": [7, 22, 7], "628": [8, 24, 8], "629": [9, 26, 8],
  "633": [3, 13, 5], "634": [4, 16, 5], "635": [5, 19, 6], "636": [6, 22, 7],
  "638": [8, 28, 9],
  // 4-digit: 60xx light, 62xx medium, 63xx heavy, 68xx/69xx thin section
  "6000": [10, 26, 8], "6001": [12, 28, 8], "6002": [15, 32, 9], "6003": [17, 35, 10],
  "6004": [20, 42, 12], "6005": [25, 47, 12], "6006": [30, 55, 13], "6007": [35, 62, 14],
  "6008": [40, 68, 15], "6009": [45, 75, 16], "6010": [50, 80, 16],
  "6200": [10, 30, 9], "6201": [12, 32, 10], "6202": [15, 35, 11], "6203": [17, 40, 12],
  "6204": [20, 47, 14], "6205": [25, 52, 15], "6206": [30, 62, 16], "6207": [35, 72, 17],
  "6208": [40, 80, 18],
  "6300": [10, 35, 11], "6301": [12, 37, 12], "6302": [15, 42, 13], "6303": [17, 47, 14],
  "6304": [20, 52, 15], "6305": [25, 62, 17], "6306": [30, 72, 19],
  "6800": [10, 19, 5], "6801": [12, 21, 5], "6802": [15, 24, 5], "6803": [17, 26, 5],
  "6804": [20, 32, 7], "6805": [25, 37, 7],
  "6900": [10, 22, 6], "6901": [12, 24, 6], "6902": [15, 28, 7], "6903": [17, 30, 7],
  "6904": [20, 37, 9], "6905": [25, 42, 9],
};

/** LM..UU linear ball bushings: bore × outside diameter × length. */
const LM_UU: Record<string, [number, number, number]> = {
  "6": [6, 12, 19], "8": [8, 15, 24], "10": [10, 19, 29], "12": [12, 21, 30],
  "13": [13, 23, 32], "16": [16, 28, 37], "20": [20, 32, 42], "25": [25, 40, 59],
  "30": [30, 45, 64], "35": [35, 52, 70], "40": [40, 60, 80],
};

/*
  Titles filed under bearings that are not a bearing.

  Every one is a real row. A catalogue that sells motors "with ball bearings"
  and fans rated by their bearing type puts the word in a lot of titles, and the
  category tree cannot help because these are already mis-filed under
  `bearings.ball-bearings.deep-groove`:

    "D Shaft RS-775 DC Motor with Ball Bearing - 12V to 24V - High Torque"
    "Orion Fans OD6025-12HB DC Axial Fan 12 V Square 60 mm 25 Ball Bearing CFM"
    "High-Torque Drill Motor with Ball Bearings — RS-785S Single Bearing"
    "Iron Marble Ball Bearings 19mm — Pack of 1"        loose balls, no races
    "Two Trees U604ZZ Rolling U-Wheel Guide Groove 4x13x4mm"  a V-groove wheel
    "Two Trees Horizontal optical axis bracket SHF16"   a shaft support

  The U-wheel is the instructive one: it carries a genuine `604ZZ` designation
  because there is a 604 bearing pressed inside it, and its stated 4x13x4 is the
  *wheel*, not the bearing. Drawing a plain annulus for it would be wrong twice.
*/
const NOT_A_BEARING =
  /\b(motor|fan|cfm|drill|bracket|marble|u-?wheel|wheel|pulley|puller|extractor|grease|retainer|adhesive|holder|axis|spindle|gimbal|servo|kit)\b/i;

/** Magnet listings that carry no geometry, or geometry of an assembly. */
const NOT_A_PLAIN_MAGNET =
  /\b(sheet|tape|strip|roll|catch|hook|badge|clasp|separator|sweeper|stirrer|viewer|therapy|toy|dart|whiteboard|push ?pin|fishing|assembly|mount(?:ing)? (?:kit|plate))\b/i;

const AMBIGUOUS = /\b(assorted|asstd|variety|mixed|set of)\b/i;

const n = (s: string | undefined) => (s === undefined ? NaN : Number(s));
const ok = (...v: number[]) => v.every((x) => Number.isFinite(x) && x > 0 && x < 1000);

/**
 * A deep-groove ball bearing or a linear bushing, or `null`.
 *
 * Dimensions stated in the title always win over the table. They are this
 * listing's own claim about what it ships, and a supplier who stocks a
 * non-standard part under a standard designation has told us something the
 * table cannot. Where both exist and disagree, the row is refused rather than
 * arbitrated — see the check file.
 */
export function bearing(title: string, categoryPath?: string): RoundPart | null {
  const t = (title ?? "").trim();
  if (!t || AMBIGUOUS.test(t) || NOT_A_BEARING.test(t)) return null;
  if (categoryPath && !categoryPath.startsWith("bearings.")) return null;

  // ---- linear bushing: LM8UU, LM12LUU, LM8UU-OP
  const lm = t.match(/\bLM\s?(\d{1,2})\s?L?UU\b/i);
  if (lm) {
    const dims = LM_UU[lm[1]];
    if (!dims) return null;
    return {
      kind: "round",
      label: `LM${lm[1]}UU`,
      bore: dims[0],
      od: dims[1],
      width: dims[2],
      standard: "LM series",
    };
  }

  // ---- deep groove: 608ZZ, 608-ZZ, 6003 2RS, 626ZZ
  const des = t.match(/\b(6[0-9]{2,3})\s*[-\s]?\s*(2RS|2RZ|RS|ZZ|2Z|Z)?\b/i);
  if (!des) return null;
  const table = ISO_15[des[1]];

  // ---- dimensions stated in the title, in either of the two shapes used
  const triple = t.match(/(\d+(?:\.\d+)?)\s*[×x*]\s*(\d+(?:\.\d+)?)\s*[×x*]\s*(\d+(?:\.\d+)?)\s*mm/i);
  const idOd = t.match(/ID\s*:?\s*(\d+(?:\.\d+)?)\s*mm\s*,?\s*OD\s*:?\s*(\d+(?:\.\d+)?)\s*mm\s*,?\s*[TW]\s*:?\s*(\d+(?:\.\d+)?)\s*mm/i);

  let listed: [number, number, number] | null = null;
  if (idOd) listed = [n(idOd[1]), n(idOd[2]), n(idOd[3])];
  else if (triple) listed = [n(triple[1]), n(triple[2]), n(triple[3])];
  if (listed && !ok(...listed)) listed = null;
  // A bore no smaller than the outside diameter is not a bearing.
  if (listed && listed[0] >= listed[1]) listed = null;

  if (listed && table) {
    const same = listed.every((v, i) => Math.abs(v - table[i]) < 0.51);
    if (!same) return null; // the listing and ISO 15 disagree; we do not pick
  }

  const dims = listed ?? table;
  if (!dims) return null;

  const seal = des[2] ? des[2].toUpperCase() : "";
  return {
    kind: "round",
    label: `${des[1]}${seal ? ` ${seal}` : ""}`,
    bore: dims[0],
    od: dims[1],
    width: dims[2],
    // Provenance follows where the numbers came from, not where the name did.
    standard: listed ? null : "ISO 15",
  };
}

/**
 * A disc, ring or block magnet, or `null`.
 *
 * Nothing here consults a table, so nothing here needs one: `standard` is
 * always `null` and the sheet keeps its ordinary footer.
 */
export function magnet(title: string, categoryPath?: string): RoundPart | BlockPart | null {
  const t = (title ?? "").trim();
  if (!t || AMBIGUOUS.test(t) || NOT_A_PLAIN_MAGNET.test(t)) return null;
  if (categoryPath && !categoryPath.startsWith("magnets.")) return null;
  if (!/\bmagnet/i.test(t)) return null;

  const isRing = /\bring\b|\bwith hole\b|\bannular\b/i.test(t);
  // `rectangul` without the suffix never matched: "Rectangular" continues past
  // the \b, so 20×10×2 blocks were read as ⌀20 discs 10 thick.
  const isBlock = /\b(block|bar|rectangular|rectangle|cuboid|square)\b/i.test(t);

  // ---- block: three edges, either bare or spelled out
  if (isBlock) {
    const spelled = t.match(
      /Length\s*:?\s*(\d+(?:\.\d+)?)\s*mm\s*,\s*Breadth\s*:?\s*(\d+(?:\.\d+)?)\s*mm\s*,\s*Thickness\s*:?\s*(\d+(?:\.\d+)?)\s*mm/i,
    );
    /*
      The unit is optional on the first two figures and required on the last:
      the harvest writes both "20mm x10mm x 2mm" and "50x15x7.5mm".

      `(?:mm)?` and not `mm?` — the latter is a literal `m` with an optional
      second one, so it *requires* a unit it was meant to make optional, and
      silently dropped all 34 bare-triple rows.
    */
    const bare = t.match(
      /(\d+(?:\.\d+)?)\s*(?:mm)?\s*[×xX]\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*[×xX]\s*(\d+(?:\.\d+)?)\s*mm/i,
    );
    const m = spelled ?? bare;
    if (!m) return null;
    const [l, b, h] = [n(m[1]), n(m[2]), n(m[3])];
    if (!ok(l, b, h)) return null;
    return { kind: "block", label: "Block magnet", length: l, breadth: b, thickness: h, standard: null };
  }

  // ---- ring: outside diameter, bore, thickness
  if (isRing) {
    const m = t.match(/(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*mm/i);
    if (!m) return null;
    const [od, id, h] = [n(m[1]), n(m[2]), n(m[3])];
    if (!ok(od, id, h) || id >= od) return null;
    return { kind: "round", label: "Ring magnet", od, bore: id, width: h, standard: null };
  }

  /*
    Disc and cylinder, in the three shapes the harvest uses:

      "15mm X 1.5mm Neodymium Disc Magnets N35 (Dia: 15mm, Thickness: 1.5mm)"
      "6mm Diameter Neodymium Disc Magnets N35 — 10mm"
      "Neodymium (NdFeB) 20x6 mm Disc Magnet"

    All three are diameter first, thickness second. The spelled-out form is
    tried first because it is unambiguous; the em-dash form second because it
    is the only one where the two figures are separated by prose.
  */
  const spelled = t.match(/Dia(?:meter)?\s*:?\s*(\d+(?:\.\d+)?)\s*mm\s*,\s*Thick(?:ness)?\s*:?\s*(\d+(?:\.\d+)?)\s*mm/i);
  const dashed = t.match(/(\d+(?:\.\d+)?)\s*mm\s+Diameter\b[^—–-]*[—–-]\s*(\d+(?:\.\d+)?)\s*mm/i);
  const bare = t.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*[×xX]\s*(\d+(?:\.\d+)?)\s*mm/i);

  const m = spelled ?? dashed ?? bare;
  if (!m) return null;
  const [dia, th] = [n(m[1]), n(m[2])];
  if (!ok(dia, th)) return null;

  return { kind: "round", label: /cylind/i.test(t) ? "Cylinder magnet" : "Disc magnet", od: dia, bore: null, width: th, standard: null };
}
