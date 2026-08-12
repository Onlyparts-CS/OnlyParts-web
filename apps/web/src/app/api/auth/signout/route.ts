import { NextResponse, type NextRequest } from "next/server";
import { endCustomerSession } from "@/lib/customerSession";
import { safeNext } from "@/lib/googleOAuth";

/**
 * Sign out.
 *
 * POST only. A GET would make `<img src="/api/auth/signout">` on any page on
 * the internet log the buyer out — harmless compared to most CSRF, but still a
 * thing done to somebody without their asking.
 *
 * The order-access cookie (`op_orders`) is deliberately left alone. It records
 * that *this browser* placed particular orders, which stays true after signing
 * out and is what lets a guest reach their own receipt.
 */
export async function POST(req: NextRequest) {
  await endCustomerSession();
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  return NextResponse.redirect(new URL(next === "/account" ? "/" : next, req.nextUrl.origin), {
    // 303, so the browser follows with GET rather than repeating the POST.
    status: 303,
  });
}
