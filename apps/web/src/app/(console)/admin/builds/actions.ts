"use server";

import { revalidatePath } from "next/cache";
import { actionStaff } from "@/lib/actionAuth";

/**
 * Curating a build — "Build a Drone" and the parts that go in it.
 *
 * `collections/Builds.ts` is emphatic that membership is an editorial
 * judgement and must never be synthesised from categories: the prototype
 * inferred it once and every fastener in the catalogue ended up claiming to be
 * a drone part, because drones contain fasteners. So there is no "add all of
 * category X" here, deliberately. Parts are searched for and added one at a
 * time, with a note saying why *this* build wants *this* part.
 *
 * Until now the only ways to curate one were the CMS or a seed script.
 */

const session = () => actionStaff("admin", "catalog");

export type BuildResult = { ok: true } | { ok: false; error: string };

export type BuildItemInput = { product: number; note: string; position: number };

export async function saveBuild(
  id: number | null,
  data: { name: string; slug: string; blurb: string; glyph: string; position: number },
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  const name = data.name.trim();
  const slug = data.slug.trim().toLowerCase();
  if (!name) return { ok: false, error: "A build needs a name — 'Drone' renders as 'Build a Drone'." };
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return { ok: false, error: "Slug is lowercase letters, digits and hyphens." };

  try {
    const payloadData = {
      name, slug,
      blurb: data.blurb.trim() || null,
      glyph: data.glyph || null,
      position: data.position,
    };
    const doc = id
      ? await payload.update({ collection: "builds", id, user, overrideAccess: false, data: payloadData as never })
      : await payload.create({ collection: "builds", user, overrideAccess: false, data: { ...payloadData, items: [] } as never });

    revalidateAll(doc.slug);
    return { ok: true, id: doc.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique/i.test(msg)) return { ok: false, error: `A build already uses the slug "${slug}".` };
    return { ok: false, error: msg };
  }
}

/**
 * The bill of materials.
 *
 * Sent whole rather than as add/remove deltas, because the `beforeChange` hook
 * on `Builds` rejects a duplicate product across the entire array — a delta
 * would have to reconstruct that state client-side to know whether it would be
 * refused.
 */
export async function saveBuildItems(
  id: number,
  items: BuildItemInput[],
): Promise<BuildResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  const seen = new Set<number>();
  for (const i of items) {
    if (seen.has(i.product)) return { ok: false, error: "The same product is listed twice." };
    seen.add(i.product);
  }

  try {
    const doc = await payload.update({
      collection: "builds", id, user, overrideAccess: false,
      data: {
        items: items.map((i, n) => ({ product: i.product, note: i.note.trim() || null, position: n })),
      } as never,
    });
    revalidateAll(doc.slug);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Products matching a query, for the part picker. Read-gated like the writes. */
export async function findProducts(q: string): Promise<{ id: number; title: string; path: string }[]> {
  const { payload, user } = await session();
  if (!user || q.trim().length < 2) return [];

  const [products, cats] = await Promise.all([
    payload.find({
      collection: "products",
      where: { title: { contains: q.trim() } },
      limit: 10, depth: 0, overrideAccess: true,
    }),
    payload.find({ collection: "categories", limit: 2000, depth: 0, overrideAccess: true }),
  ]);
  const pathById = new Map(cats.docs.map((c) => [String(c.id), String(c.path ?? "")]));

  return products.docs.map((p) => ({
    id: p.id,
    title: p.title,
    path: pathById.get(String(typeof p.primaryCategory === "object" && p.primaryCategory
      ? p.primaryCategory.id : p.primaryCategory)) ?? "",
  }));
}

function revalidateAll(slug?: string | null) {
  for (const p of ["/admin/builds", "/", "/projects"]) revalidatePath(p);
  if (slug) revalidatePath(`/projects/${slug}`);
}
