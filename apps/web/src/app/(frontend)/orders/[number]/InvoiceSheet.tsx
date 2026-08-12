"use client";

import Link from "next/link";
import type { OrderView } from "@/lib/orderRead";
import { STATES, SELLER_GSTIN, SELLER_STATE } from "@/lib/gst";
import { inr } from "@/lib/catalog";
import { CheckIcon, TruckIcon, InvoiceIcon } from "@/components/Icons";
import { Logo } from "@/components/Logo";

/**
 * The invoice itself. Client-side only for `window.print()` — everything it
 * renders is decided on the server and handed down, so nothing here can
 * disagree with what was actually charged.
 */

/** What the buyer is looking at, which is not always a tax invoice yet. */
const HEADING: Record<OrderView["paymentStatus"], string> = {
  pending: "Order placed",
  authorized: "Payment authorised",
  paid: "Payment received",
  failed: "Payment failed",
  refunded: "Order refunded",
  partially_refunded: "Order partially refunded",
};

export function InvoiceSheet({ order }: { order: OrderView }) {
  const stateName = (code: string) => STATES.find((s) => s.code === code)?.name ?? code;
  const intra = order.placeOfSupply === SELLER_STATE;

  /*
    A tax invoice number is issued when payment succeeds, never at placement.
    Until then this sheet is a proforma and has to say so — printing "Tax
    Invoice" over an unpaid order is not a labelling nicety, it is a document
    claiming a supply that has not happened.
  */
  const isTaxInvoice = Boolean(order.invoiceNumber);

  // Derived from the order date, not from "now" — an invoice must render the
  // same figures every time it's opened, and `Date.now()` during render is both
  // impure and wrong here (the promise was made when the order was placed).
  const eta = new Date(new Date(order.placedAt).getTime() + 2 * 864e5)
    .toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div className="container-page page-shell">
      {/* confirmation — screen only; it is not part of the tax document */}
      <div className="print-hide mb-8 rounded-md border border-success/25 bg-success-bg p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success text-white">
            <CheckIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl text-heading">{HEADING[order.paymentStatus]}</h1>
            <p className="mt-1 text-[0.875rem] text-muted">
              Order <span className="font-mono text-heading">{order.number}</span>
              {order.email && (
                <> · a confirmation has been sent to <span className="font-mono">{order.email}</span></>
              )}
            </p>
            <p className="mt-2 flex items-center gap-2 text-[0.8125rem] text-muted">
              <TruckIcon className="size-4 shrink-0 text-success" />
              Delivery by <span className="font-medium text-heading">{eta}</span> to {order.address.pincode}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="btn btn-secondary btn-sm">
              Print {isTaxInvoice ? "invoice" : "receipt"}
            </button>
            <Link href="/account" className="btn btn-ghost btn-sm">All orders</Link>
          </div>
        </div>
      </div>

      {/* ---------- GST invoice ---------- */}
      <article className="invoice-sheet overflow-hidden rounded-md border border-line bg-surface shadow-e1">
        <header className="avoid-break flex flex-wrap items-start justify-between gap-6 border-b border-line p-6">
          <div>
            <Logo />
            <p className="mt-3 text-[0.75rem] leading-relaxed text-muted">
              OnlyParts Retail Pvt Ltd<br />
              Peenya Industrial Area, Bengaluru 560058<br />
              Karnataka, India
            </p>
            <p className="mt-2 font-mono text-[0.6875rem] text-faint">
              GSTIN <span className="text-heading">{SELLER_GSTIN}</span>
            </p>
          </div>

          <div className="text-right">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-spot-700">
              {isTaxInvoice ? "Tax Invoice" : "Proforma"}
            </p>
            <p className="mt-2 font-mono text-[0.8125rem] text-heading">
              {order.invoiceNumber ?? order.number}
            </p>
            <dl className="mt-3 grid gap-1 text-[0.75rem]">
              <Meta k={isTaxInvoice ? "Invoice date" : "Placed"} v={new Date(order.placedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
              <Meta k="Order" v={order.number} />
              <Meta k="Payment" v={order.paymentMethod.toUpperCase()} />
            </dl>
            {!isTaxInvoice && (
              <p className="mt-2 max-w-[16rem] text-right text-[0.625rem] leading-relaxed text-faint">
                A tax invoice number is issued once payment is confirmed.
              </p>
            )}
          </div>
        </header>

        <div className="avoid-break grid gap-6 border-b border-line p-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">Billed to</h2>
            <p className="text-[0.875rem] leading-relaxed text-body">
              <span className="font-medium text-heading">{order.address.name}</span><br />
              {order.address.line1}{order.address.line2 && <>, {order.address.line2}</>}<br />
              {order.address.city} {order.address.pincode}<br />
              {stateName(order.address.stateCode)}<br />
              <span className="font-mono text-[0.75rem] text-faint">+91 {order.address.phone}</span>
            </p>
            {order.gstin && (
              <p className="mt-2 font-mono text-[0.75rem] text-heading">GSTIN {order.gstin}</p>
            )}
          </div>
          <div className="sm:text-right">
            <h2 className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">Place of supply</h2>
            <p className="text-[0.875rem] text-body">
              {stateName(order.placeOfSupply)} <span className="font-mono text-faint">({order.placeOfSupply})</span>
            </p>
            <p className="mt-1 font-mono text-[0.6875rem] text-faint">
              {intra ? "Intra-state supply — CGST + SGST" : "Inter-state supply — IGST"}
            </p>
          </div>
        </div>

        {/*
          Line items with per-line tax — the part an auditor reads.

          `colgroup` rather than letting the browser size columns: printing sets
          `table-layout: fixed` (the 760px min-width had to go, it was 6px wider
          than A4's printable area and the Total column fell off the sheet), and
          fixed layout needs declared widths or it splits them evenly and the
          description column collapses.
        */}
        <div className="invoice-scroll overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <colgroup>
              <col style={{ width: intra ? "28%" : "32%" }} />
              <col style={{ width: intra ? "10%" : "11%" }} />
              <col style={{ width: intra ? "7%" : "8%" }} />
              <col style={{ width: intra ? "11%" : "12%" }} />
              <col style={{ width: intra ? "12%" : "13%" }} />
              {intra ? (
                <>
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                </>
              ) : (
                <col style={{ width: "11%" }} />
              )}
              <col style={{ width: intra ? "12%" : "13%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-line-strong bg-sunken text-[0.625rem] uppercase tracking-[0.1em] text-faint">
                <th className="px-4 py-2.5 font-bold">Description</th>
                <th className="px-2 py-2.5 font-bold">HSN</th>
                <th className="px-2 py-2.5 text-right font-bold">Qty</th>
                <th className="px-2 py-2.5 text-right font-bold">Rate</th>
                <th className="px-2 py-2.5 text-right font-bold">Taxable</th>
                {intra ? (
                  <>
                    <th className="px-2 py-2.5 text-right font-bold">CGST</th>
                    <th className="px-2 py-2.5 text-right font-bold">SGST</th>
                  </>
                ) : (
                  <th className="px-2 py-2.5 text-right font-bold">IGST</th>
                )}
                <th className="px-4 py-2.5 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => (
                <tr key={l.sku} className="border-b border-line align-top odd:bg-sunken/45">
                  <td className="px-4 py-3">
                    <span className="block text-[0.8125rem] text-heading">{l.title}</span>
                    <span className="block break-all font-mono text-[0.625rem] text-disabled">⌗ {l.sku}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 font-mono text-[0.75rem] text-body">{l.hsn}</td>
                  <td className="px-2 py-3 text-right font-mono text-[0.75rem] tnum text-body">{l.qty.toLocaleString("en-IN")}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-[0.75rem] tnum text-body">
                    {inr(l.unitPrice)}
                    <span className="block text-[0.625rem] text-disabled">{l.rate}% GST</span>
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-[0.75rem] tnum text-body">{inr(l.taxable)}</td>
                  {intra ? (
                    <>
                      <td className="px-2 py-3 text-right font-mono text-[0.75rem] tnum text-body">
                        {inr(l.cgst)}<span className="block text-[0.625rem] text-disabled">{l.rate / 2}%</span>
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-[0.75rem] tnum text-body">
                        {inr(l.sgst)}<span className="block text-[0.625rem] text-disabled">{l.rate / 2}%</span>
                      </td>
                    </>
                  ) : (
                    <td className="px-2 py-3 text-right font-mono text-[0.75rem] tnum text-body">
                      {inr(l.igst)}<span className="block text-[0.625rem] text-disabled">{l.rate}%</span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-right font-mono text-[0.8125rem] tnum text-heading">{inr(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* totals */}
        <div className="avoid-break flex justify-end border-t border-line-strong p-6">
          <dl className="w-full max-w-xs grid gap-2 text-[0.875rem]">
            <Row k="Taxable value" v={inr(order.taxable)} />
            {intra ? (
              <>
                <Row k="CGST" v={inr(order.cgst)} />
                <Row k="SGST" v={inr(order.sgst)} />
              </>
            ) : (
              <Row k="IGST" v={inr(order.igst)} />
            )}
            <Row k="Shipping" v={order.shipping === 0 ? "Free" : inr(order.shipping)} />
            <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-medium text-heading">Total</dt>
              <dd className="font-display text-xl font-bold tnum text-heading">{inr(order.grand)}</dd>
            </div>
            <p className="mt-1 text-right text-[0.6875rem] text-faint">
              Total tax: <span className="font-mono">{inr(order.cgst + order.sgst + order.igst)}</span>
            </p>
          </dl>
        </div>

        <footer className="avoid-break border-t border-line bg-sunken px-6 py-4">
          <p className="flex items-start gap-2 text-[0.6875rem] leading-relaxed text-faint">
            <InvoiceIcon className="mt-0.5 size-3.5 shrink-0 text-spot-600" />
            <span>
              Prices are inclusive of GST; taxable value is back-computed at the applicable rate.
              Invoice numbering is a gapless per-financial-year sequence. This is computer generated
              and valid without signature. Goods once used are non-returnable; unopened packs may be
              returned within 7 days.
            </span>
          </p>
        </footer>
      </article>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-end gap-3">
      <dt className="text-faint">{k}</dt>
      <dd className="font-mono text-heading">{v}</dd>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="font-mono tnum text-heading">{v}</dd>
    </div>
  );
}
