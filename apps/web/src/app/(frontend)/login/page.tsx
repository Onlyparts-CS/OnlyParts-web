import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Shell } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { currentCustomer } from "@/lib/customerAuth";
import { isConfigured, safeNext } from "@/lib/googleOAuth";

/**
 * Sign in.
 *
 * This page used to offer "Mobile OTP" and "Email & password", and neither was
 * real: the OTP branch accepted any six digits and told you so, and the
 * password branch checked only that the string was eight characters long.
 * Both then called a client function that wrote the name into localStorage.
 * There was no server involved, so everything behind "signed in" — order
 * history, saved addresses, the DPDP export — was gated on a claim the browser
 * made about itself.
 *
 * One method now, and it is somebody else's problem: Google. That removes the
 * password database, the reset flow, the credential-stuffing surface and the
 * SMS bill in one move, and it is what most Indian buyers expect on a phone.
 *
 * Guest checkout is untouched and still the common case. Signing in is for
 * people who want their history, not a toll gate on buying.
 */

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, string> = {
  failed: "That sign-in did not complete. Please try again.",
  throttled: "Too many attempts. Wait a minute and try again.",
  unconfigured: "Sign-in is not configured on this deployment yet.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeNext(next);

  // Already signed in — send them where they were going rather than showing a
  // sign-in page to somebody who is signed in.
  if (await currentCustomer()) redirect(target);

  return (
    <Shell
      title="Sign in"
      lead="Your orders, GST invoices, saved addresses and BOMs — all in one place. Checkout works without an account too."
    >
      {error && MESSAGES[error] && (
        <p className="mb-4 rounded-sm border border-danger/30 bg-danger-bg/60 px-3 py-2 text-[0.8125rem] text-danger">
          {MESSAGES[error]}
        </p>
      )}

      {isConfigured() ? (
        <GoogleButton next={target} />
      ) : (
        <p className="rounded-sm border border-dashed border-line-strong bg-bg p-4 text-[0.8125rem] text-muted">
          Google sign-in needs <code className="font-mono text-[0.75rem]">GOOGLE_CLIENT_ID</code> and{" "}
          <code className="font-mono text-[0.75rem]">GOOGLE_CLIENT_SECRET</code> in the environment.
          Until then, checkout still works without an account.
        </p>
      )}

      <p className="mt-5 text-[0.75rem] leading-relaxed text-faint">
        We receive your name and email address from Google, and nothing else. We never see your
        Google password. Your mobile number is asked for at checkout, because that is what the
        courier calls.
      </p>

      <p className="mt-5 text-center text-[0.8125rem] text-muted">
        <Link href="/cart" className="text-spot-700 hover:underline">Check out as a guest</Link> — no account needed.
      </p>
    </Shell>
  );
}
