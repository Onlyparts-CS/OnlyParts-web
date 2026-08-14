"use client";

import { useState } from "react";
import Link from "next/link";
import { Frame } from "@/components/Frame";
import { addManyToCart } from "@/lib/store";
import { inr } from "@/lib/catalog";
import { tierFor } from "@/lib/product";
import type { Sku } from "@/lib/skus";
import { CartIcon } from "@/components/Icons";

/**
 * Parts that complete this one, buyable as a set.
 *
 * The heading is "Works with this part" and not "Frequently bought together",
 * because nothing here has been bought together yet. What every row can prove
 * is the line under it — the thread agrees, the bore agrees, or the supplier
 * declared the platform. That is a smaller claim than Amazon's and it is one
 * we can actually stand behind.
 *
 * Each tick adds a separate cart line. A kit is not a SKU here: every part
 * keeps its own stock, its own lead time and its own price breaks, so a set
 * that contains one made-to-order item says so on that row instead of
 * inheriting a bundle's fictional availability.
 */
export function WorksWith({
  anchor,
  items,
}: {
  anchor: Sku;
  items: { sku: Sku; why: string; proven: boolean }[];
}) {
  const rows: { sku: Sku; why: string | null; proven: boolean }[] = [
    { sku: anchor, why: null, proven: true },
    ...items,
  ];

  // This part and its strongest match start ticked — the set the buyer most
  // likely came for. Everything below that is opt-in, so the total never
  // starts higher than what they actually asked about.
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(rows.slice(0, 2).map((r) => r.sku.sku)),
  );
  const [added, setAdded] = useState(0);

  if (!items.length) return null;

  const toggle = (code: string) => {
    setAdded(0);
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const chosen = rows.filter((r) => ticked.has(r.sku.sku));
  // Price breaks apply per line and are never summed across lines, so the
  // total here is qty 1 of each at its own tier — the same arithmetic the cart
  // will do. Showing a bundled break would be a discount that never arrives.
  const total = chosen.reduce((n, r) => n + tierFor(r.sku, 1).price, 0);
  const anyOut = chosen.some((r) => r.sku.stock === 0);

  const add = () => {
    addManyToCart(chosen.map((r) => ({ sku: r.sku.sku })));
    setAdded(chosen.length);
  };

  return (
    <section>
      <h2 className="text-xl">Works with this part</h2>
      <p className="mb-4 mt-1 text-[0.875rem] text-muted">
        Matched on the dimension or platform named against each one — not on what
        other people bought. Where we could not check a size, the row says so.
      </p>

      <div className="border border-line bg-surface">
        {/* the row of plates, the way the set reads at a glance */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          {rows.map((r, i) => (
            <span key={r.sku.sku} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className="shrink-0 text-faint">+</span>}
              <Link
                href={`/p/${r.sku.slug}`}
                className={`block w-16 border ${ticked.has(r.sku.sku) ? "border-spot-600" : "border-line opacity-40"}`}
                title={r.sku.title}
              >
                <Frame
                  ratio="1/1"
                  glyph={r.sku.glyph}
                  part={r.sku}
                  cell={3}
                  src={r.sku.image?.url}
                  alt={r.sku.image?.alt}
                  sizes="64px"
                />
              </Link>
            </span>
          ))}
        </div>

        <ul className="divide-y divide-line">
          {rows.map((r, i) => {
            const on = ticked.has(r.sku.sku);
            return (
              <li key={r.sku.sku} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  id={`ww-${r.sku.sku}`}
                  checked={on}
                  onChange={() => toggle(r.sku.sku)}
                  className="mt-1 size-4 shrink-0 accent-[var(--color-spot-600)]"
                />
                <label htmlFor={`ww-${r.sku.sku}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block text-[0.9375rem] leading-snug">
                    {i === 0 && <span className="text-muted">This item: </span>}
                    {r.sku.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[0.75rem] text-faint">
                    <span className="font-mono">{r.sku.sku}</span>
                    {/* A checked dimension earns the accent; a category-level
                        pairing does not get to look like a verified fit. */}
                    {r.why && (
                      <span className={r.proven ? "text-spot-700" : "text-faint"}>
                        {r.proven ? r.why : `${r.why} — not verified for this size`}
                      </span>
                    )}
                    {r.sku.stock === 0
                      ? <span>Made to order · {r.sku.leadDays ?? 7} days</span>
                      : <span>In stock</span>}
                  </span>
                </label>
                <span className="shrink-0 pt-0.5 text-right text-[0.9375rem] tabular-nums">
                  {inr(tierFor(r.sku, 1).price)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-tint px-4 py-3">
          <div>
            <span className="text-[0.75rem] text-faint">
              Total ({chosen.length} {chosen.length === 1 ? "item" : "items"})
            </span>
            <span className="ml-2 text-lg tabular-nums">{inr(total)}</span>
            {anyOut && (
              <span className="ml-2 text-[0.75rem] text-muted">
                — one of these is made to order, so the set ships in two parcels
              </span>
            )}
          </div>
          <button
            onClick={add}
            disabled={!chosen.length}
            className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CartIcon className="size-4" />
            {added > 0 ? `Added ${added} to cart` : `Add ${chosen.length} to cart`}
          </button>
        </div>
      </div>
    </section>
  );
}
