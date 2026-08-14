"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addManyToCart } from "@/lib/store";
import type { Sku } from "@/lib/skus";
import { inr } from "@/lib/catalog";

/**
 * The two things a build page is for.
 *
 * Both buttons existed with no handlers — on a page whose entire proposition is
 * "here is the bill of materials", the button that adds the bill of materials
 * did nothing. This is a curated BOM's only real advantage over a category
 * listing, and it was the one part not wired.
 *
 * Client-side because the cart lives in this browser (`lib/store.ts`); the page
 * around it stays a server component and hands the rows down.
 */
export function BomActions({ picks, projectName, projectSlug }: {
  picks: Sku[];
  projectName: string;
  projectSlug: string;
}) {
  const [added, setAdded] = useState(0);
  const router = useRouter();

  /*
    Out-of-stock parts are skipped rather than added at zero.

    A made-to-order line silently entering the cart is how somebody gets to
    checkout and finds the total is not what the page said. The count below
    reports what actually went in, and names what did not.
  */
  const inStock = picks.filter((s) => s.stock > 0);
  const skipped = picks.length - inStock.length;

  const addAll = () => {
    addManyToCart(inStock.map((s) => ({ sku: s.sku })));
    setAdded(inStock.length);
    // The header's cart badge reads from the same store; nudge the tree so it
    // updates without a reload.
    router.refresh();
  };

  const downloadCsv = () => {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = [
      ["sku", "title", "qty", "unit_price_inr", "stock", "category"],
      ...picks.map((s) => [
        s.sku,
        s.title,
        "1",
        (s.price / 100).toFixed(2),
        String(s.stock),
        s.categories[0].join(" > "),
      ]),
    ];
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `onlyparts-${projectSlug}-bom.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const total = inStock.reduce((n, s) => n + s.price, 0);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={addAll} disabled={inStock.length === 0} className="btn btn-primary btn-sm disabled:opacity-40">
          Add {inStock.length} parts to cart
          {inStock.length > 0 && <span className="ml-1.5 font-mono opacity-80">{inr(total)}</span>}
        </button>
        <button onClick={downloadCsv} className="btn btn-secondary btn-sm">Download BOM as CSV</button>
      </div>

      <p className="mt-2 text-[0.8125rem] text-faint" role="status">
        {added > 0 ? (
          <>
            <span className="text-spot-700">{added} added.</span> One of each — adjust
            quantities in the cart.
          </>
        ) : skipped > 0 ? (
          <>
            {skipped} of these {skipped === 1 ? "is" : "are"} made to order and{" "}
            {skipped === 1 ? "is" : "are"} left out of the bulk add. The CSV includes
            everything.
          </>
        ) : (
          <>One of each, for a {projectName.toLowerCase()} build. Adjust quantities in the cart.</>
        )}
      </p>
    </div>
  );
}
