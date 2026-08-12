"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Halftone } from "@/components/Halftone";
import type { PlateKey } from "@/lib/plates";
import { Rule } from "@/components/Rule";
import { drawerWord } from "@/lib/catalog";

/* ============================================================
   The cabinet face — first viewport.
   ------------------------------------------------------------
   One monumental image anchors the page, and it argues the whole
   proposition without a sentence: the plate re-screens from a
   screw into a bearing into a stepper into an extrusion, and the
   marginalia beside it changes drawer as it goes. "Every part"
   is not a claim here, it is a demonstration.

   Everything named below is a standard designation — DIN 912,
   608ZZ, NEMA 17 — not stock. Nothing on this screen asserts a
   price, a quantity or a lead time, so it stays true before the
   catalogue is seeded.
   ============================================================ */

/**
 * `param` is the same dimensional parameter a product tile passes, so the
 * screw shown here is genuinely the proportion of an M3 × 10 rather than a
 * generic screw. `zoom` compensates for silhouette: a bearing fills a square
 * box on its own, a screw is tall and thin and needs cropping in.
 */
const ROTATION: {
  plate: PlateKey; param: number; zoom: number; image?: string;
  drawer: string; cat: string; designation: string; standard: string;
}[] = [
  /*
    No `image` on the hero, deliberately, and not for want of trying.

    The hero is the one plate that must be unambiguous at a glance, and every
    public-domain photograph available screened worse than the drawn part: a
    macro crop of one screw reads as abstract texture, and an assortment shot
    reads as clutter. The drawn plate is unmistakable and it is dimensionally
    true to the part named beside it.

    Real photography belongs here the moment OnlyParts shoots it — set `image`
    and it flows through the same screen. See `public/parts/CREDITS.md` for
    what that shoot needs to produce.
  */
  { plate: "screw",     param: 0.11, zoom: 1.34, drawer: "01", cat: "Fasteners", designation: "M3 × 10 socket head cap", standard: "DIN 912" },
  { plate: "bearing",   param: 0.28, zoom: 1.04, drawer: "08", cat: "Bearings",              designation: "608ZZ deep groove",       standard: "ID 8 · OD 22 · W 7" },
  { plate: "rotor",     param: 0.5,  zoom: 1.04, drawer: "02", cat: "Motors",                designation: "NEMA 17 stepper",         standard: "1.8° · 42 × 42" },
  { plate: "extrusion", param: 0.5,  zoom: 1.04, drawer: "13", cat: "Hardware",              designation: "2020 V-slot extrusion",   standard: "6063-T5" },
  { plate: "chip",      param: 0.5,  zoom: 1.12, drawer: "03", cat: "Electronic Components", designation: "DIP-8 through-hole",      standard: "2.54 mm pitch" },
  { plate: "prop",      param: 0.5,  zoom: 1.06, drawer: "06", cat: "Drones & Parts",        designation: "5 × 4.3 tri-blade",       standard: "5 mm shaft" },
];

const HOLD_MS = 3600;

export function CabinetFace() {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setI((n) => (n + 1) % ROTATION.length);
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, []);

  const cur = ROTATION[i];

  return (
    <section className="relative overflow-hidden border-b border-ink-900">
      {/* sheet coordinates down the left margin — a drawing frame's own furniture */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden w-9 flex-col justify-around border-r border-line lg:flex">
        {["A", "B", "C", "D"].map((c) => (
          <span key={c} className="bin text-center">{c}</span>
        ))}
      </div>

      <div className="container-page relative lg:pl-14">
        <div className="grid items-center gap-8 py-10 lg:min-h-[calc(100svh-var(--header-h))] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-4 lg:py-8">
          {/* ---------- the type, printed over the plate's left edge ---------- */}
          <div className="relative z-10 order-2 lg:order-1 lg:pr-[8%]">
            <h1 className="monumental text-[clamp(3.25rem,11vw,8.5rem)]">
              Every part.
              <br />
              <span className="text-spot-700">One cart.</span>
            </h1>

            <p className="mt-6 max-w-md text-[1.0625rem] leading-relaxed text-muted">
              Fasteners, bearings, motors, printers, electronics, batteries, extrusion
              {/* Explicit `{" "}` — the literal space after the expression was being
                  trimmed away and the hero read "fourteendrawers". */}
              — {drawerWord()}{" "}drawers of it, cross-listed on every shelf a part belongs
              to. One order, one box, one GST invoice. Whatever we don&rsquo;t stock, we make.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="#cabinet" className="btn btn-primary btn-lg">
                Open the cabinet
              </Link>
              <Link href="/make" className="btn btn-secondary btn-lg">
                Get a part made
              </Link>
            </div>

          </div>

          {/* ---------- the plate ---------- */}
          <div className="relative order-1 lg:order-2 lg:-mr-9 lg:self-stretch">
            <Halftone
              plate={cur.plate}
              image={cur.image}
              param={cur.param}
              zoom={cur.image ? 1 : cur.zoom}
              interactive
              cell={8}
              className="aspect-[5/6] w-full sm:aspect-[16/11] lg:aspect-auto lg:h-full lg:min-h-[34rem]"
            />

            {/* the record for whatever is currently on the plate */}
            {/*
              On lg the plate is taller than the part inside it, so the record
              sits in the empty band at its foot. Below lg the plate fills its
              box and an absolute label lands on top of the dots — so there it
              goes back into the flow, under the plate.
              The column also bleeds right on lg; the record must not go with it.
            */}
            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 bg-bg py-2 lg:absolute lg:inset-x-0 lg:bottom-0 lg:mt-0 lg:pb-6 lg:pr-9">
              <span key={cur.plate} className="rise">
                <span className="bin block">
                  Drawer {cur.drawer} · {cur.cat}
                </span>
                <span className="mt-1 block font-mono text-[0.8125rem] text-heading">
                  {cur.designation}
                </span>
              </span>
              <span className="bin">{cur.standard}</span>
            </div>
          </div>
        </div>
      </div>

      {/* the rotation, as a scale you can read and click */}
      <div className="container-page relative pb-4 lg:pl-14">
        <div className="flex items-center gap-4">
          <span className="bin hidden shrink-0 sm:block">Index rev 2026-08-03</span>
          <Rule className="hidden flex-1 sm:block" />
          <ul className="flex shrink-0 items-center gap-1.5">
            {ROTATION.map((r, n) => (
              <li key={r.plate}>
                <button
                  onClick={() => setI(n)}
                  aria-label={`Show ${r.designation}`}
                  aria-current={n === i}
                  className={`block h-1.5 transition-all duration-300 ease-[var(--ease-out)] ${
                    n === i ? "w-8 bg-spot-500" : "w-3 bg-ink-300 hover:bg-ink-400"
                  }`}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
