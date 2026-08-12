"use client";

import { useEffect, useState } from "react";
import { Halftone } from "@/components/Halftone";
import type { PlateKey } from "@/lib/plates";
import { Rule } from "@/components/Rule";

/**
 * The plate beside the sign-in form.
 *
 * The auth screens were a 384px card floating in most of a viewport of
 * nothing. That space is not a problem to be shrunk — it is the only moment on
 * the site where the visitor is doing exactly one thing and can be shown what
 * the site actually is. So it carries the largest halftone on the site.
 *
 * **This is the effect a screenshot cannot show.** The plate is a live dot
 * screen, and the pointer works on it the way a loupe works on a printed
 * sheet: ink blooms under the glass and settles again behind it. The screen
 * also re-screens between parts on a slow cycle, so a sign-in that takes
 * twenty seconds shows four drawers' worth of what is in the cabinet.
 *
 * With no pointer, the cycle carries it alone; under `prefers-reduced-motion`
 * the plate renders once and nothing moves. Nothing is lost either way,
 * because nothing here is information.
 */

const CYCLE: { plate: PlateKey; param: number; label: string; addr: string }[] = [
  { plate: "bearing",   param: 0.28, label: "608ZZ deep groove",        addr: "Drawer 08 · Bearings" },
  { plate: "screw",     param: 0.14, label: "M3 × 10 socket head cap",  addr: "Drawer 01 · Fasteners" },
  { plate: "rotor",     param: 0.5,  label: "NEMA 17 stepper",          addr: "Drawer 02 · Motors" },
  { plate: "extrusion", param: 0.5,  label: "2020 V-slot extrusion",    addr: "Drawer 13 · Hardware" },
];

export function AuthCanvas() {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setI((n) => (n + 1) % CYCLE.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  const cur = CYCLE[i];

  return (
    <div className="relative hidden h-full min-h-[34rem] overflow-hidden border border-ink-900 bg-bg lg:block">
      <Halftone
        plate={cur.plate}
        param={cur.param}
        cell={7}
        zoom={1.08}
        interactive
        className="absolute inset-0"
      />

      {/* corner registration — where the two plates line up */}
      <span aria-hidden className="pointer-events-none absolute left-3 top-3 size-5 border-l border-t border-spot-600" />
      <span aria-hidden className="pointer-events-none absolute right-3 top-3 size-5 border-r border-t border-spot-600" />
      <span aria-hidden className="pointer-events-none absolute bottom-3 left-3 size-5 border-b border-l border-spot-600" />
      <span aria-hidden className="pointer-events-none absolute bottom-3 right-3 size-5 border-b border-r border-spot-600" />
      <Rule className="pointer-events-none absolute inset-x-0 bottom-0 w-full" />

      <p className="bin pointer-events-none absolute left-6 top-6">
        Move the pointer across the plate
      </p>

      <div className="pointer-events-none absolute inset-x-6 bottom-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <span key={cur.plate} className="rise">
          <span className="bin block">{cur.addr}</span>
          <span className="mt-1 block font-mono text-[0.8125rem] text-heading">{cur.label}</span>
        </span>
        <span className="bin">Index rev 2026-08-03</span>
      </div>
    </div>
  );
}
