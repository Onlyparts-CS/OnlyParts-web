import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { InvoiceIcon, BoxIcon, TruckIcon, CheckIcon } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Bulk & institutional orders — OnlyParts",
  description:
    "Quantity pricing above 1,000 units, proforma invoices for procurement, GST input credit, and supply for colleges, ATL labs and manufacturers.",
};

const OFFERS = [
  {
    icon: BoxIcon,
    title: "Quantity pricing",
    body: "Price breaks are published on every product page up to 1,000 units. Above that, send the line items and we quote against your actual volume — usually within one working day.",
  },
  {
    icon: InvoiceIcon,
    title: "Procurement paperwork",
    body: "Proforma invoices for approval, purchase-order references carried onto the tax invoice, and GST invoices with per-line HSN codes so input credit is straightforward.",
  },
  {
    icon: TruckIcon,
    title: "Scheduled delivery",
    body: "Staggered releases against a single order, so you are not storing a year of stock. We hold the price for the whole schedule.",
  },
];

const SEGMENTS = [
  ["Manufacturers & job shops", "Repeat BOMs, kitted deliveries, and consignment stock for high-velocity lines."],
  ["Hardware startups", "Prototype quantities that scale into production without changing supplier."],
  ["Colleges & ATL labs", "Kit lists against a syllabus, institutional invoicing, and delivery to a campus address."],
  ["Repair businesses", "Consumables and micro-fasteners in the quantities a bench actually uses."],
];

export default function BulkOrdersPage() {
  return (
    <>
      <PageHeader
        title="Bulk & institutional orders"
        lead="Above 1,000 units the published price breaks stop and a real quote starts. Send us the lines and we'll price them properly."
      />

      <div className="container-page page-shell">
        <div className="grid gap-4 lg:grid-cols-3">
          {OFFERS.map((o) => (
            <div key={o.title} className="rounded-md border border-line bg-surface p-5">
              <span className="mb-3 grid size-10 place-items-center rounded-sm border border-spot-200 bg-spot-50 text-spot-600">
                <o.icon className="size-5" />
              </span>
              <h2 className="text-[1.0625rem]">{o.title}</h2>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">{o.body}</p>
            </div>
          ))}
        </div>

        <section className="section-gap grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-lg">Who we supply</h2>
            <ul className="grid gap-4">
              {SEGMENTS.map(([title, body]) => (
                <li key={title} className="flex gap-3">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-spot-600" />
                  <span>
                    <span className="block text-[0.9375rem] font-semibold text-heading">{title}</span>
                    <span className="mt-0.5 block text-[0.875rem] leading-relaxed text-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-spot-200 bg-spot-50 p-6">
            <h2 className="text-lg text-spot-900">How to get a quote</h2>
            <ol className="mt-4 grid gap-4">
              {[
                ["Send the lines", "A spreadsheet, a BOM, or just SKUs and quantities in an email. Part numbers from another supplier are fine — we'll cross-reference."],
                ["We price it", "Against real volume, usually within one working day. Two working days if it needs an import quote."],
                ["Proforma if you need one", "For approval or a purchase order, before you commit."],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-spot-600 font-mono text-[0.6875rem] font-bold text-on-accent">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[0.875rem] font-semibold text-spot-900">{t}</span>
                    <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-spot-900/75">{b}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/make/rfq" className="btn btn-primary btn-sm">Send a bulk enquiry</Link>
              <Link href="/contact" className="btn btn-secondary btn-sm">Talk to us</Link>
            </div>
          </div>
        </section>

        <section className="section-gap rounded-md border border-line bg-surface p-6">
          <h2 className="text-lg">Not in the catalogue?</h2>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
            Bulk buying and custom manufacturing use the same intake. If the part
            has to be made rather than bought — CNC, sheet metal, injection
            moulding, PCB assembly — Make-on-Demand quotes it within 24 hours.
          </p>
          <Link href="/make" className="btn btn-secondary btn-sm mt-4">Make-on-Demand →</Link>
        </section>
      </div>
    </>
  );
}
