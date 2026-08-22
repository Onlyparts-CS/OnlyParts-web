import { specDrawing } from "@/lib/specDrawing";
import { FastenerViews } from "./FastenerViews";
import { PartViews } from "./PartViews";

/**
 * The `drawing` slot, actually drawn.
 *
 * SVG rather than a halftone plate, and deliberately not screened: the whole
 * point of this slot is the numbers, and a 4 pt dimension figure put through a
 * dot screen is a smudge. Everything else on the site is processed imagery;
 * this is a document, and documents stay sharp.
 *
 * It is also the only picture in the gallery we own outright. A generated sheet
 * has no photographer, no watermark and nobody to ask — `media.licence` has an
 * `owned` value and this is the one thing that can honestly claim it without a
 * shoot.
 *
 * Two sheets, depending on how much we know.
 *
 * The **envelope** is the general case: a length and an outside diameter and
 * nothing about shape, so the drawing is a rectangle and the corner says NOT
 * TO SCALE. The figures are true; the shape is a frame to hang them on, and
 * stating that is the difference between a schematic and a lie.
 *
 * The **fastener** sheet is drawn when `fastenerStd.ts` recognises a standard
 * screw in the title — 1,228 of 3,355 categorised fastener rows in the current
 * harvest. There the profile is real, both views share one derived scale, and
 * the corner says so instead. It also names the standard, because that sheet
 * mixes figures from this listing with figures from ISO, and a reader is owed
 * the difference.
 */
export function SpecDrawing({
  sku,
  attrs,
  title,
  categoryPath,
}: {
  sku: string;
  attrs: Record<string, unknown>;
  /** Read only to recognise a standard fastener; see `fastenerStd.ts`. */
  title?: string;
  /** Dotted materialised path, used to contradict the title, never to fill it. */
  categoryPath?: string;
}) {
  const model = specDrawing(attrs, title, categoryPath);
  if (model.empty) return null;

  const part = model.part;
  const bolt = part?.kind === "fastener" ? part : null;
  /*
    The footer follows provenance, not part type. A bearing given only as "608"
    took its figures from ISO 15 and must say so; the same bearing with its
    dimensions written out in the title did not, and must not. Magnets never do.
  */
  const standard = part?.standard ?? null;
  // A recognised part draws its own views; the envelope is the fallback for
  // everything else, which is still most of the catalogue.
  const hasEnvelope = !part && Boolean(model.along || model.across);
  // Seven fits without crowding; an eighth row costs the footer its air.
  const rows = model.rows.slice(0, 7);

  /*
    The title block is bottom-aligned and the drawing takes what is left.

    Fixing the block's top instead left a three-row part with a hand's width of
    nothing between its last row and the footer — the sheet read as though it
    had failed to finish loading. Growing upward from the footer means a part
    with three attributes and a part with seven both produce a full sheet.
  */
  const FOOTER_Y = 302;
  const ROW_STEP = 15;
  /*
    A fastener footer is two lines, and the block has to grow from the *top*
    one or it takes the air the single-line version was measured against. The
    first attempt anchored to FOOTER_Y regardless and put the last spec row
    6 units off the provenance line — close enough to read as one block, which
    is the specific confusion the provenance line exists to prevent.
  */
  const footerTop = standard ? FOOTER_Y - 9 : FOOTER_Y;
  const firstRow = footerTop - 20 - (rows.length - 1) * ROW_STEP;
  const skuY = firstRow - 22;
  const sepY = skuY - 16;
  // Whatever the block did not take, centred.
  const envY = Math.round((28 + sepY) / 2) - 34;

  const hair = "var(--color-ink-400)";
  const dim = "var(--color-spot-600)";

  return (
    <svg
      viewBox="0 0 320 320"
      className="absolute inset-0 size-full bg-surface"
      role="img"
      aria-label={
        `Dimensioned schematic for ${sku}. ` +
        (part
          ? [
              part.kind === "fastener"
                ? `${part.thread} by ${part.length} ${model.unit}, ${part.head} head, ${part.drive} drive. ` +
                  `Head diameter ${part.headDia} and head height ${part.headHeight} ${model.unit}.`
                : part.kind === "round"
                  ? `${part.label}. Outside diameter ${part.od} ${model.unit}` +
                    (part.bore === null ? "" : `, bore ${part.bore} ${model.unit}`) +
                    `, width ${part.width} ${model.unit}.`
                  : `${part.label}. ${part.length} by ${part.breadth} by ${part.thickness} ${model.unit}.`,
              // Provenance belongs in the spoken version too — the footer says
              // it in print and a screen reader never reaches the footer.
              standard ? `Some dimensions per ${standard}.` : "Dimensions as listed.",
              ...rows.map((r) => `${r.label.toLowerCase()}: ${r.value}.`),
            ].join(" ")
          : [
              // Spelled out with the unit: the sheet declares it once in the
              // footer, but a screen reader gets one string and cannot look down.
              model.along && `Length ${model.along} ${model.unit}.`,
              model.across && `Outside diameter ${model.across.replace("⌀", "")} ${model.unit}.`,
              ...rows.map((r) => `${r.label.toLowerCase()}: ${r.value}.`),
            ]
              .filter(Boolean)
              .join(" ") + " Not to scale.")
      }
    >
      {bolt && <FastenerViews f={bolt} top={30} bottom={sepY - 10} />}
      {part && part.kind !== "fastener" && <PartViews p={part} top={30} bottom={sepY - 10} />}

      {hasEnvelope && (
        <g>
          {/* the envelope — a frame for the figures, not a profile */}
          <rect x={92} y={envY} width={136} height={52} fill="none" stroke="var(--color-ink-700)" strokeWidth={1.25} />

          {model.along && (
            <g stroke={dim} strokeWidth={0.75}>
              {/* extension lines drop past the dimension line, as they do on paper */}
              <line x1={92} y1={envY + 56} x2={92} y2={envY + 82} />
              <line x1={228} y1={envY + 56} x2={228} y2={envY + 82} />
              <line x1={92} y1={envY + 76} x2={228} y2={envY + 76} />
              <path
                d={`M92 ${envY + 76} l6 -2.5 v5 z M228 ${envY + 76} l-6 -2.5 v5 z`}
                fill={dim}
                stroke="none"
              />
              <rect x={144} y={envY + 69} width={32} height={14} fill="var(--color-surface)" stroke="none" />
              <text
                x={160}
                y={envY + 80}
                textAnchor="middle"
                className="font-mono"
                fontSize={11}
                fill="var(--color-spot-700)"
                stroke="none"
              >
                {model.along}
              </text>
            </g>
          )}

          {model.across && (
            <g stroke={dim} strokeWidth={0.75}>
              <line x1={88} y1={envY} x2={62} y2={envY} />
              <line x1={88} y1={envY + 52} x2={62} y2={envY + 52} />
              <line x1={68} y1={envY} x2={68} y2={envY + 52} />
              <path
                d={`M68 ${envY} l-2.5 6 h5 z M68 ${envY + 52} l-2.5 -6 h5 z`}
                fill={dim}
                stroke="none"
              />
              <rect x={61} y={envY + 6} width={14} height={40} fill="var(--color-surface)" stroke="none" />
              <text
                x={68}
                y={envY + 30}
                textAnchor="middle"
                transform={`rotate(-90 68 ${envY + 26})`}
                className="font-mono"
                fontSize={11}
                fill="var(--color-spot-700)"
                stroke="none"
              >
                {model.across}
              </text>
            </g>
          )}
        </g>
      )}

      {/* title block */}
      <line x1={26} y1={sepY} x2={294} y2={sepY} stroke={hair} strokeWidth={0.75} />
      <text x={26} y={skuY} className="font-mono" fontSize={11} fill="var(--color-ink-900)">
        {sku}
      </text>

      {rows.map((r, i) => {
        const y = firstRow + i * ROW_STEP;
        return (
          <g key={r.label}>
            <text x={26} y={y} className="font-mono" fontSize={9} fill="var(--color-ink-500)">
              {r.label}
            </text>
            <text x={294} y={y} textAnchor="end" className="font-mono" fontSize={10} fill="var(--color-ink-800)">
              {r.value}
            </text>
            <line x1={26} y1={y + 4.5} x2={294} y2={y + 4.5} stroke="var(--color-line)" strokeWidth={0.5} />
          </g>
        );
      })}

      {/*
        One line, left-aligned. Two — a note at each end — read as one sentence
        at any row count that pushed them together, and "DIMENSIONS IN MM
        FIGURES AS PUBLISHED" is worse than either half alone.

        "As published" is the load-bearing half: these are the figures the
        manufacturer states, not dimensions anybody here measured.
      */}
      {standard ? (
        /*
          Two lines, because a fastener sheet mixes two authorities and hiding
          that would be the dishonest saving. The head figures are read out of
          the standard; the thread and length are read off this listing. A
          buyer who wants to know why our head diameter differs from a
          supplier's datasheet can see, on the sheet, that ours is the
          standard's and go argue with the supplier rather than with us.

          "TO PROPORTION" replaces the envelope's "NOT TO SCALE" and is true
          here: `FastenerViews` derives one scale from the real figures and
          applies it to both views. The drive recess is the exception and is
          named as such, because it is the one shape drawn without a table.
        */
        /*
          Both lines are budgeted at 53 characters. The sheet is 320 units wide
          with 26 of margin each side, and this face measures ~5 units per
          character at 7.5 — the first draft ran "AND" three times and lost the
          last word off the right edge, which on a provenance line is the worst
          possible word to drop. Hence the `+` signs.
        */
        <>
          <text x={26} y={footerTop} className="font-mono" fontSize={7.5} fill="var(--color-ink-500)">
            {bolt
              ? `HEAD ⌀+HEIGHT PER ${standard} · THREAD+LENGTH LISTED`
              : `BOUNDARY DIMENSIONS PER ${standard}`}
          </text>
          <text x={26} y={FOOTER_Y} className="font-mono" fontSize={7.5} fill="var(--color-ink-400)">
            {bolt
              ? `${model.unit.toUpperCase()} · ENVELOPE TO PROPORTION · RECESS INDICATIVE`
              : `${model.unit.toUpperCase()} · DRAWN TO PROPORTION`}
          </text>
        </>
      ) : (
        <text x={26} y={FOOTER_Y} className="font-mono" fontSize={8} fill="var(--color-ink-400)">
          {part
            ? `DRAWN TO PROPORTION · ${model.unit.toUpperCase()} · AS PUBLISHED`
            : `NOT TO SCALE · DIMENSIONS IN ${model.unit.toUpperCase()} · AS PUBLISHED`}
        </text>
      )}
    </svg>
  );
}
