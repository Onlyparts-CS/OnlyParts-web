"use server";

import { revalidatePath } from "next/cache";
import { actionStaff } from "@/lib/actionAuth";
import type { Triage } from "@/collections/SearchQueries";

/**
 * Triaging a zero-result search.
 *
 * The classification is the whole point of the queue. "Nothing matched" is not
 * one problem, it is four with different owners: a missing product is a buying
 * decision, a missing synonym and a parser gap are bugs in search, and noise is
 * somebody's cat on the keyboard. Counting them together produces a number that
 * nobody can act on.
 */
export async function triageQuery(
  id: number,
  triage: Triage,
  note: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { payload, user } = await actionStaff("admin", "catalog", "ops");
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  try {
    await payload.update({
      collection: "search-queries",
      id,
      user,
      overrideAccess: false,
      data: { triage, note: note.trim() || null },
    });
    revalidatePath("/admin/queues");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
