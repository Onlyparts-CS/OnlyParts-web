import { guard } from "@/lib/adminAuth";
import { Denied } from "@/components/admin/Denied";
import { dbAllSkus } from "@/lib/catalogDb";
import { ProductsTable } from "./ProductsTable";

export const dynamic = "force-dynamic";

/**
 * Server shell over the catalogue table.
 *
 * The table itself is a client component — it filters and paginates in the
 * browser — and a client component cannot read the session, so the guard has
 * nowhere to stand inside it. This shell exists to give it one. Splitting the
 * file is the whole reason: a `"use client"` page is unguardable.
 */
export default async function AdminProductsPage() {
  const g = await guard("admin", "catalog");
  if (!g.ok) return <Denied staff={g.staff} needed={g.needed} />;

  // Read here, filtered in the browser. The table's whole value is instant
  // filtering across the catalogue, which a round trip per keystroke destroys.
  return <ProductsTable skus={await dbAllSkus()} />;
}
