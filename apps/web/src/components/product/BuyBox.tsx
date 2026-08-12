"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { inr } from "@/lib/catalog";
import { tierFor } from "@/lib/product";
import { addToCart } from "@/lib/store";
import type { Sku } from "@/lib/skus";
import { CartIcon, TruckIcon, InvoiceIcon, BoxIcon, CheckIcon } from "@/components/Icons";
import { WishButton } from "@/components/WishButton";

export function BuyBox({ sku }: { sku: Sku }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const tier = useMemo(() => tierFor(sku, qty), [sku, qty]);
  const total = tier.price * qty;
  const listTotal = sku.price * qty;
  const saved = listTotal - total;
  const nextTier = sku.breaks.find((b) => b.qty > qty);
  const toNext = nextTier ? nextTier.qty - qty : 0;

  const step = (d: number) => setQty((q) => Math.max(1, q + d));

  return (
    <div>
      {/* price */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-3xl font-bold tnum text-heading">{inr(tier.price)}</span>
        <span className="text-sm text-faint">/pc · incl. GST</span>
        {tier.qty > 1 && (
          <span className="rounded-xs bg-spot-50 px-2 py-0.5 font-mono text-[0.6875rem] text-spot-800">
            tier {tier.qty}+ applied
          </span>
        )}
      </div>

      {/* quantity */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="qty" className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
            Quantity
          </label>
          <span className="font-mono text-[0.6875rem] text-faint">no minimum · sold as single pieces</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 items-center rounded-sm border border-line-strong bg-surface">
            <button onClick={() => step(-1)} aria-label="Decrease quantity"
              className="grid h-full w-10 place-items-center text-muted transition-colors hover:bg-sunken hover:text-heading">−</button>
            <input
              id="qty" type="number" min={1} value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="h-full w-16 border-x border-line bg-transparent text-center font-mono text-[0.9375rem] tnum text-heading outline-none focus:bg-spot-50"
            />
            <button onClick={() => step(1)} aria-label="Increase quantity"
              className="grid h-full w-10 place-items-center text-muted transition-colors hover:bg-sunken hover:text-heading">+</button>
          </div>
          <div className="flex gap-1.5">
            {[10, 100, 1000].map((n) => (
              <button key={n} onClick={() => setQty(n)}
                className="rounded-sm border border-line px-2.5 py-1.5 font-mono text-[0.75rem] text-muted transition-colors hover:border-spot-600 hover:bg-spot-50 hover:text-spot-800">
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* price breaks — the live reason to buy more */}
      <table className="mt-5 w-full border-collapse overflow-hidden rounded-sm border border-line text-left">
        <thead>
          <tr className="bg-sunken">
            <th className="px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-faint">Qty</th>
            <th className="px-3 py-1.5 text-right text-[0.625rem] font-bold uppercase tracking-[0.1em] text-faint">Unit price</th>
            <th className="px-3 py-1.5 text-right text-[0.625rem] font-bold uppercase tracking-[0.1em] text-faint">You save</th>
          </tr>
        </thead>
        <tbody>
          {sku.breaks.map((b, i) => {
            const active = b.qty === tier.qty;
            const next = sku.breaks[i + 1];
            const range = next ? `${b.qty}–${next.qty - 1}` : `${b.qty}+`;
            const pct = Math.round((1 - b.price / sku.price) * 100);
            return (
              <tr key={b.qty}
                className={`border-t border-line font-mono text-[0.8125rem] tnum transition-colors ${
                  active ? "bg-spot-50 text-spot-900" : "text-body"
                }`}>
                <td className="px-3 py-2">
                  {active && <span aria-hidden className="mr-1.5 text-spot-600">▸</span>}{range}
                </td>
                <td className="px-3 py-2 text-right">{inr(b.price)}</td>
                <td className="px-3 py-2 text-right">{pct > 0 ? `${pct}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {toNext > 0 && nextTier && (
        <p className="mt-2 font-mono text-[0.75rem] text-spot-700">
          Add {toNext.toLocaleString("en-IN")} more → {inr(nextTier.price)}/pc
        </p>
      )}

      {/* total */}
      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-sm text-muted">Total for {qty.toLocaleString("en-IN")} pcs</span>
        <span className="text-right">
          <span className="block font-display text-2xl font-bold tnum text-heading">{inr(total)}</span>
          {saved > 0 && (
            <span className="block font-mono text-[0.75rem] text-spot-700">you save {inr(saved)}</span>
          )}
        </span>
      </div>

      {/* actions */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => { addToCart(sku.sku, qty); setAdded(true); setTimeout(() => setAdded(false), 2200); }}
          disabled={sku.stock === 0}
          className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {added ? <><CheckIcon className="size-4" /> Added to cart</> : <><CartIcon className="size-[18px] shrink-0" /> {sku.stock === 0 ? "Out of stock" : "Add to cart"}</>}
        </button>
        <WishButton sku={sku.sku} title={sku.title} variant="button" />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {/* a BOM is a cart you keep, so this adds the line and sends you there */}
        <Link href="/cart" onClick={() => addToCart(sku.sku, qty)} className="btn btn-secondary btn-sm flex-1">
          Add to BOM
        </Link>
        <Link href="/make/rfq" className="btn btn-secondary btn-sm flex-1">Bulk quote 1000+ →</Link>
      </div>

      {/* promises — numbers, never adjectives */}
      <ul className="mt-6 grid gap-2.5 border-t border-line pt-5 text-[0.8125rem] text-muted">
        <li className="flex items-start gap-2.5">
          <TruckIcon className="mt-0.5 size-[17px] shrink-0 text-spot-600" />
          {sku.stock > 0
            ? <span>Ships in <span className="font-mono text-heading">{sku.dispatchHours}h</span> · free delivery over <span className="font-mono">₹999</span></span>
            : <span>Made to order · <span className="font-mono text-heading">{sku.leadDays ?? 7} days</span></span>}
        </li>
        <li className="flex items-start gap-2.5">
          <BoxIcon className="mt-0.5 size-[17px] shrink-0 text-spot-600" />
          <span>Buy 1 piece or 10,000 — no minimum order</span>
        </li>
        <li className="flex items-start gap-2.5">
          <InvoiceIcon className="mt-0.5 size-[17px] shrink-0 text-spot-600" />
          <span>GST invoice with HSN · 7-day returns on unopened packs</span>
        </li>
      </ul>
    </div>
  );
}
