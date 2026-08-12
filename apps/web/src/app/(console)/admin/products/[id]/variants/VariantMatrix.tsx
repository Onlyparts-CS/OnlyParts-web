"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createVariants, type MatrixRow, type RowResult } from "./actions";
import type { TemplateField } from "../../new/actions";

/* ============================================================
   The variant matrix.
   ------------------------------------------------------------
   A fastener product is not one row. "M3 Hex Socket Head Cap
   Screw, SS304" is eight lengths × three materials, and typing
   twenty-four near-identical records by hand is how a catalogue
   ends up with three different weights for the same screw.

   Three steps, in the order the work actually happens:
     1  pick the axes and the values on each
     2  name them — a SKU pattern, because real part numbers are
        patterns and typing twenty-four of them is not a task
     3  price and weigh them, filling down where they agree

   The cross-product is generated, never typed. That is the
   whole point.
   ============================================================ */

export function VariantMatrix({
  productId, productTitle, categoryPath, template, existingSkus,
}: {
  productId: number | string;
  productTitle: string;
  categoryPath: string;
  template: TemplateField[];
  existingSkus: string[];
}) {
  /** Only enums can be an axis — a free-text spec has no finite value set. */
  const axisFields = useMemo(() => template.filter((t) => t.enumValues.length > 0), [template]);

  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [pattern, setPattern] = useState("");
  const [defaults, setDefaults] = useState({ price: "", weightG: "", stock: "0" });
  const [overrides, setOverrides] = useState<Record<string, Partial<MatrixRow>>>({});
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [pending, start] = useTransition();

  const toggle = (key: string, value: string) =>
    setPicked((p) => {
      const cur = p[key] ?? [];
      return { ...p, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });

  /** Cartesian product of every axis that has at least one value ticked. */
  const combos = useMemo(() => {
    const active = axisFields
      .map((f) => ({ key: f.key, values: picked[f.key] ?? [] }))
      .filter((a) => a.values.length > 0);
    if (!active.length) return [];
    return active.reduce<Record<string, string>[]>(
      (acc, axis) => acc.flatMap((row) => axis.values.map((v) => ({ ...row, [axis.key]: v }))),
      [{}],
    );
  }, [axisFields, picked]);

  /** `FS-SHC-{thread}-{length_mm}` → `FS-SHC-M3-10`, non-alphanumerics stripped. */
  const skuFor = (specs: Record<string, string>) =>
    (pattern || "SKU")
      .replace(/\{(\w+)\}/g, (_, k: string) => (specs[k] ?? "").toString())
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "");

  const rows: MatrixRow[] = combos.map((specs) => {
    const id = JSON.stringify(specs);
    const o = overrides[id] ?? {};
    return {
      specs,
      sku: o.sku ?? skuFor(specs),
      price: o.price ?? defaults.price,
      weightG: o.weightG ?? defaults.weightG,
      stock: o.stock ?? defaults.stock,
    };
  });

  const setRow = (specs: Record<string, string>, patch: Partial<MatrixRow>) =>
    setOverrides((p) => {
      const id = JSON.stringify(specs);
      return { ...p, [id]: { ...p[id], ...patch } };
    });

  const taken = new Set(existingSkus.map((s) => s.toUpperCase()));
  const dupes = rows.filter((r) => taken.has(r.sku.toUpperCase())).length;
  const blanks = rows.filter((r) => !r.price || !r.weightG).length;

  const submit = () =>
    start(async () => {
      const res = await createVariants(productId, categoryPath, rows);
      setResults(res.results);
    });

  if (results) {
    const ok = results.filter((r) => r.ok);
    const bad = results.filter((r) => !r.ok);
    return (
      <div className="grid gap-4">
        <div className={`border p-5 ${bad.length ? "border-warning/40 bg-warning-bg" : "border-success/30 bg-success-bg"}`}>
          <p className="font-mono text-[0.875rem] font-medium">
            {ok.length} of {results.length} written{bad.length ? ` · ${bad.length} refused` : ""}
          </p>
        </div>
        {bad.length > 0 && (
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line bg-sunken">
                  <Th>SKU</Th><Th>Why it was refused</Th>
                </tr>
              </thead>
              <tbody>
                {bad.map((r) => (
                  <tr key={r.sku} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-2 font-mono text-[0.75rem]">{r.sku}</td>
                    <td className="px-3 py-2 text-danger">{r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => { setResults(null); setOverrides({}); }} className="btn btn-secondary btn-sm">
            Back to the matrix
          </button>
          <Link href="/admin/products" className="btn btn-ghost btn-sm">All products</Link>
        </div>
      </div>
    );
  }

  if (axisFields.length === 0) {
    return (
      <p className="border border-dashed border-line bg-surface p-5 text-[0.875rem] text-muted">
        This shelf has no list-valued specs, so there is nothing to build a matrix from.
        Add an enum attribute — thread, material, size — in the CMS first, or add a single
        variant by hand.
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      {/* ---------- 1. axes ---------- */}
      <Step n={1} title="Pick the axes" note={`Which specs vary across ${productTitle}. Tick every value you stock.`}>
        <div className="grid gap-4">
          {axisFields.map((f) => (
            <div key={f.key}>
              <p className="mb-2 text-[0.8125rem] font-medium text-heading">
                {f.label}{f.unit ? ` (${f.unit})` : ""}
                <span className="bin ml-2">{(picked[f.key] ?? []).length} of {f.enumValues.length}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {f.enumValues.map((v) => {
                  const on = (picked[f.key] ?? []).includes(v);
                  return (
                    <button key={v} onClick={() => toggle(f.key, v)} aria-pressed={on}
                      className={`border px-2.5 py-1 font-mono text-[0.75rem] transition-colors ${
                        on ? "border-spot-600 bg-spot-600 text-on-accent" : "border-line text-muted hover:border-line-strong hover:text-heading"
                      }`}>
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Step>

      {/* ---------- 2. names ---------- */}
      <Step n={2} title="Name them"
        note="A pattern, because part numbers are patterns. Use {key} for a spec — they are listed below.">
        <input value={pattern} onChange={(e) => setPattern(e.target.value)}
          placeholder={`FS-SHC-{${axisFields[0]?.key ?? "thread"}}`}
          className="h-10 w-full rounded-sm border border-line bg-surface px-3 font-mono text-[0.875rem] text-heading outline-none focus:border-spot-600" />
        <p className="mt-2 flex flex-wrap gap-1.5">
          {axisFields.map((f) => (
            <button key={f.key} onClick={() => setPattern((p) => `${p}{${f.key}}`)}
              className="border border-line px-2 py-0.5 font-mono text-[0.6875rem] text-muted hover:border-spot-600 hover:text-spot-700">
              {`{${f.key}}`}
            </button>
          ))}
        </p>
      </Step>

      {/* ---------- 3. the grid ---------- */}
      <Step n={3} title={`Price and weigh — ${rows.length} variant${rows.length === 1 ? "" : "s"}`}
        note="Set one value to fill the column; edit any cell that differs.">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Fill label="Price for one (₹)" value={defaults.price}
            onChange={(v) => setDefaults((d) => ({ ...d, price: v }))} />
          <Fill label="Weight (g)" value={defaults.weightG}
            onChange={(v) => setDefaults((d) => ({ ...d, weightG: v }))} />
          <Fill label="Opening stock" value={defaults.stock}
            onChange={(v) => setDefaults((d) => ({ ...d, stock: v }))} />
        </div>

        {rows.length === 0 ? (
          <p className="border border-dashed border-line p-4 text-[0.8125rem] text-faint">
            Tick at least one value above and the matrix appears here.
          </p>
        ) : (
          <>
            <div className="max-h-[26rem] overflow-auto border border-line">
              <table className="w-full min-w-[42rem] text-left text-[0.8125rem]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-line bg-sunken">
                    {axisFields.filter((f) => (picked[f.key] ?? []).length).map((f) => <Th key={f.key}>{f.label}</Th>)}
                    <Th>SKU</Th><Th>₹</Th><Th>g</Th><Th>Stock</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const dup = taken.has(r.sku.toUpperCase());
                    return (
                      <tr key={JSON.stringify(r.specs)} className="border-b border-line bg-surface last:border-b-0">
                        {axisFields.filter((f) => (picked[f.key] ?? []).length).map((f) => (
                          <td key={f.key} className="px-2 py-1 font-mono text-[0.75rem] text-muted">{r.specs[f.key]}</td>
                        ))}
                        <td className="px-2 py-1">
                          <input value={r.sku} onChange={(e) => setRow(r.specs, { sku: e.target.value.toUpperCase() })}
                            className={`h-8 w-full border bg-bg px-2 font-mono text-[0.75rem] outline-none focus:border-spot-600 ${
                              dup ? "border-danger text-danger" : "border-line text-heading"
                            }`} />
                        </td>
                        <Cell value={r.price} onChange={(v) => setRow(r.specs, { price: v })} />
                        <Cell value={r.weightG} onChange={(v) => setRow(r.specs, { weightG: v })} />
                        <Cell value={r.stock} onChange={(v) => setRow(r.specs, { stock: v })} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={submit} disabled={pending || dupes > 0 || blanks > 0}
                className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50">
                {pending ? "Writing…" : `Create ${rows.length} variant${rows.length === 1 ? "" : "s"}`}
              </button>
              {dupes > 0 && <span className="text-[0.8125rem] text-danger">{dupes} SKU{dupes === 1 ? "" : "s"} already exist.</span>}
              {blanks > 0 && <span className="text-[0.8125rem] text-warning">{blanks} row{blanks === 1 ? "" : "s"} missing price or weight.</span>}
            </div>
          </>
        )}
      </Step>
    </div>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="bin px-2 py-2">{children}</th>
);

const Cell = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <td className="px-2 py-1">
    <input value={value} inputMode="decimal" onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full border border-line bg-bg px-2 text-right font-mono text-[0.75rem] text-heading outline-none focus:border-spot-600 tnum" />
  </td>
);

function Fill({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.75rem] font-medium text-heading">{label}</span>
      <input value={value} inputMode="decimal" onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-sm border border-line bg-surface px-3 font-mono text-[0.8125rem] text-heading outline-none focus:border-spot-600" />
    </label>
  );
}

function Step({ n, title, note, children }: {
  n: number; title: string; note?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-line bg-surface p-5 shadow-e1">
      <div className="mb-1 flex items-baseline gap-2.5">
        <span className="grid size-5 shrink-0 place-items-center bg-spot-600 font-mono text-[0.625rem] font-bold text-on-accent">{n}</span>
        <h2 className="text-[1.0625rem] text-heading">{title}</h2>
      </div>
      {note && <p className="mb-4 ml-[1.9rem] text-[0.8125rem] leading-relaxed text-muted">{note}</p>}
      <div className="ml-[1.9rem]">{children}</div>
    </section>
  );
}
