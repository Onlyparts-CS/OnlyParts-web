"use client";

import { useState } from "react";

/**
 * The one sign-in control.
 *
 * A plain link, not a fetch: the OAuth flow is a top-level navigation to
 * Google and back, and an XHR cannot perform it. The `useState` exists only so
 * the button can show it is working — Google's redirect takes a moment on a
 * slow connection, and a button that does nothing visible gets clicked twice.
 *
 * The mark is inlined rather than fetched. Google's brand guidelines want
 * their colours exact, and a remote image on a sign-in button is a third-party
 * request on the one page where the fewest should happen.
 */
export function GoogleButton({ next }: { next: string }) {
  const [going, setGoing] = useState(false);

  return (
    <a
      href={`/api/auth/google?next=${encodeURIComponent(next)}`}
      onClick={() => setGoing(true)}
      aria-busy={going}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-sm border border-line-strong bg-surface px-4 text-[0.9375rem] font-medium text-heading transition-colors hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spot-600 aria-busy:opacity-60"
    >
      <svg aria-hidden viewBox="0 0 18 18" className="size-[18px] flex-none">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
      </svg>
      {going ? "Taking you to Google…" : "Continue with Google"}
    </a>
  );
}
