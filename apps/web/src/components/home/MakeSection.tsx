import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { Halftone } from "@/components/Halftone";
import { UploadIcon } from "@/components/Icons";
import { Rule } from "@/components/Rule";

/* ============================================================
   Make-on-Demand.
   ------------------------------------------------------------
   This was turquoise territory once — a second accent marking
   the half of the business that makes parts rather than stocking
   them. The turquoise tokens still exist and `.btn-make` and
   friends still reference them, but nothing on any page does:
   what separates this section is the tinted ground and the
   specimen label, which say "not a stocked part" without needing
   a colour to say it.

   That is the better answer, and the green re-plate proved why.
   A band that argues with the page in a second hue competes with
   the accent doing the selling; a band that is the *same* ink at
   a lower volume simply reads as a different room.
   ============================================================ */

const STEPS = [
  ["Upload", "STEP · STL · IGES · DXF · DWG · SLDPRT · PDF · BOM spreadsheet"],
  ["Specify", "Process, material, finish, tolerance and quantity breaks"],
  ["Quote", "First response in 4 business hours, priced quote within 24"],
  ["Track", "Material → production → QC → dispatch, visible the whole way"],
];

const PROCESSES = [
  "CNC machining", "3D printing", "Sheet metal", "Injection moulding",
  "Laser cutting", "PCB assembly", "Wire harnesses", "Custom sourcing",
];

export function MakeSection() {
  return (
    <section id="make" className="scroll-mt-24 border-b border-line bg-spot-50 py-16 lg:py-24">
      <div className="container-page grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
        {/* the specimen — a part on its way to existing */}
        <Reveal className="order-2 lg:order-1">
          <div className="relative border border-line-strong bg-surface">
            <Halftone
              plate="gear"
              cell={7}


              className="aspect-square w-full"
            />
            <span className="bin absolute left-3 top-3">Specimen · not a stocked part</span>
            <span className="bin absolute bottom-3 left-3">AL 6061 · anodised</span>
            <span className="bin absolute bottom-3 right-3">Ø152 ±0.1</span>
            <Rule axis="y" className="absolute inset-y-0 right-0 h-full opacity-60" />
          </div>
        </Reveal>

        {/* the pitch */}
        <Reveal className="order-1 lg:order-2" delay={90}>
          {/*
            Ink, not accent.

            Every word in this band used to be a shade of the spot plate, on a
            ground that is also the spot plate. Under oxide that read as warm
            ink on warm paper and passed for normal text; green does not — it
            reads as *coloured* type, and with the halftone, the step numbers,
            the chips and the button all green too there was no focal point
            left. The tint stays (it separates from paper at dE 6.5, more than
            the oxide one managed at 3.3); the type goes back to ink and the
            accent is spent on one button.
          */}
          <h2 className="monumental text-[clamp(2rem,5.5vw,4.25rem)] text-heading">
            Can&rsquo;t buy it?
            <br />
            We&rsquo;ll make it.
          </h2>
          <p className="mt-5 max-w-lg text-[1.0625rem] leading-relaxed text-muted">
            Upload a drawing or a BOM and a real engineer quotes it within 24 hours.
            Prototype quantities through production runs, from one vendor — instead of
            phoning four and waiting a week for three of them to reply.
          </p>

          <ol className="mt-9 grid gap-5">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                {/*
                  Outlined, not filled. Four filled accent squares stacked down
                  the left edge out-shouted the button they are meant to lead
                  to — and a step number is a label, not an action.
                */}
                <span className="relative grid size-7 shrink-0 place-items-center border border-ink-400 bg-surface font-mono text-[0.75rem] font-bold tnum text-heading">
                  {i + 1}
                  {i < STEPS.length - 1 && (
                    <span aria-hidden className="absolute left-1/2 top-full h-5 w-px -translate-x-1/2 bg-ink-300" />
                  )}
                </span>
                <span className="pt-0.5">
                  <span className="monumental block text-[1.0625rem] text-heading">{title}</span>
                  <span className="mt-0.5 block text-[0.875rem] leading-relaxed text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ol>

          <ul className="mt-9 flex flex-wrap gap-1.5">
            {PROCESSES.map((p) => (
              <li key={p} className="border border-line-strong bg-surface px-2.5 py-1 font-mono text-[0.6875rem] text-muted">
                {p}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/make/rfq" className="btn btn-primary btn-lg">
              <UploadIcon className="size-[17px]" /> Start an RFQ
            </Link>
            <Link href="/make" className="btn btn-secondary btn-lg">Talk to an engineer</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
