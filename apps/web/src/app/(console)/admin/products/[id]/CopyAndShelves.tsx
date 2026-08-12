"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProductCopy, updateCrossListing } from "./actions";

export type Leaf = { id: number; path: string; name: string };

/**
 * Name, description, and the other shelves this product sits on.
 *
 * Cross-listing is the reason an M3 screw appears under Fasteners *and* under
 * Drones without being two records — `Products` documents it as "one canonical
 * record stands behind all of them". It existed only in the CMS until now,
 * which meant every product created in this console was single-shelf whether
 * that was true or not.
 */
export function CopyAndShelves({ productId, title, subtitle, primaryPath, leaves, crossListed }: {
  productId: number;
  title: string;
  subtitle: string;
  primaryPath: string;
  leaves: Leaf[];
  crossListed: number[];
}) {
  const [t, setT] = useState(title);
  const [s, setS] = useState(subtitle);
  const [picked, setPicked] = useState<number[]>(crossListed);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) { setError(res.error); setMsg(""); return; }
      setError(""); setMsg(ok);
      router.refresh();
    });

  // Only shown once someone types: 389 leaves in a list is not a chooser.
  const matches = q.trim().length < 2
    ? []
    : leaves
        .filter((l) => l.path !== primaryPath && !picked.includes(l.id))
        .filter((l) => `${l.path} ${l.name}`.toLowerCase().includes(q.trim().toLowerCase()))
        .slice(0, 8);

  const chosen = leaves.filter((l) => picked.includes(l.id));

  return (
    <div className="grid gap-4">
      <section className="border border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base">Name and description</h2>
        </div>
        <div className="grid gap-3 p-5">
          <label className="block">
            <span className="bin mb-1 block">Product name</span>
            <input value={t} onChange={(e) => setT(e.target.value)}
              className="h-9 w-full border border-line bg-bg px-2.5 text-[0.875rem] text-heading outline-none focus:border-spot-600" />
          </label>
          <label className="block">
            <span className="bin mb-1 block">Short description</span>
            <textarea value={s} onChange={(e) => setS(e.target.value)} rows={3}
              className="w-full border border-line bg-bg p-2.5 text-[0.875rem] leading-relaxed text-heading outline-none focus:border-spot-600" />
          </label>
          <button
            onClick={() => run(() => updateProductCopy(productId, t, s), "Saved")}
            disabled={pending || (t === title && s === subtitle)}
            className="btn btn-primary btn-sm justify-self-start disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      <section className="border border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base">Also on these shelves</h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            One record, filed in more than one place. The primary shelf —{" "}
            <span className="font-mono text-heading">{primaryPath.replace(/\./g, " › ")}</span> — is
            where the canonical page lives and cannot be listed twice.
          </p>
        </div>

        <div className="p-5">
          {chosen.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-1.5">
              {chosen.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => setPicked(picked.filter((id) => id !== l.id))}
                    className="flex items-center gap-1.5 border border-line-strong bg-bg px-2 py-1 font-mono text-[0.6875rem] text-muted hover:border-danger hover:text-danger"
                  >
                    {l.path.replace(/\./g, " › ")} <span aria-hidden>×</span>
                    <span className="sr-only">Remove</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search shelves — type at least two letters"
            className="h-9 w-full border border-line bg-bg px-2.5 text-[0.875rem] text-heading outline-none placeholder:text-disabled focus:border-spot-600"
          />

          {matches.length > 0 && (
            <ul className="mt-1 border border-line">
              {matches.map((l) => (
                <li key={l.id} className="border-b border-line last:border-0">
                  <button
                    onClick={() => { setPicked([...picked, l.id]); setQ(""); }}
                    className="block w-full px-2.5 py-1.5 text-left font-mono text-[0.75rem] text-body hover:bg-sunken hover:text-heading"
                  >
                    {l.path.replace(/\./g, " › ")}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => run(() => updateCrossListing(productId, picked), "Shelves updated")}
            disabled={pending || picked.join() === crossListed.join()}
            className="btn btn-primary btn-sm mt-3 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save shelves"}
          </button>
        </div>
      </section>

      {error && <p className="border border-danger/30 bg-danger-bg px-4 py-2.5 text-[0.875rem] text-danger">{error}</p>}
      {msg && <p className="font-mono text-[0.8125rem] text-success">{msg}</p>}
    </div>
  );
}
