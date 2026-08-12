"use server";

import { revalidatePath } from "next/cache";
import { actionStaff } from "@/lib/actionAuth";
import type { MediaRole } from "@/lib/mediaRoles";

/**
 * Product imagery, without leaving the console.
 *
 * There was no image upload anywhere in this admin — not one, none. The
 * "Missing imagery" queue counted products with no photograph and its only
 * action was a link to `/cms`, which is the thing this console exists so
 * nobody has to open.
 *
 * `products.media` was always an array with a role per entry — hero, gallery,
 * scale, drawing, datasheet. Nothing wrote to it. These do.
 *
 * Uploads go through Payload's local API rather than a route handler, so the
 * `Media` collection's own rules apply unchanged: mime allow-list, the three
 * generated sizes, required alt text, and a licence that a share-alike option
 * is deliberately absent from.
 */

const session = () => actionStaff("admin", "catalog");

export type MediaResult = { ok: true } | { ok: false; error: string };


/** 8 MB. Above this is a camera original nobody has cropped. */
const MAX_BYTES = 8 * 1024 * 1024;

export async function uploadProductImage(form: FormData): Promise<MediaResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  const productId = Number(form.get("productId"));
  const alt = String(form.get("alt") ?? "").trim();
  const role = String(form.get("role") ?? "gallery") as MediaRole;
  const file = form.get("file");

  if (!Number.isFinite(productId)) return { ok: false, error: "Which product?" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file arrived." };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `${(file.size / 1024 / 1024).toFixed(1)} MB is over the 8 MB limit. Crop or re-export it.` };
  }
  /*
    Alt text is required by the collection and required here, rather than
    defaulted to the filename. "IMG_4821.jpg" read aloud by a screen reader is
    worse than silence, and a default is how every image ends up with one.
  */
  if (!alt) return { ok: false, error: "Describe what the image shows — it is read aloud to people who cannot see it." };

  try {
    const media = await payload.create({
      collection: "media",
      user,
      overrideAccess: false,
      data: { alt, licence: String(form.get("licence") ?? "owned") } as never,
      file: {
        data: Buffer.from(await file.arrayBuffer()),
        mimetype: file.type,
        name: file.name,
        size: file.size,
      },
    });

    const product = await payload.findByID({
      collection: "products", id: productId, depth: 0, overrideAccess: true,
    });
    const existing = (product.media ?? []) as { image: unknown; role?: string | null }[];

    /*
      One hero, enforced here rather than trusted. A second hero silently wins
      or loses depending on array order, which is the kind of bug that only
      shows up as "the wrong photo on the category page".
    */
    const next = role === "hero"
      ? [...existing.map((m) => (m.role === "hero" ? { ...m, role: "gallery" } : m)), { image: media.id, role }]
      : [...existing, { image: media.id, role }];

    await payload.update({
      collection: "products", id: productId, user, overrideAccess: false,
      data: { media: next } as never,
    });

    revalidate(productId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Reorder, re-role, or drop one entry. The array order is the gallery order. */
export async function updateProductMedia(
  productId: number,
  media: { image: number; role: MediaRole }[],
): Promise<MediaResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  const heroes = media.filter((m) => m.role === "hero").length;
  if (heroes > 1) return { ok: false, error: "Only one image can be the hero." };

  try {
    await payload.update({
      collection: "products", id: productId, user, overrideAccess: false,
      data: { media } as never,
    });
    revalidate(productId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * The shelves this product also belongs on.
 *
 * Leaves only, and never the primary — `Products` enforces both on save, but
 * saying so here keeps the operator out of an error they cannot see coming.
 */
export async function updateCrossListing(
  productId: number,
  categoryIds: number[],
): Promise<MediaResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  try {
    const product = await payload.findByID({
      collection: "products", id: productId, depth: 0, overrideAccess: true,
    });
    const primary = Number(typeof product.primaryCategory === "object" && product.primaryCategory
      ? product.primaryCategory.id : product.primaryCategory);

    await payload.update({
      collection: "products", id: productId, user, overrideAccess: false,
      data: { crossListedIn: categoryIds.filter((id) => id !== primary) } as never,
    });
    revalidate(productId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Title and subtitle, so a typo does not need the CMS either. */
export async function updateProductCopy(
  productId: number,
  title: string,
  subtitle: string,
): Promise<MediaResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };
  if (!title.trim()) return { ok: false, error: "A product needs a name." };

  try {
    await payload.update({
      collection: "products", id: productId, user, overrideAccess: false,
      data: { title: title.trim(), subtitle: subtitle.trim() || null } as never,
    });
    revalidate(productId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function revalidate(productId: number) {
  for (const p of [`/admin/products/${productId}`, "/admin/products", "/admin/queues", "/admin"]) {
    revalidatePath(p);
  }
}
