import Link from "next/link";
import { PROJECTS } from "@/lib/catalog";
import { Logo } from "@/components/Logo";
import { Rule } from "@/components/Rule";

const COMPANY = [
  ["Make-on-Demand", "/make"], ["Bulk orders", "/bulk-orders"], ["About", "/about"],
  ["Careers", "/careers"], ["Guides", "/guides"], ["FAQ", "/faq"],
];
const SUPPORT = [
  ["Track order", "/track"], ["Shipping", "/policies/shipping"], ["Returns", "/policies/returns"],
  ["GST invoices", "/policies/gst-invoices"], ["Contact", "/contact"],
];
const LEGAL = [
  ["Privacy", "/policies/privacy"], ["Terms", "/policies/terms"],
];

/**
 * The colophon — the back matter of the catalogue.
 *
 * It closes on the wordmark at plate scale rather than trailing off in small
 * print, because a page that ends on a legal line ends by accident. The
 * imprint sits under it, which is where an imprint belongs.
 */
export function Footer() {
  return (
    <footer className="print-hide border-t border-ink-900 bg-surface">
      <div className="container-page">
        <div className="grid gap-x-8 gap-y-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div>
            <Logo className="mb-4" />
            <p className="max-w-xs text-[0.875rem] leading-relaxed text-muted">
              The parts store for people who build things. Retail without a minimum
              order, and manufacturing on demand when the catalogue runs out.
            </p>
            <p className="bin mt-5">Peenya · Bengaluru · 560058</p>
          </div>

          {/*
            No drawer columns here.

            The header carries all fourteen as folder tabs on every page, and
            repeating them in the footer meant the two longest columns on the
            page were a second copy of the primary navigation. One route to a
            category is enough; the footer's job is the things the header has
            no room for.
          */}
          <FootCol title="Builds">
            {PROJECTS.map((p) => (
              <li key={p.slug}><Link href={`/projects/${p.slug}`}>{p.name}</Link></li>
            ))}
          </FootCol>

          <FootCol title="Company">
            {COMPANY.map(([label, href]) => <li key={label}><Link href={href}>{label}</Link></li>)}
          </FootCol>

          <FootCol title="Support">
            {SUPPORT.map(([label, href]) => <li key={label}><Link href={href}>{label}</Link></li>)}
          </FootCol>
        </div>

        {/*
          The base plate.

          Deliberately below AA (1.35:1 at ink-200 on white) and deliberately
          exempt: this is a watermark, not copy. It is `aria-hidden`, carries
          no information, and the same wordmark is set legibly a few hundred
          pixels above it in the first footer column — so WCAG 1.4.3's
          exemption for purely decorative text applies. Darkening it to reach
          3:1 would make an eleven-rem word the loudest thing on the page,
          which is the opposite of what a base plate is for.
        */}
        <div className="border-t border-line pt-8">
          <p aria-hidden className="monumental select-none text-[clamp(2.75rem,13vw,11rem)] leading-[0.8] text-ink-200">
            Onlyparts
          </p>
          <Rule className="mt-3 w-full" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-6">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.6875rem] text-faint">
            <span>© 2026 OnlyParts Retail Pvt Ltd</span>
            {LEGAL.map(([label, href]) => (
              <Link key={label} href={href} className="underline-offset-4 hover:text-spot-700 hover:underline">{label}</Link>
            ))}
          </span>
          <span className="bin">UPI · Visa · Mastercard · Netbanking</span>
        </div>
      </div>
    </footer>
  );
}

function FootCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="overline mb-4 border-b border-line pb-2">{title}</h2>
      <ul className="grid gap-2 text-[0.8125rem] text-muted [&_a:hover]:text-spot-700 [&_a]:transition-colors">
        {children}
      </ul>
    </div>
  );
}
