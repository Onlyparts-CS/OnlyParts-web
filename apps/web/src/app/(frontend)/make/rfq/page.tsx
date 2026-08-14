"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  PROCESSES, processByKey, TOLERANCES, ACCEPTED, MAX_FILE_MB, MAX_FILES,
  recommendProcess, rfqNumber, slaDeadline, kindFor, isAccepted,
  type ProcessKey, type RfqFile,
} from "@/lib/mod";
import { useStore, submitRfq } from "@/lib/store";
import { isValidGstin } from "@/lib/gst";
import { UploadIcon, CheckIcon, ArrowRight, BoxIcon } from "@/components/Icons";

type Step = 1 | 2 | 3;

export default function RfqPage() {
  const router = useRouter();
  const { user } = useStore();
  const [step, setStep] = useState<Step>(1);

  // step 1
  const [files, setFiles] = useState<RfqFile[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [isNda, setIsNda] = useState(false);
  const [describe, setDescribe] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // step 2
  const [process, setProcess] = useState<ProcessKey | "">("");
  const [material, setMaterial] = useState("");
  const [finish, setFinish] = useState("");
  const [tolerance, setTolerance] = useState("fine");
  const [quantities, setQuantities] = useState<number[]>([50]);
  const [needBy, setNeedBy] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [isFlat, setIsFlat] = useState(false);
  const [isElectronic, setIsElectronic] = useState(false);

  // step 3
  const [name, setName] = useState(user?.name ?? "");
  const [company, setCompany] = useState(user?.company ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [gstin, setGstin] = useState(user?.gstin ?? "");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");

  const proc = process ? processByKey(process) : null;
  const maxQty = Math.max(...quantities);
  const recommendation = recommendProcess({
    qty: maxQty,
    needsTightTolerance: tolerance === "tight" || tolerance === "precision",
    isFlat, isElectronic,
  });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const ok: RfqFile[] = [];
    const bad: string[] = [];
    for (const f of Array.from(list)) {
      if (!isAccepted(f.name)) { bad.push(`${f.name} — unsupported format`); continue; }
      if (f.size > MAX_FILE_MB * 1024 * 1024) { bad.push(`${f.name} — over ${MAX_FILE_MB} MB`); continue; }
      if (files.length + ok.length >= MAX_FILES) { bad.push(`${f.name} — max ${MAX_FILES} files`); continue; }
      ok.push({ name: f.name, sizeBytes: f.size, kind: kindFor(f.name) });
    }
    setFiles((prev) => [...prev, ...ok]);
    setRejected(bad);
  };

  const canContinue1 = files.length > 0 || describe.trim().length > 20;
  const canContinue2 = Boolean(process && material && quantities.length && maxQty > 0);

  const submit = () => {
    if (!name.trim()) return setError("Enter your name");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email");
    if (!/^[6-9]\d{9}$/.test(phone)) return setError("Enter a 10-digit Indian mobile number");
    if (gstin && !isValidGstin(gstin)) return setError("That GSTIN doesn't look valid");

    const now = new Date();
    const rfq = submitRfq(
      {
        status: "submitted",
        process: process as ProcessKey,
        material, finish, tolerance,
        quantities: [...quantities].sort((a, b) => a - b),
        needBy: needBy || undefined,
        targetPrice: targetPrice ? Math.round(Number(targetPrice) * 100) : undefined,
        notes: [describe, notes].filter(Boolean).join("\n\n") || undefined,
        isNda,
        files,
        contact: { name, company: company || undefined, email, phone, gstin: gstin || undefined, city: city || undefined },
        slaDueAt: slaDeadline(now).toISOString(),
      },
      rfqNumber,
    );
    router.push(`/rfqs/${rfq.number}`);
  };

  return (
    <div className="container-page page-shell">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <Link href="/make" className="text-[0.8125rem] text-spot-700 hover:underline">← Make-on-Demand</Link>
          <h1 className="mt-2 text-[clamp(1.5rem,3vw,2.25rem)]">Request a quote</h1>
          <p className="mt-2 text-muted">
            A real engineer reviews this — first response within 4 business hours,
            priced quote within 24.
          </p>
        </header>

        <Steps current={step} />

        {/* ---------------- 1 — upload ---------------- */}
        {step === 1 && (
          <Card title="Upload your files">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              className={`rounded-md border-2 border-dashed p-8 text-center transition-colors ${
                dragging ? "border-spot-600 bg-spot-50" : "border-line-strong bg-bg"
              }`}
            >
              <UploadIcon className="mx-auto mb-3 size-8 text-spot-600" />
              <p className="text-[0.9375rem] font-medium text-heading">Drop files here</p>
              {/* a real input, not a drag-only surface — keyboard users must be able to upload */}
              <button onClick={() => inputRef.current?.click()} className="btn btn-secondary btn-sm mt-3">
                Browse files
              </button>
              <input
                ref={inputRef} type="file" multiple className="sr-only"
                accept={ACCEPTED.map((e) => "." + e).join(",")}
                onChange={(e) => addFiles(e.target.files)}
              />
              <p className="mt-4 font-mono text-[0.6875rem] leading-relaxed text-disabled">
                STEP · STP · STL · IGES · SLDPRT · SLDASM · IPT · CATPART · SAT · 3DXML<br />
                DXF · DWG · PDF · PNG · JPG · XLSX · CSV · ZIP<br />
                max {MAX_FILE_MB} MB per file, {MAX_FILES} files
              </p>
            </div>

            {rejected.length > 0 && (
              <ul className="mt-3 grid gap-1">
                {rejected.map((r) => (
                  <li key={r} className="rounded-sm border border-danger/30 bg-danger-bg px-3 py-2 text-[0.75rem] text-danger">{r}</li>
                ))}
              </ul>
            )}

            {files.length > 0 && (
              <ul className="mt-4 grid gap-2">
                {files.map((f, i) => (
                  <li key={f.name + i} className="flex items-center gap-3 rounded-sm border border-line bg-surface px-3 py-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xs bg-spot-50 font-mono text-[0.5625rem] uppercase text-spot-700">
                      {f.name.split(".").pop()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] text-heading">{f.name}</span>
                      <span className="block font-mono text-[0.625rem] text-disabled">
                        {(f.sizeBytes / 1024 / 1024).toFixed(2)} MB · {f.kind}
                      </span>
                    </span>
                    <CheckIcon className="size-4 shrink-0 text-success" />
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      className="shrink-0 text-[0.75rem] text-faint hover:text-danger">Remove</button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5">
              <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
                No CAD? Describe the part instead
              </label>
              <textarea
                value={describe} onChange={(e) => setDescribe(e.target.value)} rows={3}
                placeholder="e.g. aluminium mounting bracket, 80 × 40 × 5 mm, four M4 clearance holes on a 60 mm pitch"
                className="w-full rounded-sm border border-line bg-surface p-3 text-[0.875rem] text-heading outline-none focus:border-spot-600"
              />
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-sm border border-line bg-bg p-3">
              <input type="checkbox" checked={isNda} onChange={(e) => setIsNda(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-spot-600" />
              <span>
                <span className="block text-[0.875rem] text-heading">This is confidential — require an NDA before review</span>
                <span className="block text-[0.75rem] text-faint">
                  Files go to a restricted store, every access is logged, and we send a mutual NDA before an engineer opens them.
                </span>
              </span>
            </label>

            <Nav
              onNext={() => setStep(2)}
              nextDisabled={!canContinue1}
              hint={canContinue1 ? undefined : "Upload at least one file, or describe the part in a sentence or two."}
            />
          </Card>
        )}

        {/* ---------------- 2 — specify ---------------- */}
        {step === 2 && (
          <Card title="Specify the job">
            <div className="mb-5 grid gap-2 sm:grid-cols-2">
              {PROCESSES.map((p) => (
                <button key={p.key} onClick={() => { setProcess(p.key); setMaterial(""); setFinish(""); }}
                  aria-pressed={process === p.key}
                  className={`rounded-sm border p-3 text-left transition-all ${
                    process === p.key ? "border-spot-600 bg-spot-50" : "border-line bg-surface hover:border-spot-300 hover:bg-spot-50/50"
                  }`}>
                  <span className="block text-[0.875rem] font-medium text-heading">{p.name}</span>
                  <span className="mt-0.5 block text-[0.75rem] leading-snug text-faint">{p.blurb}</span>
                  <span className="mt-1.5 block font-mono text-[0.625rem] text-spot-700">
                    {p.leadDays[0]}–{p.leadDays[1]} days · min {p.minQty}
                  </span>
                </button>
              ))}
            </div>

            {/* rules-based recommender — FR-29 */}
            {recommendation && recommendation.key !== process && (
              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-sm border border-spot-200 bg-spot-50 px-4 py-3">
                <span className="text-[0.8125rem] text-spot-900">
                  <span className="font-medium">We&apos;d suggest {processByKey(recommendation.key).name}.</span>{" "}
                  {recommendation.why}
                </span>
                <button onClick={() => { setProcess(recommendation.key); setMaterial(""); setFinish(""); }}
                  className="btn btn-secondary btn-sm ml-auto">Use this</button>
              </div>
            )}

            {proc && (
              <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
                <Select label="Material" value={material} onChange={setMaterial} options={proc.materials} placeholder="Select material…" />
                <Select label="Finish" value={finish} onChange={setFinish} options={proc.finishes} placeholder="Select finish…" />
                <div className="sm:col-span-2">
                  <Label>Tolerance</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TOLERANCES.map((t) => (
                      <label key={t.key}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-sm border p-2.5 transition-colors ${
                          tolerance === t.key ? "border-spot-600 bg-spot-50" : "border-line hover:bg-sunken"
                        }`}>
                        <input type="radio" name="tol" checked={tolerance === t.key}
                          onChange={() => setTolerance(t.key)} className="mt-0.5 size-3.5 shrink-0 accent-spot-600" />
                        <span>
                          <span className="block font-mono text-[0.75rem] text-heading">{t.label}</span>
                          <span className="block text-[0.6875rem] text-faint">{t.note}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 border-t border-line pt-5">
              <Label>
                Quantities
                <span className="ml-2 font-normal normal-case tracking-normal text-disabled">
                  add breaks to see how unit price falls
                </span>
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                {quantities.map((q, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface pl-2">
                    <input
                      type="number" min={1} value={q}
                      onChange={(e) => setQuantities(quantities.map((v, j) => (j === i ? Math.max(1, Number(e.target.value) || 1) : v)))}
                      className="w-20 bg-transparent py-2 font-mono text-[0.8125rem] tnum text-heading outline-none"
                      aria-label={`Quantity break ${i + 1}`}
                    />
                    {quantities.length > 1 && (
                      <button onClick={() => setQuantities(quantities.filter((_, j) => j !== i))}
                        aria-label="Remove quantity" className="px-2 text-faint hover:text-danger">×</button>
                    )}
                  </span>
                ))}
                {quantities.length < 4 && (
                  <button onClick={() => setQuantities([...quantities, maxQty * 10])} className="btn btn-secondary btn-sm">
                    + Add break
                  </button>
                )}
              </div>
              {proc && maxQty < proc.minQty && (
                <p className="mt-2 text-[0.75rem] text-warning">
                  {proc.name} has a minimum of {proc.minQty}. We&apos;ll quote it, but expect a setup charge.
                </p>
              )}
            </div>

            <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
              <div>
                <Label>Need by (optional)</Label>
                <input type="date" value={needBy} onChange={(e) => setNeedBy(e.target.value)}
                  className="h-11 w-full rounded-sm border border-line bg-surface px-3 text-[0.9375rem] text-heading outline-none focus:border-spot-600" />
              </div>
              <div>
                <Label>Target price per piece (optional)</Label>
                <div className="flex h-11 items-center rounded-sm border border-line bg-surface focus-within:border-spot-600">
                  <span className="pl-3 font-mono text-[0.8125rem] text-disabled">₹</span>
                  <input type="number" min={0} value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)}
                    className="h-full w-full bg-transparent px-2 font-mono text-[0.9375rem] tnum text-heading outline-none" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label>Notes for the engineer (optional)</Label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  placeholder="Critical dimensions, mating parts, inspection requirements, anything that would change how you'd make it"
                  className="w-full rounded-sm border border-line bg-surface p-3 text-[0.875rem] text-heading outline-none focus:border-spot-600" />
              </div>
              <div className="flex flex-wrap gap-4 sm:col-span-2">
                <Check label="It's a flat profile" checked={isFlat} onChange={setIsFlat} />
                <Check label="It's an electronic assembly" checked={isElectronic} onChange={setIsElectronic} />
              </div>
            </div>

            <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!canContinue2}
              hint={canContinue2 ? undefined : "Pick a process and a material to continue."} />
          </Card>
        )}

        {/* ---------------- 3 — contact ---------------- */}
        {step === 3 && (
          <Card title="Where should we send the quote?">
            <div className="grid gap-3 sm:grid-cols-2">
              <In label="Full name" v={name} on={setName} autoComplete="name" />
              <In label="Company (optional)" v={company} on={setCompany} autoComplete="organization" />
              <In label="Email" v={email} on={setEmail} type="email" autoComplete="email" />
              <In label="Mobile" v={phone} on={(x) => setPhone(x.replace(/\D/g, "").slice(0, 10))} prefix="+91" autoComplete="tel" />
              <In label="City (optional)" v={city} on={setCity} autoComplete="address-level2" />
              <In label="GSTIN (optional)" v={gstin} on={(x) => setGstin(x.toUpperCase().slice(0, 15))} mono />
            </div>

            {/* Form-level, not field-level — nothing to mark aria-invalid on,
                so it needs announcing on appearance instead. */}
            {error && <p role="alert" className="mt-3 text-[0.75rem] text-danger">{error}</p>}

            <Summary
              files={files.length} process={proc?.name} material={material}
              quantities={quantities} isNda={isNda}
            />

            <Nav onBack={() => setStep(2)} onSubmit={submit} submitLabel="Submit RFQ" />
          </Card>
        )}
      </div>
    </div>
  );
}

/* ---------------- pieces ---------------- */

function Steps({ current }: { current: Step }) {
  const steps = ["Upload", "Specify", "Contact"];
  return (
    <ol className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => {
        const n = (i + 1) as Step;
        const done = n < current;
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-[0.75rem] font-bold ${
              done ? "bg-success text-white" : n === current ? "bg-spot-600 text-on-accent" : "bg-sunken text-disabled"
            }`}>
              {done ? <CheckIcon className="size-3.5" /> : n}
            </span>
            <span className={`text-[0.8125rem] ${n === current ? "font-medium text-heading" : "text-faint"}`}>{s}</span>
            {i < steps.length - 1 && <span className={`h-px flex-1 ${done ? "bg-success" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-5 text-lg">{title}</h2>
      {children}
    </section>
  );
}

function Nav({ onBack, onNext, onSubmit, nextDisabled, submitLabel, hint }: {
  onBack?: () => void; onNext?: () => void; onSubmit?: () => void;
  nextDisabled?: boolean; submitLabel?: string; hint?: string;
}) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      {hint && <p className="mb-3 text-[0.75rem] text-faint">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {onBack && <button onClick={onBack} className="btn btn-secondary">Back</button>}
        {onNext && (
          <button onClick={onNext} disabled={nextDisabled} className="btn btn-primary ml-auto disabled:opacity-50">
            Continue <ArrowRight className="size-4" />
          </button>
        )}
        {onSubmit && <button onClick={onSubmit} className="btn btn-primary ml-auto">{submitLabel}</button>}
      </div>
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">{children}</label>
);

function Select({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-sm border border-line bg-surface px-3 text-[0.9375rem] text-heading outline-none focus:border-spot-600">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function In({ label, v, on, type = "text", prefix, mono, autoComplete }: {
  label: string; v: string; on: (s: string) => void; type?: string;
  prefix?: string; mono?: boolean; autoComplete?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex h-11 items-center rounded-sm border border-line bg-surface focus-within:border-spot-600">
        {prefix && <span className="pl-3 font-mono text-[0.8125rem] text-disabled">{prefix}</span>}
        <input type={type} value={v} autoComplete={autoComplete} onChange={(e) => on(e.target.value)}
          className={`h-full w-full bg-transparent px-3 text-[0.9375rem] text-heading outline-none ${mono ? "font-mono" : ""}`} />
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem] text-body">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-spot-600" />
      {label}
    </label>
  );
}

function Summary({ files, process, material, quantities, isNda }: {
  files: number; process?: string; material: string; quantities: number[]; isNda: boolean;
}) {
  return (
    <div className="mt-6 rounded-sm border border-line bg-bg p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
        <BoxIcon className="size-3.5" /> Your request
      </h3>
      <dl className="grid gap-1.5 text-[0.8125rem]">
        <Line k="Files" v={files ? `${files} attached` : "described in text"} />
        <Line k="Process" v={process ?? "—"} />
        <Line k="Material" v={material || "—"} />
        <Line k="Quantities" v={quantities.sort((a, b) => a - b).join(" / ")} />
        {isNda && <Line k="Confidentiality" v="NDA required before review" />}
      </dl>
    </div>
  );
}

const Line = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-faint">{k}</dt>
    <dd className="text-right font-mono text-heading">{v}</dd>
  </div>
);
