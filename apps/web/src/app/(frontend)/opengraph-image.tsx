import { ImageResponse } from "next/og";

/**
 * The card every shared OnlyParts link used to not have.
 *
 * There was no `opengraph-image` anywhere in the app, so a link pasted into
 * WhatsApp — which is where a parts list actually gets shared in this market —
 * rendered as a bare URL. This covers every route that does not override it.
 *
 * Drawn rather than uploaded so it stays in step with the tokens. No custom
 * font: Satori bundles its own, `.next/static/media` filenames are content
 * hashes that change every build, and fetching Archivo from Google at render
 * time would put a third-party network call in the path of a link preview.
 * Layout is flexbox only — `ImageResponse` does not support grid.
 */

export const alt = "OnlyParts — every part, one cart";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#F7F5F1";
const INK = "#1C1813";
const MUTED = "#6E6656";
const LINE = "#E2DDD3";
const SPOT = "#3B8736";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", background: PAPER, color: INK,
          padding: 72, position: "relative",
        }}
      >
        {/* registration marks — where the two plates line up */}
        <div style={{ position: "absolute", left: 40, top: 40, width: 44, height: 44, borderLeft: `3px solid ${SPOT}`, borderTop: `3px solid ${SPOT}`, display: "flex" }} />
        <div style={{ position: "absolute", right: 40, bottom: 40, width: 44, height: 44, borderRight: `3px solid ${SPOT}`, borderBottom: `3px solid ${SPOT}`, display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, letterSpacing: 6, color: MUTED }}>
          ONLYPARTS
          <div style={{ display: "flex", flex: 1, height: 1, background: LINE }} />
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 3 }}>INDIA</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 700, lineHeight: 1.05 }}>
            Every part.
          </div>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 700, lineHeight: 1.05, color: SPOT }}>
            One cart.
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: MUTED, maxWidth: 900, lineHeight: 1.4 }}>
            Fasteners, bearings, motors, electronics and more — no minimum order,
            GST invoice, shipped across India.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 24, color: MUTED }}>
          <div style={{ display: "flex", border: `2px solid ${INK}`, padding: "8px 16px", color: INK }}>
            onlyparts.in
          </div>
          <div style={{ display: "flex" }}>Can&apos;t buy it? We&apos;ll make it.</div>
        </div>
      </div>
    ),
    size,
  );
}
