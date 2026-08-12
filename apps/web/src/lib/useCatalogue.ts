"use client";

import { useEffect, useRef, useState } from "react";
import { resolveSkus } from "@/app/(frontend)/search/actions";
import type { Sku } from "./skus";
import type { CartLine } from "./store";

/**
 * Resolving cart and wishlist codes now that the catalogue lives in Postgres.
 *
 * `resolveCart` did this synchronously against a generated array. That worked
 * only because the whole catalogue was shipped to the browser — which is not
 * an option at fifty thousand SKUs, and was never an option once prices had to
 * be authoritative. The browser holds SKU codes and quantities; every figure
 * attached to them comes from the server.
 *
 * The rows arrive a moment after the page does. That is deliberate and visible:
 * `pending` is returned so a cart can show its own skeleton rather than
 * flashing "your cart is empty" at somebody who has eight things in it.
 */

type Resolved = { sku: Sku; qty: number };

function useResolved(codes: string[]): { rows: Sku[]; pending: boolean } {
  const key = codes.join(",");
  const [fetched, setFetched] = useState<{ key: string; rows: Sku[] } | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!key) return;
    const mine = ++seq.current;
    resolveSkus(key.split(","))
      .then((rows) => { if (mine === seq.current) setFetched({ key, rows }); })
      .catch(() => { if (mine === seq.current) setFetched({ key, rows: [] }); });
  }, [key]);

  // Tagged with the key it answered, so a stale response for a previous cart
  // can never be rendered against the current one.
  if (!key) return { rows: [], pending: false };
  if (fetched?.key === key) return { rows: fetched.rows, pending: false };
  return { rows: [], pending: true };
}

/**
 * Cart lines joined to live catalogue rows.
 *
 * Anything the server does not return is dropped — a delisted SKU leaves the
 * cart rather than sitting there with a price nobody will honour.
 */
export function useResolvedCart(cart: CartLine[]): { lines: Resolved[]; pending: boolean } {
  const { rows, pending } = useResolved(cart.map((l) => l.sku));
  const bySku = new Map(rows.map((s) => [s.sku.toUpperCase(), s]));

  const lines = cart
    .map((l) => {
      const sku = bySku.get(l.sku.toUpperCase());
      return sku ? { sku, qty: l.qty } : null;
    })
    .filter((x): x is Resolved => x !== null);

  return { lines, pending };
}

/** Same drop-the-delisted rule as the cart, so counts cannot disagree. */
export function useResolvedWishlist(wishlist: string[]): { rows: Sku[]; pending: boolean } {
  const { rows, pending } = useResolved(wishlist);
  const order = new Map(wishlist.map((s, i) => [s.toUpperCase(), i]));
  return {
    rows: [...rows].sort((a, b) => (order.get(a.sku.toUpperCase()) ?? 0) - (order.get(b.sku.toUpperCase()) ?? 0)),
    pending,
  };
}
