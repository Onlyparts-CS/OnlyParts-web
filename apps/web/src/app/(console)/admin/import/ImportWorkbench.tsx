"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { errorCsv, SAMPLE_CSV, IMPORT_FIELDS, type DryRun, type RowOutcome } from "@/lib/import";
import { analyseImport, commitImport, type CommitResult } from "./actions";
import { UploadIcon, CheckIcon } from "@/components/Icons";

type Phase = "upload" | "review" | "done";

/**
 * Bulk import — docs/14-ADMIN-CATALOG-OPS.md §4.
 *
 * The whole point is the dry run. An import that changes 8,000 prices looks
 * identical to one that changes 3 until you show the counts, so nothing commits
 * until a human has seen them.
 *
 * The file is read in the browser and the *text* is posted to a Server Action;
 * the diff and the write both happen there, against Postgres. Nothing about
 * what will change is decided on this side — the browser's copy of the diff
 * exists to be looked at, and the commit re-derives it from the same text.
 */
export function ImportWorkbench({ projectSlugs }: { projectSlugs: string[] }) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [filename, setFilename] = useState("");
  const [csv, setCsv] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<DryRun | null>(null);
  // Reset with every new analysis: a tick that survives a fresh sheet is a
  // confirmation of a count the operator never saw.
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [commit, setCommit] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RowOutcome["kind"] | "all">("all");
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const analyse = (text: string, name: string) => {
    setError(null);
    setFilename(name);
    setCsv(text);
    startTransition(async () => {
      const res = await analyseImport(text);
      if (!res.ok) { setError(res.error); return; }
      setHeaders(res.headers);
      setConfirmBulk(false);
      setResult(res.result);
      setPhase("review");
    });
  };

  const runCommit = () => {
    setError(null);
    startTransition(async () => {
      // The filename rides along so the undo record is identifiable later —
      // "import.csv" three times in a history list helps nobody.
      const res = await commitImport(csv, filename, confirmBulk);
      if (!res.ok) { setError(res.error); return; }
      setCommit(res);
      setPhase("done");
      // Pull the history table below into step with what just happened.
      router.refresh();
    });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    analyse(await file.text(), file.name);
  };

  const downloadErrors = () => {
    if (!result) return;
    const blob = new Blob([errorCsv(result.outcomes, headers)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename.replace(/\.csv$/i, "") + "-errors.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const reset = () => {
    setPhase("upload"); setResult(null); setCommit(null); setError(null);
    setFilename(""); setCsv(""); setFilter("all");
  };

  return (
    <div className="container-page page-shell">
      <h1 className="text-[clamp(1.5rem,3vw,2.25rem)]">Bulk import</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Upload a CSV of products, prices or stock levels. The diff is computed
        against the live catalogue, and nothing is written until you have seen it.
      </p>

      {error && (
        <p className="mt-4 border border-danger/30 bg-danger-bg px-4 py-3 text-[0.875rem] text-danger">
          <strong>Stopped.</strong> {error}
        </p>
      )}

      {/* ---------------- upload ---------------- */}
      {phase === "upload" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files[0]); }}
              className={`rounded-md border-2 border-dashed p-10 text-center transition-colors ${
                dragging ? "border-spot-600 bg-spot-50" : "border-line-strong bg-surface"
              }`}
            >
              <UploadIcon className="mx-auto mb-3 size-8 text-spot-600" />
              <p className="text-[0.9375rem] font-medium text-heading">
                {pending ? "Reading the catalogue…" : "Drop a CSV here"}
              </p>
              <button onClick={() => inputRef.current?.click()} disabled={pending}
                className="btn btn-secondary btn-sm mt-3 disabled:opacity-50">
                Browse files
              </button>
              <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only"
                onChange={(e) => onFile(e.target.files?.[0])} />
              <p className="mt-4 font-mono text-[0.6875rem] text-disabled">
                CSV · first row is the header · rows commit in chunks of 100
              </p>
            </div>

            <button
              onClick={() => analyse(SAMPLE_CSV, "sample-import.csv")}
              disabled={pending}
              className="btn btn-primary btn-sm mt-4 disabled:opacity-50"
            >
              {pending ? "Working…" : "Try the sample file"}
            </button>
            <p className="mt-2 text-[0.75rem] text-faint">
              Seven rows against the real catalogue — a price change, a stock change, a
              new product, an unchanged row, and three that fail validation in
              different ways.
            </p>
          </div>

          <aside className="rounded-md border border-line bg-surface p-4">
            <h2 className="bin mb-2">
              Recognised columns
            </h2>
            <p className="mb-3 text-[0.75rem] text-muted">
              <span className="font-mono text-heading">sku</span> is required on every row.
              Anything unrecognised is ignored with a warning.
            </p>
            <div className="flex flex-wrap gap-1">
              {IMPORT_FIELDS.map((f) => (
                <span key={f} className="rounded-xs bg-sunken px-1.5 py-0.5 font-mono text-[0.625rem] text-faint">{f}</span>
              ))}
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <h3 className="bin mb-1.5">
                Project tags
              </h3>
              <p className="text-[0.75rem] leading-relaxed text-muted">
                <span className="font-mono text-heading">projects</span> takes a
                pipe-separated list and decides where the part appears under
                &ldquo;Used in these projects&rdquo;. It is a judgement call, which is why
                it is set here rather than inferred from the category — a drone contains
                fasteners, but that does not make every fastener a drone part.
                Leaving it blank is normal.
              </p>
              {projectSlugs.length === 0 ? (
                <p className="mt-2 text-[0.75rem] text-warning">
                  No builds are defined yet, so any value in this column will fail the
                  row. Create one under Builds in the CMS first.
                </p>
              ) : (
                <>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {projectSlugs.map((s) => (
                      <span key={s} className="bg-spot-50 px-1.5 py-0.5 font-mono text-[0.625rem] text-spot-700">{s}</span>
                    ))}
                  </div>
                  <p className="mt-2 font-mono text-[0.6875rem] text-disabled">
                    {projectSlugs.slice(0, 2).join("|")}
                  </p>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ---------------- review ---------------- */}
      {phase === "review" && result && (
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[0.8125rem] text-heading">{filename}</span>
            {/* The true total. `outcomes` is trimmed to what this list draws — see
                `forBrowser` in actions.ts — so its length is a preview size,
                not a row count, and showing it would under-report the sheet. */}
            <span className="font-mono text-[0.75rem] text-faint">
              {(result.create + result.update + result.unchanged + result.errors).toLocaleString("en-IN")} rows
            </span>
            <button onClick={reset} className="ml-auto btn btn-ghost btn-sm">Choose a different file</button>
          </div>

          {/* the four numbers */}
          <div className="rack sm:grid-cols-4">
            <Count label="Will create" n={result.create} tone="create" onClick={() => setFilter("create")} />
            <Count label="Will update" n={result.update} tone="update" onClick={() => setFilter("update")} />
            <Count label="Unchanged" n={result.unchanged} tone="none" onClick={() => setFilter("unchanged")} />
            <Count label="Errors" n={result.errors} tone="error" onClick={() => setFilter("error")} />
          </div>

          {result.blockers.map((b) => (
            <p key={b} className="mt-4 rounded-sm border border-danger/30 bg-danger-bg px-4 py-3 text-[0.875rem] text-danger">
              <strong>Blocked.</strong> {b}
            </p>
          ))}
          {result.warnings.map((w) => (
            <p key={w} className="mt-3 rounded-sm border border-warning/30 bg-warning-bg px-4 py-3 text-[0.875rem] text-warning">
              {w}
            </p>
          ))}

          {/*
            Overridable, unlike the blockers above it. A sheet that touches most
            of the catalogue is usually a mis-mapped column and occasionally a
            real backfill, and only the person who made the sheet can tell which.
            Refusing outright taught operators to wipe and re-import instead.
          */}
          {result.bulkChange && (
            <div className="mt-3 rounded-sm border border-warning/30 bg-warning-bg px-4 py-3">
              <p className="text-[0.875rem] text-warning">
                This modifies {result.bulkChange.update.toLocaleString("en-IN")} of{" "}
                {result.bulkChange.live.toLocaleString("en-IN")} rows ({result.bulkChange.pct}%).
                A run this large is usually a column mapped to the wrong field — check the
                sample rows above before you accept it.
              </p>
              <label htmlFor="confirm-bulk" className="mt-2 flex cursor-pointer items-center gap-2 text-[0.875rem] text-heading">
                <input
                  id="confirm-bulk"
                  type="checkbox"
                  checked={confirmBulk}
                  onChange={(e) => setConfirmBulk(e.target.checked)}
                  className="size-4 shrink-0 accent-[var(--color-spot-600)]"
                />
                I have checked the mapping — apply all {result.bulkChange.update.toLocaleString("en-IN")} changes.
              </label>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-[0.75rem] text-faint">Show:</span>
            {(["all", "create", "update", "unchanged", "error"] as const).map((k) => (
              <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                className={`rounded-sm border px-2.5 py-1 text-[0.75rem] capitalize transition-colors ${
                  filter === k ? "border-spot-600 bg-spot-600 text-on-accent" : "border-line text-muted hover:bg-sunken"
                }`}>
                {k}
              </button>
            ))}
            {result.errors > 0 && (
              <button onClick={downloadErrors} className="ml-auto btn btn-secondary btn-sm">
                Download {result.errors} errors as CSV
              </button>
            )}
          </div>

          <div className="mt-3 overflow-hidden rounded-md border border-line bg-surface">
            <ul className="divide-y divide-line">
              {result.outcomes
                .filter((o) => filter === "all" || o.kind === filter)
                .slice(0, 200)
                .map((o, i) => <Outcome key={o.sku + i} o={o} />)}
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface p-4">
            <div className="min-w-0 flex-1">
              <p className="text-[0.875rem] text-heading">
                {result.blockers.length > 0
                  ? "Fix the blocker above before committing."
                  : result.bulkChange && !confirmBulk
                    ? "Confirm the bulk change above before committing."
                    : `Commit will create ${result.create}, update ${result.update} and skip ${result.errors} rows.`}
              </p>
              <p className="mt-0.5 text-[0.75rem] text-faint">
                Stock changes are written as counted movements, so the ledger still
                shows who asserted each number and when.
              </p>
            </div>
            <button
              disabled={
                pending
                || result.blockers.length > 0
                || (!!result.bulkChange && !confirmBulk)
                || result.create + result.update === 0
              }
              onClick={runCommit}
              className="btn btn-primary disabled:opacity-50"
            >
              {pending ? "Writing…" : "Commit import"}
            </button>
          </div>
        </div>
      )}

      {/* ---------------- done ---------------- */}
      {phase === "done" && commit?.ok && (
        <div className={`mt-8 border p-6 ${
          commit.failures.length ? "border-warning/40 bg-warning-bg" : "border-success/25 bg-success-bg"
        }`}>
          <div className="flex items-start gap-4">
            {commit.failures.length === 0 && (
              <span className="grid size-10 shrink-0 place-items-center bg-success text-white">
                <CheckIcon className="size-5" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="text-lg text-heading">
                {commit.failures.length ? "Written, with failures" : "Written"}
              </h2>
              <p className="mt-1 font-mono text-[0.875rem] tnum text-muted">
                {commit.created} created · {commit.updated} updated · {commit.skipped} skipped
                {commit.failures.length > 0 && ` · ${commit.failures.length} failed`}
              </p>

              {/*
                Failures are listed by SKU rather than summarised. "3 rows failed"
                sends somebody back to the spreadsheet to guess which three; the
                collection's own error message is written for a human and is the
                most useful thing this screen can show.
              */}
              {commit.failures.length > 0 && (
                <ul className="mt-3 max-w-2xl space-y-1 border-t border-warning/30 pt-3">
                  {commit.failures.slice(0, 20).map((f) => (
                    <li key={f.sku} className="font-mono text-[0.75rem] text-warning">
                      <span className="text-heading">{f.sku}</span> — {f.error}
                    </li>
                  ))}
                  {commit.failures.length > 20 && (
                    <li className="bin">and {commit.failures.length - 20} more</li>
                  )}
                </ul>
              )}

              <p className="mt-3 max-w-xl text-[0.8125rem] text-muted">
                Rows were written in chunks of 100 as the signed-in user, so every
                rule the CMS enforces applied. Stock landed as counted inventory
                movements, not as a field, and the catalogue, enrichment and queue
                screens have already been revalidated. Search reads the same tables
                directly, so there is no separate index to rebuild.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={reset} className="btn btn-secondary btn-sm">Import another file</button>
                <a href="/admin/products" className="btn btn-ghost btn-sm">See the catalogue</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Count({ label, n, tone, onClick }: {
  label: string; n: number; tone: "create" | "update" | "none" | "error"; onClick: () => void;
}) {
  /*
    Four tinted cards side by side is four backgrounds competing for the
    same glance. The tint moves to the numeral — which is the thing being
    read — and the cell stays paper.
  */
  const numeral = {
    create: "text-success",
    update: "text-spot-700",
    none: "text-disabled",
    error: n > 0 ? "text-danger" : "text-disabled",
  }[tone];

  return (
    <button onClick={onClick} className="bg-surface p-4 text-left transition-colors hover:bg-sunken">
      <div className="bin">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold tnum ${numeral}`}>{n.toLocaleString("en-IN")}</div>
    </button>
  );
}

function Outcome({ o }: { o: RowOutcome }) {
  /* Up to 200 of these render at once — outlined stamps, not filled pills. */
  const badge = {
    create: "text-success",
    update: "text-spot-700",
    unchanged: "text-disabled",
    error: "text-danger",
  }[o.kind];

  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      {/* Fixed width so the SKU column starts at the same x on every row — "unchanged" is the longest. */}
      <span className={`stamp stamp-flat w-24 shrink-0 justify-center ${badge}`}>
        {o.kind}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[0.75rem] text-heading">{o.sku || "(no sku)"}</span>

        {o.kind === "update" && (
          <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {o.changes.map((c) => (
              <span key={c.field} className="font-mono text-[0.6875rem]">
                <span className="text-faint">{c.field}:</span>{" "}
                <span className="text-disabled line-through">{c.from || "—"}</span>{" "}
                <span className="text-spot-700">→ {c.to}</span>
              </span>
            ))}
          </span>
        )}

        {o.kind === "create" && (
          <span className="mt-0.5 block truncate text-[0.75rem] text-muted">{o.row.title}</span>
        )}

        {o.kind === "error" && (
          <span className="mt-0.5 block text-[0.75rem] text-danger">{o.errors.join(" · ")}</span>
        )}
      </span>
    </li>
  );
}
