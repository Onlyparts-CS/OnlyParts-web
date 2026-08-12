import Link from "next/link";
import { notFound } from "next/navigation";
import { guard } from "@/lib/adminAuth";
import { Denied } from "@/components/admin/Denied";
import { StatusStamp, PaymentStamp } from "@/components/admin/Stamp";
import { getOrderAdmin, ist, istDay } from "@/lib/adminOps";
import { ORDER_TRANSITIONS } from "@/collections/Orders";
import { STATES, SELLER_STATE } from "@/lib/gst";
import { inr } from "@/lib/catalog";
import { ArrowRight } from "@/components/Icons";
import { OrderControls } from "./OrderControls";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ number: string }> };

const PAYMENT_LABEL: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Netbanking",
  cod: "Cash on delivery",
  neft: "Bank transfer",
};

/**
 * One order, whole.
 *
 * This screen reads; it does not write. Editing lives in Payload's own panel
 * at `/cms`, which already enforces the status machine and the frozen-invoice
 * rule in `collections/Orders.ts` — rebuilding those forms here would mean
 * maintaining two paths into the same legal document, and the second one would
 * eventually disagree with the first.
 *
 * What Payload's panel cannot give is this arrangement: the timeline as a
 * spine, the tax split laid out the way the return wants it, and the answer to
 * "where is it" above the fold.
 */
export default async function AdminOrderPage({ params }: Props) {
  const g = await guard("admin", "ops");
  if (!g.ok) return <Denied staff={g.staff} needed={g.needed} />;

  const { number } = await params;
  const order = await getOrderAdmin(decodeURIComponent(number));
  if (!order) notFound();

  const stateName = (code: string) => STATES.find((s) => s.code === code)?.name ?? code;
  const intra = order.placeOfSupply === SELLER_STATE;
  const placedAt = order.placedAt ?? order.createdAt;
  const next = ORDER_TRANSITIONS[order.status] ?? [];

  /* Newest first — the last thing that happened is the thing being asked about. */
  const events = [...(order.events ?? [])].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return (
    <div className="container-page page-shell">
      <Link href="/admin/orders" className="bin hover:text-spot-700">&larr; All orders</Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <h1 className="monumental text-[clamp(1.75rem,4vw,2.75rem)]">{order.number}</h1>
          <p className="mt-2 font-mono text-[0.8125rem] text-muted">
            Placed {ist(placedAt)} IST · {order.channel ?? "web"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusStamp value={order.status} />
          <PaymentStamp value={order.paymentStatus} />
          <Link
            href={`/cms/collections/orders/${order.id}`}
            className="btn btn-secondary btn-sm ml-1"
          >
            Edit in CMS <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <OrderControls
        number={order.number ?? String(order.id)}
        status={order.status}
        paymentStatus={order.paymentStatus}
        next={next}
      />

      <div className="rack section-gap sm:grid-cols-2 lg:grid-cols-4">
        <Cell label="Grand total" value={inr(order.grandTotal)} sub="paid or payable, inclusive" />
        <Cell
          label="Tax invoice"
          value={order.invoiceNumber ?? "Proforma"}
          sub={
            order.invoiceNumber
              ? `issued ${order.invoiceDate ? istDay(order.invoiceDate) : "—"}`
              : "issued when payment succeeds"
          }
          muted={!order.invoiceNumber}
        />
        <Cell
          label="Payment"
          value={PAYMENT_LABEL[order.paymentMethod ?? ""] ?? "—"}
          sub={order.gatewayPaymentId ?? order.gatewayOrderId ?? "no gateway reference"}
        />
        <Cell
          label="Place of supply"
          value={stateName(order.placeOfSupply)}
          sub={intra ? `${order.placeOfSupply} · intra-state, CGST + SGST` : `${order.placeOfSupply} · inter-state, IGST`}
        />
      </div>

      <div className="section-gap grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <h2 className="mb-3 text-lg">Lines</h2>
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="bin border-b border-line bg-sunken">
                  <th className="px-3 py-2.5 font-bold">SKU</th>
                  <th className="px-3 py-2.5 font-bold">Description</th>
                  <th className="px-2 py-2.5 font-bold">HSN</th>
                  <th className="px-2 py-2.5 text-right font-bold">Qty</th>
                  <th className="px-2 py-2.5 text-right font-bold">Rate</th>
                  <th className="px-2 py-2.5 text-right font-bold">Taxable</th>
                  <th className="px-2 py-2.5 text-right font-bold">GST</th>
                  <th className="px-3 py-2.5 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((l, i) => (
                  <tr key={`${l.sku}-${i}`} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[0.75rem] text-heading">{l.sku}</td>
                    <td className="max-w-xs px-3 py-2">
                      <span className="block truncate text-[0.8125rem] text-body">{l.title}</span>
                    </td>
                    <td className="px-2 py-2 font-mono text-[0.75rem] tnum text-faint">{l.hsnCode}</td>
                    <td className="px-2 py-2 text-right font-mono text-[0.75rem] tnum text-body">{l.qty}</td>
                    <td className="px-2 py-2 text-right font-mono text-[0.75rem] tnum text-muted">{inr(l.unitPrice)}</td>
                    <td className="px-2 py-2 text-right font-mono text-[0.75rem] tnum text-muted">{inr(l.taxable)}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-[0.75rem] tnum text-muted">
                      {inr((l.cgst ?? 0) + (l.sgst ?? 0) + (l.igst ?? 0))}
                      <span className="ml-1 text-disabled">@{l.gstRate}%</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[0.8125rem] tnum text-heading">{inr(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 ml-auto w-full max-w-sm border border-line bg-surface">
            <Money label="Subtotal" value={order.subtotal} />
            <Money label="Shipping" value={order.shipping} />
            <Money label="Taxable value" value={order.taxable} />
            {/*
              Never both. Intra-state splits into CGST and SGST at half the rate
              each; inter-state is IGST at the full rate. Showing all three with
              zeros invites somebody to add them up.
            */}
            {intra ? (
              <>
                <Money label="CGST" value={order.cgst ?? 0} />
                <Money label="SGST" value={order.sgst ?? 0} />
              </>
            ) : (
              <Money label="IGST" value={order.igst ?? 0} />
            )}
            <Money label="Grand total" value={order.grandTotal} strong />
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Buyer">
            <Field label="Name" value={order.customerName} />
            <Field label="Phone" value={order.customerPhone} mono />
            <Field label="Email" value={order.customerEmail ?? "—"} />
            <Field label="GSTIN" value={order.gstin ?? "—"} mono />
            {order.customer && (
              <Link
                href={`/cms/collections/customers/${typeof order.customer === "object" ? order.customer.id : order.customer}`}
                className="mt-3 inline-block text-[0.75rem] text-spot-700 hover:underline"
              >
                Customer record &rarr;
              </Link>
            )}
          </Panel>

          <Panel title="Ship to">
            <p className="text-[0.8125rem] leading-relaxed text-body">
              {order.shipTo.name}
              <br />
              {order.shipTo.line1}
              {order.shipTo.line2 && <><br />{order.shipTo.line2}</>}
              <br />
              {order.shipTo.city} {order.shipTo.pincode}
              <br />
              {stateName(order.shipTo.stateCode)}
            </p>
            <p className="mt-2 font-mono text-[0.75rem] tnum text-faint">{order.shipTo.phone}</p>
          </Panel>

          {order.staffNotes && (
            <Panel title="Staff notes">
              <p className="whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-body">
                {order.staffNotes}
              </p>
              <p className="bin mt-3">internal · never shown to the buyer</p>
            </Panel>
          )}
        </div>
      </div>

      <section className="section-gap">
        <h2 className="mb-3 text-lg">Timeline</h2>
        {events.length === 0 ? (
          <p className="border border-dashed border-line-strong bg-surface p-6 text-[0.8125rem] text-muted">
            Nothing recorded. The timeline is append-only and written by checkout, the
            payment webhook and any staff edit — an order with an empty one has not been
            touched since it was placed.
          </p>
        ) : (
          <ol className="border-l-2 border-line pl-5">
            {events.map((e, i) => (
              <li key={e.id ?? i} className="relative pb-5 last:pb-0">
                {/* The tick on the rule. Squared, like everything else here. */}
                <span className="absolute -left-[1.575rem] top-1.5 size-2 bg-spot-500" aria-hidden />
                <p className="bin">{ist(e.at)} · {e.kind}</p>
                <p className="mt-1 text-[0.875rem] text-body">{e.detail}</p>
                {e.actor && <p className="mt-0.5 font-mono text-[0.6875rem] text-faint">{e.actor}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Cell({ label, value, sub, muted }: {
  label: string; value: string; sub: string; muted?: boolean;
}) {
  return (
    <div className="bg-surface p-4">
      <div className="bin">{label}</div>
      <div className={`mt-1.5 font-display text-xl font-bold tnum ${muted ? "text-ink-500" : "text-heading"}`}>
        {value}
      </div>
      <div className="mt-1 font-mono text-[0.6875rem] break-all text-disabled">{sub}</div>
    </div>
  );
}

function Money({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 border-b border-line px-4 py-2 last:border-0 ${
      strong ? "bg-sunken" : ""
    }`}>
      <span className={strong ? "text-[0.875rem] font-medium text-heading" : "text-[0.8125rem] text-muted"}>
        {label}
      </span>
      <span className={`font-mono tnum ${strong ? "text-[0.9375rem] font-bold text-heading" : "text-[0.8125rem] text-body"}`}>
        {inr(value)}
      </span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-surface p-4">
      <h2 className="bin mb-2.5">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-1.5 last:border-0">
      <span className="shrink-0 text-[0.75rem] text-faint">{label}</span>
      <span className={`min-w-0 truncate text-right text-[0.8125rem] text-body ${mono ? "font-mono tnum" : ""}`}>
        {value}
      </span>
    </div>
  );
}
