"use server";

import { revalidatePath } from "next/cache";
import { actionStaff } from "@/lib/actionAuth";

/**
 * Undoing a bulk import.
 *
 * Three rules, and the first two are why this is not simply "apply the inverse".
 *
 * 1. **Restore from the snapshot, never from a computation.** Each row carries
 *    what it was immediately before the write. Re-deriving the old price from
 *    anywhere else would discard whatever changed in the meantime.
 * 2. **Stock is corrected, not rewound.** `inventory.onHand` is derived from an
 *    append-only ledger, so undoing a stock change means writing a *new*
 *    movement that returns it to the snapshot figure. Deleting the original
 *    movement would leave the ledger unable to explain its own total.
 * 3. **A created product is retired, not deleted.** Between the import and the
 *    revert somebody may have bought one, and an order line points at the
 *    variant. The variant goes inactive and the product goes to draft, which
 *    takes it out of the catalogue and leaves the history intact.
 *
 * A batch can be reverted once. Reverting twice would restore a snapshot over
 * values a human has since corrected, which is the one way an undo button
 * destroys work rather than saving it.
 */

const session = () => actionStaff("admin", "catalog");

export type RevertResult =
  | { ok: true; restored: number; retired: number; failures: { sku: string; error: string }[] }
  | { ok: false; error: string };

type Before = {
  title?: string;
  basePrice?: number;
  attributes?: unknown[];
  stock?: number;
};

export async function revertImport(batchId: number): Promise<RevertResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  let batch;
  try {
    batch = await payload.findByID({
      collection: "import-batches", id: batchId, depth: 0, overrideAccess: true,
    });
  } catch {
    return { ok: false, error: "That import no longer exists." };
  }
  if (batch.status === "reverted") {
    return { ok: false, error: "This import has already been reverted." };
  }

  const wh = await payload.find({
    collection: "warehouses", where: { isActive: { equals: true } },
    limit: 1, depth: 0, overrideAccess: true,
  });
  const warehouse = wh.docs[0]?.id ?? null;

  const failures: { sku: string; error: string }[] = [];
  let restored = 0;
  let retired = 0;

  for (const row of batch.rows ?? []) {
    const variantId = Number(typeof row.variant === "object" && row.variant ? row.variant.id : row.variant);
    const productId = Number(typeof row.product === "object" && row.product ? row.product.id : row.product);

    try {
      if (row.kind === "create") {
        if (Number.isFinite(variantId)) {
          await payload.update({
            collection: "variants", id: variantId, user, overrideAccess: false,
            data: { isActive: false } as never,
          });
        }
        if (Number.isFinite(productId)) {
          await payload.update({
            collection: "products", id: productId, user, overrideAccess: false,
            data: { status: "draft" } as never,
          });
        }
        retired++;
      } else {
        const before = (row.before ?? {}) as Before;

        if (before.title !== undefined && Number.isFinite(productId)) {
          await payload.update({
            collection: "products", id: productId, user, overrideAccess: false,
            data: { title: before.title } as never,
          });
        }

        const patch: Record<string, unknown> = {};
        if (before.basePrice !== undefined) patch.basePrice = before.basePrice;
        if (before.attributes !== undefined) patch.attributes = before.attributes;
        if (Object.keys(patch).length && Number.isFinite(variantId)) {
          await payload.update({
            collection: "variants", id: variantId, user, overrideAccess: false,
            data: patch as never,
          });
        }

        if (before.stock !== undefined && Number.isFinite(variantId)) {
          await correctStock(payload, user, variantId, before.stock, warehouse, batch.filename);
        }
        restored++;
      }

      // Remove only the build memberships this import appended.
      if (row.buildsAdded) {
        await removeFromBuilds(payload, user, productId, row.buildsAdded.split(",").filter(Boolean));
      }
    } catch (e) {
      failures.push({ sku: row.sku, error: e instanceof Error ? e.message : String(e) });
    }
  }

  await payload.update({
    collection: "import-batches", id: batchId, user, overrideAccess: false,
    data: { status: "reverted", revertedAt: new Date().toISOString(), revertedBy: user.email } as never,
  });

  for (const p of ["/admin/products", "/admin/pim", "/admin", "/admin/queues", "/admin/import"]) {
    revalidatePath(p);
  }

  return { ok: true, restored, retired, failures };
}

/* ------------------------------------------------------------------ */

type Payload = Awaited<ReturnType<typeof actionStaff>>["payload"];
type User = NonNullable<Awaited<ReturnType<typeof actionStaff>>["user"]>;

/** A compensating movement back to the snapshot figure. The ledger keeps both rows. */
async function correctStock(
  payload: Payload, user: User, variantId: number, target: number, warehouse: number | null, filename: string,
) {
  if (warehouse === null) throw new Error("No active warehouse — stock cannot be corrected.");

  const inv = await payload.find({
    collection: "inventory", where: { variant: { equals: variantId } },
    limit: 10, depth: 0, overrideAccess: true,
  });
  const onHand = inv.docs.reduce((n, i) => n + (i.onHand ?? 0), 0);
  const delta = Math.round(target) - onHand;
  if (delta === 0) return;

  await payload.create({
    collection: "inventory-movements", user, overrideAccess: false,
    data: {
      variant: variantId, warehouse, delta, reason: "count",
      note: `Reverting import — ${filename}`,
    } as never,
  });
}

/**
 * Take a product back out of the builds this import put it in.
 *
 * Matched by product id and nothing else, so a note or a position somebody
 * curated on a *different* item in the same build is untouched.
 */
async function removeFromBuilds(payload: Payload, user: User, productId: number, slugs: string[]) {
  if (!Number.isFinite(productId) || !slugs.length) return;

  for (const slug of slugs) {
    const found = await payload.find({
      collection: "builds", where: { slug: { equals: slug } },
      limit: 1, depth: 0, overrideAccess: true,
    });
    const build = found.docs[0];
    if (!build) continue;

    const pid = (i: { product: unknown }) =>
      String(typeof i.product === "object" && i.product ? (i.product as { id: unknown }).id : i.product);
    const items = (build.items ?? []).filter((i) => pid(i) !== String(productId));
    if (items.length === (build.items ?? []).length) continue;

    await payload.update({
      collection: "builds", id: build.id, user, overrideAccess: false,
      data: { items } as never,
    });
  }
}
