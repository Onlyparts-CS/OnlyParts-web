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
  const { user } = await payload.auth({ headers: await nextHeaders() });

  // `collection` matters: a customer session must never satisfy a staff check.
  if (!user || user.collection !== "users") return { payload, user: null };

  const held = ((user as { roles?: StaffRole[] }).roles ?? []) as StaffRole[];
  const allowed = roles.length === 0 || held.some((r) => roles.includes(r));
  return { payload, user: allowed ? user : null };
}
