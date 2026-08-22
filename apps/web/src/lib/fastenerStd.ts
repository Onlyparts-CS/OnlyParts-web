/**
 * Fastener geometry, recovered from a listing title and closed by a standard.
 *
 * `specDrawing.ts` draws what the attribute row holds and refuses to invent the
 * rest, which is right — but it leaves a screw with two figures on its sheet
 * when the trade expects five. The gap is not knowledge, it is bookkeeping:
 * `thread` is populated on 165 of 3,379 fastener rows (4.9%) because Indian
 * Shopify listings do not publish a "Thread Size" spec row, while 2,351 of the
 * same rows (69.6%) state the thread in the title. Head diameter and head
 * height have no column at all, on any source, and never will — no supplier
 * publishes them, because for a standard part nobody needs to.
 *
 * That last point is the whole argument for this file. `dk` and `k` for an
 * ISO 4762 M4 are not measurements anybody takes; they are the definition of
 * the part. Reading them out of the standard is not inference in the sense
 * `specDrawing.ts` forbids — it is the same act as reading `5 V` off a part
 * marked 7805. What *would* be inference is deciding which standard applies,
 * and that is why almost all of the code below is refusal.
 *
 * The division of labour, stated once:
 *
 *   from the listing   thread, length          — facts about this SKU
 *   from the standard  head diameter, height   — facts about the part family
 *   refused            everything ambiguous    — see `reject()`
 *
 * The caller must keep those apart on the page. `SpecDrawing` prints the
 * standard's id in the footer so a buyer can see which half is which, because
 * a buyer machines to the figure and is entitled to know whose figure it is.
 */

export type HeadType = "socket" | "button" | "csk" | "pan" | "cheese";
export type DriveType = "hex" | "cross" | "slotted";

export type Fastener = {
  kind: "fastener";
  /** As designated: `M4`. */
  thread: string;
  /** Nominal major diameter in mm — 4 for M4. */
  threadDia: number;
  /** Nominal length in mm, as the standard measures it for this head. */
  length: number;
  head: HeadType;
  drive: DriveType;
  /** The standard the head dimensions were read out of. Printed on the sheet. */
  standard: string;
  /** `dk` — head diameter, from the standard, not from the listing. */
  headDia: number;
  /** `k` — head height, from the standard, not from the listing. */
  headHeight: number;
  /**
   * True when length is measured from the top of the head rather than from
   * under it. Countersunk heads sit flush, so their head is inside the length.
   */
  headInLength: boolean;
};

/*
  Head dimensions, keyed by standard and then by thread.

  `dk` is the head diameter and `k` the head height, both the nominal/maximum
  figure the standard tabulates — the number a supplier's own datasheet prints.
  Tolerance classes are deliberately not modelled: a drawing that carried
  `5.5 -0.18` would be claiming we know which class was shipped, and we do not.

  Keyed by *standard*, not by thread, because that is the distinction the one
  existing table in this repo gets wrong. `skus.ts:102` carries a single `d`
  per thread and applies it to four different head styles — which makes an
  M3 button head 5.5 mm across when ISO 7380 says 5.7, and an M3 countersunk
  5.5 when ISO 10642 says 6.72. That table is demo-catalogue scaffolding and
  must not be reused here; this one replaces it for real SKUs.
*/
type HeadTable = Record<string, { dk: number; k: number }>;

/** ISO 4762 / DIN 912 — hexagon socket head cap screws. `k` equals `d`. */
const ISO_4762: HeadTable = {
  M1_6: { dk: 3.0, k: 1.6 },
  M2: { dk: 3.8, k: 2.0 },
  M2_5: { dk: 4.5, k: 2.5 },
  M3: { dk: 5.5, k: 3.0 },
  M4: { dk: 7.0, k: 4.0 },
  M5: { dk: 8.5, k: 5.0 },
  M6: { dk: 10.0, k: 6.0 },
  M8: { dk: 13.0, k: 8.0 },
  M10: { dk: 16.0, k: 10.0 },
  M12: { dk: 18.0, k: 12.0 },
  M16: { dk: 24.0, k: 16.0 },
  M20: { dk: 30.0, k: 20.0 },
};

/** ISO 7380-1 — hexagon socket button head screws. Not defined below M3. */
const ISO_7380: HeadTable = {
  M3: { dk: 5.7, k: 1.65 },
  M4: { dk: 7.6, k: 2.2 },
  M5: { dk: 9.5, k: 2.75 },
  M6: { dk: 10.5, k: 3.3 },
  M8: { dk: 14.0, k: 4.4 },
  M10: { dk: 17.5, k: 5.5 },
  M12: { dk: 21.0, k: 6.6 },
};

/** ISO 10642 / DIN 7991 — hexagon socket countersunk head. `dk` theoretical. */
const ISO_10642: HeadTable = {
  M3: { dk: 6.72, k: 1.86 },
  M4: { dk: 8.96, k: 2.48 },
  M5: { dk: 11.2, k: 3.1 },
  M6: { dk: 13.44, k: 3.72 },
  M8: { dk: 17.92, k: 4.96 },
  M10: { dk: 22.4, k: 6.2 },
  M12: { dk: 26.88, k: 7.44 },
};

/** ISO 7046 / DIN 965 — cross-recessed countersunk head. */
const ISO_7046: HeadTable = {
  M2: { dk: 3.8, k: 1.2 },
  M2_5: { dk: 4.7, k: 1.5 },
  M3: { dk: 5.6, k: 1.65 },
  M4: { dk: 7.5, k: 2.2 },
  M5: { dk: 9.2, k: 2.5 },
  M6: { dk: 11.0, k: 3.0 },
  M8: { dk: 14.5, k: 4.0 },
  M10: { dk: 18.0, k: 5.0 },
};

/** ISO 7045 / DIN 7985 — cross-recessed pan head. */
const ISO_7045: HeadTable = {
  M2: { dk: 4.0, k: 1.6 },
  M2_5: { dk: 5.0, k: 2.1 },
  M3: { dk: 6.0, k: 2.4 },
  M4: { dk: 8.0, k: 3.1 },
  M5: { dk: 10.0, k: 3.9 },
  M6: { dk: 12.0, k: 4.6 },
  M8: { dk: 16.0, k: 6.0 },
  M10: { dk: 20.0, k: 7.5 },
};

/** ISO 1207 / DIN 84 — slotted cheese head. The head in the reference sheet. */
const ISO_1207: HeadTable = {
  M1_6: { dk: 3.0, k: 1.1 },
  M2: { dk: 3.8, k: 1.4 },
  M2_5: { dk: 4.5, k: 1.8 },
  M3: { dk: 5.5, k: 2.0 },
  M4: { dk: 7.0, k: 2.6 },
  M5: { dk: 8.5, k: 3.3 },
  M6: { dk: 10.0, k: 3.9 },
  M8: { dk: 13.0, k: 5.0 },
  M10: { dk: 16.0, k: 6.0 },
};

/*
  Head shape alone does not pick a standard — the drive picks it too.

  A countersunk screw is ISO 10642 with a hex socket and ISO 7046 with a cross
  recess, and their head diameters differ by 20% at M3 (6.72 against 5.6). A
  table keyed on "csk" would therefore be wrong for half the countersunk screws
  in the catalogue, silently, in the direction a buyer cannot see. Pairs absent
  from this map are refused rather than approximated: a slotted pan head is
  ISO 1580 and a slotted countersunk is ISO 2009, and neither table is here.
*/
const STANDARDS: Partial<Record<`${HeadType}-${DriveType}`, { id: string; dims: HeadTable; headInLength: boolean }>> = {
  "socket-hex": { id: "ISO 4762", dims: ISO_4762, headInLength: false },
  "button-hex": { id: "ISO 7380", dims: ISO_7380, headInLength: false },
  "csk-hex": { id: "ISO 10642", dims: ISO_10642, headInLength: true },
  "csk-cross": { id: "ISO 7046", dims: ISO_7046, headInLength: true },
  "pan-cross": { id: "ISO 7045", dims: ISO_7045, headInLength: false },
  "cheese-slotted": { id: "ISO 1207", dims: ISO_1207, headInLength: false },
};

/** `M2.5` → the `M2_5` table key. Dots are not legal in an identifier. */
const threadKey = (t: string) => t.replace(".", "_");

/*
  Titles that must never reach the tables.

  Every entry is a shape actually present in the harvest, not a hypothetical:

    "Almost Engineered a Near-Perfect M3 & M4 3D Printing Kit"
      two threads, one title — whichever we picked would be wrong half the time
    "M4 Phillips head Assorted Fastening Kit from 6mm to 25mm - 180Pcs"
      one thread, no single length
    "Yankee Print Washer with Hypo-eliminator Hose for 20x24 Prints"
      a darkroom appliance filed under fasteners.washers.flat-plain
    "M4.8 #10 Philips Countersunk CSK Stainless Steel Self-Tapping Screws"
      self-tappers have their own thread form; ISO 7046 does not describe them

  The drywall/gypsum/wood/sheet-metal terms are here for the same reason as
  self-tapping: 42 bugle-head drywall screws matched a head word and a thread
  in testing, and none of them is an ISO machine screw.
*/
const AMBIGUOUS = /\b(assorted|asstd|kit|combo|variety|set of|mixed)\b/i;
const NOT_A_MACHINE_SCREW =
  /\b(self[\s-]?tapping|self[\s-]?drilling|drywall|gypsum|wood screw|sheet metal|chipboard|coach|lag|grub|set screw|stud|threaded rod)\b/i;

/*
  Head variants that share a head word with a tabulated standard and are not it.

  "Stainless Steel Flanged Button Head Screws … — M8X1.25 / 40mm" matches
  `button` and would be drawn against ISO 7380-1 at 14 mm across. It is
  ISO 7380-2, whose flange is 17.4 mm — a quarter wider, on the one dimension
  that decides whether the screw fouls the pocket next to it. "Round washer
  head" is the same failure against ISO 7045.
*/
const HEAD_VARIANT = /\b(flange[ds]?|washer head|serrated|ribbed|domed|torx|security|tamper)\b/i;
const IMPERIAL = /(#\d|\b\d+\/\d+\s*(?:inch|")|\bBSP\b|\bNPT\b|\bUNC\b|\bUNF\b|\bBSW\b)/i;

const HEAD_WORDS: [RegExp, HeadType][] = [
  // Order is priority, not preference. "Socket Button Head Cap" carries both
  // "socket" and "button"; the head is a button and "socket" is describing the
  // drive. Every head word therefore outranks the socket-head fallback.
  [/\b(csk|countersunk|flat head)\b/i, "csk"],
  [/\bbutton\b/i, "button"],
  [/\b(chhd|cheese)\b/i, "cheese"],
  [/\bpan\b/i, "pan"],
  [/\b(socket head|shcs|cap screw|cylindrical head)\b/i, "socket"],
];

const DRIVE_WORDS: [RegExp, DriveType][] = [
  [/\b(hex|allen|hexagon socket|socket)\b/i, "hex"],
  [/\b(phillips|philips|pozi|cross[\s-]?recess|cross head)\b/i, "cross"],
  [/\b(slotted|slot drive|flat[\s-]?slot)\b/i, "slotted"],
];

/** Category leaf → head shape, for the branch that was mapped by hand. */
const HEAD_FROM_CATEGORY: [string, HeadType][] = [
  ["screws-by-head.socket-head-cap", "socket"],
  ["screws-by-head.countersunk-csk", "csk"],
  ["screws-by-head.button-head", "button"],
  ["screws-by-head.pan-head", "pan"],
  ["screws-by-head.cheese-head", "cheese"],
];

const firstMatch = <T,>(pairs: [RegExp, T][], s: string): T | null =>
  pairs.find(([re]) => re.test(s))?.[1] ?? null;

/**
 * A fastener's full geometry, or `null` when anything at all is unclear.
 *
 * `null` is the common and correct answer — measured over the 2,050 harvested
 * onlyscrews rows, 620 titles (30.2%) carry a thread, a length, a head word
 * and a drive word together, and only the subset of those whose head/drive
 * pair has a table survives this function. The caller keeps the halftone plate
 * for the rest, which is what it did before this file existed.
 *
 * `categoryPath` is the dotted materialised path (`fasteners.screws-by-head.
 * button-head`). It is used as a *check*, never as a source: the tree was
 * mapped by hand in `tools/feeds/map.json`, so where it disagrees with the
 * title one of the two is wrong and neither is worth guessing between.
 */
export function fastener(title: string, categoryPath?: string): Fastener | null {
  const t = (title ?? "").trim();
  if (!t) return null;

  if (AMBIGUOUS.test(t) || NOT_A_MACHINE_SCREW.test(t) || IMPERIAL.test(t) || HEAD_VARIANT.test(t)) return null;

  /*
    Exactly one thread designation. Two means a kit that dodged AMBIGUOUS.

    The trailing guard is a lookahead, not a word boundary. `\bM5\b` cannot
    match the `M5` in "M5X0.8" — `5` and `X` are both word characters, so there
    is no boundary between them — which silently cost every thinkrobotics and
    makerbazar row that states its pitch. Rejecting only a following digit or
    dot keeps `M4.8` reading as 4.8 rather than 4.
  */
  const threads = [...t.matchAll(/\bM(\d+(?:\.\d+)?)(?![\d.])/gi)].map((m) => m[1]);
  if (threads.length === 0) return null;
  if (new Set(threads).size !== 1) return null;
  const threadDia = Number(threads[0]);
  if (!Number.isFinite(threadDia) || threadDia <= 0) return null;
  const thread = `M${threads[0]}`;

  /*
    Length, from the two shapes the harvest actually uses, cross-checked.

    onlyscrews states it twice — "M4 X 12mm … (Dia. 4mm, Length 12mm)" — and
    the pair is worth checking rather than trusting either half, because a
    supplier who edits one and not the other has told us the row is stale. Six
    rows in the harvest disagree with themselves this way.
  */
  const paren = t.match(/\(\s*Dia\.?\s*(\d+(?:\.\d+)?)\s*mm\s*,\s*Length\s*(\d+(?:\.\d+)?)\s*mm\s*\)/i);
  // Case-insensitive on the unit: the harvest carries "25mm", "25MM" and "25Mm".
  const inline = t.match(/\bM\d+(?:\.\d+)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*mm/i);

  /*
    The Shopify option-suffix dialect: "… (pack of 10) — M4X0.7 / 60mm".

    makerbazar and thinkrobotics state the thread with its *pitch* rather than
    its length, then give the length after a slash — 1,547 fastener rows between
    them, none of which the two patterns above can read. The pitch is skipped
    deliberately: it is a real figure but it belongs to the thread designation,
    and a drawing that called 0.7 a length would be wrong by two orders.
  */
  const suffix = t.match(/\bM\d+(?:\.\d+)?\s*(?:[x×]\s*\d+(?:\.\d+)?)?\s*\/\s*(\d+(?:\.\d+)?)\s*mm/i);

  let length: number | null = null;
  const agree = (n: number) => {
    if (length !== null && length !== n) return false; // the title disagrees with itself
    length = n;
    return true;
  };
  if (paren) {
    if (Number(paren[1]) !== threadDia) return null; // states a diameter that is not its own thread
    if (!agree(Number(paren[2]))) return null;
  }
  if (inline && !agree(Number(inline[1]))) return null;
  if (suffix && !agree(Number(suffix[1]))) return null;
  if (length === null || !Number.isFinite(length) || length <= 0 || length > 500) return null;

  const head = firstMatch(HEAD_WORDS, t);
  const drive = firstMatch(DRIVE_WORDS, t);
  if (!head || !drive) return null;

  // The tree is a check, not a source — see the docstring.
  const fromCategory = categoryPath
    ? HEAD_FROM_CATEGORY.find(([leaf]) => categoryPath.includes(leaf))?.[1] ?? null
    : null;
  if (fromCategory && fromCategory !== head) return null;

  const std = STANDARDS[`${head}-${drive}`];
  if (!std) return null;

  const dims = std.dims[threadKey(thread)];
  if (!dims) return null; // a real thread this standard does not tabulate

  return {
    kind: "fastener",
    thread,
    threadDia,
    length,
    head,
    drive,
    standard: std.id,
    headDia: dims.dk,
    headHeight: dims.k,
    headInLength: std.headInLength,
  };
}
