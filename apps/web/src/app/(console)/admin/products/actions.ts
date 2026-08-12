"use server";

import { revalidatePath } from "next/cache";
import { actionStaff } from "@/lib/actionAuth";

/**
 * The bulk bar, actually doing something.
 *
 * These four buttons existed with no handlers — they appeared the moment a row
 * was ticked and did nothing when pressed, which is worse than not being there.
 *
 * Everything runs as the signed-in user with `overrideAccess: false`, like
 * every other write in this console, and every export re-checks the session:
 * a `"use server"` function is a public POST endpoint, and "adjust the price of
 * these SKUs" is not something to leave open.
 */

const session = () => actionStaff("admin", "catalog");
const CHUNK = 100;

export type BulkResult =
  | { ok: true; changed: number; failures: { sku: string; error: string }[] }
  | { ok: false; error: string };

/** Guards every entry point: nobody bulk-edits the whole catalogue by accident. */
const MAX_SELECTION = 500;

async function variantsFor(payload: Awaited<ReturnType<typeof actionStaff>>["payload"], skus: string[]) {
  const { docs } = await payload.find({
    collection: "variants",
    where: { sku: { in: skus } },
    limit: MAX_SELECTION,
    depth: 0,
    overrideAccess: true,
  });
  return docs;
}

/* ------------------------------------------------------------------ */

/**
 * Reprice, by percentage or to a flat figure.
 *
 * Percentage is the common case — "everything from this supplier is up 4%" —
 * and doing it by hand across sixty rows is where a decimal point goes missing.
 * Rounding is to the paise, and it happens once, on an integer, so no float
 * survives the operation.
 */
export async function adjustPrice(
  skus: string[],
  mode: "percent" | "set",
  value: number,
): Promise<BulkResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };
  if (!skus.length) return { ok: false, error: "Nothing selected." };
  if (skus.length > MAX_SELECTION) return { ok: false, error: `Select ${MAX_SELECTION} or fewer at a time.` };
  if (!Number.isFinite(value)) return { ok: false, error: "That is not a number." };
  if (mode === "set" && value <= 0) return { ok: false, error: "A price has to be more than nothing." };
  if (mode === "percent" && value <= -100) return { ok: false, error: "A discount of 100% or more leaves no price." };

  const docs = await variantsFor(payload, skus);
  const failures: { sku: string; error: string }[] = [];
  let changed = 0;

  for (let i = 0; i < docs.length; i += CHUNK) {
    for (const v of docs.slice(i, i + CHUNK)) {
      const next = mode === "set"
        ? Math.round(value * 100)
        : Math.round(v.basePrice * (1 + value / 100));
      if (next === v.basePrice) continue;
      if (next <= 0) { failures.push({ sku: v.sku, error: "would fall to zero or below" }); continue; }
      try {
        await payload.update({
          collection: "variants", id: v.id, user, overrideAccess: false,
          data: { basePrice: next } as never,
        });
        changed++;
      } catch (e) {
        failures.push({ sku: v.sku, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  return { ok: true, changed, failures };
}

/* ------------------------------------------------------------------ */

/**
 * Stock, as ledger movements.
 *
 * `inventory.onHand` is read-only by design — every unit is accounted for by a
 * row saying who moved it and why — so "set to 40" is written as the delta that
 * gets there from wherever it is now, with the reason `count`. That is honest:
 * somebody asserted a number, they did not receive a shipment.
 */
export async function adjustStock(
  skus: string[],
  mode: "set" | "delta",
  value: number,
): Promise<BulkResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };
  if (!skus.length) return { ok: false, error: "Nothing selected." };
  if (skus.length > MAX_SELECTION) return { ok: false, error: `Select ${MAX_SELECTION} or fewer at a time.` };
  if (!Number.isFinite(value)) return { ok: false, error: "That is not a number." };
  if (mode === "set" && value < 0) return { ok: false, error: "Stock cannot be set below zero." };

  const wh = await payload.find({
    collection: "warehouses", where: { isActive: { equals: true } },
    limit: 1, depth: 0, overrideAccess: true,
  });
  const warehouse = wh.docs[0]?.id;
  if (!warehouse) return { ok: false, error: "No active warehouse — stock cannot be recorded." };

  const docs = await variantsFor(payload, skus);
  const inv = await payload.find({
    collection: "inventory",
    where: { variant: { in: docs.map((v) => v.id) } },
    limit: MAX_SELECTION, depth: 0, overrideAccess: true,
  });
  const onHand = new Map<string, number>();
  for (const i of inv.docs) {
    const id = String(typeof i.variant === "object" && i.variant ? i.variant.id : i.variant);
    onHand.set(id, (onHand.get(id) ?? 0) + (i.onHand ?? 0));
  }

  const failures: { sku: string; error: string }[] = [];
  let changed = 0;

  for (let i = 0; i < docs.length; i += CHUNK) {
    for (const v of docs.slice(i, i + CHUNK)) {
      const current = onHand.get(String(v.id)) ?? 0;
      const delta = mode === "set" ? Math.round(value) - current : Math.round(value);
      if (delta === 0) continue;
      if (current + delta < 0) { failures.push({ sku: v.sku, error: `only ${current} on hand` }); continue; }
      try {
        await payload.create({
          collection: "inventory-movements", user, overrideAccess: false,
          data: {
            variant: v.id, warehouse, delta, reason: "count",
            note: mode === "set" ? "Bulk adjust — counted to a figure" : "Bulk adjust — relative movement",
          } as never,
        });
        changed++;
      } catch (e) {
        failures.push({ sku: v.sku, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  return { ok: true, changed, failures };
}

/* ------------------------------------------------------------------ */

/** Leaf categories, for the assign dropdown. Read-gated like everything else. */
export async function leafCategories(): Promise<{ path: string; name: string }[]> {
  const { payload, user } = await session();
  if (!user) return [];

  const { docs } = await payload.find({
    collection: "categories", limit: 2000, depth: 0, sort: "path", overrideAccess: true,
  });
  const hasChild = new Set(docs.map((c) => String(c.parent ?? "")).filter(Boolean));
  return docs
    .filter((c) => !hasChild.has(String(c.id)) && c.path)
    .map((c) => ({ path: String(c.path), name: String(c.path).replace(/\./g, " › ") }));
}

/**
 * Refile products onto a different shelf.
 *
 * The category lives on the *product*, so selecting three variants of one
 * product moves that product once. The count returned is products moved, not
 * rows ticked, because reporting "3 moved" for one move is a lie the operator
 * will notice on the next screen.
 */
export async function assignCategory(skus: string[], path: string): Promise<BulkResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };
  if (!skus.length) return { ok: false, error: "Nothing selected." };
  if (!path) return { ok: false, error: "Pick a category." };

  const cat = await payload.find({
    collection: "categories", where: { path: { equals: path } },
    limit: 1, depth: 0, overrideAccess: true,
  });
  const category = cat.docs[0];
  if (!category) return { ok: false, error: `No category at "${path}".` };

  const { docs } = await payload.find({
    collection: "variants", where: { sku: { in: skus } },
    limit: MAX_SELECTION, depth: 0, overrideAccess: true,
  });

  const productIds = [...new Set(docs.map((v) => Number(typeof v.product === "object" && v.product ? v.product.id : v.product)))];
  const failures: { sku: string; error: string }[] = [];
  let changed = 0;

  for (const id of productIds) {
    try {
      await payload.update({
        collection: "products", id, user, overrideAccess: false,
        data: { primaryCategory: category.id } as never,
      });
      changed++;
    } catch (e) {
      // `Products` refuses a non-leaf category with its own message — surface it.
      failures.push({ sku: `product ${id}`, error: e instanceof Error ? e.message : String(e) });
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/pim");
  revalidatePath("/admin");
  return { ok: true, changed, failures };
}
