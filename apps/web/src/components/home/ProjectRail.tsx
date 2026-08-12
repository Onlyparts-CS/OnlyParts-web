import Link from "next/link";
import { PROJECTS, projectStatsLabel } from "@/lib/catalog";
import { Halftone } from "@/components/Halftone";
import { Reveal } from "@/components/Reveal";
import { PLATE_FOR_GLYPH } from "@/lib/plates";
import { ArrowRight } from "@/components/Icons";

/**
 * Builds — the cards filed across drawers rather than in one.
 *
 * This is the argument for the whole cabinet in one section: a drone needs
 * five drawers, and the point of the store is that you open one card instead
 * of five tabs.
 */
export function ProjectRail() {
  return (
    <section className="border-b border-line bg-surface py-16 lg:py-24">
      <div className="container-page">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h2 className="monumental max-w-[16ch] text-[clamp(2rem,5vw,4rem)]">
            Filed across drawers
          </h2>
          <p className="max-w-sm text-[0.9375rem] leading-relaxed text-muted">
            A build needs parts from four or five categories at once. These carry the
            whole bill of materials on one card — one cart, one shipping fee, one
            delivery date, instead of four sites and four waits.
          </p>
        </Reveal>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map((p, i) => (
            <Reveal key={p.slug} delay={(Math.floor(i / 3) + (i % 3)) * 90}>
              <Link href={`/projects/${p.slug}`} className="card-index group flex h-full gap-4 p-4">
                <span className="block size-24 shrink-0 overflow-hidden bg-bg">
                  <Halftone plate={PLATE_FOR_GLYPH[p.glyph] ?? "gear"} cell={5} duotone={false} className="h-full w-full" />
                </span>

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="monumental text-[1.25rem] text-heading transition-colors group-hover:text-spot-700">
                    {p.name}
                  </span>
                  <span className="bin mt-1.5 block">{projectStatsLabel(p)}</span>

                  <span className="mt-2.5 flex flex-wrap gap-1">
                    {p.spans.map((s) => (
                      <span key={s} className="border border-line px-1.5 py-0.5 font-mono text-[0.625rem] text-faint">
                        {s}
                      </span>
                    ))}
                  </span>

                  <span className="mt-auto flex items-center gap-1.5 pt-3 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-spot-700">
                    Open the BOM
                    <ArrowRight className="size-3 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
