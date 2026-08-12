import Link from "next/link";
import type { Axis } from "@/lib/product";
import type { Sku } from "@/lib/skus";

/**
 * Variant picker — docs/04-WIREFRAMES.md §5.
 *
 * 7 threads × 12 lengths × 4 materials is 336 combinations, which is why this
 * is an axis matrix and not a dropdown. Two rules:
 *   1. Dim, don't hide. An invisible option reads as "they don't sell it".
 *   2. The URL follows the selection, so a variant is shareable and indexable.
 */
export function VariantMatrix({ axes, current }: { axes: Axis[]; current: Sku }) {
  if (!axes.length) return null;

  return (
    <div className="grid gap-4">
      {axes.map((axis) => {
        const selected = String(current.attrs[axis.key]);
        return (
          <div key={axis.key}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
                {axis.label}
              </span>
              <span className="font-mono text-[0.75rem] text-heading">
                {selected}{axis.unit ? ` ${axis.unit}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {axis.options.map((o) => {
                const isSelected = o.value === selected;
                const base =
                  "rounded-sm border px-2.5 py-1.5 font-mono text-[0.8125rem] tnum transition-all";

                if (isSelected) {
                  return (
                    <span key={o.value} aria-current="true"
                      className={`${base} border-spot-600 bg-spot-600 text-on-accent`}>
                      {o.value}
                    </span>
                  );
                }
                if (o.available && o.slug) {
                  return (
                    <Link key={o.value} href={`/p/${o.slug}`} scroll={false}
                      className={`${base} border-line bg-surface text-body hover:-translate-y-px hover:border-spot-600 hover:bg-spot-50 hover:text-spot-800`}>
                      {o.value}
                    </Link>
                  );
                }
                return (
                  <span key={o.value} title={o.reason} aria-disabled="true"
                    className={`${base} cursor-not-allowed border-dashed border-line bg-sunken text-disabled`}>
                    {o.value}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="font-mono text-[0.6875rem] text-disabled">
        Dashed options aren&apos;t made in this combination — available on request, 7–10 days.
      </p>
    </div>
  );
}
