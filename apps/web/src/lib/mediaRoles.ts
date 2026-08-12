/**
 * What a product image is *for*.
 *
 * Lives here rather than beside the actions that use it because a `"use server"`
 * module may only export async functions — a plain `const` exported from one
 * arrives on the client as a promise, and `MEDIA_ROLES.map is not a function`
 * is how you find out. `lib/actionAuth.ts` carries the same warning for the
 * same reason.
 *
 * Mirrors the `role` options on `products.media`. Position in the array orders
 * the gallery; the role says what each image is doing:
 *
 *   hero      the one that represents the product everywhere else
 *   gallery   further views of the same part
 *   scale     next to something of known size, because "M3" means nothing
 *             to a buyer who has not held one
 *   drawing   a dimensioned drawing rather than a photograph
 *   datasheet a page from the manufacturer's sheet
 */
export const MEDIA_ROLES = ["hero", "gallery", "scale", "drawing", "datasheet"] as const;

export type MediaRole = (typeof MEDIA_ROLES)[number];
