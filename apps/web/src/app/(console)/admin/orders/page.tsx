import Link from "next/link";
import { guard } from "@/lib/adminAuth";
import { Denied } from "@/components/admin/Denied";
import { StatusStamp, PaymentStamp } from "@/components/admin/Stamp";
import { listOrders, ist, PER_PAGE, type OrderFilters } from "@/lib/adminOps";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/collections/Orders";
import { STATES } from "@/lib/gst";
import { inr } from "@/lib/catalog";
import { ArrowRight, SearchIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/**
 * The order ledger.
 *
 * A ledger page, not a card grid. Somebody is holding a phone with a customer
 * on it, and the job is to answer "where is my order" without leaving this
 * screen — so the row carries everything that question can mean: what state it
 * is in, whether the money arrived, where it is going and what it was worth.
 *
 * Filters live in the URL rather than in component state. That is what makes a
 * filtered view something you can send to a colleague, and it is why this page
 * has no `"use client"` anywhere in its tree.
 */
export default async function AdminOrdersPage({ searchParams }: Props) {
  const g = await guard("admin", "ops");
  if (!g.ok) return <Denied staff={g.staff} needed={g.needed} />;

  const sp = await searchParams;
  const f: OrderFilters = {
    status: one(sp.status),
    payment: one(sp.payment),
    q: one(sp.q),
    page: Number(one(sp.page)) || 1,
  };

  const { rows, total, page, pages } = await listOrders(f);
  const filtered = Boolean(f.status || f.payment || f.q);
  const stateName = (code: string) => STATES.find((s) => s.code === code)?.name ?? code;

  return (
    <div className="container-page page-shell">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <h1 className="text-[clamp(1.5rem,3vw,2.25rem)]">Orders</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Every order placed, newest first. Fulfilment and payment are separate
            states — cash on delivery ships before it is paid, and one column cannot
            say that.
          </p>
        </div>
        <p className="bin shrink-0">
          {total.toLocaleString("en-IN")} {filtered ? "matching" : "total"}
        </p>
      </div>

      {/*
        A GET form, so the result is a URL. `defaultValue` and no onChange
        handler: this submits on Enter and needs no JavaScript to work at all.
      */}
      <form className="section-gap flex flex-wrap items-center gap-2" action="/admin/orders">
        <label className="flex h-10 min-w-64 flex-1 items-center gap-2.5 border border-line bg-surface px-3 focus-within:border-spot-600">
          <SearchIcon className="size-4 shrink-0 text-disabled" />
          <span className="sr-only">Search orders</span>
          <input
            type="search"
            name="q"
            defaultValue={f.q ?? ""}
            placeholder="Order number, phone or name"
            className="h-full w-full bg-transparent text-[0.875rem] text-heading outline-none placeholder:text-disabled"
          />
        </label>

        <Select name="status" value={f.status} all="Any status" options={ORDER_STATUS} />
        <Select name="payment" value={f.payment} all="Any payment" options={PAYMENT_STATUS} />

        <button type="submit" className="btn btn-secondary btn-sm h-10">Apply</button>
        {filtered && (
          <Link href="/admin/orders" className="text-[0.75rem] text-spot-700 hover:underline">
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <Empty filtered={filtered} />
      ) : (
        <div className="mt-4 overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[940px] border-collapse text-left">
            <thead>
              <tr className="bin border-b border-line bg-sunken">
                <th className="px-4 py-2.5 font-bold">Number</th>
                <th className="px-3 py-2.5 font-bold">Placed</th>
                <th className="px-3 py-2.5 font-bold">Customer</th>
                <th className="px-3 py-2.5 font-bold">Ship to</th>
                <th className="px-3 py-2.5 font-bold">Fulfilment</th>
                <th className="px-3 py-2.5 font-bold">Payment</th>
                <th className="px-3 py-2.5 text-right font-bold">Items</th>
                <th className="px-3 py-2.5 text-right font-bold">Total</th>
                <th className="w-8 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.number} className="border-b border-line transition-colors last:border-0 hover:bg-sunken/60">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Link
                      href={`/admin/orders/${o.number}`}
                      className="font-mono text-[0.8125rem] text-heading hover:text-spot-700 hover:underline"
                    >
                      {o.number}
                    </Link>
                    {/*
                      An order with no invoice number has not been paid for, so
                      what exists is a proforma. Saying so on the row saves
                      opening it to find out.
                    */}
                    {!o.invoiceNumber && <span className="bin ml-2">proforma</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.75rem] tnum text-muted">
                    {ist(o.placedAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="block text-[0.8125rem] text-body">{o.customerName}</span>
                    <span className="block font-mono text-[0.6875rem] tnum text-faint">{o.customerPhone}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[0.75rem] text-faint">
                    {stateName(o.placeOfSupply)}
                  </td>
                  <td className="px-3 py-2.5"><StatusStamp value={o.status} /></td>
                  <td className="px-3 py-2.5"><PaymentStamp value={o.paymentStatus} /></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[0.75rem] tnum text-muted">
                    {o.units} <span className="text-disabled">/ {o.lineCount}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[0.8125rem] tnum text-heading">
                    {inr(o.grandTotal)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/orders/${o.number}`}
                      aria-label={`Open ${o.number}`}
                      className="grid size-6 place-items-center text-disabled hover:bg-sunken hover:text-spot-700"
                    >
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
          <PageLink sp={sp} to={page - 1} disabled={page <= 1}>Previous</PageLink>
          <span className="font-mono text-[0.75rem] text-faint">
            Page {page} of {pages} · {PER_PAGE} per page
          </span>
          <PageLink sp={sp} to={page + 1} disabled={page >= pages}>Next</PageLink>
        </nav>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Select({ name, value, all, options }: {
  name: string; value?: string; all: string; options: readonly string[];
}) {
  return (
    <>
      <span className="sr-only" id={`${name}-label`}>{all}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        aria-labelledby={`${name}-label`}
        className="h-10 border border-line bg-surface px-2 text-[0.8125rem] capitalize text-heading outline-none focus:border-spot-600"
      >
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
        ))}
      </select>
    </>
  );
}

function PageLink({ sp, to, disabled, children }: {
  sp: Record<string, string | string[] | undefined>;
  to: number; disabled: boolean; children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="btn btn-secondary btn-sm pointer-events-none opacity-40">{children}</span>;
  }
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s && k !== "page") next.set(k, s);
  }
  next.set("page", String(to));
  return <Link href={`/admin/orders?${next}`} className="btn btn-secondary btn-sm">{children}</Link>;
}

/*
  Two empty states, because they are two different situations. A filter that
  matched nothing is the operator's own doing and wants the filter cleared; no
  orders at all is a fact about the business and wants explaining.
*/
function Empty({ filtered }: { filtered: boolean }) {
  return (
    <div className="mt-4 border border-dashed border-line-strong bg-surface p-12 text-center">
      <p className="bin mb-3">{filtered ? "No match" : "Nothing yet"}</p>
      <h2 className="monumental text-[clamp(1.25rem,2.5vw,1.75rem)]">
        {filtered ? "Nothing matches those filters" : "No orders placed"}
      </h2>
      <p className="mx-auto mt-4 max-w-md text-[0.875rem] leading-relaxed text-muted">
        {filtered ? (
          <>Search covers the order number, the buyer&rsquo;s phone and their name. Widen it, or clear the filters.</>
        ) : (
          <>
            Orders arrive here the moment checkout completes — there is nothing to
            create by hand. Place one from the storefront to see this fill.
          </>
        )}
      </p>
      <Link href={filtered ? "/admin/orders" : "/"} className="btn btn-secondary btn-sm mt-6">
        {filtered ? "Clear filters" : "Open the storefront"}
      </Link>
    </div>
  );
}
