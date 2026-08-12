import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES } from "@/lib/content";
import { PageHeader } from "@/components/PageHeader";
import { Frame } from "@/components/Frame";
import { ArrowRight } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Guides — OnlyParts",
  description:
    "Practical guides for people who build things: measuring screws, reading bearing codes, choosing magnet grades, sizing threaded inserts.",
};

const GLYPHS: Record<string, "hex" | "bearing" | "magnet" | "nozzle"> = {
  Fasteners: "hex",
  Bearings: "bearing",
  Magnets: "magnet",
  "3D printing": "nozzle",
};

export default function GuidesIndex() {
  const categories = [...new Set(GUIDES.map((g) => g.category))];

  return (
    <>
      <PageHeader
        title="How to choose the right part"
        lead="Short, practical answers to the questions that decide a purchase — written by people who have got them wrong before."
      />

      <div className="container-page page-shell">
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c} className="chip">{c}</span>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`}
              className="group flex flex-col overflow-hidden rounded-md border border-line bg-surface shadow-e1 transition-all hover:-translate-y-1 hover:border-spot-600 hover:shadow-e2">
              <Frame ratio="16/9" glyph={GLYPHS[g.category] ?? "hex"} tone="neutral"
                sizes="(max-width:640px) 100vw, 33vw" className="border-b border-line" />
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex items-center gap-2 font-mono text-[0.625rem] text-faint">
                  <span className="text-spot-700">{g.category}</span>
                  <span>·</span>
                  <span>{g.readMins} min read</span>
                </div>
                <h2 className="text-[1.0625rem] leading-snug">{g.title}</h2>
                <p className="mt-2 flex-1 text-[0.875rem] leading-relaxed text-muted">{g.excerpt}</p>
                <span className="mt-4 flex items-center gap-1.5 text-[0.8125rem] font-medium text-spot-700">
                  Read
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
