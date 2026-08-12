"use client";

import { useRouter } from "next/navigation";
import type { Token } from "@/lib/types";

/**
 * The parsed-token bar — the single feature people will talk about.
 *
 * Removing a chip strips the word the user actually typed out of `q` and
 * re-runs the search. An incorrect parse must never be a trap
 * (docs/09-SEARCH-SPEC.md §2).
 */
export function TokenBar({ q, tokens }: { q: string; tokens: Token[] }) {
  const router = useRouter();

  if (!tokens.length) return null;

  const remove = (raw: string) => {
    const next = q
      .split(/\s+/)
      .filter((w) => w.toLowerCase() !== raw.toLowerCase())
      .join(" ")
      .trim();
    router.push(next ? `/search?q=${encodeURIComponent(next)}` : "/search");
  };

  // one chip per parsed value, but `m3x10` yields two tokens from one word
  const seen = new Set<string>();

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-spot-200 bg-spot-50 px-4 py-3">
      <span className="text-[0.8125rem] text-spot-800">We understood:</span>
      {tokens.map((t) => {
        const id = t.key + String(t.value);
        if (seen.has(id)) return null;
        seen.add(id);
        return (
          <button
            key={id}
            onClick={() => remove(t.raw)}
            title={`Remove "${t.raw}" from the search`}
            className="inline-flex items-center gap-2 rounded-full bg-spot-600 px-3 py-1 font-mono text-[0.75rem] font-medium text-on-accent transition-colors hover:bg-spot-600"
          >
            {t.label}
            <span aria-hidden className="font-bold opacity-55">×</span>
            <span className="sr-only">Remove filter</span>
          </button>
        );
      })}
      <span className="ml-auto hidden font-mono text-[0.6875rem] text-spot-700 sm:block">
        parsed into attributes, not keywords
      </span>
    </div>
  );
}
