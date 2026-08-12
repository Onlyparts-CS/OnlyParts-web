"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SORTS } from "@/lib/facets";

export function PlpControls({
  chips, total,
}: {
  chips: { key: string; label: string; value?: string }[];
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (mutate: (q: URLSearchParams) => void) => {
    const q = new URLSearchParams(params.toString());
    mutate(q);
    router.replace(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  const removeChip = (key: string, value?: string) =>
    set((q) => {
      if (!value) { q.delete(key); return; }
      const next = (q.get(key) ?? "").split(",").filter((v) => v && v !== value);
      if (next.length) q.set(key, next.join(","));
      else q.delete(key);
    });

  const view = params.get("view") === "table" ? "table" : "grid";
  const sort = params.get("sort") ?? "relevance";

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <p className="font-mono text-[0.8125rem] text-faint">
        <span className="text-heading">{total.toLocaleString("en-IN")}</span> products
      </p>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key + c.label}
              onClick={() => removeChip(c.key, c.value)}
              className="inline-flex items-center gap-1.5 rounded-full border border-spot-300 bg-spot-50 px-2.5 py-1 font-mono text-[0.6875rem] text-spot-800 transition-colors hover:border-spot-600 hover:bg-spot-100"
            >
              {c.label}
              <span aria-hidden className="font-bold opacity-60">×</span>
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* parametric table view — FR-24, the DigiKey pattern */}
        <div className="flex rounded-sm border border-line p-0.5" role="group" aria-label="View">
          {(["grid", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => set((q) => (v === "grid" ? q.delete("view") : q.set("view", v)))}
              aria-pressed={view === v}
              className={`rounded-xs px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                view === v ? "bg-spot-600 text-on-accent" : "text-muted hover:bg-sunken"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-faint">
          Sort
          <select
            value={sort}
            onChange={(e) => set((q) => (e.target.value === "relevance" ? q.delete("sort") : q.set("sort", e.target.value)))}
            className="rounded-sm border border-line bg-surface px-2 py-1.5 text-[0.8125rem] text-heading outline-none focus:border-spot-600"
          >
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
