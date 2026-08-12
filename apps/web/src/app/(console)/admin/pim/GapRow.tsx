"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fillGaps } from "./actions";
import type { AttrType } from "@/lib/pim";

export type GapField = {
  key: string;
  label: string;
  type: AttrType;
  unit: string | null;
  enumValues: string[];
};

/**
 * One row of the gap queue, with the missing cells as inputs.
 *
 * The whole reason this component is client-side: the queue is a list of small
 * edits, and a page navigation per edit is what makes people stop working a
 * queue. Saved rows stay put and go quiet rather than vanishing — a row that
 * disappears the instant you save it takes with it the only evidence that the
 * save worked, and `router.refresh()` will remove it on the next read anyway.
 */
export function GapRow({ sku, variantId, categoryPath, fields }: {
  sku: string;
  variantId: number;
  categoryPath: string;
  fields: GapField[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = Object.values(values).some((v) => v.trim() !== "");

  const save = () => {
    startTransition(async () => {
      const res = await fillGaps(variantId, categoryPath, values);
      if (!res.ok) { setState("error"); setMessage(res.error); return; }
      setState("saved");
      setMessage(`${res.filled} filled`);
      router.refresh();
    });
  };

  return (
    <tr className={`border-b border-line last:border-b-0 ${state === "saved" ? "opacity-55" : ""}`}>
      <td className="px-3 py-2 align-top font-mono text-[0.75rem] text-heading">{sku}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-end gap-2">
          {fields.map((f) => (
            <label key={f.key} className="min-w-0">
              <span className="bin block">
                {f.label}{f.unit ? ` (${f.unit})` : ""}
              </span>
              {f.type === "enum" && f.enumValues.length > 0 ? (
                <select
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="mt-0.5 h-8 w-36 border border-line bg-surface px-1.5 text-[0.75rem] text-heading outline-none focus:border-spot-600"
                >
                  <option value="">—</option>
                  {f.enumValues.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "boolean" ? (
                <select
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="mt-0.5 h-8 w-24 border border-line bg-surface px-1.5 text-[0.75rem] text-heading outline-none focus:border-spot-600"
                >
                  <option value="">—</option>
                  <option value="true">yes</option>
                  <option value="false">no</option>
                </select>
              ) : (
                <input
                  // `inputMode` rather than `type="number"`: a number spinner in a
                  // dense grid is a scroll-wheel accident waiting to happen.
                  inputMode={f.type === "number" || f.type === "dimension" ? "decimal" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="mt-0.5 h-8 w-28 border border-line bg-surface px-1.5 font-mono text-[0.75rem] text-heading outline-none focus:border-spot-600"
                />
              )}
            </label>
          ))}
        </div>
        {state === "error" && <p className="mt-1.5 text-[0.75rem] text-danger">{message}</p>}
        {state === "saved" && <p className="mt-1.5 text-[0.75rem] text-success">{message} — refreshing the queue</p>}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top">
        <button
          onClick={save}
          disabled={!dirty || pending}
          className="btn btn-secondary btn-sm disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <Link
          href={`/cms/collections/variants/${variantId}`}
          className="ml-2 text-[0.75rem] text-spot-700 hover:underline"
        >
          Open
        </Link>
      </td>
    </tr>
  );
}
