"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBuild } from "./actions";

/**
 * Starting a build.
 *
 * Name and slug only. Everything else — the blurb, the plate, and the parts
 * that are the actual work — is edited in the row this creates, because asking
 * for a bill of materials before the build exists means holding an unsaved
 * list in a form.
 */
export function NewBuild() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const create = () =>
    startTransition(async () => {
      const res = await saveBuild(null, { name, slug, blurb: "", glyph: "", position: 99 });
      if (!res.ok) { setError(res.error); return; }
      setError(""); setName(""); setSlug(""); setOpen(false);
      router.refresh();
    });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-primary btn-sm">New build</button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 border border-line bg-surface p-3">
      <label className="block">
        <span className="bin mb-1 block">Name</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            // Slug follows the name until somebody edits it by hand.
            setSlug((s) => (s === "" || s === slugify(name) ? slugify(e.target.value) : s));
          }}
          placeholder="Robot Arm"
          className="h-9 w-44 border border-line bg-bg px-2.5 text-[0.875rem] text-heading outline-none focus:border-spot-600"
        />
      </label>
      <label className="block">
        <span className="bin mb-1 block">Slug</span>
        <input value={slug} onChange={(e) => setSlug(e.target.value)}
          className="h-9 w-44 border border-line bg-bg px-2.5 font-mono text-[0.8125rem] text-heading outline-none focus:border-spot-600" />
      </label>
      <button onClick={create} disabled={pending || !name.trim()} className="btn btn-primary btn-sm disabled:opacity-40">
        {pending ? "Creating…" : "Create"}
      </button>
      <button onClick={() => { setOpen(false); setError(""); }} className="btn btn-ghost btn-sm">Cancel</button>
      {error && <p className="basis-full text-[0.8125rem] text-danger">{error}</p>}
    </div>
  );
}

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
