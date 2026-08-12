import type { Sku } from "./skus";

/**
 * Rule 6(1) declarations, as they are worded on a listing.
 *
 * These two functions are three lines each and they are here, not inline in
 * `SpecTable`, for one reason: getting either of them wrong is an offence
 * rather than a rendering bug, and a component in a `"use client"` file cannot
 * be exercised by `node x.check.ts`. See `legal.check.ts`.
 */

type Legal = NonNullable<Sku["legal"]>;

/**
 * What the listing prints for country of origin.
 *
 * Never falls back to a country. 89 of 119,864 harvested rows carry an origin,
 * so a default would be a fabricated declaration on the other 119,775 — and an
 * absent declaration is an omission where a wrong one is a misdeclaration.
 * Printing the row unconditionally is deliberate too: silently dropping the
 * line reads as though the question was never asked.
 */
export function originValue(legal?: Legal): string {
  return legal?.countryOfOrigin || NOT_DECLARED;
}

export const NOT_DECLARED = "Not declared";

/**
 * Rule 6(1) wants the *importer* named on imported goods and the manufacturer
 * or packer on domestic ones. It is one field, so the label carries the claim —
 * and with no origin on file we cannot make either claim, which is why there is
 * a third case rather than a default to one of the other two.
 */
export function packerLabel(origin?: string): string {
  if (!origin) return "Packed / imported by";
  return origin === "India" ? "Packed by" : "Imported by";
}
