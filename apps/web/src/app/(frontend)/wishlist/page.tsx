"use client";

import Link from "next/link";
import { useStore, removeWish, addToCart } from "@/lib/store";
import { useResolvedWishlist } from "@/lib/useCatalogue";
import { inr } from "@/lib/catalog";
import { Frame } from "@/components/Frame";
import { HeartIcon, CartIcon } from "@/components/Icons";
import { stockState } from "@/components/catalog/ProductTile";

/**
 * Saved parts.
 *
 * The heart in the header used to be decoration. This is what it now points at.
 * Deliberately a working list rather than a gallery: the reason an engineer
 * saves a part is to come back and buy some of it, so every row can go straight
 * to the cart, and the whole list can go at once.
 */
export default function WishlistPage() {
  const { wishlist } = useStore();
  const { rows: items, pending } = useResolvedWishlist(wishlist);
  const inStock = items.filter((s) => s.stock > 0);

  // A saved list that briefly claims to be empty is worse than a blank moment.
  if (pending) return null;
  if (!items.length) return <Empty />;

  return (
    <div className="container-page page-shell">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.5rem,3vw,2.25rem)]">Saved parts</h1>
          <p className="mt-1.5 font-mono text-[0.8125rem] text-faint">
            {items.length} saved{inStock.length !== items.length && <> · {items.length - inStock.length} made to order</>}
          </p>
        </div>
        {inStock.length > 0 && (
          <button
            onClick={() => inStock.forEach((s) => addToCart(s.sku, 1))}
            className="btn btn-primary btn-sm"
          >
            <CartIcon className="size-4" />
            Add {inStock.length} in-stock to cart
          </button>
        )}
      </header>

      <ul className="divide-y divide-line rounded-md border border-line bg-surface">
        {items.map((sku) => {
          const stock = stockState(sku.stock);
          return (
            <li key={sku.sku} className="flex gap-4 p-4">
              <Link href={`/p/${sku.slug}`} className="w-20 shrink-0 self-start overflow-hidden rounded-sm border border-line">
                <Frame ratio="1/1" glyph={sku.glyph} part={sku} cell={3} sizes="80px" />
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0 flex-1 basis-48">
                    <Link href={`/p/${sku.slug}`} className="block text-[0.9375rem] font-medium leading-snug text-heading hover:text-spot-700">
                      {sku.title}
                    </Link>
                    <div className="mt-0.5 break-all font-mono text-[0.6875rem] text-disabled">⌗ {sku.sku}</div>
                    <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-xs px-1.5 py-0.5 text-[0.625rem] font-medium ${stock.cls}`}>
                      <span className={`size-1.5 rounded-full ${stock.dot}`} />{stock.label}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="whitespace-nowrap font-display text-[1.0625rem] font-bold tnum text-heading">{inr(sku.price)}</div>
                    <div className="whitespace-nowrap font-mono text-[0.6875rem] text-spot-700 tnum">
                      {inr(sku.breaks.at(-1)!.price)} @ {sku.breaks.at(-1)!.qty}+
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button onClick={() => addToCart(sku.sku, 1)} className="btn btn-secondary btn-sm">
                    Add to cart
                  </button>
                  <button onClick={() => removeWish(sku.sku)}
                    className="text-[0.75rem] text-faint underline-offset-2 hover:text-danger hover:underline">
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[0.8125rem] text-muted">
        Saved parts live in this browser for now. Signing in will move them to your
        account so they follow you between devices.
      </p>
    </div>
  );
}

function Empty() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-lg text-center">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-spot-50 text-spot-600">
          <HeartIcon className="size-6" />
        </span>
        <h1 className="text-2xl">Nothing saved yet</h1>
        <p className="mt-2 text-muted">
          Tap the heart on any part to keep it here — useful when you are speccing a
          build and want to compare before you commit.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/c" className="btn btn-primary btn-sm">Browse categories</Link>
          <Link href="/make/rfq" className="btn btn-secondary btn-sm">Get a part made</Link>
        </div>
      </div>
    </div>
  );
}
