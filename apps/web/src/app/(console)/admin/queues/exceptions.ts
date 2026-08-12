"use server";

import { revalidatePath } from "next/cache";
import { actionStaff } from "@/lib/actionAuth";
import type { ExceptionStatus } from "@/collections/ImportExceptions";

/**
 * Triaging a rejected import row.
 *
 * Two outcomes, and the distinction is the whole value of the queue.
 * **Resolved** means the underlying problem is gone — the category now exists,
 * the HSN was corrected at source. **Ignored** means the row was never going to
 * be imported and nobody should look at it again — a header line that slipped
 * into the data, a discontinued part.
 *
 * Counting them together gives a backlog that only ever grows.
 */
export async function triageException(
  id: number,
  status: ExceptionStatus,
  note: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { payload, user } = await actionStaff("admin", "catalog");
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  try {
    await payload.update({
      collection: "import-exceptions",
      id,
      user,
      overrideAccess: false,
      data: { status, note: note.trim() || null },
    });
    revalidatePath("/admin/queues");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
