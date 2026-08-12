"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Error boundary. Shows the digest so a customer can quote it to support —
 * "something went wrong" with no reference is useless to both of us.
 */
export default function Error({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // wired to Sentry in the backend phase
    console.error(error);
  }, [error]);

  return (
    <div className="container-page py-16 lg:py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-mono text-[0.75rem] tracking-[0.2em] text-danger">ERROR</p>
        <h1 className="mt-3 text-[clamp(1.75rem,4vw,2.5rem)]">Something broke on our side</h1>
        <p className="mt-4 text-[1.0625rem] text-muted">
          This is our fault, not yours. Trying again often works — the page may
          have failed to load data momentarily.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <button onClick={reset} className="btn btn-primary">Try again</button>
          <Link href="/" className="btn btn-secondary">Go home</Link>
        </div>

        {error.digest && (
          <p className="mt-6 font-mono text-[0.75rem] text-faint">
            Reference: <span className="text-heading">{error.digest}</span>
          </p>
        )}

        <p className="mt-6 text-[0.875rem] text-muted">
          If it keeps happening,{" "}
          <Link href="/contact" className="text-spot-700 hover:underline">tell us</Link>
          {error.digest && " and quote that reference"}.
        </p>
      </div>
    </div>
  );
}
