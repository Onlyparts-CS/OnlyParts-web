"use server";

import { revalidatePath } from "next/cache";
import { actionStaff } from "@/lib/actionAuth";
import { resolveAttributes, toSpecRows } from "@/lib/pim";

/**
 * Filling a gap without leaving the queue.
 *
 * The enrichment screen has always been able to *find* missing specs; the only
 * thing it could do about one was link out to `/cms/collections/variants/{id}`.
 * That is a page load, a form, a save and a back button for a single number,
 * repeated per row — which is why a completeness queue that hands you off is a
 * completeness queue nobody works through.
 *
 * Guarded like every other action here: `"use server"` compiles to a public
 * POST endpoint, so the session is re-checked rather than assumed from the page
 * that rendered the form.
 */

export type FillResult =
  | { ok: true; filled: number }
  | { ok: false; error: string };

export async function fillGaps(
  variantId: number,
  categoryPath: string,
  values: Record<string, string>,
): Promise<FillResult> {
  const { payload, user } = await actionStaff("admin", "catalog");
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  const supplied = Object.fromEntries(
    Object.entries(values).filter(([, v]) => v.trim() !== ""),
  );
  if (!Object.keys(supplied).length) return { ok: false, error: "Nothing to save." };

  const defs = await resolveAttributes(categoryPath);
  const incoming = toSpecRows(defs, supplied);
  if (!incoming.length) {
    // `toSpecRows` drops a value it cannot coerce rather than forcing it — a
    // wrong number in `value_number` breaks a range facet silently.
    return { ok: false, error: "None of those values fit their attribute's type." };
  }

  try {
    const current = await payload.findByID({
      collection: "variants", id: variantId, depth: 0, overrideAccess: true,
    });

    const defId = (d: unknown) => String(typeof d === "object" && d ? (d as { id: unknown }).id : d);
    const kept = (current.attributes ?? []).filter(
      (a) => !incoming.some((n) => defId(n.definition) === defId(a.definition)),
    );

    await payload.update({
      collection: "variants",
      id: variantId,
      user,
      overrideAccess: false,
      data: { attributes: [...kept, ...incoming] } as never,
    });

    revalidatePath("/admin/pim");
    revalidatePath("/admin/products");
    return { ok: true, filled: incoming.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
