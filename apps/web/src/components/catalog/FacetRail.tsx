"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { Facet } from "@/lib/facets";
import { ChevronDown } from "@/components/Icons";

/**
 * Filter rail — open by default on desktop. Filter-first is the McMaster lesson
 * (docs/12-COMPETITIVE-RESEARCH.md §2): engineers don't know the product name,
 * they know the dimensions. Hiding filters behind a button costs a click on the
 * single most-used control on the page.
 *
 * All state is written to the URL; the server re-renders the filtered grid.
 */
export function FacetRail({ facets, total }: { facets: Facet[]; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const push = useCallback(
    (mutate: (q: URLSearchParams) => void) => {
      const q = new URLSearchParams(params.toString());
      mutate(q);
      q.delete("page");
      startTransition(() => {
        router.replace(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false });
      });
    },
    [params, pathname, router]
  );

  const toggle = (key: string, value: string) =>
    push((q) => {
      const cur = (q.get(key) ?? "").split(",").filter(Boolean);
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      if (next.length) q.set(key, next.join(","));
      else q.delete(key);
    });

  const setRange = (key: string, lo: number, hi: number, min: number, max: number) =>
    push((q) => {
      if (lo <= min && hi >= max) q.delete(key);
      else q.set(key, `${lo}-${hi}`);
    });

  const selected = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const hasAny = facets.some((f) =>
    f.kind === "enum" ? selected(f.def.key).length > 0 : params.has(f.def.key)
  );

  return (
    <aside className="lg:sticky lg:top-32 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto lg:pr-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-heading">Filters</h2>
        {hasAny && (
          <button
            onClick={() => push((q) => facets.forEach((f) => q.delete(f.def.key)))}
            className="text-xs font-medium text-spot-700 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
      <p className="mb-4 font-mono text-[0.6875rem] text-faint">{total.toLocaleString("en-IN")} products</p>

      <div className="divide-y divide-line border-y border-line">
        {facets.map((f) =>
          f.kind === "enum" ? (
            <EnumGroup
              key={f.def.key}
              facet={f}
              selected={selected(f.def.key)}
              onToggle={(v) => toggle(f.def.key, v)}
            />
          ) : (
            <RangeGroup
              key={f.def.key}
              facet={f}
              value={params.get(f.def.key)}
              onApply={(lo, hi) => setRange(f.def.key, lo, hi, f.min, f.max)}
            />
          )
        )}
      </div>
    </aside>
  );
}

function Group({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="py-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint"
      >
        {title}
        <ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function EnumGroup({
  facet, selected, onToggle,
}: { facet: Extract<Facet, { kind: "enum" }>; selected: string[]; onToggle: (v: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const chips = facet.def.facet === "chips";
  const visible = expanded ? facet.values : facet.values.slice(0, chips ? 12 : 6);

  return (
    <Group title={facet.def.label + (facet.def.unit ? ` (${facet.def.unit})` : "")}>
      {chips ? (
        <div className="flex flex-wrap gap-1.5">
          {visible.map((v) => {
            const on = selected.includes(v.value);
            return (
              <button
                key={v.value}
                onClick={() => onToggle(v.value)}
                disabled={v.count === 0}
                aria-pressed={on}
                className={`rounded-sm border px-2.5 py-1 font-mono text-[0.75rem] transition-colors disabled:opacity-40 ${
                  on ? "border-spot-600 bg-spot-600 text-on-accent" : "border-line bg-surface text-body hover:border-spot-600 hover:bg-spot-50"
                }`}
              >
                {v.value}
                <span className={`ml-1.5 text-[0.625rem] ${on ? "text-ink-950/60" : "text-disabled"}`}>{v.count}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <ul className="grid gap-0.5">
          {visible.map((v) => {
            const on = selected.includes(v.value);
            return (
              <li key={v.value}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xs px-1 py-1.5 hover:bg-sunken">
                  <input
                    type="checkbox" checked={on} onChange={() => onToggle(v.value)}
                    className="size-3.5 shrink-0 accent-spot-600"
                  />
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-body">{v.value}</span>
                  <span className="shrink-0 font-mono text-[0.625rem] text-disabled">{v.count}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {facet.values.length > visible.length && !expanded && (
        <button onClick={() => setExpanded(true)} className="mt-2 text-xs font-medium text-spot-700 hover:underline">
          Show {facet.values.length - visible.length} more
        </button>
      )}
    </Group>
  );
}

function RangeGroup({
  facet, value, onApply,
}: { facet: Extract<Facet, { kind: "range" }>; value: string | null; onApply: (lo: number, hi: number) => void }) {
  const isPrice = facet.def.key === "price";
  const min = isPrice ? Math.floor(facet.min / 100) : facet.min;
  const max = isPrice ? Math.ceil(facet.max / 100) : facet.max;
  const parsed = value?.split("-").map(Number);
  const [lo, setLo] = useState(parsed?.[0] ?? min);
  const [hi, setHi] = useState(parsed?.[1] ?? max);

  return (
    <Group title={facet.def.label + (facet.def.unit ? ` (${facet.def.unit})` : "")}>
      {/* engineers type exact values — the slider alone is not enough */}
      <div className="flex items-center gap-2">
        <input
          type="number" value={lo} min={min} max={max}
          onChange={(e) => setLo(Number(e.target.value))}
          onBlur={() => onApply(Math.min(lo, hi), hi)}
          onKeyDown={(e) => e.key === "Enter" && onApply(Math.min(lo, hi), hi)}
          className="w-full rounded-sm border border-line bg-surface px-2 py-1.5 font-mono text-[0.75rem] tnum text-heading outline-none focus:border-spot-600"
          aria-label={`${facet.def.label} minimum`}
        />
        <span className="text-xs text-disabled">to</span>
        <input
          type="number" value={hi} min={min} max={max}
          onChange={(e) => setHi(Number(e.target.value))}
          onBlur={() => onApply(lo, Math.max(lo, hi))}
          onKeyDown={(e) => e.key === "Enter" && onApply(lo, Math.max(lo, hi))}
          className="w-full rounded-sm border border-line bg-surface px-2 py-1.5 font-mono text-[0.75rem] tnum text-heading outline-none focus:border-spot-600"
          aria-label={`${facet.def.label} maximum`}
        />
      </div>
      <input
        type="range" min={min} max={max} value={hi}
        onChange={(e) => setHi(Number(e.target.value))}
        onMouseUp={() => onApply(lo, hi)}
        onTouchEnd={() => onApply(lo, hi)}
        className="mt-3 w-full accent-spot-600"
        aria-label={`${facet.def.label} maximum slider`}
      />
      <div className="mt-1 flex justify-between font-mono text-[0.625rem] text-disabled">
        <span>{min}{facet.def.unit && facet.def.unit !== "₹" ? ` ${facet.def.unit}` : ""}</span>
        <span>{max}{facet.def.unit && facet.def.unit !== "₹" ? ` ${facet.def.unit}` : ""}</span>
      </div>
    </Group>
  );
}
