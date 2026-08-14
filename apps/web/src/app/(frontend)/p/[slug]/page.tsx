import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  buildMatrix, listings, substitutes, worksWith, complementDrawers, projectsFor, hsnFor,
} from "@/lib/product";
import { dbFindSku, dbSkusInPath } from "@/lib/catalogDb";
import { inr } from "@/lib/catalog";
import { Gallery } from "@/components/product/Gallery";
import { BuyBox } from "@/components/product/BuyBox";
import { SpecTable } from "@/components/product/SpecTable";
import { VariantMatrix } from "@/components/product/VariantMatrix";
import { Reviews } from "@/components/product/Reviews";
import { WorksWith } from "@/components/product/WorksWith";
import { ProductTile, stockState } from "@/components/catalog/ProductTile";
import { Glyph } from "@/components/Glyph";
import { StarIcon, ArrowRight } from "@/components/Icons";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sku = await dbFindSku(slug);
  if (!sku) return {};
  return {
    title: `${sku.title} — OnlyParts`,
    description: `${sku.title}. ${inr(sku.price)}/pc, ${inr(sku.breaks.at(-1)!.price)} at ${sku.breaks.at(-1)!.qty}+. No minimum order, GST invoice, ships in ${sku.dispatchHours}h. SKU ${sku.sku}.`,
    alternates: { canonical: `/p/${sku.slug}` },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const sku = await dbFindSku(slug);
  if (!sku) notFound();

  /*
    One read, shared by everything below it.

    The matrix, the substitutes and the pairings each used to fetch their own
    candidates. Against generated data that cost nothing; against Postgres it
    is three scans of the same shelf per page view. The drawer is read once and
    passed down, which is also why those helpers now take their pool as an
    argument instead of reaching for the catalogue themselves.
  */
  const drawer = await dbSkusInPath([sku.categories[0][0]]);
  const shelfPath = sku.categories[0].join(".");
  const shelf = drawer.filter((s) => s.categories[0].join(".") === shelfPath);

  const { axes } = buildMatrix(sku, shelf);
  const cats = listings(sku);
  const primary = cats.find((c) => c.primary)!;
  const alsoIn = cats.filter((c) => !c.primary);
  const stock = stockState(sku.stock);
  const hsn = hsnFor(sku);
  const subs = substitutes(sku, shelf);

  /*
    Complements usually sit in the same drawer as the part they complete — a
    drone motor and its ESC are both `drones-parts` — so the read above covers
    most of them for free. The exceptions are real (a LiPo pack lives under
    `batteries-power`, not under the motor it powers), so any drawer the
    pairing map reaches into and this page has not already loaded is fetched
    once here. In practice that is nought or one extra read, not one per row.
  */
  const extra = (
    await Promise.all(
      complementDrawers(sku)
        .filter((d) => d !== sku.categories[0][0])
        .map((d) => dbSkusInPath([d])),
    )
  ).flat();
  const together = worksWith(sku, [...drawer, ...extra]);
  const projects = projectsFor(sku);
  const topBreak = sku.breaks.at(-1)!;

  /* Product JSON-LD — canonical is always /p/{slug}, never a category path,
     so cross-listing creates no duplicate-content risk (05-FRONTEND §9). */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: sku.title,
    sku: sku.sku,
    mpn: sku.sku,
    category: primary.trail.map((n) => n.name).join(" > "),
    /*
      Omitted entirely when nothing has been reviewed. An `aggregateRating` of
      0.0 over 0 reviews is not a low score, it is an invalid one: Google
      rejects the block outright and publishing a rating no customer gave is
      the kind of thing that earns a structured-data manual action.
    */
    ...(sku.ratingCount > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: sku.rating.toFixed(1),
        reviewCount: sku.ratingCount,
      },
    }),
    offers: {
      "@type": "Offer",
      price: (sku.price / 100).toFixed(2),
      priceCurrency: "INR",
      availability: sku.stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/BackOrder",
      url: `https://onlyparts.in/p/${sku.slug}`,
    },
  };

  return (
    <div className="container-page page-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* breadcrumb from the PRIMARY assignment, with a switcher for the others */}
      <nav aria-label="Breadcrumb" className="mb-1">
        <ol className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-faint">
          <li><Link href="/" className="hover:text-spot-700">Home</Link></li>
          {primary.trail.map((n) => (
            <li key={n.slug} className="flex items-center gap-1.5">
              <span aria-hidden className="text-disabled">›</span>
              <Link href={`/c/${n.path.join("/")}`} className="hover:text-spot-700">{n.name}</Link>
            </li>
          ))}
        </ol>
      </nav>

      {alsoIn.length > 0 && (
        <p className="mb-6 flex flex-wrap items-center gap-2 text-[0.75rem] text-faint">
          <span>Also listed in:</span>
          {alsoIn.map((c) => {
            const leaf = c.trail.at(-1)!;
            return (
              <Link key={leaf.path.join("/")} href={`/c/${leaf.path.join("/")}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 transition-colors hover:border-spot-600 hover:bg-spot-50 hover:text-spot-800">
                <Glyph name={leaf.glyph} className="size-3.5 text-spot-600" />
                {c.trail.map((n) => n.name).join(" › ")}
              </Link>
            );
          })}
        </p>
      )}

      {/* ---------- main ---------- */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)] lg:gap-14">
        <Gallery glyph={sku.glyph} sku={sku.sku} attrs={sku.attrs} images={sku.images} />

        <div className="min-w-0">
          <h1 className="text-[clamp(1.375rem,2.4vw,1.875rem)] leading-tight">{sku.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-mono text-[0.75rem] text-disabled">⌗ {sku.sku}</span>
            {/* Five grey stars and "0.0 (0)" reads as a part everybody hated. */}
            {sku.ratingCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="flex gap-0.5 text-warning">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <StarIcon key={i} className={`size-3.5 ${i < Math.round(sku.rating) ? "" : "opacity-25"}`} />
                  ))}
                </span>
                <span className="font-mono text-[0.75rem] text-faint">{sku.rating.toFixed(1)} ({sku.ratingCount})</span>
              </span>
            )}
            <span className={`inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-[0.6875rem] font-medium ${stock.cls}`}>
              <span className={`size-1.5 rounded-full ${stock.dot}`} />{stock.label}
            </span>
          </div>

          <div className="mt-7 border-y border-line py-6">
            <VariantMatrix axes={axes} current={sku} />
          </div>

          <div className="mt-6">
            <BuyBox sku={sku} />
          </div>

          {/*
            "Used in these projects" used to sit 68% down the page, below the
            cross-sell, as two outline chips. It is one of the few things on a
            commodity part that is genuinely differentiating — this screw is part
            of a build we can hand you whole — so it belongs beside the buy box.

            It only renders when the SKU has been curated into a build (see
            `projectsFor`); it is no longer inferred from the category.
          */}
          {projects.length > 0 && (
            <section className="mt-6 rounded-md border border-spot-200 bg-spot-50/70 p-4">
              <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-spot-800">
                Used in these builds
              </h2>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-spot-900/80">
                We keep a full parts list for each one — same cart, one shipping fee.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {projects.map((p) => (
                  <Link key={p.slug} href={`/projects/${p.slug}`}
                    className="group inline-flex items-center gap-2 rounded-sm border border-spot-300 bg-surface px-3 py-2 text-[0.875rem] font-medium text-spot-900 transition-all hover:-translate-y-0.5 hover:border-spot-600 hover:shadow-e2">
                    <Glyph name={p.glyph} className="size-4 text-spot-600" />
                    Build a {p.name}
                    <ArrowRight className="size-3.5 text-spot-600 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ---------- substitutes: the out-of-stock rescue (FR-25) ---------- */}
      {sku.stock === 0 && subs.length > 0 && (
        <section className="mt-12 rounded-md border border-info/30 bg-info-bg/60 p-5">
          <h2 className="text-base">This one is made to order. These fit the same envelope and are in stock:</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {subs.map((s) => <ProductTile key={s.sku} sku={s} />)}
          </div>
        </section>
      )}

      <div className="mt-14 grid gap-12">
        <SpecTable sku={sku} />

        {/* ---------- description ---------- */}
        <section>
          <h2 className="mb-3 text-xl">About this part</h2>
          <div className="max-w-3xl text-[0.9375rem] leading-relaxed text-body">
            <p>
              {sku.title}. Supplied loose — buy a single piece or ten thousand, with
              price breaks applied automatically in the cart at {sku.breaks.map((b) => b.qty).join(", ")} pieces.
              Best price {inr(topBreak.price)}/pc at {topBreak.qty.toLocaleString("en-IN")}+.
            </p>
            <p className="mt-3">
              Every unit is dimensionally checked against{" "}
              {sku.attrs.standard ? <span className="font-mono">{String(sku.attrs.standard)}</span> : "the published specification"}.
              Ships with a GST invoice quoting HSN <span className="font-mono">{hsn.code}</span> at {hsn.rate}%,
              so it books cleanly against input credit.
            </p>
            <p className="mt-3 text-muted">
              Need this in a material or size we don&apos;t stock?{" "}
              <Link href="/make/rfq" className="text-spot-700 underline">Send us a drawing</Link> — we quote
              custom manufacturing within 24 hours.
            </p>
          </div>
        </section>

        {/* ---------- complements: buy the set, one line each ---------- */}
        <WorksWith anchor={sku} items={together} />

        <Reviews sku={sku.sku} title={sku.title} rating={sku.rating} ratingCount={sku.ratingCount} />

        {sku.stock > 0 && subs.length > 0 && (
          <section>
            <h2 className="mb-1 text-xl">Same size, other materials</h2>
            <p className="mb-4 text-[0.875rem] text-muted">
              Identical dimensions — pick the material that suits the load, the
              environment and the budget.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {subs.map((s) => <ProductTile key={s.sku} sku={s} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
