import Link from "next/link";
import { Frame } from "@/components/Frame";
import { WishButton } from "@/components/WishButton";
import { inr } from "@/lib/catalog";
import type { Sku } from "@/lib/skus";

/**
 * The index card.
 *
 * Non-negotiables, all present: the SKU (buyers search by it and screenshot
 * tiles into WhatsApp), the next price break (the no-MOQ + bulk story in one
 * line), stock without a click, and dispatch as a number.
 *
 * Stock is a stamped impression rather than a coloured pill, so a grid of
 * forty-eight cards is not forty-eight green badges competing with the one
 * accent that means something.
 */
export function ProductTile({ sku }: { sku: Sku }) {
  const stock = stockState(sku.stock);
  const next = sku.breaks.find((b) => b.qty === 100) ?? sku.breaks[1];
  const savePct = Math.round((1 - next.price / sku.price) * 100);
  const made = sku.stock === 0;

  return (
    <Link href={`/p/${sku.slug}`} className="card-index group flex flex-col">
      {/* a made-to-order card is filed under Make, and takes that tab */}
      <span aria-hidden className={`tab tab-sm ${made ? "tab" : ""}`} />

      <div className="relative border-b border-line">
        <Frame ratio="1/1" glyph={sku.glyph} part={sku} cell={4}
          src={sku.image?.url} alt={sku.image?.alt}
          sizes="(max-width:640px) 50vw, (max-width:1280px) 25vw, 16vw" />
        <span className="absolute left-2 top-2 flex items-center gap-1">
          {sku.hasDatasheet && (
            <span className="border border-line bg-surface/90 px-1.5 py-0.5 font-mono text-[0.5625rem] text-faint">
              PDF
            </span>
          )}
        </span>
        <span className="absolute bottom-2 right-2">
          <WishButton sku={sku.sku} title={sku.title} />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-[0.8125rem] font-medium leading-snug text-heading transition-colors group-hover:text-spot-700">
          {sku.title}
        </h3>

        <div className="bin mt-1.5 truncate">⌗ {sku.sku}</div>

        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[1.125rem] font-bold tnum text-heading">{inr(sku.price)}</span>
            <span className="text-[0.6875rem] text-faint">/pc</span>
          </div>
          {savePct > 0 && (
            <div className="mt-0.5 font-mono text-[0.6875rem] text-spot-700 tnum">
              {inr(next.price)} @ {next.qty}+ · save {savePct}%
            </div>
          )}
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2.5">
            <span className={`stamp ${stock.stampCls}`}>{stock.label}</span>
            <span className="bin shrink-0">
              {made ? `${sku.leadDays ?? 7} d` : `${sku.dispatchHours} h`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Table row for the parametric view — FR-24, the DigiKey pattern. */
export function ProductRow({ sku, cols }: { sku: Sku; cols: { key: string; label: string; unit?: string }[] }) {
  const stock = stockState(sku.stock);
  const next = sku.breaks.find((b) => b.qty === 100) ?? sku.breaks[1];

  return (
    <tr className="border-b border-line transition-colors last:border-0 hover:bg-spot-50">
      <td className="py-2 pl-3 pr-2">
        <Link href={`/p/${sku.slug}`} className="flex items-center gap-2.5">
          <span className="block size-9 shrink-0 overflow-hidden border border-line bg-bg">
            <Frame ratio="1/1" glyph={sku.glyph} part={sku} cell={3} tone="neutral"
              src={sku.image?.url} alt={sku.image?.alt} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.8125rem] text-heading hover:text-spot-700">{sku.title}</span>
            <span className="bin block">⌗ {sku.sku}</span>
          </span>
        </Link>
      </td>
      {cols.map((c) => (
        <td key={c.key} className="whitespace-nowrap px-2 py-2 font-mono text-[0.75rem] tnum text-body">
          {sku.attrs[c.key] ?? "—"}{sku.attrs[c.key] !== undefined && c.unit ? ` ${c.unit}` : ""}
        </td>
      ))}
      <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-[0.75rem] tnum text-heading">
        {inr(sku.price)}
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-[0.75rem] tnum text-spot-700">
        {inr(next.price)}
      </td>
      <td className="whitespace-nowrap py-2 pl-2 pr-3">
        <span className={`stamp ${stock.stampCls}`}>{stock.label}</span>
      </td>
    </tr>
  );
}

/**
 * Stock, as an impression.
 *
 * `cls`/`dot` are kept because several surfaces still render the pill form —
 * the wishlist row and the product header, where a single instance is a badge
 * rather than one of forty-eight.
 */
export function stockState(n: number) {
  if (n === 0)
    return {
      label: "Made to order", stampCls: "stamp-out",
      cls: "bg-spot-50 text-spot-800", dot: "bg-spot-600",
    };
  if (n < 10)
    return {
      label: `Low · ${n}`, stampCls: "stamp-danger",
      cls: "bg-warning-bg text-warning", dot: "bg-warning",
    };
  return {
    label: `In stock · ${n.toLocaleString("en-IN")}`, stampCls: "",
    cls: "bg-success-bg text-success", dot: "bg-success",
  };
}
