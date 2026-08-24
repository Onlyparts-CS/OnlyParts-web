/**
 * A body tone for a part whose listing states its material or finish.
 *
 * The point is the axis the drawings could not previously show. A family is one
 * shape at many sizes, and the sheets already carry the size; what they could
 * not carry is that the same M4 x 12 exists in SS 304, brass and black oxide,
 * which on a supplier's site is three photographs of three visibly different
 * screws.
 *
 * What this is not: a render. The tone is flat, muted and sits *under* the line
 * work, because a drawing that starts imitating a photograph invites the reader
 * to measure the picture instead of the figures. It is closer to the material
 * hatching on a sectioned assembly than to a material shader.
 *
 * The honesty rule is the same as everywhere else in this folder: the tone is a
 * restatement of a value the listing already gave, in the title block, two
 * inches below. It never introduces a claim. An unrecognised value gets no
 * tone at all rather than a guessed one, and the sheet then looks exactly as it
 * did before — which is the correct outcome for a part whose finish we do not
 * know.
 */

export type FinishTone = {
  /** Body fill. Muted on purpose; the line work has to stay dominant. */
  fill: string;
  /** What the sheet calls it, printed so the tone is never the only statement. */
  label: string;
};

/*
  Keyed on the exact strings the catalogue actually stores. Deliberately not a
  fuzzy match: "Stainless (440C)" and "SS 304" are different entries because
  they are different values in the data, and a substring rule that mapped both
  through "stainless" would also swallow the next unfamiliar alloy silently.
*/
const TONES: Record<string, FinishTone> = {
  // stainless and passivated steels — neutral, slightly cool
  "ss 304": { fill: "#C9CDD1", label: "SS 304" },
  "ss 316": { fill: "#C4C9CE", label: "SS 316" },
  "stainless (440c)": { fill: "#C2C7CC", label: "Stainless 440C" },
  "plain / passivated": { fill: "#CBCFD3", label: "Plain / passivated" },
  natural: { fill: "#CBCFD3", label: "Natural" },

  // through-hardened and alloy steels — darker, warmer grey
  "chrome steel (gcr15)": { fill: "#B4B8BC", label: "Chrome steel" },
  "alloy 12.9": { fill: "#8E8B86", label: "Alloy 12.9" },
  "high tensile": { fill: "#9A968F", label: "High tensile" },

  // conversion coatings and plating
  "black oxide": { fill: "#4A4642", label: "Black oxide" },
  "black oxide (blackened)": { fill: "#4A4642", label: "Black oxide" },
  zinc: { fill: "#C6CBD0", label: "Zinc plated" },
  "zinc plated": { fill: "#C6CBD0", label: "Zinc plated" },
  nicuni: { fill: "#CDD1D4", label: "NiCuNi plated" },

  // non-ferrous
  brass: { fill: "#C4A468", label: "Brass" },
};

/*
  Read in this order and stop at the first hit.

  Finish outranks material because it is the outer layer and therefore the thing
  you would actually see: a high-tensile screw that is black oxide is black, and
  a sheet that tinted it steel-grey on the strength of `material` would be
  showing the wrong surface. `coating` last, because only the magnets use it.
*/
const KEYS = ["finish", "material", "coating"] as const;

export function finishTone(attrs: Record<string, unknown>): FinishTone | null {
  for (const k of KEYS) {
    const v = attrs[k];
    if (typeof v !== "string") continue;
    const hit = TONES[v.trim().toLowerCase()];
    if (hit) return hit;
  }
  return null;
}
