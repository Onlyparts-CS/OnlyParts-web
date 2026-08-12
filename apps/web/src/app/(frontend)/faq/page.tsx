import Link from "next/link";
import type { Metadata } from "next";
import { FAQS } from "@/lib/content";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "FAQ — OnlyParts",
  description: "Minimum orders, quantity discounts, GST invoices, shipping times, returns and bulk buying — answered directly.",
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHeader
        title="Questions people actually ask"
        lead="If the answer you need isn't here, message us on WhatsApp — it's the fastest way to reach a person."
      />

      <div className="container-page page-shell">
        <div className="mx-auto max-w-2xl">
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
            {FAQS.map((f) => (
              <li key={f.q}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 hover:bg-sunken/60">
                    <span className="text-[0.9375rem] font-medium text-heading">{f.q}</span>
                    <span aria-hidden className="mt-0.5 shrink-0 text-spot-600 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="px-5 pb-4 text-[0.875rem] leading-relaxed text-muted">{f.a}</p>
                </details>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-md border border-spot-200 bg-spot-50 p-5 text-center">
            <h2 className="text-base text-spot-900">Still stuck?</h2>
            <p className="mt-1.5 text-[0.875rem] text-spot-900/80">
              WhatsApp gets a reply in under 30 minutes during working hours.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/contact" className="btn btn-primary btn-sm">Contact us</Link>
              <Link href="/guides" className="btn btn-secondary btn-sm">Read the guides</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
