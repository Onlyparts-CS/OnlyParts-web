"use client";

import Link from "next/link";
import { useStore, setQty, removeLine } from "@/lib/store";
import { useResolvedCart } from "@/lib/useCatalogue";
import { toInvoiceLines, savingsFor, nextTierHint } from "@/lib/cartMath";
import { totalsFor, FREE_SHIPPING_THRESHOLD, SELLER_STATE } from "@/lib/gst";
import { inr } from "@/lib/catalog";
import { Frame } from "@/components/Frame";
import { Halftone } from "@/components/Halftone";
import { PLATE_FOR_CATEGORY } from "@/lib/plates";
import { BomTools } from "@/components/cart/BomTools";
import { TruckIcon, ArrowRight } from "@/components/Icons";
import { CATEGORIES, skuCountLabel, COMING_SOON } from "@/lib/catalog";

export default function CartPage() {
  const { cart } = useStore();
  const { lines: items, pending } = useResolvedCart(cart);

  /*
    "Loading" and "empty" are different answers and must look different.

    Prices come from the server now, so there is a moment between the page
    arriving and the rows resolving. Showing the empty-cart page during it tells
    somebody with eight items that they have none.
  */
  if (pending) return <CartSkeleton n={cart.length} />;
  if (!items.length) return <EmptyCart />;

  // Place of supply is unknown until checkout, so the cart quotes tax at the
  // seller's own state. Checkout re-computes it against the delivery address —
  // the total can legitimately move between the two, and it must never move
  // silently, so the cart labels this.
  const lines = toInvoiceLines(items, SELLER_STATE);
  const subtotal = lines.reduce((n, l) => n + l.lineTotal, 0);
  const totals = totalsFor(lines, SELLER_STATE);
  const listTotal = items.reduce((n, { sku, qty }) => n + sku.price * qty, 0);
  const saved = listTotal - subtotal;
  const toFree = FREE_SHIPPING_THRESHOLD - subtotal;

  const categoriesSpanned = new Set(items.flatMap(({ sku }) => sku.categories.map((c) => c[0]))).size;

  return (
    <div className="container-page page-shell">
      <header className="mb-6">
        <h1 className="text-[clamp(1.5rem,3vw,2.25rem)]">Your cart</h1>
        <p className="mt-1.5 font-mono text-[0.8125rem] text-faint">
          {items.length} {items.length === 1 ? "item" : "items"}
          {categoriesSpanned > 1 && <> from <span className="text-spot-700">{categoriesSpanned} categories</span> — one delivery, one shipping fee</>}
        </p>
      </header>

      {/* minmax(0,…) for the same reason as checkout: an `auto` column takes a
          min-content floor from a product title and overflows on a phone */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------- lines ---------- */}
        <div className="min-w-0">
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {items.map(({ sku, qty }) => {
              const s = savingsFor(sku, qty);
              const hint = nextTierHint(sku, qty);
              return (
                /*
                 * The price used to be a `shrink-0` sibling of the detail column.
                 * A bulk line like ₹12,58,987.41 inflated it to 120px, and because
                 * it refused to shrink the detail column collapsed to 84px — while
                 * the quantity stepper has a hard intrinsic width of 130px. The
                 * stepper overflowed its own column by 46px and ran under the
                 * price. Small numbers hid it; a real bulk order exposed it.
                 *
                 * Now the price sits inside the detail column's own header row,
                 * so it can wrap onto its own line when there isn't room, and the
                 * stepper below always has the full row width to itself.
                 */
                <li key={sku.sku} className="flex gap-4 p-4">
                  {/* self-start, or the flex row stretches an 80px 1:1 frame to
                      the full 337px row height */}
                  <Link href={`/p/${sku.slug}`}
                    className="w-20 shrink-0 self-start overflow-hidden rounded-sm border border-line">
                    <Frame ratio="1/1" glyph={sku.glyph} part={sku} cell={3} sizes="80px" />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <div className="min-w-0 flex-1 basis-48">
                        <Link href={`/p/${sku.slug}`} className="block text-[0.9375rem] font-medium leading-snug text-heading hover:text-spot-700">
                          {sku.title}
                        </Link>
                        <div className="mt-0.5 break-all font-mono text-[0.6875rem] text-disabled">⌗ {sku.sku}</div>
                        <div className="mt-1 font-mono text-[0.6875rem] text-faint">
                          {sku.stock > 0
                            ? <>In stock · ships in {sku.dispatchHours}h</>
                            : <span className="text-info">Made to order · {sku.leadDays ?? 7} days</span>}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="whitespace-nowrap font-display text-[1.0625rem] font-bold tnum text-heading">{inr(s.actual)}</div>
                        {s.saved > 0 && (
                          <>
                            <div className="whitespace-nowrap font-mono text-[0.6875rem] text-disabled line-through tnum">{inr(s.listTotal)}</div>
                            <div className="whitespace-nowrap font-mono text-[0.6875rem] text-spot-700 tnum">−{inr(s.saved)}</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div className="flex h-9 shrink-0 items-center rounded-sm border border-line-strong">
                        <button onClick={() => setQty(sku.sku, qty - 1)} aria-label={`Decrease ${sku.sku}`}
                          className="grid h-full w-9 place-items-center text-muted hover:bg-sunken hover:text-heading">−</button>
                        <input
                          value={qty} aria-label={`Quantity for ${sku.sku}`}
                          inputMode="numeric"
                          onChange={(e) => setQty(sku.sku, Math.max(1, Number(e.target.value) || 1))}
                          className="h-full w-18 border-x border-line bg-transparent text-center font-mono text-[0.8125rem] tnum text-heading outline-none focus:bg-spot-50"
                        />
                        <button onClick={() => setQty(sku.sku, qty + 1)} aria-label={`Increase ${sku.sku}`}
                          className="grid h-full w-9 place-items-center text-muted hover:bg-sunken hover:text-heading">+</button>
                      </div>

                      <button onClick={() => removeLine(sku.sku)}
                        className="text-[0.75rem] text-faint underline-offset-2 hover:text-danger hover:underline">
                        Remove
                      </button>

                      {s.tier.qty > 1 && (
                        <span className="rounded-xs bg-spot-50 px-2 py-0.5 font-mono text-[0.6875rem] text-spot-800">
                          tier {s.tier.qty}+ · {inr(s.tier.price)}/pc
                        </span>
                      )}
                    </div>

                    {hint && (
                      <p className="mt-2 font-mono text-[0.6875rem] text-spot-700">
                        Add {hint.addQty.toLocaleString("en-IN")} more → {inr(hint.unitPrice)}/pc
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <BomTools cart={cart} />

          {/*
            Pulled back by its own 12px inline padding. A ghost button has no
            border to align, so left as-is its *text* sits indented from every
            bordered control above it and the column reads ragged.
          */}
          <div className="mt-3 -ml-3">
            <Link href="/c" className="btn btn-ghost btn-sm">Continue shopping</Link>
          </div>
        </div>

        {/* ---------- summary ---------- */}
        <aside className="min-w-0 lg:sticky lg:top-40 lg:self-start">
          <div className="rounded-md border border-line bg-surface p-5">
            <h2 className="mb-4 text-base">Order summary</h2>

            <dl className="grid gap-2.5 text-[0.875rem]">
              {/*
                Subtotal is quoted at *list*, not at the tier price.

                `subtotal` already has the break discount inside it, so printing
                it here next to "Bulk savings −₹19.40" made the column contradict
                its own total: 199.00 − 19.40 + 79.00 reads as 258.60 against a
                stated 278.00. A summary a buyer cannot add up is a summary they
                do not trust. Quoting list and then deducting is also how the
                invoice reads, so the two agree line for line.
              */}
              <Row label="Subtotal" value={inr(listTotal)} />
              {saved > 0 && <Row label="Bulk savings" value={`−${inr(saved)}`} accent />}
              <Row
                label="Shipping"
                value={totals.shipping === 0 ? "Free" : inr(totals.shipping)}
                accent={totals.shipping === 0}
              />
              <div className="mt-1 border-t border-line pt-3">
                <Row label={`GST (incl.)`} value={inr(totals.tax)} muted />
                <p className="mt-1 font-mono text-[0.625rem] text-disabled">
                  prices include GST · exact split computed at checkout from your delivery state
                </p>
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-medium text-heading">Total</dt>
                <dd className="font-display text-2xl font-bold tnum text-heading">{inr(totals.grand)}</dd>
              </div>
            </dl>

            {toFree > 0 ? (
              <div className="mt-4 rounded-sm border border-spot-200 bg-spot-50 p-3">
                <p className="flex items-center gap-2 text-[0.8125rem] text-spot-800">
                  <TruckIcon className="size-4 shrink-0" />
                  Add <span className="font-mono font-medium">{inr(toFree)}</span> for free shipping
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-spot-100">
                  <div className="h-full rounded-full bg-spot-500 transition-[width] duration-500"
                    style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%` }} />
                </div>
              </div>
            ) : (
              <p className="mt-4 flex items-center gap-2 rounded-sm border border-success/25 bg-success-bg p-3 text-[0.8125rem] text-success">
                <TruckIcon className="size-4 shrink-0" /> Free shipping unlocked
              </p>
            )}

            <Link href="/checkout" className="btn btn-primary mt-5 w-full">
              Checkout <ArrowRight className="size-4" />
            </Link>

            <p className="mt-3 text-center font-mono text-[0.625rem] text-disabled">
              UPI · Cards · Netbanking · GST invoice on every order
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? "text-faint" : "text-muted"}>{label}</dt>
      <dd className={`font-mono tnum ${accent ? "text-spot-700" : muted ? "text-faint" : "text-heading"}`}>{value}</dd>
    </div>
  );
}

/**
 * An empty cart is a drawer that has not been opened yet, so it says so and
 * then opens four. No centred icon-in-a-circle: the four drawers are both the
 * illustration and the way out.
 */
/**
 * The gap between "the page is here" and "the prices are here".
 *
 * Sized from the cart the browser already knows about, so the layout does not
 * jump when the real rows land — the skeleton has exactly as many bars as
 * there will be lines.
 */
function CartSkeleton({ n }: { n: number }) {
  return (
    <div className="container-page page-shell" aria-busy="true" aria-label="Loading your cart">
      <span className="sr-only">Loading your cart…</span>
      <div className="mb-6 h-8 w-48 animate-pulse rounded-sm bg-sunken" />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-3">
          {Array.from({ length: Math.min(Math.max(n, 1), 8) }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-md border border-line bg-surface p-3">
              <div className="size-20 shrink-0 animate-pulse rounded-sm bg-sunken" />
              <div className="grid flex-1 content-start gap-2 pt-1">
                <div className="h-3.5 w-2/3 animate-pulse rounded-xs bg-sunken" />
                <div className="h-3 w-28 animate-pulse rounded-xs bg-sunken/70" />
              </div>
              <div className="h-4 w-16 animate-pulse self-start rounded-xs bg-sunken" />
            </div>
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-md bg-sunken/60" />
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="container-page page-shell">
      <div className="max-w-2xl">
        <h1 className="monumental text-[clamp(2.25rem,6vw,4.5rem)]">Nothing filed yet</h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted">
          Open a drawer, or go straight to a spec —{" "}
          <span className="font-mono text-spot-700">m3x10 ss304</span>,{" "}
          <span className="font-mono text-spot-700">608zz</span>,{" "}
          <span className="font-mono text-spot-700">nema 17</span>. There is no minimum
          order on any of them.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/c" className="btn btn-primary">Open the cabinet</Link>
          <Link href="/make/rfq" className="btn btn-secondary">Get a part made</Link>
        </div>
      </div>

      <div className="section-gap">
        <h2 className="mb-4 text-[1.375rem]">Start here</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.slice(0, 4).map((c, i) => (
            <Link key={c.slug} href={`/c/${c.slug}`} className="card-index group flex items-center gap-3 p-3">
              <span className="block size-16 shrink-0 overflow-hidden bg-bg">
                <Halftone plate={PLATE_FOR_CATEGORY[c.slug] ?? "screw"} cell={4} duotone={false} className="h-full w-full" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium text-heading transition-colors group-hover:text-spot-700">{c.name}</span>
                <span className="bin mt-1 block">
                  Drawer {String(i + 1).padStart(2, "0")} · {skuCountLabel(c.count) ?? COMING_SOON}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
