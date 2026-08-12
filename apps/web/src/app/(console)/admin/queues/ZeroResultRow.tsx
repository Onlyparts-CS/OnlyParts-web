"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { triageQuery } from "./actions";
import { TRIAGE, type Triage } from "@/collections/SearchQueries";

const LABEL: Record<Triage, string> = {
  untriaged: "Untriaged",
  missing_product: "Missing product",
  missing_synonym: "Missing synonym",
  parser_gap: "Parser gap",
  noise: "Noise",
};

/**
 * One failed search, and what we decided about it.
 *
 * Triage happens in the row rather than behind a link, because the decision
 * takes two seconds and the queue is worked in one sitting. The search itself
 * opens in a new tab — you almost always want to see what the customer saw
 * before classifying it, and losing your place in the queue to do that is how
 * the queue stops being worked.
 */
export function ZeroResultRow({ id, q, count, lastSeen, triage, note }: {
  id: number;
  q: string;
  count: number;
  lastSeen: string;
  triage: Triage;
  note: string | null;
}) {
  const [value, setValue] = useState<Triage>(triage);
  const [text, setText] = useState(note ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = value !== triage || text !== (note ?? "");

  const save = () =>
    startTransition(async () => {
      const res = await triageQuery(id, value, text);
      if (!res.ok) { setError(res.error); return; }
      setError("");
      router.refresh();
    });

  return (
    <tr className={`border-b border-line last:border-0 ${triage !== "untriaged" ? "opacity-70" : ""}`}>
      <td className="px-4 py-2.5">
        <Link
          href={`/search?q=${encodeURIComponent(q)}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[0.8125rem] text-heading hover:text-spot-700 hover:underline"
        >
          {q}
        </Link>
        {error && <p className="mt-1 text-[0.75rem] text-danger">{error}</p>}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[0.8125rem] tnum text-heading">
        {count.toLocaleString("en-IN")}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.75rem] tnum text-faint">{lastSeen}</td>
      <td className="px-3 py-2.5">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value as Triage)}
          aria-label={`Classify "${q}"`}
          className="h-8 border border-line bg-surface px-1.5 text-[0.75rem] text-heading outline-none focus:border-spot-600"
        >
          {TRIAGE.map((t) => <option key={t} value={t}>{LABEL[t]}</option>)}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What was decided"
          aria-label={`Note for "${q}"`}
          className="h-8 w-full min-w-40 border border-line bg-surface px-2 text-[0.75rem] text-heading outline-none placeholder:text-disabled focus:border-spot-600"
        />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <button onClick={save} disabled={!dirty || pending} className="btn btn-secondary btn-sm disabled:opacity-40">
          {pending ? "…" : "Save"}
        </button>
      </td>
    </tr>
  );
}
