"use client";

import { useEffect, useState, useTransition } from "react";
import type { Sku } from "@/lib/skus";
import { inr } from "@/lib/catalog";
import { adjustPrice, adjustStock, assignCategory, leafCategories, type BulkResult } from "./actions";

type Panel = null | "price" | "stock" | "category";

/**
 * The bulk bar.
 *
 * Each action opens **inline, under the bar**, rather than in a dialog. A modal
 * for "add 4% to these sixty prices" hides the sixty prices behind the thing
 * asking about them, and the preview line below is the entire reason anybody
 * trusts pressing the button — it says what the first row will become before
 * it becomes it.
 *
 * Only one panel is open at a time, and opening one closes the last result, so
 * a stale "42 changed" can never sit under a form that has not been run.
 */
export function BulkBar({ skus, rows, onClear, onDone }: {
  skus: string[];
  rows: Sku[];
  onClear: () => void;
  onDone: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [pending, startTransition] = useTransition();

  const open = (p: Panel) => { setResult(null); setPanel(panel === p ? null : p); };

  const run = (fn: () => Promise<BulkResult>) =>
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      if (res.ok) { setPanel(null); onDone(); }
    });

  return (
    <div className="mb-3 border border-spot-300 bg-spot-50">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <span className="font-mono text-[0.8125rem] tnum text-spot-900">{skus.length} selected</span>
        <div className="flex flex-wrap gap-2">
          <Tab active={panel === "price"} onClick={() => open("price")}>Adjust price…</Tab>
          <Tab active={panel === "stock"} onClick={() => open("stock")}>Adjust stock…</Tab>
          <Tab active={panel === "category"} onClick={() => open("category")}>Assign category…</Tab>
          <button onClick={() => exportCsv(rows)} className="btn btn-secondary btn-sm">Export CSV</button>
        </div>
        <button onClick={onClear} className="ml-auto text-[0.75rem] text-spot-700 hover:underline">Clear</button>
      </div>

      {panel === "price" && <PricePanel rows={rows} pending={pending} onRun={(m, v) => run(() => adjustPrice(skus, m, v))} />}
      {panel === "stock" && <StockPanel rows={rows} pending={pending} onRun={(m, v) => run(() => adjustStock(skus, m, v))} />}
      {panel === "category" && <CategoryPanel pending={pending} onRun={(p) => run(() => assignCategory(skus, p))} />}

      {result && (
        <div className="border-t border-spot-300 px-4 py-2.5">
          {result.ok ? (
            <p className="font-mono text-[0.8125rem] tnum text-success">
              {result.changed} changed
              {result.failures.length > 0 && (
                <span className="text-warning"> · {result.failures.length} skipped</span>
              )}
            </p>
          ) : (
            <p className="text-[0.8125rem] text-danger">{result.error}</p>
          )}
          {result.ok && result.failures.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {result.failures.slice(0, 8).map((f) => (
                <li key={f.sku} className="font-mono text-[0.75rem] text-warning">
                  <span className="text-heading">{f.sku}</span> — {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PricePanel({ rows, pending, onRun }: {
  rows: Sku[]; pending: boolean; onRun: (mode: "percent" | "set", value: number) => void;
}) {
  const [mode, setMode] = useState<"percent" | "set">("percent");
  const [value, setValue] = useState("");
  const n = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(n) && (mode === "percent" ? n > -100 : n > 0);

  // What the first selected row becomes. One concrete number beats a sentence.
  const sample = rows[0];
  const preview = valid && sample
    ? mode === "set" ? Math.round(n * 100) : Math.round(sample.price * (1 + n / 100))
    : null;

  return (
    <Panel>
      <Choice options={[["percent", "By percent"], ["set", "Set to"]]} value={mode} onChange={(v) => setMode(v as never)} />
      <Field
        value={value} onChange={setValue} pending={pending}
        suffix={mode === "percent" ? "%" : "₹"}
        placeholder={mode === "percent" ? "-5 or 4" : "24.50"}
      />
      {preview !== null && sample && (
        <p className="font-mono text-[0.75rem] tnum text-spot-900">
          {sample.sku}: {inr(sample.price)} → <span className="font-bold">{inr(preview)}</span>
        </p>
      )}
      <Run disabled={!valid || pending} pending={pending} onClick={() => onRun(mode, n)} />
    </Panel>
  );
}

function StockPanel({ rows, pending, onRun }: {
  rows: Sku[]; pending: boolean; onRun: (mode: "set" | "delta", value: number) => void;
}) {
  const [mode, setMode] = useState<"set" | "delta">("set");
  const [value, setValue] = useState("");
  const n = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(n) && (mode === "set" ? n >= 0 : n !== 0);

  const sample = rows[0];
  const preview = valid && sample ? (mode === "set" ? Math.round(n) : sample.stock + Math.round(n)) : null;

  return (
    <Panel>
      <Choice options={[["set", "Count to"], ["delta", "Move by"]]} value={mode} onChange={(v) => setMode(v as never)} />
      <Field value={value} onChange={setValue} pending={pending} suffix="units" placeholder={mode === "set" ? "40" : "-10"} />
      {preview !== null && sample && (
        <p className="font-mono text-[0.75rem] tnum text-spot-900">
          {sample.sku}: {sample.stock} → <span className="font-bold">{preview < 0 ? "blocked" : preview}</span>
        </p>
      )}
      <p className="basis-full font-mono text-[0.6875rem] text-spot-900/70">
        Written as counted movements — the ledger keeps who asserted what.
      </p>
      <Run disabled={!valid || pending} pending={pending} onClick={() => onRun(mode, n)} />
    </Panel>
  );
}

function CategoryPanel({ pending, onRun }: { pending: boolean; onRun: (path: string) => void }) {
  const [cats, setCats] = useState<{ path: string; name: string }[]>([]);
  const [path, setPath] = useState("");

  // Fetched on open rather than shipped with the page: 389 leaves is a payload
  // every visitor to this screen would pay for and almost nobody uses.
  useEffect(() => { leafCategories().then(setCats); }, []);

  return (
    <Panel>
      <select
        value={path}
        onChange={(e) => setPath(e.target.value)}
        aria-label="Category"
        className="h-8 max-w-md flex-1 border border-spot-300 bg-surface px-2 text-[0.8125rem] text-heading outline-none focus:border-spot-600"
      >
        <option value="">{cats.length ? "Pick a shelf…" : "Loading…"}</option>
        {cats.map((c) => <option key={c.path} value={c.path}>{c.name}</option>)}
      </select>
      <p className="basis-full font-mono text-[0.6875rem] text-spot-900/70">
        The shelf belongs to the product, so variants of one product move together.
      </p>
      <Run disabled={!path || pending} pending={pending} onClick={() => onRun(path)} />
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3 border-t border-spot-300 px-4 py-3">{children}</div>
);

/** A bar button that stays lit while its panel is open — the panel is its state. */
const Tab = ({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    aria-expanded={active}
    className={`btn btn-sm ${active ? "btn-primary" : "btn-secondary"}`}
  >
    {children}
  </button>
);

function Choice({ options, value, onChange }: {
  options: [string, string][]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex border border-spot-300 p-0.5" role="group">
      {options.map(([v, label]) => (
        <button
          key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          className={`px-2.5 py-1 text-[0.75rem] font-medium transition-colors ${
            value === v ? "bg-spot-600 text-on-accent" : "text-spot-900 hover:bg-spot-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Field({ value, onChange, pending, suffix, placeholder }: {
  value: string; onChange: (v: string) => void; pending: boolean; suffix: string; placeholder: string;
}) {
  return (
    <label className="flex h-8 items-center gap-1.5 border border-spot-300 bg-surface px-2">
      <input
        inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
        disabled={pending} placeholder={placeholder} aria-label={suffix}
        className="w-24 bg-transparent font-mono text-[0.8125rem] tnum text-heading outline-none placeholder:text-disabled"
      />
      <span className="font-mono text-[0.6875rem] text-faint">{suffix}</span>
    </label>
  );
}

const Run = ({ disabled, pending, onClick }: { disabled: boolean; pending: boolean; onClick: () => void }) => (
  <button onClick={onClick} disabled={disabled} className="btn btn-primary btn-sm disabled:opacity-40">
    {pending ? "Applying…" : "Apply"}
  </button>
);

/**
 * Export is the one action here that needs no server: the rows are already in
 * the browser, and round-tripping them to ask for them back would be slower and
 * no more correct.
 */
function exportCsv(rows: Sku[]) {
  const cols = ["sku", "title", "price", "stock", "category"];
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const csv = [
    cols.join(","),
    ...rows.map((r) => [
      r.sku,
      r.title,
      (r.price / 100).toFixed(2),
      String(r.stock),
      r.categories[0].join("."),
    ].map(esc).join(",")),
  ].join("\n");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
