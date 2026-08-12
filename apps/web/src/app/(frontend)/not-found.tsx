import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog";
import { Glyph } from "@/components/Glyph";

/**
 * A 404 is a failed intent, not a wall. Every route out of here is one the
 * visitor might actually have wanted — including Make-on-Demand, because "the
 * page doesn't exist" and "the part doesn't exist" often mean the same thing.
 */
export default function NotFound() {
  return (
    <div className="container-page py-16 lg:py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-mono text-[0.75rem] tracking-[0.2em] text-spot-700">404</p>
        <h1 className="mt-3 text-[clamp(1.75rem,4vw,2.75rem)]">This page isn&apos;t here</h1>
        <p className="mt-4 text-[1.0625rem] text-muted">
          The link may be old, or we may have moved something. Search by spec —
          <span className="font-mono text-spot-700"> m3x10 ss304</span> — or start from a category.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Link href="/c" className="btn btn-primary">Browse categories</Link>
          <Link href="/" className="btn btn-secondary">Home</Link>
        </div>
        <p className="mt-4 text-[0.8125rem] text-faint">
          Press <span className="kbd">Ctrl K</span> anywhere to search.
        </p>
      </div>

      <div className="mx-auto mt-14 max-w-4xl">
        <p className="mb-3 text-center text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
          Or jump to a category
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.slice(0, 8).map((c) => (
            <Link key={c.slug} href={`/c/${c.slug}`}
              className="group flex items-center gap-3 rounded-md border border-line bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-spot-600 hover:shadow-e2">
              <span className="grid size-9 shrink-0 place-items-center rounded-sm border border-spot-200 bg-spot-50 text-spot-600">
                <Glyph name={c.glyph} className="size-4.5" />
              </span>
              <span className="truncate text-[0.875rem] font-medium text-heading">{c.name}</span>
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-12 text-center text-[0.875rem] text-muted">
        Looking for something we don&apos;t stock?{" "}
        <Link href="/make/rfq" className="text-spot-700 hover:underline">We&apos;ll make it →</Link>
      </p>
    </div>
  );
}
