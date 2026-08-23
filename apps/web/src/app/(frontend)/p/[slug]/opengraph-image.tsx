import { ImageResponse } from "next/og";
import { dbFindSku } from "@/lib/catalogDb";
import { inr } from "@/lib/catalog";
import { stockState } from "@/components/catalog/ProductTile";

/**
 * A product's own card.
 *
 * The site-wide card at the `(frontend)` root is the right answer for a page
 * about the shop; it is the wrong one for a link to a specific part, which is
 * the only kind of link anybody actually pastes into a group chat. This one
 * carries the three things a buyer decides on — what it is, what it costs, and
 * whether it is in stock — so the preview answers the question before the tap.
 *
 * `dbFindSku` is the same cached read the page itself does, and it is what
 * decides the 404: an unknown slug falls back to the shop card rather than
 * rendering a frame around nothing.
 *
 * Same constraints as the root card: Satori's bundled font, flexbox only.
 */

export const alt = "Part detail";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#F7F5F1";
const INK = "#1C1813";
const MUTED = "#6E6656";
const LINE = "#E2DDD3";
const SPOT = "#3B8736";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sku = await dbFindSku(slug);

  const title = sku?.title ?? "OnlyParts";
  const code = sku?.sku ?? "";
  const price = sku ? `${inr(sku.price)}/pc` : "";
  // The same three states the tile and the page show. A preview reading
  // "In stock" over a shelf of one is the kind of small lie a buyer notices
  // on arrival.
  const stock = sku ? stockState(sku.stock).label : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", background: PAPER, color: INK,
          padding: 72, position: "relative",
        }}
      >
        <div style={{ position: "absolute", left: 40, top: 40, width: 44, height: 44, borderLeft: `3px solid ${SPOT}`, borderTop: `3px solid ${SPOT}`, display: "flex" }} />
        <div style={{ position: "absolute", right: 40, bottom: 40, width: 44, height: 44, borderRight: `3px solid ${SPOT}`, borderBottom: `3px solid ${SPOT}`, display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, letterSpacing: 6, color: MUTED }}>
          ONLYPARTS
          <div style={{ display: "flex", flex: 1, height: 1, background: LINE }} />
          {code ? <div style={{ display: "flex", fontSize: 24, letterSpacing: 2 }}>⌗ {code}</div> : null}
        </div>

        {/*
          Four lines of a long fastener title is still readable at preview size;
          six is a grey block. `lineClamp` is one of the few Satori extensions
          worth using — the alternative is truncating on character count, which
          cuts mid-word.
        */}
        <div style={{
          display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.15,
          maxWidth: 1000, lineClamp: 4,
        }}>
          {title}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 30 }}>
          {price ? (
            <div style={{ display: "flex", background: SPOT, color: PAPER, padding: "12px 22px", fontWeight: 700 }}>
              {price}
            </div>
          ) : null}
          {stock ? (
            <div style={{ display: "flex", border: `2px solid ${LINE}`, padding: "10px 20px", color: MUTED }}>
              {stock}
            </div>
          ) : null}
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", fontSize: 24, color: MUTED }}>
            No minimum order · GST invoice
          </div>
        </div>
      </div>
    ),
    size,
  );
}
