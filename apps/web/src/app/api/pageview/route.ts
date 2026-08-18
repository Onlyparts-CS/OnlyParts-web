import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { logPageView } from "@/lib/viewLog";

/**
 * The analytics beacon.
 *
 * Open by necessity — the visitor has no session — and safe to be open because
 * the row it writes holds no identifier and nothing here is readable without a
 * staff role. See `collections/PageViews.ts`.
 *
 * `204` in every case, including a rejected path and a throttled caller. The
 * browser sent this after the page had already painted and there is nothing it
 * could usefully do with a failure; a 4xx here would only appear as a red line
 * in a visitor's console for a request they did not make.
 */
export async function POST(req: NextRequest) {
  const nothing = new NextResponse(null, { status: 204 });

  // A human reading pages generates a handful of these a minute. Sixty leaves
  // room for a fast browser and a prefetch or two, and caps a script's ability
  // to inflate a count to something a `count` column shrugs off.
  if (!(await rateLimit(req, "pageview", 60, 60))) return nothing;

  const body: unknown = await req.json().catch(() => null);
  const path = typeof body === "object" && body && "path" in body ? (body as { path: unknown }).path : null;
  if (typeof path !== "string" || path.length > 200) return nothing;

  await logPageView(path);
  return nothing;
}
