import Link from "next/link";
import type { Metadata } from "next";
import { currentStaff, rolesFor, can, ROLE_LABEL } from "@/lib/adminAuth";

export const metadata: Metadata = {
  title: "Admin — OnlyParts",
  robots: { index: false, follow: false },
};

/** The session is read per request; a page behind a gate must never be cached. */
export const dynamic = "force-dynamic";

/*
  Ordered by desk, not alphabetically. Orders and Customers are the operations
  desk and come first because that work is time-critical — somebody is waiting
  on the other end of it. The catalogue screens behind them are not.

  Which roles open which door is `SURFACE_ROLES` in `lib/adminAuth.ts`, and the
  filter below reads that same table, so a new entry here is gated the moment
  it is added — there is no second list to keep in step.
*/
const NAV = [
  ["/admin", "Overview"],
  ["/admin/orders", "Orders"],
  ["/admin/customers", "Customers"],
  ["/admin/pim", "Enrichment"],
  ["/admin/builds", "Builds"],
  ["/admin/products", "Products"],
  ["/admin/import", "Bulk import"],
  ["/admin/queues", "Work queues"],
];

/**
 * Admin shell.
 *
 * Two consoles, one identity. Payload's generated panel at `/cms` handles
 * records and fields; this handles the judgement surfaces Payload does not give
 * for free — the dry-run import diff, the enrichment workbench, the
 * completeness queue.
 *
 * The gate is Payload's own session, so signing in at `/cms` signs you in here
 * and there is one staff identity rather than two to keep in step. It used to
 * be nothing at all — the banner read "Prototype — no auth gate" and meant it.
 * That was tolerable while these screens were static. It is not, now that
 * Enrichment writes to the catalogue.
 *
 * `docs/06-BACKEND-ARCHITECTURE.md` §9 wants two independent gates in
 * production: Cloudflare Access in front, this behind. This is the second one.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff();

  if (!staff) {
    return (
      <div className="container-page page-shell">
        <div className="mx-auto max-w-lg border border-line bg-surface p-8 text-center shadow-e1">
          <p className="bin mb-3">Restricted</p>
          <h1 className="monumental text-[clamp(1.5rem,3vw,2.25rem)]">Staff only</h1>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
            This console writes to the live catalogue, so it sits behind the same sign-in
            as the CMS. No customer account reaches it.
          </p>
          {/* `redirect` is Payload's own login param — come back here, not to the CMS. */}
          <Link href="/cms/login?redirect=%2Fadmin" className="btn btn-primary mt-6">Sign in</Link>
          <p className="mt-4 text-[0.75rem] leading-relaxed text-faint">
            No staff account yet? The first one is created at{" "}
            <span className="font-mono text-spot-700">/cms/create-first-user</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-bg">
      <div className="border-b border-line bg-ink-950">
        <div className="container-page flex h-11 flex-wrap items-center gap-x-4 text-[0.75rem] text-ink-200">
          <span className="flex items-center gap-2 font-medium">
            <span className="size-1.5 rounded-full bg-success" />
            Admin console
          </span>
          <span className="font-mono text-[0.6875rem] text-ink-400">
            {staff.email}
            {staff.roles.length > 0 && ` · ${staff.roles.map((r) => ROLE_LABEL[r]).join(", ")}`}
          </span>
          <Link href="/cms" className="ml-auto text-spot-300 hover:underline">CMS</Link>
          <Link href="/" className="text-spot-300 hover:underline">Storefront</Link>
        </div>
      </div>

      <div className="container-page">
        <nav className="flex gap-1 overflow-x-auto border-b border-line py-2">
          {/*
            Filtered, not disabled. A door you cannot open should not be drawn:
            a greyed-out tab is an invitation to ask why, and the honest answer
            is "this account is not for that job".
          */}
          {NAV.filter(([href]) => {
            const needed = rolesFor(href);
            return !needed || can(staff, ...needed);
          }).map(([href, label]) => (
            <Link key={href} href={href}
              className="shrink-0 rounded-sm px-3 py-1.5 text-[0.875rem] font-medium text-muted transition-colors hover:bg-sunken hover:text-heading">
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {children}
    </div>
  );
}
