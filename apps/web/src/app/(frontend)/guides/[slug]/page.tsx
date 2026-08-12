import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GUIDES, guideBySlug } from "@/lib/content";
import { PageHeader, Prose } from "@/components/PageHeader";
import { ArrowRight } from "@/components/Icons";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  return {
    title: `${g.title} — OnlyParts`,
    description: g.excerpt,
    alternates: { canonical: `/guides/${g.slug}` },
  };
}

const anchor = (heading: string) =>
  heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default async function GuidePage({ params }: Props) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();

  const related = GUIDES.filter((g) => g.slug !== guide.slug && g.category === guide.category).slice(0, 3);
  const sections = guide.sections.map((s, i) => ({
    id: s.heading ? anchor(s.heading) : `section-${i}`,
    heading: s.heading,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.excerpt,
    datePublished: guide.published,
    author: { "@type": "Organization", name: "OnlyParts" },
    publisher: { "@type": "Organization", name: "OnlyParts" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHeader
        variant="editorial"

        title={guide.title}
        lead={guide.excerpt}
        meta={`${guide.category} · ${guide.published} · ${guide.readMins} min read`}
        breadcrumb={[{ label: "Guides", href: "/guides" }]}
      />

      {/*
        The body used to be a 672px column pinned to the left of a 1425px
        container — 713px of dead space on one flank. The measure is right; what
        was missing was anything on the other side of it. A contents rail earns
        that space on a page with headed sections, and gives the reader a way to
        jump to the head type they actually came for.
      */}
      <Prose aside={<GuideRail sections={sections} related={related} />}>
        {guide.sections.map((s, i) => (
          <section key={i} id={sections[i]?.id} className="scroll-mt-[calc(var(--header-h)+1.5rem)]">
            {s.heading && <h2 className="mb-3 text-xl">{s.heading}</h2>}
            {s.body.map((p, j) => (
              <p key={j} className="mt-3 text-[0.9375rem] leading-relaxed text-body first:mt-0">{p}</p>
            ))}
          </section>
        ))}

        <div className="!mt-12 rounded-md border border-spot-200 bg-spot-50 p-5">
          <h2 className="text-base text-spot-900">Need the part, not the theory?</h2>
          <p className="mt-1.5 text-[0.875rem] text-spot-900/80">
            Search by spec — <span className="font-mono">m3x10 ss304</span>,{" "}
            <span className="font-mono">608zz</span> — and we parse it into attributes before looking anything up.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/c" className="btn btn-primary btn-sm">Browse categories</Link>
            <Link href="/make/rfq" className="btn btn-secondary btn-sm">Get one made</Link>
          </div>
        </div>

        {/* related guides live in the rail on xl; below the article on narrower screens */}
        {related.length > 0 && (
          <section className="!mt-10 border-t border-line pt-6 xl:hidden">
            <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
              More on {guide.category}
            </h2>
            <ul className="grid gap-2">
              {related.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}`}
                    className="group flex items-center gap-2 text-[0.9375rem] text-body hover:text-spot-700">
                    {g.title}
                    <ArrowRight className="size-3.5 text-disabled transition-transform group-hover:translate-x-0.5 group-hover:text-spot-600" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Prose>
    </>
  );
}

/**
 * Contents plus related reading. Hidden below xl, where there is no second
 * column to put it in and the article should simply run full measure.
 */
function GuideRail({
  sections, related,
}: {
  sections: { id: string; heading?: string }[];
  related: (typeof GUIDES)[number][];
}) {
  const headed = sections.filter((s) => s.heading);

  return (
    <div className="hidden xl:block">
      {headed.length > 1 && (
        <nav aria-label="On this page">
          <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
            On this page
          </h2>
          <ul className="grid gap-1 border-l border-line">
            {headed.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}
                  className="-ml-px block border-l-2 border-transparent py-1 pl-4 text-[0.8125rem] leading-snug text-muted transition-colors hover:border-spot-600 hover:text-spot-700">
                  {s.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {related.length > 0 && (
        <div className={headed.length > 1 ? "mt-8 border-t border-line pt-6" : ""}>
          <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
            Related guides
          </h2>
          <ul className="grid gap-2.5">
            {related.map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`}
                  className="group flex items-start gap-2 text-[0.8125rem] leading-snug text-body hover:text-spot-700">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-disabled transition-transform group-hover:translate-x-0.5 group-hover:text-spot-600" />
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 rounded-md border border-line bg-sunken/60 p-4">
        <p className="text-[0.8125rem] leading-relaxed text-muted">
          Can&apos;t find the size in the guide?
        </p>
        <Link href="/make/rfq" className="btn btn-secondary btn-sm mt-3 w-full">Get it made</Link>
      </div>
    </div>
  );
}
