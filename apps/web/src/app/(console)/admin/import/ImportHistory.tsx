"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revertImport } from "./revert";

export type BatchSummary = {
  id: number;
  filename: string;
  at: string;
  actor: string | null;
  created: number;
  updated: number;
  status: "applied" | "reverted";
  revertedAt: string | null;
  revertedBy: string | null;
};

/**
 * Recent imports, and the undo.
 *
 * Reverting is a bulk write to a live catalogue, so it asks first — but
 * inline, in the row, rather than in a dialog. A modal here would cover the
 * list the operator is using to decide *which* import to undo.
 *
 * Only the most recent applied batch offers a revert. Undoing an older one
 * while a newer one sits on top of it would restore a snapshot over values the
 * later import deliberately set, and the result would be neither state.
 */
export function ImportHistory({ batches, revertableId }: {
  batches: BatchSummary[];
  revertableId: number | null;
}) {
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!batches.length) return null;

  const run = (id: number) =>
    startTransition(async () => {
      const res = await revertImport(id);
      setConfirming(null);
      if (!res.ok) { setError(res.error); return; }
      setError("");
      setDone(
        `${res.restored} restored, ${res.retired} retired` +
        (res.failures.length ? ` · ${res.failures.length} failed` : ""),
      );
      router.refresh();
    });

  return (
    <section className="section-gap">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg">Recent imports</h2>
        <p className="bin">prior values kept per row</p>
      </div>

      {error && (
        <p className="mb-3 border border-danger/30 bg-danger-bg px-4 py-2.5 text-[0.875rem] text-danger">{error}</p>
      )}
      {done && (
        <p className="mb-3 border border-success/30 bg-success-bg px-4 py-2.5 text-[0.875rem] text-success">
          Reverted — {done}
        </p>
      )}

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="bin border-b border-line bg-sunken">
              <th className="px-4 py-2.5 font-bold">File</th>
              <th className="px-3 py-2.5 font-bold">When</th>
              <th className="px-3 py-2.5 font-bold">By</th>
              <th className="px-3 py-2.5 text-right font-bold">Created</th>
              <th className="px-3 py-2.5 text-right font-bold">Updated</th>
              <th className="px-3 py-2.5 font-bold">State</th>
              <th className="w-44 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className={`border-b border-line last:border-0 ${b.status === "reverted" ? "opacity-60" : ""}`}>
                <td className="px-4 py-2.5 font-mono text-[0.75rem] text-heading">{b.filename}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.75rem] tnum text-muted">{b.at}</td>
                <td className="px-3 py-2.5 font-mono text-[0.6875rem] text-faint">{b.actor ?? "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[0.8125rem] tnum text-heading">{b.created}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[0.8125rem] tnum text-heading">{b.updated}</td>
                <td className="px-3 py-2.5">
                  <span className={`stamp stamp-flat ${b.status === "reverted" ? "text-ink-500" : "text-success"}`}>
                    {b.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {b.status === "reverted" ? (
                    <span className="bin">{b.revertedAt}</span>
                  ) : b.id !== revertableId ? (
                    /*
                      Named, not just disabled. "Why is this greyed out" has one
                      answer and the row may as well give it.
                    */
                    <span className="bin">superseded</span>
                  ) : confirming === b.id ? (
                    <span className="flex items-center justify-end gap-2">
                      <button onClick={() => run(b.id)} disabled={pending}
                        className="btn btn-primary btn-sm disabled:opacity-40">
                        {pending ? "Reverting…" : "Yes, revert"}
                      </button>
                      <button onClick={() => setConfirming(null)} disabled={pending}
                        className="text-[0.75rem] text-muted hover:underline">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => { setError(""); setDone(""); setConfirming(b.id); }}
                      className="btn btn-secondary btn-sm">
                      Revert
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 max-w-3xl text-[0.8125rem] leading-relaxed text-faint">
        A revert restores each row to the values recorded at commit time. Products the
        import <em>created</em> are retired rather than deleted — between the import and
        now somebody may have bought one, and an order line points at the variant.
        Stock is corrected with a new counted movement, so the ledger can still explain
        its own total.
      </p>
    </section>
  );
}
