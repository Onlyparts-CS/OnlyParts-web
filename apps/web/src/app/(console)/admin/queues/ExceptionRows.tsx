"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { triageException } from "./exceptions";
import { EXCEPTION_STATUS, type ExceptionStatus } from "@/collections/ImportExceptions";

export type ExceptionRow = {
  id: number;
  sku: string;
  source: string;
  at: string;
  reasons: string;
  status: ExceptionStatus;
  note: string | null;
  row: Record<string, string> | null;
};

const LABEL: Record<ExceptionStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  ignored: "Ignored",
};

/**
 * The rejected rows, and a way to clear them.
 *
 * "Download the open rows" is the point of the whole screen. The workbench
 * already offered the failures of *one* run while its tab was open; this offers
 * every open failure across every import, as a sheet you can correct and
 * re-upload. That round trip is the actual job — the triage below is only for
 * rows that will never be imported.
 */
export function ExceptionRows({ rows }: { rows: ExceptionRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  const open = rows.filter((r) => r.status === "open");

  const download = () => {
    /*
      Columns are the union of every open row's keys, not a fixed list. Two
      imports can carry different columns and a fixed header would silently
      drop whichever one it did not know about.
    */
    const cols = [...new Set(open.flatMap((r) => Object.keys(r.row ?? {})))];
    if (!cols.length) return;
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [
      [...cols, "_reason"].join(","),
      ...open.map((r) => [...cols.map((c) => r.row?.[c] ?? ""), r.reasons].map(esc).join(",")),
    ].join("\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `onlyparts-import-exceptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const set = (id: number, status: ExceptionStatus, note: string) =>
    startTransition(async () => {
      const res = await triageException(id, status, note);
      if (!res.ok) { setError(res.error); return; }
      setError("");
      router.refresh();
    });

  return (
    <>
      {error && (
        <p className="mb-3 border border-danger/30 bg-danger-bg px-4 py-2.5 text-[0.875rem] text-danger">{error}</p>
      )}

      {open.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button onClick={download} className="btn btn-secondary btn-sm">
            Download {open.length} open {open.length === 1 ? "row" : "rows"} as CSV
          </button>
          <span className="text-[0.75rem] text-faint">
            Fix the cells, re-upload, and the rows that import cleanly stop appearing here.
          </span>
        </div>
      )}

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="bin border-b border-line bg-sunken">
              <th className="px-4 py-2.5 font-bold">SKU</th>
              <th className="px-3 py-2.5 font-bold">Why it was refused</th>
              <th className="px-3 py-2.5 font-bold">From</th>
              <th className="px-3 py-2.5 font-bold">When</th>
              <th className="w-52 px-3 py-2.5 font-bold">Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.id} r={r} pending={pending} onSet={set} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ r, pending, onSet }: {
  r: ExceptionRow;
  pending: boolean;
  onSet: (id: number, s: ExceptionStatus, note: string) => void;
}) {
  const [note, setNote] = useState(r.note ?? "");

  return (
    <tr className={`border-b border-line last:border-0 ${r.status !== "open" ? "opacity-60" : ""}`}>
      <td className="whitespace-nowrap px-4 py-2.5 align-top font-mono text-[0.75rem] text-heading">{r.sku}</td>
      <td className="px-3 py-2.5 align-top">
        <span className="block max-w-md text-[0.8125rem] leading-relaxed text-danger">{r.reasons}</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was decided"
          aria-label={`Note for ${r.sku}`}
          className="mt-1.5 h-7 w-full max-w-md border border-line bg-surface px-2 text-[0.75rem] text-heading outline-none placeholder:text-disabled focus:border-spot-600"
        />
      </td>
      <td className="px-3 py-2.5 align-top font-mono text-[0.6875rem] text-faint">{r.source}</td>
      <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-[0.6875rem] tnum text-faint">{r.at}</td>
      <td className="px-3 py-2.5 align-top">
        <div className="flex flex-wrap gap-1">
          {EXCEPTION_STATUS.map((s) => (
            <button
              key={s}
              onClick={() => onSet(r.id, s, note)}
              disabled={pending || (s === r.status && note === (r.note ?? ""))}
              aria-pressed={s === r.status}
              className={`px-2 py-1 text-[0.6875rem] font-medium transition-colors disabled:opacity-40 ${
                s === r.status
                  ? "bg-ink-900 text-bg"
                  : "border border-line text-muted hover:border-line-strong hover:text-heading"
              }`}
            >
              {LABEL[s]}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
}
