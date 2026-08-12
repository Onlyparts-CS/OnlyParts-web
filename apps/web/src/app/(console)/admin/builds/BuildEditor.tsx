"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBuild, saveBuildItems, findProducts, type BuildItemInput } from "./actions";

export type BuildRow = {
  id: number;
  name: string;
  slug: string;
  blurb: string;
  glyph: string;
  position: number;
  items: { product: number; title: string; path: string; note: string }[];
};

/** The line-art set in `components/Glyph.tsx`; anything else renders nothing. */
const GLYPHS = ["prop", "nozzle", "rotor", "hub", "endmill", "wrench", "chip",
  "cell", "bearing", "magnet", "hex", "extrusion", "contactor"];

/**
 * One build, and its bill of materials.
 *
 * Expanded in place rather than on its own route: curating is a search, a
 * click and a sentence, repeated — and a page navigation between each one is
 * what stops anybody finishing a list.
 *
 * There is no "add everything in this category" and there will not be. That
 * shortcut is exactly how the prototype ended up claiming an M8 cap screw was
 * a drone part.
 */
export function BuildEditor({ build }: { build: BuildRow }) {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState({
    name: build.name, slug: build.slug, blurb: build.blurb,
    glyph: build.glyph, position: build.position,
  });
  const [items, setItems] = useState(build.items);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: number; title: string; path: string }[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const search = (value: string) => {
    setQ(value);
    if (value.trim().length < 2) { setHits([]); return; }
    startTransition(async () => setHits(await findProducts(value)));
  };

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, msg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) { setError(res.error); setSaved(""); return; }
      setError(""); setSaved(msg);
      router.refresh();
    });

  const add = (p: { id: number; title: string; path: string }) => {
    if (items.some((i) => i.product === p.id)) {
      setError("That product is already in this build.");
      return;
    }
    setItems([...items, { product: p.id, title: p.title, path: p.path, note: "" }]);
    setQ(""); setHits([]); setError("");
  };

  const saveItems = () =>
    run(
      () => saveBuildItems(build.id, items.map((i, n): BuildItemInput => ({ product: i.product, note: i.note, position: n }))),
      `${items.length} parts saved`,
    );

  return (
    <article className="border border-line bg-surface">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-sunken"
      >
        <span className="monumental text-[1.0625rem]">{build.name}</span>
        <span className="bin">/projects/{build.slug}</span>
        <span className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[0.8125rem] tnum text-muted">
            {items.length} {items.length === 1 ? "part" : "parts"}
          </span>
          <span aria-hidden className="text-disabled">{open ? "−" : "+"}</span>
        </span>
      </button>

      {open && (
        <div className="border-t border-line">
          {/* ---------------- the build itself ---------------- */}
          <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2">
            <label className="block">
              <span className="bin mb-1 block">Name — renders as “Build a …”</span>
              <input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                className="h-9 w-full border border-line bg-bg px-2.5 text-[0.875rem] text-heading outline-none focus:border-spot-600" />
            </label>
            <label className="block">
              <span className="bin mb-1 block">Slug</span>
              <input value={meta.slug} onChange={(e) => setMeta({ ...meta, slug: e.target.value })}
                className="h-9 w-full border border-line bg-bg px-2.5 font-mono text-[0.8125rem] text-heading outline-none focus:border-spot-600" />
            </label>
            <label className="block sm:col-span-2">
              <span className="bin mb-1 block">Blurb</span>
              <textarea value={meta.blurb} onChange={(e) => setMeta({ ...meta, blurb: e.target.value })} rows={2}
                className="w-full border border-line bg-bg p-2.5 text-[0.875rem] leading-relaxed text-heading outline-none focus:border-spot-600" />
            </label>
            <label className="block">
              <span className="bin mb-1 block">Plate</span>
              <select value={meta.glyph} onChange={(e) => setMeta({ ...meta, glyph: e.target.value })}
                className="h-9 w-full border border-line bg-bg px-2 text-[0.8125rem] text-heading outline-none focus:border-spot-600">
                <option value="">—</option>
                {GLYPHS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="bin mb-1 block">Order</span>
              <input type="number" value={meta.position}
                onChange={(e) => setMeta({ ...meta, position: Number(e.target.value) })}
                className="h-9 w-full border border-line bg-bg px-2.5 font-mono text-[0.8125rem] tnum text-heading outline-none focus:border-spot-600" />
            </label>
            <div className="sm:col-span-2">
              <button onClick={() => run(() => saveBuild(build.id, meta), "Build saved")}
                disabled={pending} className="btn btn-secondary btn-sm disabled:opacity-40">
                {pending ? "Saving…" : "Save build"}
              </button>
            </div>
          </div>

          {/* ---------------- the BOM ---------------- */}
          <div className="p-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-[0.9375rem]">Parts</h3>
              <p className="bin">a note per part, saying why this build wants it</p>
            </div>

            <div className="relative">
              <input
                value={q}
                onChange={(e) => search(e.target.value)}
                placeholder="Search products to add — at least two letters"
                className="h-9 w-full border border-line bg-bg px-2.5 text-[0.875rem] text-heading outline-none placeholder:text-disabled focus:border-spot-600"
              />
              {hits.length > 0 && (
                <ul className="absolute inset-x-0 z-10 border border-line-strong bg-surface shadow-e2">
                  {hits.map((h) => (
                    <li key={h.id} className="border-b border-line last:border-0">
                      <button onClick={() => add(h)}
                        className="block w-full px-2.5 py-2 text-left hover:bg-sunken">
                        <span className="block text-[0.8125rem] text-heading">{h.title}</span>
                        <span className="bin">{h.path.replace(/\./g, " › ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length === 0 ? (
              <p className="mt-3 border border-dashed border-line-strong bg-bg p-4 text-[0.8125rem] text-muted">
                No parts yet. A build with nothing in it renders its page but has no bill
                of materials, so the “Add all to cart” button has nothing to add.
              </p>
            ) : (
              <ul className="mt-3 grid gap-px bg-line">
                {items.map((i, n) => (
                  <li key={i.product} className="grid gap-2 bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                    <span className="min-w-0">
                      <span className="block truncate text-[0.8125rem] text-heading">{i.title}</span>
                      <span className="bin">{i.path.replace(/\./g, " › ")}</span>
                    </span>
                    <input
                      value={i.note}
                      onChange={(e) => setItems(items.map((x, k) => (k === n ? { ...x, note: e.target.value } : x)))}
                      placeholder="Why this build wants it"
                      className="h-8 w-full border border-line bg-bg px-2 text-[0.75rem] text-heading outline-none placeholder:text-disabled focus:border-spot-600"
                    />
                    <span className="flex items-center gap-1">
                      <button onClick={() => { const c = [...items]; [c[n], c[n - 1]] = [c[n - 1], c[n]]; setItems(c); }}
                        disabled={n === 0} aria-label="Move up"
                        className="grid size-7 place-items-center border border-line text-muted hover:text-heading disabled:opacity-30">↑</button>
                      <button onClick={() => { const c = [...items]; [c[n], c[n + 1]] = [c[n + 1], c[n]]; setItems(c); }}
                        disabled={n === items.length - 1} aria-label="Move down"
                        className="grid size-7 place-items-center border border-line text-muted hover:text-heading disabled:opacity-30">↓</button>
                      <button onClick={() => setItems(items.filter((_, k) => k !== n))} aria-label={`Remove ${i.title}`}
                        className="grid size-7 place-items-center border border-line text-muted hover:border-danger hover:text-danger">×</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button onClick={saveItems} disabled={pending} className="btn btn-primary btn-sm disabled:opacity-40">
                {pending ? "Saving…" : "Save parts"}
              </button>
              {saved && <span className="font-mono text-[0.75rem] text-success">{saved}</span>}
              {error && <span className="text-[0.8125rem] text-danger">{error}</span>}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
