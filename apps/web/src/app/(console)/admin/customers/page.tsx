import Link from "next/link";
import { guard } from "@/lib/adminAuth";
import { Denied } from "@/components/admin/Denied";
import { listCustomers, PER_PAGE } from "@/lib/adminOps";
import { inr } from "@/lib/catalog";
import { SearchIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

const TIER_LABEL: Record<string, string> = {
  retail: "Retail",
  b2b: "B2B",
  institution: "Institution",
};

/**
 * Buyers, ranked by what they have spent.
 *
 * Sorted by lifetime value rather than by name, because the question this
 * screen is opened to answer is almost never "is this person in the system" —
 * it is "who are the twenty accounts worth protecting". Search is there for
 * the other case.
 *
 * There is no detail page. A customer is their orders, and those already have
 * one; the record itself is a name, a phone and some addresses, which Payload's
 * own panel edits perfectly well. Building a second view of it would be
 * building a worse form.
 */
export default async function AdminCustomersPage({ searchParams }: Props) {
  const g = await guard("admin", "ops");
  if (!g.ok) return <Denied staff={g.staff} needed={g.needed} />;

  const sp = await searchParams;
  const q = one(sp.q);
  const { rows, total, page, pages } = await listCustomers({ q, page: Number(one(sp.page)) || 1 });

  return (
    <div className="container-page page-shell">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <h1 className="text-[clamp(1.5rem,3vw,2.25rem)]">Customers</h1>
          <p className="mt-2 max-w-2xl text-muted">
            One record per phone number — the identity a repeat buyer is matched on,
            including when they check out as a guest.
          </p>
        </div>
        <p className="bin shrink-0">{total.toLocaleString("en-IN")} {q ? "matching" : "total"}</p>
      </div>

      <form className="section-gap flex flex-wrap items-center gap-2" action="/admin/customers">
        <label className="flex h-10 min-w-64 flex-1 items-center gap-2.5 border border-line bg-surface px-3 focus-within:border-spot-600">
          <SearchIcon className="size-4 shrink-0 text-disabled" />
          <span className="sr-only">Search customers</span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Phone, name, company or GSTIN"
            className="h-full w-full bg-transparent text-[0.875rem] text-heading outline-none placeholder:text-disabled"
          />
        </label>
        <button type="submit" className="btn btn-secondary btn-sm h-10">Apply</button>
        {q && <Link href="/admin/customers" className="text-[0.75rem] text-spot-700 hover:underline">Clear</Link>}
      </form>

      {rows.length === 0 ? (
        <div className="mt-4 border border-dashed border-line-strong bg-surface p-12 text-center">
          <p className="bin mb-3">{q ? "No match" : "Nothing yet"}</p>
          <h2 className="monumental text-[clamp(1.25rem,2.5vw,1.75rem)]">
            {q ? "No customer matches that" : "No customers"}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[0.875rem] leading-relaxed text-muted">
            A customer record is created by checkout, matched on phone number. There is
            nothing to add by hand.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="bin border-b border-line bg-sunken">
                <th className="px-4 py-2.5 font-bold">Name</th>
                <th className="px-3 py-2.5 font-bold">Phone</th>
                <th className="px-3 py-2.5 font-bold">Company</th>
                <th className="px-3 py-2.5 font-bold">GSTIN</th>
                <th className="px-3 py-2.5 font-bold">Tier</th>
                <th className="px-3 py-2.5 text-right font-bold">Orders</th>
                <th className="px-4 py-2.5 text-right font-bold">Lifetime</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-line transition-colors last:border-0 hover:bg-sunken/60">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/cms/collections/customers/${c.id}`}
                      className="text-[0.8125rem] text-heading hover:text-spot-700 hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.email && <span className="block text-[0.6875rem] text-faint">{c.email}</span>}
                  </td>
                  {/*
                    The phone is the identity, so it is also the fastest way into
                    the orders — when there is one. A buyer who signed in with
                    Google but has not checked out yet has no phone number and so
                    has no orders to link to either.
                  */}
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {c.phone ? (
                      <Link
                        href={`/admin/orders?q=${encodeURIComponent(c.phone)}`}
                        className="font-mono text-[0.75rem] tnum text-body hover:text-spot-700 hover:underline"
                      >
                        {c.phone}
                      </Link>
                    ) : (
                      <span className="font-mono text-[0.75rem] text-faint" title="Signed in with Google; no phone yet">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[0.75rem] text-muted">{c.company ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.6875rem] tnum text-faint">
                    {c.gstin ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {/* Retail is the default and says nothing; the other two are why a price differs. */}
                    {c.tier === "retail"
                      ? <span className="bin">retail</span>
                      : <span className="stamp stamp-flat text-spot-700">{TIER_LABEL[c.tier]}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[0.75rem] tnum text-muted">{c.orderCount}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[0.8125rem] tnum text-heading">
                    {inr(c.lifetimeValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
          <Pager q={q} to={page - 1} disabled={page <= 1}>Previous</Pager>
          <span className="font-mono text-[0.75rem] text-faint">
            Page {page} of {pages} · {PER_PAGE} per page
          </span>
          <Pager q={q} to={page + 1} disabled={page >= pages}>Next</Pager>
        </nav>
      )}
    </div>
  );
}

function Pager({ q, to, disabled, children }: {
  q?: string; to: number; disabled: boolean; children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="btn btn-secondary btn-sm pointer-events-none opacity-40">{children}</span>;
  }
  const sp = new URLSearchParams({ page: String(to) });
  if (q) sp.set("q", q);
  return <Link href={`/admin/customers?${sp}`} className="btn btn-secondary btn-sm">{children}</Link>;
}
