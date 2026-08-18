"use client";

import { useState } from "react";
import { Frame } from "@/components/Frame";
import type { GlyphKey } from "@/lib/types";
import { Rule } from "@/components/Rule";
import { SpecDrawing } from "./SpecDrawing";
import { specDrawing } from "@/lib/specDrawing";

/**
 * PDP gallery.
 *
 * Three photographic slots carrying the shot list in the UI before the
 * photography exists — 3/4 hero, top-down, a scale reference — plus a drawing
 * slot that only appears when there is a drawing to put in it. Until a file
 * lands in each photographic slot they screen the same plate, which is honest,
 * and which is why the label says what the slot is *for* rather than
 * pretending the picture is already that view.
 */
const SLOTS = [
  { key: "hero", label: "3/4 view", role: "hero" },
  { key: "top", label: "Top-down", role: "gallery" },
  { key: "scale", label: "With ₹1 coin", role: "scale" },
  { key: "drawing", label: "Drawing", role: "drawing" },
] as const;

export function Gallery({
  glyph, sku, attrs, images = [],
}: {
  glyph: GlyphKey;
  sku: string;
  attrs: Record<string, unknown>;
  /** Uploaded photographs, matched to the slots by role. */
  images?: { role: string; url: string; alt: string }[];
}) {
  const [active, setActive] = useState(0);
  const part = { sku, attrs };

  /*
    Role decides the slot, not upload order. A scale shot belongs in the scale
    slot or nowhere — dropping it into "3/4 view" because it happened to be
    uploaded first would make the label lie about the picture.

    Slots with no photograph keep the drawn plate, which is why the label says
    what the slot is *for* rather than describing what is in it.
  */
  const shot = (role: string) => images.find((m) => m.role === role);

  /*
    The drawing slot is the one slot we can fill ourselves.

    An uploaded drawing still wins — a manufacturer's own dimensioned sheet is
    better than anything derived from our attribute row. Below that, a
    generated sheet beats the plate, because the slot is labelled "Drawing" and
    a silhouette is not one. Below *that* (a part we hold no attributes for)
    `specDrawing` reports empty and the plate stays, rather than printing a
    frame with nothing in it.
  */
  const generated = !specDrawing(attrs).empty;
  const isGenerated = (role: string) => role === "drawing" && !shot("drawing") && generated;

  /*
    The drawing slot is dropped, not filled with a plate.

    The other three slots are labelled by what they are *for*, and a screened
    plate standing in for a photograph we have not taken yet reads as
    "photography pending". "Drawing" does not work that way: a drawing is
    something we can either derive or not, and there is no photographer coming.
    On a part we hold no dimensions for — most of the imported catalogue — the
    tab promised a dimensioned sheet and delivered the same silhouette as the
    other three, which is the one slot that was actively lying.
  */
  const slots = SLOTS.filter((s) => s.role !== "drawing" || shot("drawing") || generated);

  return (
    <div>
      <div className="group relative overflow-hidden border border-ink-900 bg-surface">
        {isGenerated(slots[active].role) ? (
          <div className="relative aspect-square">
            <SpecDrawing sku={sku} attrs={attrs} />
          </div>
        ) : (
          <Frame
            ratio="1/1"
            glyph={glyph}
            part={part}
            cell={7}
            src={shot(slots[active].role)?.url}
            alt={shot(slots[active].role)?.alt}
            label={`${sku} · ${slots[active].label}`}
            sizes="(max-width: 1024px) 100vw, 42vw"
            priority
          />
        )}
        <span className="bin absolute left-3 top-3">{slots[active].label}</span>
        {/* registration marks — where the two plates line up */}
        <span aria-hidden className="pointer-events-none absolute left-2 top-2 size-4 border-l border-t border-spot-600" />
        <span aria-hidden className="pointer-events-none absolute bottom-2 right-2 size-4 border-b border-r border-spot-600" />
        <Rule className="pointer-events-none absolute inset-x-0 bottom-0 w-full" />
      </div>

      <div className={`mt-2 grid gap-2 ${slots.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {slots.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setActive(i)}
            onMouseEnter={() => setActive(i)}
            aria-pressed={i === active}
            aria-label={s.label}
            className={`overflow-hidden border transition-colors ${
              i === active ? "border-spot-600" : "border-line hover:border-ink-400"
            }`}
          >
            {isGenerated(s.role) ? (
              <div className="relative aspect-square">
                <SpecDrawing sku={sku} attrs={attrs} />
              </div>
            ) : (
              <Frame ratio="1/1" glyph={glyph} part={part} cell={4} tone="neutral" sizes="120px"
                src={shot(s.role)?.url} alt={shot(s.role)?.alt} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
