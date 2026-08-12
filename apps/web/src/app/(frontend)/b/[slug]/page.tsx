import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRANDS, CATEGORIES, findBrand, skuCountLabel, COMING_SOON } from "@/lib/catalog";
import { Halftone } from "@/components/Halftone";
import { PLATE_FOR_CATEGORY } from "@/lib/plates";
import { Breadcrumbs } from "@/components/catalog/Breadcrumbs";

/* ============================================================
   /b/<slug> — a brand's own shelf.
   ------------------------------------------------------------
   The counterpart to filing brand as a facet rather than as a
   fourth level of the tree.

   Somebody who wants "a printer" browses the category and never
   has to care who made it. Somebody who wants "a Bambu Lab"
   comes here, and sees everything of theirs across every
   category they appear in. Same records, two ways in, and the
   canonical URL of a product never changes.
   ============================================================ */

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return BRANDS.filter((b) => b.slug !== "generic").map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = findBrand(slug);
  if (!brand) return {};
  return {
    title: `${brand.name} — parts and machines at OnlyParts`,
    description: brand.blurb,
    alternates: { canonical: `/b/${brand.slug}` },
  };
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const brand = findBrand(slug);
  if (!brand || brand.slug === "generic") notFound();

  const cats = CATEGORIES.filter((c) => brand.categories.includes(c.slug));

  return (
    <div className="container-page page-shell">
      <Breadcrumbs trail={[]} />

      <header className="mb-10 grid gap-6 border-b border-ink-900 pb-8 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-center lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
        <span className="block aspect-[4/3] w-full overflow-hidden border border-line bg-bg">
          <Halftone
            plate={PLATE_FOR_CATEGORY[cats[0]?.slug ?? "hardware"] ?? "extrusion"}
            cell={6}
            className="h-full w-full"
          />
        </span>
        <div className="min-w-0">
          <p className="bin mb-2">Brand</p>
          <h1 className="monumental text-[clamp(2rem,5vw,4rem)]">{brand.name}</h1>
          <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">{brand.blurb}</p>
          <p className="mt-4 font-mono text-[0.8125rem] text-faint">
            <span className="text-spot-700">{skuCountLabel(brand.count) ?? COMING_SOON}</span>
            {" · "}
            filed across {cats.length} {cats.length === 1 ? "drawer" : "drawers"}
          </p>
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-[1.375rem]">Where {brand.name} is filed</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => (
            <Link
              key={c.slug}
              /* the facet, not a brand-specific category — one canonical listing */
              href={`/c/${c.slug}?brand=${brand.slug}`}
              className="card-index group flex items-center gap-3 p-3"
            >
              <span className="block size-16 shrink-0 overflow-hidden bg-bg">
                <Halftone plate={PLATE_FOR_CATEGORY[c.slug] ?? "screw"} cell={4} duotone={false} className="h-full w-full" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-medium text-heading transition-colors group-hover:text-spot-700">
                  {c.name}
                </span>
                <span className="bin mt-1 block">{c.subs.length} shelves</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-14 border-t border-line pt-8">
        <h2 className="mb-4 text-[1.375rem]">Other brands</h2>
        <div className="flex flex-wrap gap-2">
          {BRANDS.filter((b) => b.slug !== brand.slug && b.slug !== "generic").map((b) => (
            <Link key={b.slug} href={`/b/${b.slug}`} className="chip">{b.name}</Link>
          ))}
        </div>
      </section>
    </div>
  );
}
