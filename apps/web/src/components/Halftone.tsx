"use client";

import { useEffect, useRef } from "react";
import { PLATES, type PlateKey } from "@/lib/plates";

/* ============================================================
   The halftone screen.
   ------------------------------------------------------------
   Every image on this site is printed, not photographed. A plate
   is rasterised once, then re-screened as a dot lattice: one
   black plate at 45°, one oxide plate at 15°, which are the
   angles a two-colour job actually uses to keep the rosette from
   moiréing.

   Dot area is proportional to coverage, so radius goes as √c —
   using c directly is the mistake that makes a halftone look
   like a scatter plot instead of a photograph.

   Two things move, both native to the material:
     · the pointer acts as a loupe, and the ink blooms under it;
     · changing plate re-screens rather than cross-fades, so the
       dots swell from one part into the next.
   Neither runs under prefers-reduced-motion, where the plate is
   rendered once and left alone.
   ============================================================ */

const TAU = Math.PI * 2;
const INK_ANGLE = (45 * Math.PI) / 180;
const OX_ANGLE = (15 * Math.PI) / 180;
/** Cells are capped rather than fixed, so a hero-sized canvas does not
    ask the compositor for forty thousand arcs a frame. */
const MAX_CELLS = 4600;
const SWITCH_MS = 620;
/** Mean ink coverage a screened photograph is carried to — see `coverageFor`. */
const INK_TARGET = 0.32;

type Lattice = { x: number; y: number }[];

export function Halftone({
  plate,
  image,
  preload,
  param = 0.5,
  cell = 9,
  duotone = true,
  interactive = false,
  zoom = 1,
  className = "",
  ink = "#1C1813",
  /*
    spot-600, not the logo's spot-500. A dot screen is only as legible as the
    ink's contrast with the paper behind it: 500 measures 2.93:1 and the plates
    go pale, 600 measures 4.10:1 and reads slightly stronger than the oxide it
    replaces. The plate is the one place the darker step is the brand colour.

    Hardcoded because this is a canvas fill, not CSS — `var()` does not reach
    a 2D context. It has to be re-plated by hand whenever --spot-600 moves,
    which is exactly what was missed the first time.
  */
  spot = "#3B8736",
}: {
  plate: PlateKey;
  /**
   * A real photograph to screen instead of the drawn plate. Must be
   * same-origin (`/public`) — a cross-origin bitmap taints the canvas and
   * `getImageData` throws, which is the whole mechanism here.
   *
   * This is the path real product photography takes: it is screened by the
   * same engine at the same angles, so when OnlyParts shoots its own catalogue
   * the design does not change, only the source.
   *
   * Changing it re-screens through the same interpolation as a plate change,
   * so a photograph swells into the drawing dot by dot rather than cutting.
   */
  image?: string;
  /**
   * Decode an image the surface is *about* to want. A rack panel shows its
   * drawing at rest and its photograph when pulled; without this the first
   * pull screens twice — once to the plate, again when the JPEG lands.
   */
  preload?: string;
  /** [0,1] shape parameter from the part's own dimensions — see `plateParam` */
  param?: number;
  /** dot pitch in CSS px at rest */
  cell?: number;
  /** print the spot plate into the dense regions */
  duotone?: boolean;
  /** pointer acts as a loupe */
  interactive?: boolean;
  /** >1 crops in, so a monumental plate can bleed off its box */
  zoom?: number;
  className?: string;
  ink?: string;
  spot?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cvsRef = useRef<HTMLCanvasElement | null>(null);
  // Initialised from the first render's props and updated only in the switch
  // effect below — writing a ref during render is what React 19 flags.
  const plateRef = useRef(plate);
  const imageRef = useRef(image);
  const switchRef = useRef<((k: PlateKey, src?: string) => void) | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const cvs = cvsRef.current;
    if (!host || !cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0, h = 0, pitch = cell;
    let lattice: Lattice = [];
    let latticeOx: Lattice = [];
    let covFrom: Float32Array = new Float32Array(0);
    let covTo: Float32Array = new Float32Array(0);
    let covFromOx: Float32Array = new Float32Array(0);
    let covToOx: Float32Array = new Float32Array(0);
    let mix = 1;
    let switchStart = 0;

    // pointer, in CSS px, eased toward the real position
    let px = -9999, py = -9999, tx = -9999, ty = -9999, amp = 0, ampT = 0;
    let raf = 0, running = false, cancelled = false;

    /* ---------- sampling ---------- */
    const sample = document.createElement("canvas");
    const sctx = sample.getContext("2d", { willReadFrequently: true });
    /** Decoded photographs, by src. Keyed rather than singular so a surface can
        hold a drawing and a photograph at once and interpolate between them. */
    const bitmaps = new Map<string, HTMLImageElement>();

    function coverageFor(key: PlateKey, src: string | undefined, lat: Lattice, out: Float32Array) {
      if (!sctx) return;
      const SW = 300;
      const sw = w >= h ? SW : Math.max(24, Math.round((SW * w) / h));
      const sh = w >= h ? Math.max(24, Math.round((SW * h) / w)) : SW;
      sample.width = sw; sample.height = sh;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, sw, sh);
      sctx.save();
      if (zoom !== 1) {
        sctx.translate(sw / 2, sh / 2);
        sctx.scale(zoom, zoom);
        sctx.translate(-sw / 2, -sh / 2);
      }

      /*
        A photograph already carries tone, so it needs neither the drawn plate
        nor the raking light below — it is cover-fitted, read as luminance, and
        levelled. A drawn plate is a binary silhouette and gets lit.
      */
      const photo = src ? bitmaps.get(src) : undefined;
      if (photo) {
        const s = Math.max(sw / photo.width, sh / photo.height);
        const dw = photo.width * s, dh = photo.height * s;
        sctx.drawImage(photo, (sw - dw) / 2, (sh - dh) / 2, dw, dh);
        sctx.restore();

        const d = sctx.getImageData(0, 0, sw, sh).data;
        const kx = sw / w, ky = sh / h;

        /*
          Auto-level, from the image's own histogram.

          A fixed curve only suits the photograph it was tuned on: a part shot
          on a white sweep and the same part shot on a bench have completely
          different ranges, and a fixed black point turns one to mud and the
          other to noise. Clipping 2% off each end and stretching what is left
          means any future product shot lands correctly without a per-image
          number to maintain.
        */
        const luma = new Float32Array(lat.length);
        const hist = new Uint32Array(256);
        let n = 0;
        for (let i = 0; i < lat.length; i++) {
          const sx = Math.round(lat[i].x * kx), sy = Math.round(lat[i].y * ky);
          if (sx < 0 || sy < 0 || sx >= sw || sy >= sh) { luma[i] = -1; continue; }
          const o = (sy * sw + sx) * 4;
          const l = (0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]) / 255;
          luma[i] = l;
          hist[Math.min(255, Math.round(l * 255))]++;
          n++;
        }
        const clip = Math.max(1, Math.round(n * 0.02));
        let lo = 0, hi = 255, acc = 0;
        for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= clip) { lo = v; break; } }
        acc = 0;
        for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= clip) { hi = v; break; } }
        const span = Math.max(16, hi - lo) / 255, black = lo / 255;

        let sum = 0, live = 0;
        for (let i = 0; i < lat.length; i++) {
          if (luma[i] < 0) { out[i] = 0; continue; }
          const norm = (luma[i] - black) / span;
          // inverted: a dark subject prints dense
          out[i] = Math.min(1, Math.max(0, 1 - norm));
          sum += out[i]; live++;
        }

        /*
          The ink limit.

          Levelling fixes contrast but not *density*, and uncoated stock cannot
          take 74% coverage — the dots bridge and the image fills in solid. Half
          the photographs sourced for this site did exactly that: measured at
          61%, 74%, 56% and 72% against a band of roughly 20–45% where a
          halftone is still legible as a subject rather than a slab.

          A press solves this with a total-area-coverage limit, so this does
          too: measure the mean the image actually wants, then apply the gamma
          that carries it to the target. Self-tuning like the auto-levels above,
          so a future product shot needs no number of its own. Clamped both ways
          — a light image gets more ink, but not enough to develop its noise.
        */
        const mean = live ? sum / live : 0;
        if (mean > 0.02 && mean < 0.98) {
          const g = Math.min(3.2, Math.max(0.6, Math.log(INK_TARGET) / Math.log(mean)));
          if (Math.abs(g - 1) > 0.02) {
            for (let i = 0; i < lat.length; i++) if (out[i] > 0) out[i] = Math.pow(out[i], g);
          }
        }
        return;
      }

      PLATES[key](sctx, sw, sh, param);
      sctx.restore();

      /*
        Light the plate.

        The drawings are solid silhouettes, so a screen taken straight off them
        has only two tones — full ink and paper — and the result reads as a
        stencil rather than a printed photograph. It also leaves the loupe
        nothing to work on: every cell is already 0 or 1, and swelling a
        saturated cell does nothing.

        A raking light from the upper left does it — but it has to be applied
        with `destination-out`, not `source-atop`. Atop's output alpha is the
        backdrop's alpha by definition (αo = αb), so painting a translucent
        gradient that way changes colour and leaves the alpha this function
        samples completely untouched. `destination-out` removes alpha, so the
        stops are the inverse: take the most out where the light is strongest.

        Below ~120px there are too few cells to carry a gradient, so small
        thumbnails keep the crisp silhouette instead.
      */
      if (Math.min(w, h) >= 120) {
        sctx.globalCompositeOperation = "destination-out";
        const lg = sctx.createRadialGradient(
          sw * 0.32, sh * 0.24, Math.min(sw, sh) * 0.04,
          sw * 0.32, sh * 0.24, Math.max(sw, sh) * 1.05,
        );
        lg.addColorStop(0, "rgba(0,0,0,0.52)");    // highlight — least ink
        lg.addColorStop(0.45, "rgba(0,0,0,0.22)");
        lg.addColorStop(1, "rgba(0,0,0,0)");       // shadow — full ink
        sctx.fillStyle = lg;
        sctx.fillRect(0, 0, sw, sh);
        sctx.globalCompositeOperation = "source-over";
      }

      const data = sctx.getImageData(0, 0, sw, sh).data;
      const kx = sw / w, ky = sh / h;
      for (let i = 0; i < lat.length; i++) {
        const sx = Math.round(lat[i].x * kx);
        const sy = Math.round(lat[i].y * ky);
        if (sx < 0 || sy < 0 || sx >= sw || sy >= sh) { out[i] = 0; continue; }
        out[i] = data[(sy * sw + sx) * 4 + 3] / 255;
      }
    }

    function buildLattice(angle: number): Lattice {
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const diag = Math.hypot(w, h) / 2 + pitch * 2;
      const pts: Lattice = [];
      for (let v = -diag; v <= diag; v += pitch) {
        for (let u = -diag; u <= diag; u += pitch) {
          const x = w / 2 + u * cos - v * sin;
          const y = h / 2 + u * sin + v * cos;
          if (x < -pitch || y < -pitch || x > w + pitch || y > h + pitch) continue;
          pts.push({ x, y });
        }
      }
      return pts;
    }

    /* ---------- layout ---------- */
    function measure() {
      const r = host!.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      // keep the dot count bounded no matter how large the surface gets
      pitch = Math.max(cell, Math.sqrt((w * h) / MAX_CELLS));

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cvs!.width = Math.round(w * dpr);
      cvs!.height = Math.round(h * dpr);
      cvs!.style.width = `${w}px`;
      cvs!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      lattice = buildLattice(INK_ANGLE);
      latticeOx = duotone ? buildLattice(OX_ANGLE) : [];

      covTo = new Float32Array(lattice.length);
      covFrom = new Float32Array(lattice.length);
      covToOx = new Float32Array(latticeOx.length);
      covFromOx = new Float32Array(latticeOx.length);

      coverageFor(plateRef.current, imageRef.current, lattice, covTo);
      covFrom.set(covTo);
      if (duotone) { coverageFor(plateRef.current, imageRef.current, latticeOx, covToOx); covFromOx.set(covToOx); }
      mix = 1;
      draw();
    }

    /* ---------- paint ---------- */
    function band(lat: Lattice, from: Float32Array, to: Float32Array, colour: string, spotPlate: boolean) {
      if (!lat.length) return;
      ctx!.fillStyle = colour;
      ctx!.beginPath();
      /*
        The loupe. A purely multiplicative swell moved coverage by a third of a
        percentage point across the whole plate — mechanically alive, visually
        invisible. Ink under a lens does two things: existing dots grow, and
        they gain a little from the spread of the ink beside them. The additive
        term is gated on the cell already carrying ink, so the paper stays
        paper and the effect reads as magnification rather than as a smudge.
      */
      const sigma = 132;
      for (let i = 0; i < lat.length; i++) {
        let c = from[i] + (to[i] - from[i]) * mix;
        if (spotPlate) {
          // the spot plate only prints where the black plate is already dense
          c = c <= 0.5 ? 0 : (c - 0.5) / 0.5;
        }
        if (c <= 0.012) continue;
        if (amp > 0.002) {
          const d = Math.hypot(lat[i].x - px, lat[i].y - py) / sigma;
          const g = amp * Math.exp(-d * d);
          c = Math.min(1, c * (1 + 1.15 * g) + 0.16 * g);
        }
        const r = pitch * (spotPlate ? 0.46 : 0.53) * Math.sqrt(c);
        if (r < 0.22) continue;
        ctx!.moveTo(lat[i].x + r, lat[i].y);
        ctx!.arc(lat[i].x, lat[i].y, r, 0, TAU);
      }
      ctx!.fill();
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      if (duotone) band(latticeOx, covFromOx, covToOx, spot, true);
      band(lattice, covFrom, covTo, ink, false);
    }

    /* ---------- animation ---------- */
    function frame(now: number) {
      let live = false;

      if (mix < 1) {
        const t = Math.min(1, (now - switchStart) / SWITCH_MS);
        // ease-out expo, so the dots arrive rather than drift
        mix = 1 - Math.pow(2, -10 * t);
        if (t >= 1) mix = 1;
        live = mix < 1;
      }

      if (interactive) {
        px += (tx - px) * 0.14;
        py += (ty - py) * 0.14;
        amp += (ampT - amp) * 0.09;
        if (Math.abs(ampT - amp) > 0.004 || (amp > 0.004 && (Math.abs(tx - px) > 0.6 || Math.abs(ty - py) > 0.6))) live = true;
      }

      draw();
      if (live) raf = requestAnimationFrame(frame);
      else running = false;
    }

    function kick() {
      if (still || running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }

    /* ---------- photographs ---------- */
    /**
     * Decode once, then hold it. A failed decode never lands in the map, so
     * `coverageFor` silently falls back to the drawing — a missing JPEG costs
     * the photograph, not the surface.
     */
    function ensureBitmap(src: string, then: () => void) {
      if (bitmaps.has(src)) { then(); return; }
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      img.decode()
        .then(() => { if (!cancelled) { bitmaps.set(src, img); then(); } })
        .catch(() => { /* keep the drawn plate */ });
    }

    /* ---------- listeners ---------- */
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    measure();

    /*
      The photograph arrives after first paint, so the drawing screens first and
      the photo swells into it when it decodes. That is the right order — the
      surface is never empty, and a slow image degrades to the drawn part rather
      than to a hole.
    */
    if (imageRef.current) {
      const src = imageRef.current;
      ensureBitmap(src, () => { if (imageRef.current === src) reScreen(plateRef.current, src); });
    }
    // and warm whatever this surface will want on the next interaction
    if (preload) ensureBitmap(preload, () => {});

    const onMove = (e: PointerEvent) => {
      const r = host!.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      if (px < -9000) { px = tx; py = ty; }
      ampT = 1;
      kick();
    };
    const onLeave = () => { ampT = 0; kick(); };

    if (interactive && !still) {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
    }

    /* ---------- switching ---------- */
    /** Re-screen toward a new subject, wherever the current interpolation is. */
    function reScreen(key: PlateKey, src: string | undefined) {
      if (!lattice.length) return;
      // freeze wherever the interpolation currently is, then aim at the new one
      for (let i = 0; i < covFrom.length; i++) covFrom[i] += (covTo[i] - covFrom[i]) * mix;
      for (let i = 0; i < covFromOx.length; i++) covFromOx[i] += (covToOx[i] - covFromOx[i]) * mix;
      coverageFor(key, src, lattice, covTo);
      if (duotone) coverageFor(key, src, latticeOx, covToOx);
      if (still) { mix = 1; draw(); return; }
      mix = 0;
      switchStart = performance.now();
      kick();
    }

    /*
      A drawing is available synchronously and a photograph is not, so an
      undecoded target screens to its drawing first and swells again when the
      JPEG lands. With `preload` warming the map that second pass never happens
      — the pull is one continuous re-screen.
    */
    switchRef.current = (key, src) => {
      const ready = !src || bitmaps.has(src);
      reScreen(key, ready ? src : undefined);
      if (ready || !src) return;
      ensureBitmap(src, () => {
        if (imageRef.current === src) reScreen(plateRef.current, src);
      });
    };

    return () => {
      cancelled = true;
      ro.disconnect();
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      switchRef.current = null;
    };
    // `plate` and `image` are deliberately absent: the switch effect below
    // re-screens on a change, rather than tearing the canvas down and
    // rebuilding the lattice — which is what makes the switch an animation
    // instead of a cut.
    // `param` is here rather than in a ref because it is a property of the SKU
    // being rendered — it changes when the component is reused for a different
    // part, which is exactly when a full re-screen is correct.
  }, [cell, duotone, interactive, ink, spot, zoom, param, preload]);

  // Mount already screened the first subject inside `measure`; only a genuine
  // change should pay for a re-screen.
  const mounted = useRef(false);
  useEffect(() => {
    plateRef.current = plate;
    imageRef.current = image;
    if (!mounted.current) { mounted.current = true; return; }
    switchRef.current?.(plate, image);
  }, [plate, image]);

  /*
    No forced `position` here. It used to hardcode `relative`, and Tailwind
    emits `.relative` after `.absolute` in the utilities layer — so a caller
    passing `absolute inset-0` got a relative, zero-height box and a blank
    canvas. Callers own their own positioning.
  */
  return (
    <div ref={hostRef} className={className}>
      <canvas ref={cvsRef} aria-hidden className="block h-full w-full" />
    </div>
  );
}
