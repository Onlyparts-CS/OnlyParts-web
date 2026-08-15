import { specDrawing } from "@/lib/specDrawing";

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
 * Proportions are not to scale and the sheet says so in the corner. We hold a
 * length and an outside diameter, never a profile, so an envelope drawn to the
 * real ratio would still be a rectangle pretending to be a part. The figures
 * are true; the shape is a frame to hang them on, and stating that is the
 * difference between a schematic and a lie.
 */
export function SpecDrawing({
  sku,
  attrs,
}: {
  sku: string;
  attrs: Record<string, unknown>;
}) {
  const model = specDrawing(attrs);
  if (model.empty) return null;

  const hasEnvelope = Boolean(model.along || model.across);
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
  const firstRow = FOOTER_Y - 20 - (rows.length - 1) * ROW_STEP;
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
        [
          // Spelled out with the unit: the sheet declares it once in the
          // footer, but a screen reader gets one string and cannot look down.
          model.along && `Length ${model.along} ${model.unit}.`,
          model.across && `Outside diameter ${model.across.replace("⌀", "")} ${model.unit}.`,
          ...rows.map((r) => `${r.label.toLowerCase()}: ${r.value}.`),
        ]
          .filter(Boolean)
          .join(" ") +
        " Not to scale."
      }
    >
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
      <text x={26} y={FOOTER_Y} className="font-mono" fontSize={8} fill="var(--color-ink-400)">
        {`NOT TO SCALE · DIMENSIONS IN ${model.unit.toUpperCase()} · AS PUBLISHED`}
      </text>
    </svg>
  );
}
