"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORIES, skuCountLabel, COMING_SOON, drawerWord } from "@/lib/catalog";
import { Halftone } from "@/components/Halftone";
import { Reveal } from "@/components/Reveal";
import { ArrowRight } from "@/components/Icons";
import { PHOTO_FOR_CATEGORY, PLATE_FOR_CATEGORY } from "@/lib/plates";

/* ============================================================
   The rack — thirteen drawers stood on edge.
   ------------------------------------------------------------
   A card index is not a grid of tiles. It is a row of card
   edges, and you find something by pulling one forward until
   its face is readable. That is the whole interaction: thirteen
   spines, one pulls, and the drawing on its face re-screens into
   a photograph of what is actually in the drawer.

   The photograph swelling into the drawing *is* the switch — the
   dots grow from one subject into the next rather than fading,
   because these are two states of one printing plate, not two
   images stacked on top of each other.

   Below lg it is a list. A 73px spine cannot be pulled with a
   finger, and a phone should not pay for a decoration it cannot
   operate.
   ============================================================ */

/** How the row divides itself. Pulled panel : untouched panel : its neighbours. */
const GROW_PULLED = 5.4;
const GROW_PUSHED = 0.62;

/**
 * The face is a *fixed* width pinned to the panel's left edge, and the panel is
 * a moving window onto it.
 *
 * Sizing the canvas to the panel instead would re-screen 13 lattices on every
 * frame of the pull. This way the expensive work happens once and the pull is
 * pure compositing — the card is a fixed object and you are seeing more of it,
 * revealed left to right as the drawer comes out.
 */
const FACE = "w-[42vw] max-w-[40rem]";

/**
 * How present the face is at each state.
 *
 * A closed drawer does not show you its contents, and thirteen full-strength
 * halftones side by side is a wall of noise rather than a cabinet — measured at
 * 111px per spine, a centre crop of any drawing is its densest region and every
 * panel screens to solid. So the resting face is a ghost of ink on the drawer
 * front, and pulling develops it.
 */
const FACE_INK = { pulled: 1, resting: 0.09, pushed: 0.06 };

export function DrawerRack() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section id="cabinet" className="scroll-mt-24 border-b border-line py-16 lg:py-24">
      <div className="container-page">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h2 className="monumental max-w-[15ch] text-[clamp(2rem,5vw,4rem)]">
            {drawerWord()} drawers
          </h2>
          <p className="max-w-sm text-[0.9375rem] leading-relaxed text-muted">
            Three levels deep, and a part sits on every shelf it belongs to — an M3 screw
            is filed under Fasteners, 3D Printing <em>and</em> Drones, with one canonical
            record behind all three.
          </p>
        </Reveal>
      </div>

      {/* full bleed: a cabinet runs wall to wall, it does not sit in a measure */}
      <Reveal>
        <ol
          onPointerLeave={() => setActive(null)}
          className="grid border-y border-ink-900 lg:flex lg:h-[min(78svh,42rem)]"
        >
          {CATEGORIES.map((c, i) => (
            <Panel
              key={c.slug}
              slug={c.slug}
              name={c.name}
              blurb={c.blurb}
              shelves={c.subs.length}
              count={c.count}
              index={i}
              pulled={active === i}
              pushed={active !== null && active !== i}
              onOpen={() => setActive(i)}
              onClose={() => setActive(null)}
            />
          ))}
        </ol>
      </Reveal>

    </section>
  );
}

function Panel({
  slug, name, blurb, shelves, count, index, pulled, pushed, onOpen, onClose,
}: {
  slug: string; name: string; blurb: string; shelves: number; count: number;
  index: number; pulled: boolean; pushed: boolean; onOpen: () => void; onClose: () => void;
}) {
  const photo = PHOTO_FOR_CATEGORY[slug];
  const plate = PLATE_FOR_CATEGORY[slug] ?? "screw";
  const label = skuCountLabel(count) ?? COMING_SOON;
  const n = String(index + 1).padStart(2, "0");

  return (
    <li
      style={{ flexGrow: pulled ? GROW_PULLED : pushed ? GROW_PUSHED : 1 }}
      className="border-b border-line last:border-b-0 lg:h-full lg:basis-0 lg:border-b-0 lg:border-r lg:border-line lg:last:border-r-0 lg:transition-[flex-grow] lg:duration-[620ms] lg:ease-[var(--ease-drawer)]"
    >
      <Link
        href={`/c/${slug}`}
        onPointerEnter={onOpen}
        onFocus={onOpen}
        onBlur={onClose}
        className="relative flex h-[4.5rem] w-full items-center gap-3.5 overflow-hidden bg-bg px-4 outline-offset-[-2px] lg:block lg:h-full lg:px-0"
      >
        {/* ---------- below lg: a list row ---------- */}
        <span aria-hidden className="relative size-[3.25rem] shrink-0 overflow-hidden bg-surface lg:hidden">
          <Halftone plate={plate} cell={4} duotone={false} className="h-full w-full" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col lg:hidden">
          {/* wraps rather than truncates — a drawer whose label you cannot read is not a drawer */}
          <span className="monumental text-balance text-[0.9375rem] text-heading">{name}</span>
          <span className="bin mt-1">{shelves} shelves · {label}</span>
        </span>
        <span aria-hidden className="bin shrink-0 lg:hidden">{n}</span>

        {/* ---------- lg and up: the drawer face ---------- */}
        {/*
          `image` only when pulled, so the resting state is the drawing and the
          pull is what develops the photograph. `preload` decodes it at mount so
          that first pull is one continuous re-screen rather than two.
        */}
        <span
          aria-hidden
          style={{ opacity: pulled ? FACE_INK.pulled : pushed ? FACE_INK.pushed : FACE_INK.resting }}
          className={`pointer-events-none absolute inset-y-0 left-0 hidden transition-opacity duration-[620ms] ease-[var(--ease-out)] lg:block ${FACE}`}
        >
          <Halftone
            plate={plate}
            image={pulled ? photo : undefined}
            preload={photo}
            cell={8}
            className="h-full w-full"
          />
        </span>

        {/* the pulled drawer gets the signal edge, same language as a card tab */}
        <span
          aria-hidden
          className={`absolute inset-x-0 top-0 hidden h-[3px] bg-spot-500 transition-opacity duration-300 lg:block ${
            pulled ? "opacity-100" : "opacity-0"
          }`}
        />

        {/*
          The drawer front's own furniture: address, then the pull. It belongs
          to the *closed* drawer and goes with it — left up, a 9px agate label
          lands on a full-strength halftone and vanishes. The caption band
          repeats the address anyway, so nothing is lost.
        */}
        <span
          aria-hidden
          className={`absolute inset-x-0 top-0 hidden flex-col items-center pt-3.5 transition-opacity duration-300 lg:flex ${
            pulled ? "opacity-0" : "opacity-100"
          }`}
        >
          <span className="bin">{n}</span>
          <span className="mt-3 block h-[5px] w-9 border-t border-t-ink-300 bg-ink-100" />
        </span>

        {/*
          The spine label — set the way a drawer edge is labelled, with the
          shelf count running beside it as a catalogue mark. Both rotated
          individually so the flex row still lays out left to right.
        */}
        <span
          aria-hidden
          className={`absolute inset-0 hidden items-end justify-center gap-2 pb-7 transition-opacity duration-300 lg:flex ${
            pulled ? "opacity-0" : "opacity-100"
          }`}
        >
          <span className="bin whitespace-nowrap rotate-180 [writing-mode:vertical-rl]">
            {shelves} shelves · {label}
          </span>
          <span className="monumental whitespace-nowrap rotate-180 text-[0.9375rem] text-heading [writing-mode:vertical-rl]">
            {name}
          </span>
        </span>

        {/*
          The face record. Fixed to the face width, not the panel width, so the
          type does not reflow through the whole 620ms of the pull — it arrives
          already set, like a card that was always printed this way.
        */}
        <span
          className={`absolute bottom-0 left-0 hidden border-t border-ink-900 bg-bg p-5 transition-transform duration-[620ms] ease-[var(--ease-drawer)] lg:block ${FACE} ${
            pulled ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <span className="bin block">
            Drawer {n} · {shelves} shelves · {label}
          </span>
          <span className="monumental mt-2 block text-balance text-[clamp(1.375rem,2.3vw,2.25rem)] text-heading">
            {name}
          </span>
          <span className="mt-2 line-clamp-2 max-w-[46ch] text-[0.8125rem] leading-relaxed text-muted">
            {blurb}
          </span>
          <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-spot-700">
            Open drawer <ArrowRight className="size-3.5" />
          </span>
        </span>
      </Link>
    </li>
  );
}
