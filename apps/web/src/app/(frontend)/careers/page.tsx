import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Reveal } from "@/components/Reveal";
import { ArrowRight, CheckIcon } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Careers — OnlyParts",
  description:
    "We are pre-launch and hiring slowly. What we are likely to open first, what the work is actually like, and how to reach us before a role exists.",
  alternates: { canonical: "/careers" },
};

/**
 * The last unbuilt route.
 *
 * It was left out because there were no roles to post, and a careers page that
 * invents openings is the same class of lie as a category page that invents
 * stock. So this one says what is true: nothing is open, here is what will open
 * first, and here is how to reach us anyway.
 */
const AREAS = [
  {
    title: "Catalogue engineering",
    body: "Normalising supplier data into typed attributes. Half data engineering, half knowing that a 608ZZ and a 608-2Z are the same bearing.",
    signals: ["Python or TypeScript", "Messy CSVs do not frighten you", "Mechanical or electronics background helps"],
  },
  {
    title: "Sourcing & vendor ops",
    body: "Finding who actually makes a part in India, negotiating the break quantities, and holding suppliers to the dispatch numbers we publish.",
    signals: ["Hardware trade experience", "Comfortable on a factory floor", "Hindi/Kannada/Tamil useful"],
  },
  {
    title: "Manufacturing engineering (Make)",
    body: "Reading a customer's drawing, choosing the process, and quoting it inside four hours without guessing.",
    signals: ["CNC, sheet metal or moulding experience", "Reads GD&T fluently", "DFM instincts"],
  },
  {
    title: "Frontend / full stack",
    body: "Search that parses m3x10, a facet rail over 50,000 SKUs, and a GST invoice an auditor accepts. Performance is a feature here, not a phase.",
    signals: ["TypeScript, React, Postgres", "Cares about Core Web Vitals", "Writes for the next reader"],
  },
];

const TRUE_TODAY = [
  "We are pre-launch. The catalogue is still being onboarded.",
  "There are no funded openings today — this page will list them when there are.",
  "We are in Peenya, Bengaluru, next to the suppliers. This is not a remote-first company.",
  "Early hires will do work outside their title, because there are not enough of us yet.",
];

export default function CareersPage() {
  return (
    <>
      <PageHeader
        title="No openings yet. Here's what's coming."
        lead="We would rather post this than a page of invented roles. When hiring opens it will be for the four areas below — and if you already do one of them well, write to us now."
        breadcrumb={[{ label: "About", href: "/about" }]}
      />

      <div className="container-page page-shell">
        {/* what is true today */}
        <Reveal className="mb-12 max-w-3xl rounded-md border border-line bg-surface p-5 shadow-e1">
          <h2 className="text-base">Where we actually are</h2>
          <ul className="mt-3 grid gap-2.5">
            {TRUE_TODAY.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[0.875rem] leading-relaxed text-body">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-spot-600" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <section>
          <h2 className="mb-1 text-xl">What we will hire for first</h2>
          <p className="mb-5 max-w-2xl text-[0.9375rem] text-muted">
            Roughly in the order the business needs them. None of these are live
            postings — they are an honest signal of where the work is.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {AREAS.map((a, i) => (
              <Reveal key={a.title} delay={i * 95}>
                <div className="flex h-full flex-col rounded-md border border-line bg-surface p-5 shadow-e1">
                  <h3 className="text-[1.0625rem]">{a.title}</h3>
                  <p className="mt-2 flex-1 text-[0.875rem] leading-relaxed text-muted">{a.body}</p>
                  <ul className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
                    {a.signals.map((s) => (
                      <li key={s} className="rounded-xs bg-sunken px-2 py-0.5 font-mono text-[0.6875rem] text-faint">{s}</li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <Reveal className="mt-12 rounded-md border border-spot-200 bg-spot-50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-lg text-spot-900">Write to us before a role exists</h2>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-spot-900/80">
                Tell us what you have built and which of the four areas it maps to. A
                link to something real — a repo, a part you designed, a supply chain you
                fixed — is worth more than a CV. We read everything and reply to anything
                specific.
              </p>
              <p className="mt-3 font-mono text-[0.8125rem] text-spot-800">careers@onlyparts.in</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/contact" className="btn btn-primary btn-sm">
                Contact us <ArrowRight className="size-3.5" />
              </Link>
              <Link href="/about" className="btn btn-secondary btn-sm">What we are building</Link>
            </div>
          </div>
        </Reveal>

        <p className="mt-8 max-w-2xl text-[0.8125rem] leading-relaxed text-faint">
          We do not use unpaid trials, and we do not ask for work that ships without
          paying for it. If an assessment takes more than two hours, we pay for it.
        </p>
      </div>
    </>
  );
}
