import Link from "next/link";
import type { Metadata } from "next";
import { PROCESSES } from "@/lib/mod";
import { Reveal } from "@/components/Reveal";
import { Halftone } from "@/components/Halftone";
import { UploadIcon, ArrowRight, CheckIcon } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Make-on-Demand — custom manufacturing | OnlyParts",
  description:
    "Upload a drawing or BOM and a real engineer quotes it in 24 hours. CNC machining, 3D printing, sheet metal, injection moulding, PCB assembly and custom sourcing across India.",
};

const STEPS = [
  ["Upload", "STEP, STL, IGES, DXF, DWG, SLDPRT, PDF or a BOM spreadsheet. No CAD? Describe the part."],
  ["Specify", "Process, material, finish, tolerance and quantity breaks — we suggest the process if you're unsure."],
  ["Quote", "First response in 4 business hours. A costed quote, not a range, within 24."],
  ["Track", "Material → production → QC → dispatch, visible the whole way."],
];

export default function MakePage() {
  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden border-b border-line bg-spot-50">
        
        <div className="container-page relative grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="monumental text-[clamp(2.5rem,7vw,5.5rem)] text-spot-950">
              Can&apos;t buy it?<br />We&apos;ll make it.
            </h1>
            <p className="mt-5 max-w-lg text-[1.0625rem] text-muted">
              Prototype quantities through mass production, from one vendor —
              instead of phoning four and waiting a week for three of them to reply.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/make/rfq" className="btn btn-primary btn-lg">
                <UploadIcon className="size-[18px]" /> Start an RFQ
              </Link>
              <a href="tel:+919000000000" className="btn btn-secondary btn-lg">Talk to an engineer</a>
            </div>
            <ul className="mt-8 grid gap-2 text-[0.875rem] text-muted">
              {["First response in 4 business hours", "Costed quote within 24 hours", "NDA on request before anyone opens your files"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <CheckIcon className="size-4 shrink-0 text-spot-600" />{t}
                </li>
              ))}
            </ul>
          </div>

          <Reveal>
            {/* Printed in the turquoise plate — the same screen as the rest of
                the site, on the colour that means "this part does not exist
                yet". The loupe works here too. */}
            <div className="relative mx-auto aspect-square w-full max-w-lg border border-spot-300 bg-surface">
              <Halftone
                plate="gear"
                cell={7}
                zoom={1.05}
                interactive


                className="absolute inset-0"
              />
              <span className="bin absolute left-4 top-4 text-spot-800">BRACKET_V3.STEP</span>
              <span className="bin absolute bottom-4 left-4 text-spot-800">Specimen · not a stocked part</span>
              <span className="bin absolute bottom-4 right-4 text-spot-800">Ø152 ±0.1</span>
              <span aria-hidden className="pointer-events-none absolute left-2.5 top-2.5 size-4 border-l border-t border-spot-600" />
              <span aria-hidden className="pointer-events-none absolute bottom-2.5 right-2.5 size-4 border-b border-r border-spot-600" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* how it works */}
      <section className="border-b border-line bg-surface py-16 lg:py-24">
        <div className="container-page">
          <Reveal className="mb-10 max-w-2xl">
            <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)]">Four steps, one vendor.</h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <Reveal key={title} delay={i * 95}>
                <div className="h-full rounded-md border border-line bg-surface p-5">
                  <span className="mb-3 grid size-8 place-items-center rounded-full bg-spot-600 font-mono text-[0.8125rem] font-bold text-on-accent">
                    {i + 1}
                  </span>
                  <h3 className="text-base">{title}</h3>
                  <p className="mt-1.5 text-[0.875rem] leading-relaxed text-muted">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* processes */}
      <section className="border-b border-line bg-bg py-16 lg:py-24">
        <div className="container-page">
          <Reveal className="mb-10 max-w-2xl">
            <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)]">Ten processes, honestly scoped.</h2>
            <p className="mt-4 text-[1.0625rem] text-muted">
              Lead times are ranges because they are ranges — anyone quoting a single
              number before seeing your file is guessing.
            </p>
          </Reveal>

          {/*
            Diagonal stagger, not source order.

            At `i * 40` all ten cards landed within 360ms of each other and read
            as a single block fading in — below roughly 90ms the eye cannot
            resolve a sequence at all. Ordering by (row + column) sweeps the
            wave from top-left to bottom-right, which gives it a direction to
            follow, and caps the last card at ~400ms so the grid still settles
            quickly. Same wave on a 2-column layout, just shallower.
          */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROCESSES.map((p, i) => (
              <Reveal key={p.key} delay={(Math.floor(i / 3) + (i % 3)) * 80}>
                <div className="flex h-full flex-col rounded-md border border-line bg-surface p-4 transition-shadow hover:shadow-e2">
                  <h3 className="text-[1.0625rem]">{p.name}</h3>
                  <p className="mt-1.5 flex-1 text-[0.875rem] leading-relaxed text-muted">{p.blurb}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 font-mono text-[0.6875rem]">
                    <span className="text-faint">min qty {p.minQty}</span>
                    <span className="text-spot-700">{p.leadDays[0]}–{p.leadDays[1]} days</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.materials.slice(0, 3).map((m) => (
                      <span key={m} className="rounded-xs bg-sunken px-1.5 py-0.5 font-mono text-[0.5625rem] text-faint">{m}</span>
                    ))}
                    {p.materials.length > 3 && (
                      <span className="px-1 font-mono text-[0.5625rem] text-disabled">+{p.materials.length - 3}</span>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* close */}
      <section className="bg-surface py-16 lg:py-24">
        <div className="container-page text-center">
          <Reveal>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)]">Send us a drawing.</h2>
            <p className="mx-auto mt-4 max-w-lg text-[1.0625rem] text-muted">
              Every part we don&apos;t stock is a part someone still needs. Upload it and
              we&apos;ll tell you what it costs to make — in a day, not a fortnight.
            </p>
            <Link href="/make/rfq" className="btn btn-primary btn-lg mt-8">
              Start an RFQ <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
