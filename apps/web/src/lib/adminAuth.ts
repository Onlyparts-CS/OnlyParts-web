import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";

/**
 * The gate on the bespoke console.
 *
 * `/admin` shipped with no auth at all — it said so in its own banner, and
 * anyone who typed the URL was in. That was survivable while it rendered
 * nothing but static prototype screens. It stops being survivable the moment
 * the PIM can write to the catalogue.
 *
 * The session is Payload's own, so signing in at `/cms` signs you in here too
 * and there is exactly one staff identity rather than two to keep in step.
 * `docs/06-BACKEND-ARCHITECTURE.md` §9 wants two independent gates in
 * production — Cloudflare Access in front of this, RBAC behind it. This is the
 * second one. It is not a substitute for the first.
 */
export type StaffRole = "admin" | "catalog" | "ops";

export type Staff = {
  id: string | number;
  name?: string | null;
  email: string;
  roles: StaffRole[];
};

/** The signed-in staff member, or null. Never throws — callers decide. */
export async function currentStaff(): Promise<Staff | null> {
  try {
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: await nextHeaders() });
    if (!user || user.collection !== "users") return null;
    return {
      id: user.id,
      name: (user as { name?: string }).name,
      email: user.email,
      roles: ((user as { roles?: StaffRole[] }).roles ?? []) as StaffRole[],
    };
  } catch {
    // No database, no session, or Payload not reachable — treated as signed out
    // rather than as an error page, because "you are not signed in" is the
    // honest thing to show and it fails closed.
    return null;
  }
}

export const can = (staff: Staff | null, ...roles: StaffRole[]) =>
  Boolean(staff && staff.roles.some((r) => roles.includes(r)));

/* ------------------------------------------------------------------ */

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Administrator",
  catalog: "Catalogue",
  ops: "Operations",
};

/**
 * Which roles open which door.
 *
 * Kept as data rather than scattered through the pages so the answer to "who
 * can reach the importer?" is one grep, and so the nav and the page guard can
 * never disagree — they read the same table. An entry absent from here is
 * reachable by any signed-in staff member, which is the correct default for
 * read-only surfaces like the overview.
 */
export const SURFACE_ROLES = {
  "/admin/pim": ["admin", "catalog"],
  "/admin/products": ["admin", "catalog"],
  "/admin/import": ["admin", "catalog"],
  "/admin/builds": ["admin", "catalog"],
  "/admin/orders": ["admin", "ops"],
  "/admin/customers": ["admin", "ops"],
} as const satisfies Partial<Record<string, readonly StaffRole[]>>;

/** The roles a path needs, longest-prefix-first so `/admin/products/new` inherits. */
export function rolesFor(pathname: string): readonly StaffRole[] | null {
  const match = Object.keys(SURFACE_ROLES)
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? SURFACE_ROLES[match as keyof typeof SURFACE_ROLES] : null;
}

export type Guard =
  | { ok: true; staff: Staff }
  | { ok: false; staff: Staff | null; needed: readonly StaffRole[] };

/**
 * The guard a protected page calls before it renders anything.
 *
 * Returns rather than throws, because the two failure modes want different
 * screens: signed out wants the sign-in panel, wrong-role wants "you are
 * signed in, this is not yours". `notFound()` would be a lie — the page exists
 * — and `forbidden()` needs `experimental.authInterrupts`, which is not worth
 * turning on for this.
 */
export async function guard(...needed: StaffRole[]): Promise<Guard> {
  const staff = await currentStaff();
  if (staff && staff.roles.some((r) => needed.includes(r))) return { ok: true, staff };
  return { ok: false, staff, needed };
}
