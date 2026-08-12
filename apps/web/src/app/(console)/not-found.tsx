import Link from "next/link";

/**
 * The console's 404.
 *
 * It needs its own, because the storefront's offers to browse categories and
 * search the catalogue — which is the wrong advice for somebody who typed an
 * order number that does not exist. `/admin/orders/[number]` calls `notFound()`
 * on a bad number and this is what it lands on.
 */
export default function ConsoleNotFound() {
  return (
    <div className="container-page page-shell">
      <div className="mx-auto max-w-lg border border-line bg-surface p-8 text-center shadow-e1">
        <p className="bin mb-3">Not found</p>
        <h1 className="monumental text-[clamp(1.5rem,3vw,2.25rem)]">No such record</h1>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
          Nothing in the console matches that address. An order number that was
          mistyped, or a record somebody has since removed.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/admin/orders" className="btn btn-primary btn-sm">All orders</Link>
          <Link href="/admin" className="btn btn-secondary btn-sm">Overview</Link>
        </div>
      </div>
    </div>
  );
}
