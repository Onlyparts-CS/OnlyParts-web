import { getPayload } from "payload";
import config from "@payload-config";
import { headers as nextHeaders } from "next/headers";
import type { StaffRole } from "./adminAuth";

/**
 * The session check every Server Action runs before it touches anything.
 *
 * A `"use server"` export is not a private function. Next compiles each one
 * into a POST endpoint addressable by its action id, so the guard on the page
 * that renders the form protects the *screen* only — the action underneath it
 * stays reachable by anyone who has the id, signed in or not. Page guards and
 * action guards are two different fences and both have to exist.
 *
 * Lives outside the `"use server"` files on purpose: those may only export
 * async functions, so a shared helper cannot live in one, and duplicating it
 * per action file is how one copy quietly loses its role check.
 */
export async function actionStaff(...roles: StaffRole[]) {
  const payload = await getPayload({ config });

  /*
    Fail closed, like `currentStaff` already did.

    `payload.auth` throws Forbidden rather than returning an empty user for
    some malformed or expired credentials. Uncaught, that leaves the caller
    propagating a framework error page instead of its own refusal — which is
    how an unauthenticated upload to the import route answered 404 with an
    HTML body rather than 403 with a reason. A thrown auth check and a failed
    one mean the same thing here, so they should read the same.
  */
  let user: Awaited<ReturnType<typeof payload.auth>>["user"] = null;
  try {
    ({ user } = await payload.auth({ headers: await nextHeaders() }));
  } catch {
    return { payload, user: null };
  }

  // `collection` matters: a customer session must never satisfy a staff check.
  if (!user || user.collection !== "users") return { payload, user: null };

  const held = ((user as { roles?: StaffRole[] }).roles ?? []) as StaffRole[];
  const allowed = roles.length === 0 || held.some((r) => roles.includes(r));
  return { payload, user: allowed ? user : null };
}
