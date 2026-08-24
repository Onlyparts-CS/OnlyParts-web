import type { BlockPart, RoundPart } from "@/lib/partGeometry";

/**
 * Two orthographic views of a part that is round or rectangular: a bearing, a
 * disc or ring magnet, a block magnet.
 *
 * The sibling of `FastenerViews`, and the same contract — one scale derived
 * from the real figures, applied to both views, so a 608 draws as a squat ring
 * and an LM8UU draws as a long sleeve. Drawn to proportion, and the footer says
 * so rather than the envelope's "NOT TO SCALE".
 *
 * A bearing and a ring magnet are deliberately the same drawing. Both are an
 * outside diameter, a bore and a width, and the only honest difference between
 * their sheets is the numbers and the label — inventing a distinct bearing
 * rendering (rolling elements, a cage) would be drawing detail we have no
 * figures for, on a sheet whose whole claim is that its figures are real.
 */

/** Arrows go outside the extension lines when the span cannot hold them. */
const TIGHT_PX = 26;

function DimH({
  x1, x2, y, text, colour, surface,
}: { x1: number; x2: number; y: number; text: string; colour: string; surface: string }) {
  const tight = x2 - x1 < TIGHT_PX;
  const a = tight ? x1 - 9 : x1;
  const b = tight ? x2 + 9 : x2;
  return (
    <g stroke={colour} strokeWidth={0.75}>
      <line x1={x1} y1={y - 15} x2={x1} y2={y + 5} />
      <line x1={x2} y1={y - 15} x2={x2} y2={y + 5} />
      <line x1={a} y1={y} x2={b} y2={y} />
      {/* Outside arrows point inward at the extension line, as on paper. */}
      <path
        d={
          tight
            ? `M ${x1} ${y} l -6 -2.5 v5 z M ${x2} ${y} l 6 -2.5 v5 z`
            : `M ${x1} ${y} l 6 -2.5 v5 z M ${x2} ${y} l -6 -2.5 v5 z`
        }
        fill={colour}
        stroke="none"
      />
      <rect x={(x1 + x2) / 2 - 17} y={y - 7} width={34} height={13} fill={surface} stroke="none" />
      <text
        x={(x1 + x2) / 2}
        y={y + 3}
        textAnchor="middle"
        className="font-mono"
        fontSize={10.5}
        fill={colour}
        stroke="none"
      >
        {text}
      </text>
    </g>
  );
}

function DimV({
  y1, y2, x, text, colour, surface, from,
}: { y1: number; y2: number; x: number; text: string; colour: string; surface: string; from: number }) {
  const tight = y2 - y1 < TIGHT_PX;
  const a = tight ? y1 - 9 : y1;
  const b = tight ? y2 + 9 : y2;
  return (
    <g stroke={colour} strokeWidth={0.75}>
      <line x1={from} y1={y1} x2={x - 4} y2={y1} />
      <line x1={from} y1={y2} x2={x - 4} y2={y2} />
      <line x1={x} y1={a} x2={x} y2={b} />
      <path
        d={
          tight
            ? `M ${x} ${y1} l -2.5 -6 h5 z M ${x} ${y2} l -2.5 6 h5 z`
            : `M ${x} ${y1} l -2.5 6 h5 z M ${x} ${y2} l -2.5 -6 h5 z`
        }
        fill={colour}
        stroke="none"
      />
      <rect x={x - 7} y={(y1 + y2) / 2 - 15} width={14} height={30} fill={surface} stroke="none" />
      <text
        x={x}
        y={(y1 + y2) / 2}
        textAnchor="middle"
        transform={`rotate(-90 ${x} ${(y1 + y2) / 2 - 4})`}
        className="font-mono"
        fontSize={10}
        fill={colour}
        stroke="none"
      >
        {text}
      </text>
    </g>
  );
}

const fig = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

export function PartViews({
  p,
  top,
  bottom,
  tone,
}: {
  p: RoundPart | BlockPart;
  top: number;
  bottom: number;
  /** Body fill from the stated finish, or null when none was stated. */
  tone?: string | null;
}) {
  const CX = 160;
  const ink = "var(--color-ink-700)";
  const hair = "var(--color-ink-400)";
  const dim = "var(--color-spot-600)";
  const surface = "var(--color-surface)";

  const bandH = bottom - top;

  if (p.kind === "round") {
    /*
      The end view carries the shape here, so it takes the larger half — the
      reverse of the fastener sheet, where the elevation is what people read.
      A bearing seen edge-on is a rectangle; seen end-on it is recognisably a
      bearing.
    */
    const tvH = Math.min(bandH * 0.5, 108);
    const elevH = bandH - tvH;

    const scale = Math.min(110 / p.od, (tvH * 0.78) / p.od, (elevH * 0.42) / p.od, 90 / p.width);

    const od = p.od * scale;
    const bore = p.bore === null ? 0 : p.bore * scale;
    const w = p.width * scale;

    const tvCy = top + tvH / 2;
    const cy = top + tvH + elevH / 2 - 4;
    const x0 = CX - w / 2;
    const x1 = CX + w / 2;

    return (
      <g>
        <g stroke={hair} strokeWidth={0.5} strokeDasharray="7 2 1.5 2">
          <line x1={CX} y1={tvCy - od / 2 - 8} x2={CX} y2={tvCy + od / 2 + 8} />
          <line x1={CX - od / 2 - 8} y1={tvCy} x2={CX + od / 2 + 8} y2={tvCy} />
          <line x1={x0 - 12} y1={cy} x2={x1 + 12} y2={cy} />
        </g>

        {/* end view: outside circle, and the bore when there is one */}
        <circle cx={CX} cy={tvCy} r={od / 2} fill={tone ?? "none"} stroke={ink} strokeWidth={1.25} />
        {p.bore !== null && (
          <circle cx={CX} cy={tvCy} r={bore / 2} fill={surface} stroke={ink} strokeWidth={1.1} />
        )}

        {/* side elevation: the width, with the bore shown through it */}
        <rect x={x0} y={cy - od / 2} width={w} height={od} fill={tone ?? "none"} stroke={ink} strokeWidth={1.25} />
        {p.bore !== null && (
          <g stroke={ink} strokeWidth={0.8}>
            <line x1={x0} y1={cy - bore / 2} x2={x1} y2={cy - bore / 2} />
            <line x1={x0} y1={cy + bore / 2} x2={x1} y2={cy + bore / 2} />
          </g>
        )}

        {/*
          All three dimensions sit on the elevation, including the bore.

          The bore was first dimensioned against the end view, where it looked
          right and measured nothing: the extension lines have to clear the
          outside circle to reach a dimension line, so they started outside the
          part and pointed at empty paper. On the elevation the bore is two
          real lines through the rectangle and the extension lines land on them.
          The end view then carries no figures at all, which is fine — it is
          there to say "this is a ring", and the ring is not in doubt.
        */}
        <DimV y1={cy - od / 2} y2={cy + od / 2} x={x0 - 22} from={x0 - 4} text={`⌀${fig(p.od)}`} colour={dim} surface={surface} />
        {p.bore !== null && (
          <DimV
            y1={cy - bore / 2}
            y2={cy + bore / 2}
            x={x1 + 22}
            from={x1 + 4}
            text={`⌀${fig(p.bore)}`}
            colour={dim}
            surface={surface}
          />
        )}
        <DimH x1={x0} x2={x1} y={cy + od / 2 + 22} text={fig(p.width)} colour={dim} surface={surface} />
      </g>
    );
  }

  /*
    A block gets a plan and a front elevation on one vertical centre line, which
    is the arrangement that lets length be dimensioned once and read against
    both. Breadth belongs to the plan, thickness to the elevation.
  */
  const planH = Math.min(bandH * 0.46, 96);
  const elevH = bandH - planH;
  const scale = Math.min(
    130 / p.length,
    (planH * 0.62) / p.breadth,
    (elevH * 0.42) / p.thickness,
  );

  const l = p.length * scale;
  const b = p.breadth * scale;
  const th = p.thickness * scale;

  const planCy = top + planH / 2;
  const elevCy = top + planH + elevH / 2 - 6;
  const x0 = CX - l / 2;
  const x1 = CX + l / 2;

  return (
    <g>
      <g stroke={hair} strokeWidth={0.5} strokeDasharray="7 2 1.5 2">
        <line x1={CX} y1={planCy - b / 2 - 8} x2={CX} y2={elevCy + th / 2 + 8} />
      </g>

      <rect x={x0} y={planCy - b / 2} width={l} height={b} fill={tone ?? "none"} stroke={ink} strokeWidth={1.25} />
      <rect x={x0} y={elevCy - th / 2} width={l} height={th} fill={tone ?? "none"} stroke={ink} strokeWidth={1.25} />

      {/* the two views line up, so the projection lines are worth drawing */}
      <g stroke={hair} strokeWidth={0.45} strokeDasharray="2 2">
        <line x1={x0} y1={planCy + b / 2} x2={x0} y2={elevCy - th / 2} />
        <line x1={x1} y1={planCy + b / 2} x2={x1} y2={elevCy - th / 2} />
      </g>

      <DimV y1={planCy - b / 2} y2={planCy + b / 2} x={x0 - 22} from={x0 - 4} text={fig(p.breadth)} colour={dim} surface={surface} />
      <DimV y1={elevCy - th / 2} y2={elevCy + th / 2} x={x1 + 22} from={x1 + 4} text={fig(p.thickness)} colour={dim} surface={surface} />
      <DimH x1={x0} x2={x1} y={elevCy + th / 2 + 22} text={fig(p.length)} colour={dim} surface={surface} />
    </g>
  );
}
