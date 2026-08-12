import Link from "next/link";
import { BomActions } from "./BomActions";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PROJECTS, CATEGORIES, inr } from "@/lib/catalog";
import { dbAllSkus } from "@/lib/catalogDb";
import { CATALOGUE_EMPTY, EMPTY_COPY } from "@/lib/demo";
import { PageHeader } from "@/components/PageHeader";
import { Frame } from "@/components/Frame";
import { Glyph } from "@/components/Glyph";
import { ProductTile } from "@/components/catalog/ProductTile";
import { ArrowRight } from "@/components/Icons";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = PROJECTS.find((x) => x.slug === slug);
  if (!p) return {};
  return {
    title: `Build a ${p.name} — parts list | OnlyParts`,
    description: `Everything you need to build a ${p.name.toLowerCase()}, curated across ${p.spans.join(", ")}. One cart, one shipping fee, one delivery date.`,
  };
}

/** Which L1 categories each project draws from, and what to say about each. */
const NOTES: Record<string, Record<string, string>> = {
  drone: {
    "drones-parts": "Frame, flight controller, ESC and the FPV chain.",
    motors: "Brushless motors sized to your prop and cell count.",
    "batteries-power": "LiPo packs, chargers and the connectors to match.",
    fasteners: "M2 and M2.5 hardware — the sizes that actually hold a quad together.",
    "electronic-components": "Wire, heat-shrink, connectors and the odd sensor.",
  },
  "3d-printer": {
    "3d-printing": "Hotend, extruder, build surface and filament.",
    motors: "NEMA 17 steppers and the drivers to run them quietly.",
    bearings: "Linear rails, rods and the idlers that decide print quality.",
    hardware: "Extrusion, brackets, belts and pulleys for the frame.",
  },
  robot: {
    motors: "Geared DC, steppers and servos depending on the joint.",
    "electronic-components": "Controllers, sensors, drivers and power conversion.",
    "batteries-power": "Packs, BMS and charging.",
    hardware: "Chassis, couplings, gears and fasteners.",
  },
  ev: {
    "ev-parts": "Hub motor, controller, throttle and the display.",
    "batteries-power": "Cells, BMS, and everything for pack building.",
    motors: "Alternative drive options where a hub motor won't fit.",
    hardware: "Drivetrain, brackets and enclosure hardware.",
  },
  cnc: {
    "cnc-machines-parts": "Spindle, controller, tooling and workholding.",
    motors: "Steppers or servos sized to the axis load.",
    bearings: "Ball screws, linear guides and bearing blocks.",
    "industrial-electricals": "VFD, contactors, E-stop and panel components.",
  },
  "repair-bench": {
    tools: "Soldering, measuring, driving and cutting.",
    fasteners: "Micro screws for laptops, phones and consoles.",
    "electronic-components": "Consumables — solder, flux, wire, heat-shrink.",
  },
};

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = PROJECTS.find((p) => p.slug === slug);
  if (!project) notFound();

  const notes = NOTES[project.slug] ?? {};
  const cats = CATEGORIES.filter((c) => notes[c.slug]);

  /*
    The bill of materials, as curated in `/admin/builds` — not inferred.

    This section used to be the top twelve in-stock SKUs from any category the
    build touches, which is the same category-overlap guess that `projectsFor`
    was fixed for: a repair bench touches Fasteners, therefore every M2.5 screw
    in the catalogue was "popular in this build". It also meant the console's
    build editor wrote to a table this page never read.

    `sku.projects` carries the build slugs, inverted out of `builds.items` in
    `catalogDb`. One SKU per product, because a bearing with five seal/material
    variants is one line on a parts list, not five.
  */
  const seen = new Set<number | string>();
  const picks = (await dbAllSkus()).filter((s) => {
    const key = s.productId ?? s.sku;
    if (!s.projects?.includes(project.slug) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const from = picks.length ? Math.min(...picks.map((s) => s.price)) : 0;

  return (
    <>
      <PageHeader
        title={`Build a ${project.name}`}
        lead={`Everything the build needs, curated across ${project.spans.length} categories. One cart, one shipping fee, one delivery date — instead of four sites and four waits.`}
        breadcrumb={[{ label: "Projects", href: "/#projects" }]}
      />

      <div className="container-page page-shell">
        {/* what the build spans */}
        <section className="mb-12">
          <h2 className="mb-4 text-lg">What this build spans</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cats.map((c) => (
              <Link key={c.slug} href={`/c/${c.slug}`}
                className="group flex h-full flex-col rounded-md border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-spot-600 hover:shadow-e2">
                <span className="mb-3 grid size-10 place-items-center rounded-sm border border-spot-200 bg-spot-50 text-spot-600">
                  <Glyph name={c.glyph} className="size-5 transition-transform duration-700 ease-[cubic-bezier(.83,0,.17,1)] group-hover:rotate-[360deg]" />
                </span>
                <h3 className="text-[0.9375rem]">{c.name}</h3>
                <p className="mt-1.5 flex-1 text-[0.8125rem] leading-relaxed text-muted">{notes[c.slug]}</p>
                <span className="mt-3 flex items-center gap-1.5 text-[0.75rem] font-medium text-spot-700">
                  Browse <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* the BOM */}
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg">Parts in this build</h2>
            {picks.length > 0 && (
              <p className="font-mono text-[0.75rem] text-faint">
                {picks.length} {picks.length === 1 ? "part" : "parts"} curated · from {inr(from)}
              </p>
            )}
          </div>

          {picks.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {picks.map((s) => <ProductTile key={s.sku} sku={s} />)}
              </div>
              <BomActions picks={picks} projectName={project.name} projectSlug={project.slug} />
            </>
          ) : (
            <div className="rounded-md border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
              <Frame ratio="3/2" glyph={project.glyph} tone="neutral"
                className="mx-auto mb-5 max-w-xs rounded-md border border-line" sizes="320px" />
              <h3 className="text-lg">{EMPTY_COPY.title}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">{EMPTY_COPY.body}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link href="/make/rfq" className="btn btn-primary btn-sm">Tell us what you need</Link>
                <Link href="/guides" className="btn btn-secondary btn-sm">Read the build guides</Link>
              </div>
            </div>
          )}
        </section>

        {/* other projects */}
        <section className="mt-14 border-t border-line pt-8">
          <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">Other builds</h2>
          <div className="flex flex-wrap gap-2">
            {PROJECTS.filter((p) => p.slug !== project.slug).map((p) => (
              <Link key={p.slug} href={`/projects/${p.slug}`} className="chip">Build a {p.name}</Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
