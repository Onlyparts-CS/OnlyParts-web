import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { POLICIES, policyBySlug } from "@/lib/content";
import { PageHeader, Prose } from "@/components/PageHeader";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return POLICIES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = policyBySlug((await params).slug);
  if (!p) return {};
  return { title: `${p.title} — OnlyParts`, description: p.summary };
}

export default async function PolicyPage({ params }: Props) {
  const policy = policyBySlug((await params).slug);
  if (!policy) notFound();

  return (
    <>
      <PageHeader
        variant="editorial"
        title={policy.title}
        lead={policy.summary}
        meta={`Last updated ${policy.updated}`}
      />

      <Prose
        aside={
          <div className="hidden xl:block">
            <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
              All policies
            </h2>
            <ul className="grid gap-1 border-l border-line">
              {POLICIES.map((p) => (
                <li key={p.slug}>
                  <Link href={`/policies/${p.slug}`}
                    className={`-ml-px block border-l-2 py-1 pl-4 text-[0.8125rem] leading-snug transition-colors ${
                      p.slug === policy.slug
                        ? "border-spot-600 font-medium text-spot-800"
                        : "border-transparent text-muted hover:border-spot-600 hover:text-spot-700"
                    }`}>
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-line pt-5 text-[0.8125rem] leading-relaxed text-muted">
              A policy that needs interpreting is a policy we wrote badly.
            </p>
            <Link href="/contact" className="btn btn-secondary btn-sm mt-3 w-full">Ask us</Link>
          </div>
        }
      >
        {policy.sections.map((s, i) => (
          <section key={i}>
            {s.heading && <h2 className="mb-3 text-xl">{s.heading}</h2>}
            {s.body.map((p, j) => (
              <p key={j} className="mt-3 text-[0.9375rem] leading-relaxed text-body first:mt-0">{p}</p>
            ))}
          </section>
        ))}

        <div className="!mt-12 rounded-md border border-line bg-surface p-5">
          <h2 className="text-base">Still unclear?</h2>
          <p className="mt-1.5 text-[0.875rem] text-muted">
            If anything here reads ambiguously, tell us — a policy that needs interpreting is a policy we wrote badly.
          </p>
          <Link href="/contact" className="btn btn-secondary btn-sm mt-4">Contact us</Link>
        </div>

        {/* the rail carries this on xl */}
        <nav className="!mt-10 flex flex-wrap gap-2 border-t border-line pt-6 xl:hidden">
          {POLICIES.filter((p) => p.slug !== policy.slug).map((p) => (
            <Link key={p.slug} href={`/policies/${p.slug}`} className="chip">{p.title}</Link>
          ))}
        </nav>
      </Prose>
    </>
  );
}
