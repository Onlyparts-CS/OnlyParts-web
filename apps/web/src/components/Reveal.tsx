"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll reveal — one observer for the whole page, and safe without JavaScript.
 *
 * Two things the previous version got wrong, both worth stating because they
 * are the usual way this pattern fails:
 *
 * 1. **It hid content unconditionally.** `.reveal { opacity: 0 }` lived in the
 *    stylesheet, so anything that stopped the effect from running — a JS error,
 *    a blocked bundle, an old browser — left the page blank rather than
 *    unanimated. The rule is now gated behind `data-reveal-ready`, which only
 *    this file sets, and only once it is actually running. No JS, no hiding.
 * 2. **One IntersectionObserver per element.** A catalogue page carries
 *    forty-eight tiles; that was forty-eight observers, each with its own
 *    callback and its own entry in the browser's intersection bookkeeping.
 *    There is one, shared, created lazily on first use.
 *
 * Elements are released from the observer the moment they have been seen. This
 * animation happens once — a card that re-animates every time it scrolls past
 * is a card that never settles.
 */

let observer: IntersectionObserver | null = null;

function shared(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        observer?.unobserve(e.target);
      }
    },
    // Fires a little before the element is fully in view, so the motion is
    // finishing as it arrives rather than starting once it is already read.
    { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
  );
  return observer;
}

/** Arms the CSS. Anything already on screen at mount is revealed immediately. */
function arm() {
  const root = document.documentElement;
  if (root.hasAttribute("data-reveal-ready")) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.setAttribute("data-reveal-ready", "");
}

export function Reveal({
  children,
  className = "",
  /** Position in a row or list — drives the stagger, in CSS, via `--i`. */
  index = 0,
  /** Explicit hold in ms, for the handful of places that sequence by hand. */
  delay,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
  delay?: number;
  as?: React.ElementType;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      arm();
      return;
    }

    /*
      Above the fold is not a reveal.

      An element already on screen when the page loads should not fade in from
      nothing — the first thing a visitor sees should simply be there. Only
      what is genuinely below the fold gets handed to the observer.
    */
    const aboveFold = el.getBoundingClientRect().top < window.innerHeight * 0.92;

    /*
      The rect is read BEFORE arming, and `.in` is added immediately after with
      nothing in between. That ordering is load-bearing.

      `getBoundingClientRect()` forces a style recalculation. Read it after
      `arm()` and the browser computes the element at `opacity: 0` — the state
      the newly-set `data-reveal-ready` attribute puts it in — and then treats
      the `.in` that follows as a change to transition *from* 0. The result was
      a visible flash on every above-fold element: painted, blanked, faded back
      in over 620ms. Measured at 0.895 mid-flash.

      With no forced read between the two, both land in one style
      recalculation and an above-fold element never leaves opacity 1.
    */
    arm();

    if (aboveFold) {
      el.classList.add("in");
      return;
    }

    const io = shared();
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      /*
        `--i` is the stagger index, capped in CSS so a hundredth tile does not
        wait ten seconds. `delay` overrides it outright for the pages that
        sequence a short sequence of blocks by hand — those were written before
        the index existed and read more clearly with an explicit number.
      */
      style={
        (delay === undefined
          ? { "--i": index }
          : { transitionDelay: `${delay}ms` }) as React.CSSProperties
      }
    >
      {children}
    </Tag>
  );
}
