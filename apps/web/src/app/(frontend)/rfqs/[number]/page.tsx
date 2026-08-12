"use client";

import Link from "next/link";
import { use } from "react";
import { useStore } from "@/lib/store";
import { RFQ_STAGES, processByKey, TOLERANCES } from "@/lib/mod";
import { inr } from "@/lib/catalog";
import { CheckIcon, UploadIcon, InvoiceIcon } from "@/components/Icons";

export default function RfqStatusPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const { rfqs } = useStore();
  const rfq = rfqs.find((r) => r.number === decodeURIComponent(number));

  if (!rfq) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl">RFQ not found</h1>
        <p className="mt-2 text-muted">
          This prototype keeps RFQs in your browser, so it won&apos;t appear elsewhere.
        </p>
        <Link href="/make/rfq" className="btn btn-primary btn-sm mt-6">Start a new RFQ</Link>
      </div>
    );
  }

  const proc = processByKey(rfq.process);
  const tol = TOLERANCES.find((t) => t.key === rfq.tolerance);
  const currentIdx = RFQ_STAGES.findIndex((s) => s.key === rfq.status);
  const sla = new Date(rfq.slaDueAt);

  return (
    <div className="container-page page-shell">
      <div className="mx-auto max-w-3xl">
        {/* confirmation */}
        <div className="mb-8 rounded-md border border-success/25 bg-success-bg p-5">
          <div className="flex flex-wrap items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success text-white">
              <CheckIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl text-heading">RFQ received</h1>
              <p className="mt-1 text-[0.875rem] text-muted">
                <span className="font-mono text-heading">{rfq.number}</span> · confirmation sent to{" "}
                <span className="font-mono">{rfq.contact.email}</span>
              </p>
              <p className="mt-2 text-[0.8125rem] text-muted">
                An engineer responds by{" "}
                <span className="font-medium text-heading">
                  {sla.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </span>{" "}
                — 4 business hours. Priced quote within 24.
              </p>
            </div>
          </div>
        </div>

        {/* status timeline */}
        <section className="mb-6 rounded-md border border-line bg-surface p-5">
          <h2 className="mb-5 text-base">Progress</h2>
          <ol className="grid gap-0">
            {RFQ_STAGES.map((s, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <li key={s.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[0.625rem] font-bold ${
                      done ? "bg-success text-white" : active ? "bg-spot-600 text-on-accent" : "border border-line bg-surface text-disabled"
                    }`}>
                      {done ? <CheckIcon className="size-3" /> : i + 1}
                    </span>
                    {i < RFQ_STAGES.length - 1 && (
                      <span className={`w-px flex-1 ${done ? "bg-success" : "bg-line"}`} style={{ minHeight: 22 }} />
                    )}
                  </div>
                  <div className="pb-4">
                    <span className={`block text-[0.875rem] ${active ? "font-medium text-heading" : done ? "text-body" : "text-disabled"}`}>
                      {s.label}
                    </span>
                    {active && (
                      <span className="block text-[0.75rem] text-faint">
                        {new Date(rfq.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                        {" — waiting on us"}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* the request */}
        <section className="mb-6 rounded-md border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-4 text-base">Your request</h2>
          <dl className="grid gap-x-8 gap-y-3 p-5 sm:grid-cols-2">
            <Row k="Process" v={proc.name} />
            <Row k="Material" v={rfq.material} />
            <Row k="Finish" v={rfq.finish || "—"} />
            <Row k="Tolerance" v={tol?.label ?? rfq.tolerance} />
            <Row k="Quantities" v={rfq.quantities.join(" / ")} />
            <Row k="Lead time (est.)" v={`${proc.leadDays[0]}–${proc.leadDays[1]} days`} />
            {rfq.needBy && <Row k="Need by" v={new Date(rfq.needBy).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />}
            {rfq.targetPrice && <Row k="Target price" v={`${inr(rfq.targetPrice)}/pc`} />}
            {rfq.contact.gstin && <Row k="GSTIN" v={rfq.contact.gstin} />}
            {rfq.isNda && <Row k="Confidentiality" v="NDA required" accent />}
          </dl>

          {rfq.notes && (
            <div className="border-t border-line px-5 py-4">
              <h3 className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">Notes</h3>
              <p className="whitespace-pre-line text-[0.875rem] text-body">{rfq.notes}</p>
            </div>
          )}

          {rfq.files.length > 0 && (
            <div className="border-t border-line px-5 py-4">
              <h3 className="mb-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
                Files ({rfq.files.length})
              </h3>
              <ul className="grid gap-2">
                {rfq.files.map((f, i) => (
                  <li key={f.name + i} className="flex items-center gap-3 rounded-sm border border-line px-3 py-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xs bg-spot-50 font-mono text-[0.5625rem] uppercase text-spot-700">
                      {f.name.split(".").pop()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] text-heading">{f.name}</span>
                      <span className="block font-mono text-[0.625rem] text-disabled">
                        {(f.sizeBytes / 1024 / 1024).toFixed(2)} MB · {f.kind} · scanned
                      </span>
                    </span>
                    {rfq.isNda && (
                      <span className="shrink-0 rounded-xs bg-warning-bg px-1.5 py-0.5 text-[0.625rem] text-warning">
                        access logged
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* quote placeholder */}
        <section className="rounded-md border border-dashed border-line-strong bg-surface px-5 py-10 text-center">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-spot-50 text-spot-600">
            <InvoiceIcon className="size-5" />
          </span>
          <h2 className="text-base">Your quote will appear here</h2>
          <p className="mx-auto mt-2 max-w-md text-[0.875rem] text-muted">
            A costed breakdown — material, machining time, setup, finishing, tooling
            amortisation and margin — for each quantity break, with any DFM notes
            from the engineer who reviewed your files.
          </p>
          <p className="mx-auto mt-3 max-w-md font-mono text-[0.6875rem] text-disabled">
            Prototype — no engineer is assigned and no quote is generated.
          </p>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/make/rfq" className="btn btn-secondary btn-sm">
            <UploadIcon className="size-3.5" /> New RFQ
          </Link>
          <Link href="/account" className="btn btn-ghost btn-sm">Your account</Link>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2.5 last:border-0">
      <dt className="text-[0.8125rem] text-faint">{k}</dt>
      <dd className={`text-right font-mono text-[0.8125rem] ${accent ? "text-warning" : "text-heading"}`}>{v}</dd>
    </div>
  );
}
