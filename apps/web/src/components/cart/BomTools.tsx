"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { parseCsv } from "@/lib/import";
import { addToCart, type CartLine } from "@/lib/store";
import { resolveSkus } from "@/app/(frontend)/search/actions";
import { useResolvedCart } from "@/lib/useCatalogue";
import { UploadIcon, CheckIcon } from "@/components/Icons";

type Result = {
  matched: { sku: string; qty: number; title: string }[];
  unmatched: { sku: string; qty: number }[];
  skipped: number;
};

/**
 * BOM import and export.
 *
 * Both were stub buttons. An engineer arrives with a bill of materials from CAD
 * or a spreadsheet, and the whole pitch of this store is that one cart covers
 * the whole build — so pasting that list has to work.
 *
 * The importer reuses `parseCsv` from the admin bulk-import path rather than a
 * second parser: quoted fields and embedded commas behave identically, and there
 * is only one thing to fix when a customer sends a file that breaks it.
 *
 * Unmatched rows are reported, never silently dropped. A BOM that quietly loses
 * four lines is worse than one that fails.
 */
export function BomTools({ cart }: { cart: CartLine[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState(false);

  // The export needs titles and prices, which live on the server now. The cart
  // page above has already resolved them; this shares that same resolution
  // rather than issuing its own.
  const { lines: cartLines } = useResolvedCart(cart);

  const ingest = async (text: string) => {
    const { headers, rows } = parseCsv(text);
    const skuCol = headers.find((h) => ["sku", "part", "part_number", "mpn", "code"].includes(h)) ?? headers[0];
    const qtyCol = headers.find((h) => ["qty", "quantity", "count", "pcs"].includes(h)) ?? headers[1];

    const matched: Result["matched"] = [];
    const unmatched: Result["unmatched"] = [];
    let skipped = 0;

    const wanted: { code: string; qty: number }[] = [];
    for (const row of rows) {
      const code = (row[skuCol] ?? "").trim();
      if (!code) { skipped++; continue; }
      wanted.push({ code, qty: Math.max(1, Math.round(Number(row[qtyCol] ?? 1)) || 1) });
    }

    /*
      One lookup for the whole sheet.

      A BOM is routinely a hundred lines, and resolving them one at a time is a
      hundred round trips — the paste would visibly crawl. The server is asked
      once and the answers are matched up here.
    */
    const found = await resolveSkus(wanted.map((w) => w.code));
    const bySku = new Map(found.map((s) => [s.sku.toUpperCase(), s]));

    for (const { code, qty } of wanted) {
      const hit = bySku.get(code.toUpperCase());
      if (hit) {
        addToCart(hit.sku, qty);
        matched.push({ sku: hit.sku, qty, title: hit.title });
      } else {
        unmatched.push({ sku: code, qty });
      }
    }
    setResult({ matched, unmatched, skipped });
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(ingest);
    e.target.value = "";
  };

  const download = () => {
    const lines = cartLines;
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const csv = [
      "sku,qty,title,unit_price_inr,line_total_inr",
      ...lines.map(({ sku, qty }) =>
        [sku.sku, qty, esc(sku.title), (sku.price / 100).toFixed(2), ((sku.price * qty) / 100).toFixed(2)].join(","),
      ),
    ].join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `onlyparts-bom-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className="btn btn-secondary btn-sm">
          <UploadIcon className="size-4" /> Import BOM (CSV)
        </button>
        <button onClick={download} disabled={!cart.length} className="btn btn-secondary btn-sm disabled:opacity-40">
          {saved ? <><CheckIcon className="size-4" /> Downloaded</> : "Save as BOM"}
        </button>
      </div>

      <p className="mt-2 font-mono text-[0.6875rem] text-disabled">
        columns: sku, qty · header row required · quantities default to 1
      </p>

      {result && (
        <div className="mt-3 rounded-md border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[0.9375rem]">
              {result.matched.length} line{result.matched.length === 1 ? "" : "s"} added
            </h3>
            <button onClick={() => setResult(null)} className="text-[0.75rem] text-faint hover:text-heading">
              Dismiss
            </button>
          </div>

          {result.skipped > 0 && (
            <p className="mt-1 font-mono text-[0.75rem] text-faint">{result.skipped} blank row(s) skipped</p>
          )}

          {result.unmatched.length > 0 && (
            <div className="mt-3 rounded-sm border border-warning/30 bg-warning-bg p-3">
              <p className="text-[0.8125rem] font-medium text-warning">
                {result.unmatched.length} part{result.unmatched.length === 1 ? "" : "s"} not in the catalogue
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {result.unmatched.slice(0, 12).map((u) => (
                  <li key={u.sku} className="rounded-xs bg-surface px-1.5 py-0.5 font-mono text-[0.6875rem] text-body">
                    {u.sku} × {u.qty}
                  </li>
                ))}
                {result.unmatched.length > 12 && (
                  <li className="px-1 font-mono text-[0.6875rem] text-faint">+{result.unmatched.length - 12} more</li>
                )}
              </ul>
              <p className="mt-2 text-[0.75rem] leading-relaxed text-warning">
                Send the list through Make-on-Demand and we will source or manufacture
                what is missing rather than leaving you to find it elsewhere.
              </p>
              <Link href="/make/rfq" className="btn btn-secondary btn-sm mt-3">Quote the missing parts</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
