"use server";

import { revalidatePath } from "next/cache";
import { resolveAttributes, toSpecRows } from "@/lib/pim";
import { actionStaff } from "@/lib/actionAuth";

/**
 * Writing a whole variant matrix in one pass.
 *
 * A fastener product is not one row. "M3 Hex Socket Head Cap Screw, SS304" is
 * eight lengths × three materials, and typing twenty-four near-identical
 * records by hand is how catalogues end up with three different weights for the
 * same screw and a SKU that skips M3 × 16.
 *
 * Rows are written **independently and reported individually**. A partial
 * failure — two duplicate SKUs out of twenty-four — must say which two, not
 * roll back the twenty-two that were fine.
 */

export type MatrixRow = {
  /** attribute key → value, one entry per axis */
  specs: Record<string, string>;
  sku: string;
  /** rupees as typed */
  price: string;
  weightG: string;
  stock: string;
};

export type RowResult = { sku: string; ok: boolean; error?: string };

const toPaise = (r: string) => {
  const n = Number(String(r ?? "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

export async function createVariants(
  productId: number | string,
  categoryPath: string,
  rows: MatrixRow[],
): Promise<{ results: RowResult[] }> {
  const { payload, user } = await actionStaff("admin", "catalog");
  if (!user) {
    return {
      results: rows.map((r) => ({
        sku: r.sku, ok: false, error: "Not signed in with a catalogue role.",
      })),
    };
  }

  const defs = await resolveAttributes(categoryPath);
  const warehouse = (
    await payload.find({
      collection: "warehouses", where: { isActive: { equals: true } },
      limit: 1, depth: 0, overrideAccess: true,
    })
  ).docs[0];

  const results: RowResult[] = [];

  for (const row of rows) {
    const sku = row.sku.trim().toUpperCase();
    const paise = toPaise(row.price);
    const weight = Number(row.weightG);
    const stock = Number(row.stock || "0");

    if (!/^[A-Z0-9][A-Z0-9-]{3,}$/.test(sku)) {
      results.push({ sku, ok: false, error: "SKU needs 4+ characters." });
      continue;
    }
    if (paise === null || paise === 0) {
      results.push({ sku, ok: false, error: "Price missing." });
      continue;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      results.push({ sku, ok: false, error: "Weight missing." });
      continue;
    }

    const attributes = toSpecRows(defs, row.specs);

    try {
      const variant = await payload.create({
        collection: "variants",
        user,
        overrideAccess: false,
        data: {
          product: productId,
          sku,
          basePrice: paise,
          weightG: Math.round(weight),
          attributes,
          isActive: true,
        } as never,
      });

      if (stock > 0 && warehouse) {
        await payload.create({
          collection: "inventory-movements",
          user,
          overrideAccess: false,
          data: {
            variant: variant.id,
            warehouse: warehouse.id,
            delta: Math.round(stock),
            reason: "count",
            note: "Opening balance — variant matrix",
          } as never,
        });
      }
      results.push({ sku, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        sku,
        ok: false,
        error: /unique/i.test(msg) ? "SKU already exists." : msg.slice(0, 120),
      });
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/pim");
  return { results };
}
