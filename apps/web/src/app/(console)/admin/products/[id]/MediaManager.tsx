"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadProductImage, updateProductMedia } from "./actions";
import { MEDIA_ROLES, type MediaRole } from "@/lib/mediaRoles";
import { UploadIcon } from "@/components/Icons";

export type MediaEntry = {
  id: number;
  url: string;
  alt: string;
  role: MediaRole;
  width: number | null;
  height: number | null;
};

/**
 * Product imagery, managed here rather than in the CMS.
 *
 * Shopify's media panel is the reference and it is the right one: a drop zone,
 * a grid of what you have, drag to reorder, and the first image is the one that
 * shows everywhere else. Two departures, both because this catalogue is not a
 * fashion store.
 *
 * **Alt text is asked for before the upload, not after.** Every "add alt text
 * later" affordance produces a catalogue with no alt text. It is one field and
 * it is the difference between a screen reader saying "6000ZZ bearing, shielded"
 * and saying "IMG_4821".
 *
 * **Role is explicit, not positional.** Shopify infers the hero from position;
 * here `hero`, `scale`, `drawing` and `datasheet` mean different things to the
 * storefront — a scale shot next to a coin is not a substitute for the hero —
 * so position orders the gallery and role says what each one is *for*.
 */
export function MediaManager({ productId, media }: { productId: number; media: MediaEntry[] }) {
  const [items, setItems] = useState(media);
  const [alt, setAlt] = useState("");
  const [role, setRole] = useState<MediaRole>(media.length === 0 ? "hero" : "gallery");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const send = (file: File) => {
    if (!alt.trim()) {
      setError("Describe the image first — it is read aloud to people who cannot see it.");
      return;
    }
    const form = new FormData();
    form.set("productId", String(productId));
    form.set("alt", alt.trim());
    form.set("role", role);
    form.set("file", file);

    startTransition(async () => {
      const res = await uploadProductImage(form);
      if (!res.ok) { setError(res.error); return; }
      setError("");
      setAlt("");
      setRole("gallery");
      router.refresh();
    });
  };

  const persist = (next: MediaEntry[]) => {
    setItems(next);
    startTransition(async () => {
      const res = await updateProductMedia(productId, next.map((m) => ({ image: m.id, role: m.role })));
      if (!res.ok) { setError(res.error); return; }
      setError("");
      router.refresh();
    });
  };

  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    persist(next);
  };

  const setRoleAt = (i: number, r: MediaRole) => {
    // One hero. Demoting the previous one here matches what the server does.
    const next = items.map((m, k) =>
      k === i ? { ...m, role: r } : r === "hero" && m.role === "hero" ? { ...m, role: "gallery" as MediaRole } : m,
    );
    persist(next);
  };

  return (
    <section className="border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="text-base">Images</h2>
        <p className="bin">
          {items.length === 0 ? "none yet" : `${items.length} · first is the gallery order`}
        </p>
      </div>

      {/* ---------------- drop zone ---------------- */}
      <div className="border-b border-line p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="bin mb-1 block">What does it show?</span>
            <input
              value={alt}
              onChange={(e) => { setAlt(e.target.value); setError(""); }}
              placeholder="6000ZZ deep groove bearing, shield removed"
              className="h-9 w-full border border-line bg-bg px-2.5 text-[0.875rem] text-heading outline-none placeholder:text-disabled focus:border-spot-600"
            />
          </label>
          <label className="block">
            <span className="bin mb-1 block">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MediaRole)}
              className="h-9 w-full border border-line bg-bg px-2 text-[0.8125rem] capitalize text-heading outline-none focus:border-spot-600 sm:w-36"
            >
              {MEDIA_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) send(f);
          }}
          className={`mt-3 border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? "border-spot-600 bg-spot-50" : "border-line-strong bg-bg"
          }`}
        >
          <UploadIcon className="mx-auto mb-2 size-7 text-spot-600" />
          <p className="text-[0.875rem] text-heading">
            {pending ? "Uploading…" : "Drop an image, or"}{" "}
            {!pending && (
              <button onClick={() => inputRef.current?.click()} className="text-spot-700 underline underline-offset-2">
                choose a file
              </button>
            )}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }}
          />
          <p className="bin mt-3">JPEG · PNG · WebP · AVIF · up to 8 MB</p>
        </div>

        {error && <p className="mt-2 text-[0.8125rem] text-danger">{error}</p>}

        <p className="mt-3 text-[0.75rem] leading-relaxed text-faint">
          Everything here is halftone-screened before it reaches the storefront, so a
          clean, evenly-lit shot on a plain ground survives the screen better than a
          styled one. Three sizes are generated on upload.
        </p>
      </div>

      {/* ---------------- what we have ---------------- */}
      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-[0.875rem] text-muted">
          No photographs yet, so every listing draws this product as a plate. That is a
          designed fallback rather than a hole — but a drawn plate is not a product photo.
        </p>
      ) : (
        <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m, i) => (
            <li key={m.id} className="bg-surface p-3">
              <div className="relative aspect-square overflow-hidden border border-line bg-bg">
                <Image
                  src={m.url}
                  alt={m.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-contain"
                />
                {m.role === "hero" && <span className="stamp stamp-flat absolute left-2 top-2 bg-surface text-spot-700">hero</span>}
              </div>

              <p className="mt-2 line-clamp-2 text-[0.75rem] leading-snug text-muted" title={m.alt}>{m.alt}</p>

              <div className="mt-2 flex items-center gap-1.5">
                <select
                  value={m.role}
                  onChange={(e) => setRoleAt(i, e.target.value as MediaRole)}
                  disabled={pending}
                  aria-label={`Role for ${m.alt}`}
                  className="h-7 flex-1 border border-line bg-bg px-1.5 text-[0.6875rem] capitalize text-heading outline-none focus:border-spot-600"
                >
                  {MEDIA_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button onClick={() => move(i, -1)} disabled={pending || i === 0}
                  aria-label="Move earlier" className="grid size-7 place-items-center border border-line text-muted hover:text-heading disabled:opacity-30">↑</button>
                <button onClick={() => move(i, 1)} disabled={pending || i === items.length - 1}
                  aria-label="Move later" className="grid size-7 place-items-center border border-line text-muted hover:text-heading disabled:opacity-30">↓</button>
                <button onClick={() => persist(items.filter((_, k) => k !== i))} disabled={pending}
                  aria-label={`Remove ${m.alt}`}
                  className="grid size-7 place-items-center border border-line text-muted hover:border-danger hover:text-danger disabled:opacity-30">×</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
