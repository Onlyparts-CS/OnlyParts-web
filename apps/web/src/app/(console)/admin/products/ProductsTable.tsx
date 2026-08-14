"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type Sku } from "@/lib/skus";
import { inr } from "@/lib/catalog";
import { resolve } from "@/lib/taxonomy";
import { SearchIcon, ArrowRight } from "@/components/Icons";
import { BulkBar } from "./BulkBar";

type StockFilter = "all" | "in" | "low" | "out";

/**
 * Catalogue management table.
 *
 * The admin's search here is deliberately different from the storefront's: it
 * matches SKU substrings and raw attribute values, because an admin looking for
 * "everything M3 in 12.9" is doing a different job from a customer shopping.
 */
export function ProductsTable({ skus }: { skus: Sku[] }) {
  const [q, setQ] = useState("");
  const [stock, setStock] = useState<StockFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const router = useRouter();
  const PER = 50;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return skus.filter((s) => {
      if (stock === "in" && s.stock < 10) return false;
      if (stock === "low" && !(s.stock > 0 && s.stock < 10)) return false;
      if (stock === "out" && s.stock !== 0) return false;
      if (!needle) return true;
      const hay = `${s.sku} ${s.title} ${Object.values(s.attrs).join(" ")}`.toLowerCase();
      return needle.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [skus, q, stock]);

  const pages = Math.ceil(filtered.length / PER);
  const view = filtered.slice(page * PER, page * PER + PER);

  const toggle = (sku: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku); else next.add(sku);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === view.length ? new Set() : new Set(view.map((s) => s.sku)),
    );

  return (
    <div className="container-page page-shell">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.5rem,3vw,2.25rem)]">Products</h1>
          <p className="mt-1 font-mono text-[0.8125rem] text-faint">
            {filtered.length.toLocaleString("en-IN")} of {skus.length.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/import" className="btn btn-primary btn-sm">Bulk import</Link>
          <Link href="/admin/products/new" className="btn btn-secondary btn-sm">New product</Link>
        </div>
      </div>

      {/* search + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex h-10 min-w-64 flex-1 items-center gap-2.5 rounded-sm border border-line bg-surface px-3 focus-within:border-spot-600">
          <SearchIcon className="size-4 shrink-0 text-spot-600" />
          <input
            value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            type="search"
            aria-label="Search products by SKU, title or attribute value"
            placeholder="Search SKU, title or any attribute value — try &ldquo;m3 12.9&rdquo;"
            className="h-full w-full bg-transparent font-mono text-[0.8125rem] text-heading outline-none placeholder:text-disabled"
          />
          {q && <button onClick={() => setQ("")} className="shrink-0 text-[0.75rem] text-faint hover:text-heading">clear</button>}
        </div>

        <div className="flex rounded-sm border border-line p-0.5" role="group" aria-label="Stock filter">
          {(["all", "in", "low", "out"] as StockFilter[]).map((k) => (
            <button key={k} onClick={() => { setStock(k); setPage(0); }} aria-pressed={stock === k}
              className={`rounded-xs px-2.5 py-1 text-[0.75rem] font-medium capitalize transition-colors ${
                stock === k ? "bg-spot-600 text-on-accent" : "text-muted hover:bg-sunken"
              }`}>
              {k === "in" ? "in stock" : k === "out" ? "out" : k}
            </button>
          ))}
        </div>
      </div>

      {/* bulk action bar */}
      {selected.size > 0 && (
        <BulkBar
          skus={[...selected]}
          rows={filtered.filter((s) => selected.has(s.sku))}
          onClear={() => setSelected(new Set())}
          onDone={() => { setSelected(new Set()); router.refresh(); }}
        />
      )}

      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="bin border-b border-line bg-sunken">
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" aria-label="Select all on page"
                  checked={view.length > 0 && selected.size === view.length}
                  onChange={toggleAll} className="size-3.5 accent-spot-600" />
              </th>
              <th className="px-2 py-2.5 font-bold">SKU</th>
              <th className="px-2 py-2.5 font-bold">Title</th>
              <th className="px-2 py-2.5 font-bold">Primary category</th>
              <th className="px-2 py-2.5 font-bold">Projects</th>
              <th className="px-2 py-2.5 text-right font-bold">Price</th>
              <th className="px-2 py-2.5 text-right font-bold">Stock</th>
              <th className="px-2 py-2.5 font-bold">Image</th>
              <th className="w-8 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {view.map((s) => <Row key={s.sku} s={s} checked={selected.has(s.sku)} onToggle={() => toggle(s.sku)} />)}
          </tbody>
        </table>

        {view.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-muted">
            Nothing matches. Admin search covers SKU, title and every attribute value.
          </p>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
            className="btn btn-secondary btn-sm disabled:opacity-40">Previous</button>
          <span className="font-mono text-[0.75rem] text-faint">Page {page + 1} of {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}
            className="btn btn-secondary btn-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

function Row({ s, checked, onToggle }: { s: Sku; checked: boolean; onToggle: () => void }) {
  const cat = resolve(s.categories[0]);
  const state = s.stock === 0 ? "out" : s.stock < 10 ? "low" : "in";

  return (
    <tr className={`border-b border-line last:border-0 transition-colors ${checked ? "bg-spot-50" : "hover:bg-sunken/60"}`}>
      <td className="px-3 py-2">
        <input type="checkbox" checked={checked} onChange={onToggle}
          aria-label={`Select ${s.sku}`} className="size-3.5 accent-spot-600" />
      </td>
      <td className="whitespace-nowrap px-2 py-2 font-mono text-[0.75rem] text-heading">{s.sku}</td>
      <td className="max-w-md px-2 py-2">
        <span className="block truncate text-[0.8125rem] text-body">{s.title}</span>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-[0.75rem] text-faint">
        {cat?.trail.map((n) => n.name).join(" › ") ?? "—"}
        {s.categories.length > 1 && (
          <span className="ml-1.5 rounded-xs bg-spot-50 px-1 py-0.5 font-mono text-[0.625rem] text-spot-700">
            +{s.categories.length - 1}
          </span>
        )}
      </td>
      {/* curated on upload, never derived — see lib/product.ts projectsFor() */}
      <td className="px-2 py-2">
        {s.projects?.length ? (
          <span className="flex flex-wrap gap-1">
            {s.projects.map((p) => (
              <span key={p} className="rounded-xs bg-spot-50 px-1.5 py-0.5 font-mono text-[0.625rem] text-spot-700">{p}</span>
            ))}
          </span>
        ) : (
          <span className="font-mono text-[0.625rem] text-disabled">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-[0.75rem] tnum text-heading">{inr(s.price)}</td>
      {/*
        Stock is a number, so it reads as one. It was a filled pill, which
        meant fifty rows carried fifty saturated lozenges and the healthy
        ones shouted as loudly as the empty ones. Only the exceptions take
        colour now — in stock is the default and says nothing.
      */}
      <td className="whitespace-nowrap px-2 py-2 text-right">
        <span className={`font-mono text-[0.75rem] tnum ${
          state === "out" ? "text-info" : state === "low" ? "text-warning" : "text-heading"
        }`}>
          {s.stock.toLocaleString("en-IN")}
        </span>
      </td>
      {/* True of every row today, so it is marginalia, not a warning. */}
      <td className="px-2 py-2">
        <span className="bin">placeholder</span>
      </td>
      <td className="px-2 py-2">
        {/*
          Into the console, not out to the storefront. A row here is a variant,
          but everything an operator opens this table to change — imagery, copy,
          the shelves it sits on — lives on the product above it.
        */}
        <Link
          href={s.productId ? `/admin/products/${s.productId}` : `/p/${s.slug}`}
          aria-label={s.productId ? `Edit ${s.sku}` : `View ${s.sku} on the storefront`}
          className="grid size-6 place-items-center rounded-xs text-disabled hover:bg-sunken hover:text-spot-700"
        >
          <ArrowRight className="size-3.5" />
        </Link>
      </td>
    </tr>
  );
}
