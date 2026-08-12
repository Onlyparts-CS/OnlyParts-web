import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { TruckIcon, InvoiceIcon, UploadIcon, UserIcon } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Contact — OnlyParts",
  description: "Reach a human. WhatsApp, phone and email, with the hours we actually answer.",
};

const CHANNELS = [
  {
    icon: UserIcon,
    title: "WhatsApp",
    value: "+91 90000 00000",
    href: "https://wa.me/919000000000",
    note: "Fastest. Mon–Sat, 9 AM – 7 PM IST. Typical reply under 30 minutes in hours.",
  },
  {
    icon: UserIcon,
    title: "Phone",
    value: "+91 90000 00000",
    href: "tel:+919000000000",
    note: "Mon–Sat, 9 AM – 7 PM IST.",
  },
  {
    icon: InvoiceIcon,
    title: "Email",
    value: "help@onlyparts.in",
    href: "mailto:help@onlyparts.in",
    note: "Answered within one working day. Include your order number if you have one.",
  },
];

const ROUTES = [
  { icon: TruckIcon, title: "Where is my order?", body: "Track it from your account — tracking updates land there before they reach email.", href: "/track", cta: "Track an order" },
  { icon: UploadIcon, title: "I need a part you don't stock", body: "Send a drawing, a datasheet or a photo. First response in 4 business hours.", href: "/make/rfq", cta: "Start an RFQ" },
  { icon: InvoiceIcon, title: "I need a GST invoice fixed", body: "Wrong GSTIN or address on an invoice? We can reissue within the same financial year.", href: "/policies/gst-invoices", cta: "GST invoices" },
  { icon: UserIcon, title: "Bulk or institutional buying", body: "Quantities above 1,000, proforma invoices, credit terms, ATL and college supply.", href: "/bulk-orders", cta: "Bulk orders" },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        title="Talk to a human"
        lead="No ticket queue you can't see into. These are the channels we actually monitor, with the hours we actually answer."
      />

      <div className="container-page page-shell">
        <div className="grid gap-4 sm:grid-cols-3">
          {CHANNELS.map((c) => (
            <a key={c.title} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined}
              rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="group rounded-md border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-spot-600 hover:shadow-e2">
              <span className="mb-3 grid size-10 place-items-center rounded-sm border border-spot-200 bg-spot-50 text-spot-600">
                <c.icon className="size-5" />
              </span>
              <h2 className="text-[1.0625rem]">{c.title}</h2>
              <p className="mt-1 font-mono text-[0.9375rem] text-spot-700">{c.value}</p>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">{c.note}</p>
            </a>
          ))}
        </div>

        <h2 className="mb-4 mt-12 text-lg">Common reasons people write in</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROUTES.map((r) => (
            <div key={r.title} className="flex gap-4 rounded-md border border-line bg-surface p-5">
              <r.icon className="mt-0.5 size-5 shrink-0 text-spot-600" />
              <div className="min-w-0">
                <h3 className="text-[0.9375rem] font-semibold text-heading">{r.title}</h3>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{r.body}</p>
                <Link href={r.href} className="mt-3 inline-block text-[0.8125rem] font-medium text-spot-700 hover:underline">
                  {r.cta} →
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-6 rounded-md border border-line bg-surface p-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">Registered office</h2>
            <p className="text-[0.875rem] leading-relaxed text-body">
              OnlyParts Retail Pvt Ltd<br />
              Peenya Industrial Area<br />
              Bengaluru 560058, Karnataka<br />
              India
            </p>
            <p className="mt-3 font-mono text-[0.75rem] text-faint">GSTIN 29AABCO1234M1Z5</p>
          </div>
          <div>
            <h2 className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">Privacy & grievances</h2>
            <p className="text-[0.875rem] leading-relaxed text-body">
              For data access, correction or erasure requests, or any privacy
              grievance, contact our Grievance Officer at{" "}
              <a href="mailto:privacy@onlyparts.in" className="text-spot-700 hover:underline">privacy@onlyparts.in</a>.
            </p>
            <p className="mt-2 text-[0.8125rem] text-muted">We respond within 30 days, as required under the DPDP Act 2023.</p>
            <Link href="/policies/privacy" className="mt-3 inline-block text-[0.8125rem] font-medium text-spot-700 hover:underline">
              Privacy policy →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
