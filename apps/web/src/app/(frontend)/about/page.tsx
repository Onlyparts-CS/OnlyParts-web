import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Reveal } from "@/components/Reveal";
import { TruckIcon, BoxIcon, InvoiceIcon, CheckIcon } from "@/components/Icons";
import { DRAWER_COUNT } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "About — OnlyParts",
  description:
    "Why OnlyParts exists: one cart for every category of part, no minimum order, dispatch times stated as numbers, and GST invoices on every order.",
};

/**
 * The three facts that used to sit in the hero live here, expanded into real
 * copy — see docs/04-WIREFRAMES.md build note. A one-line row could state them;
 * only a page can explain why they are true.
 */
const PROMISES = [
  {
    icon: BoxIcon,
    title: "No minimum order",
    body:
      "Buy one screw. Buy four. Buy ten thousand. There is no minimum order value, no minimum quantity, and no packet size you have to round up to.",
    why:
      "Most of what stops a project is a part you need one of. Distributors won't break a box of 100, so people buy 100 or give up. We break the box.",
  },
  {
    icon: TruckIcon,
    title: "Dispatch stated as a number",
    body:
      "In-stock items ordered before 4 PM IST dispatch the same working day. Made-to-order items show their lead time on the product page, before you add them to the cart.",
    why:
      "“Fast shipping” is not a commitment. A number is. And when we are going to miss it, we tell you on the day we know rather than letting you discover it by waiting.",
  },
  {
    icon: InvoiceIcon,
    title: "GST invoices on every order",
    body:
      "A compliant tax invoice with per-line HSN codes is generated automatically and attached to your confirmation. Save your GSTIN once and it applies to everything afterwards.",
    why:
      "If you are buying for a business, an invoice you cannot claim against is a discount you did not get. It should not require an email to support.",
  },
];

const VALUES = [
  ["The specification is the product", "Photographs are representative; the spec table is contractual. If a manufacturer changes a specification, we update the listing and tell anyone with an open order before we ship."],
  ["Stock counts must be true", "An “in stock” that isn't is the most expensive lie in retail. Stock is derived from a movement ledger, reserved at checkout, and flips to made-to-order automatically when a supplier feed goes stale."],
  ["Refunds go back the way they came", "To your original payment method. Never store credit as the only option, never a percentage deduction for our mistake."],
  ["Search should speak engineering", "You know the dimensions, not the product name. Typing m3x10 ss304 should find the screw, not return nothing."],
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="Every part. One cart."
        lead="A maker building a drone needs a motor, an ESC, a LiPo, M2.5 screws, 608 bearings and heat-shrink. Today that is four websites, four checkouts and four shipping fees. That is the problem we exist to remove."
      />

      <section className="border-b border-line bg-bg py-14">
        <div className="container-page grid gap-4 lg:grid-cols-3">
          {PROMISES.map((p, i) => (
            <Reveal key={p.title} delay={i * 95}>
              <div className="h-full rounded-md border border-line bg-surface p-5">
                <span className="mb-3 grid size-10 place-items-center rounded-sm border border-spot-200 bg-spot-50 text-spot-600">
                  <p.icon className="size-5" />
                </span>
                <h2 className="text-[1.0625rem]">{p.title}</h2>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-body">{p.body}</p>
                <p className="mt-3 border-t border-line pt-3 text-[0.8125rem] leading-relaxed text-muted">
                  {p.why}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-b border-line bg-surface py-14 lg:py-20">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <h2 className="text-[clamp(1.5rem,3vw,2.25rem)]">{DRAWER_COUNT} categories, cross-listed</h2>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
              Fasteners, motors, electronic components, batteries, 3D printing,
              drones, tools, bearings, magnets, CNC, industrial electricals, EV
              parts and hardware — three levels deep, with the same part listed on
              every shelf it belongs on.
            </p>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
              A NEMA 17 stepper is under Motors, and under 3D Printing, and under
              CNC. Cross-listing costs us nothing and is the main defence against
              having to visit four sites.
            </p>
            <Link href="/c" className="btn btn-secondary btn-sm mt-6">Browse all categories</Link>
          </Reveal>

          <Reveal delay={80}>
            <ul className="grid gap-5">
              {VALUES.map(([title, body]) => (
                <li key={title} className="flex gap-3">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-spot-600" />
                  <span>
                    <span className="block font-display text-[1rem] font-bold text-heading">{title}</span>
                    <span className="mt-1 block text-[0.875rem] leading-relaxed text-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="bg-spot-50 py-14 lg:py-20">
        <div className="container-page max-w-2xl text-center">
          <h2 className="text-[clamp(1.5rem,3vw,2.25rem)]">We&apos;ll make it.</h2>
          <p className="mt-4 text-[1.0625rem] text-muted">
            Every part we don&apos;t stock is a part someone still needs. Upload a
            drawing or a BOM and a real engineer quotes it within 24 hours —
            prototype quantities through mass production.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/make" className="btn btn-primary">Make-on-Demand</Link>
            <Link href="/contact" className="btn btn-secondary">Talk to us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
