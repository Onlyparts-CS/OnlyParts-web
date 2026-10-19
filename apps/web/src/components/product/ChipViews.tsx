import type { ChipPart } from "@/lib/packageStd";

/**
 * Two orthographic views of a surface-mount chip component.
 *
 * The third sibling of `FastenerViews` and `PartViews`, under the same
 * contract: one scale from the real figures, applied to both views.
 *
 * A chip is drawn plan-and-elevation rather than as a single rectangle because
 * the two figures the code actually fixes — length and width — belong to
 * different views, and a lone rectangle would leave a reader guessing which
 * edge is which. The terminations are drawn because without them the plan is a
 * rectangle and could be anything; they are deliberately *not* dimensioned,
 * since band width varies by manufacturer and is no part of the size code.
 *
 * Height is drawn only when the listing gave one. An 0805 resistor is about
 * 0.45 mm and an 0805 MLCC can exceed 1.3 mm, both correctly called 0805 — so
 * where the listing is silent the elevation is a thin proportional slab with no
 * figure against it, which is a drawing that declines to say rather than one
 * that guesses.
 */

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
      <path
        d={`M${x1} ${y} l${tight ? -6 : 6} -2.5 v5 z M${x2} ${y} l${tight ? 6 : -6} -2.5 v5 z`}
        fill={colour}
        stroke="none"
      />
      <rect x={(x1 + x2) / 2 - 17} y={y - 7} width={34} height={14} fill={surface} stroke="none" />
      <text
        x={(x1 + x2) / 2}
        y={y + 4}
        textAnchor="middle"
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

function DimV({
  y1, y2, x, from, text, colour, surface,
}: { y1: number; y2: number; x: number; from: number; text: string; colour: string; surface: string }) {
  const tight = y2 - y1 < TIGHT_PX;
  const a = tight ? y1 - 9 : y1;
  const b = tight ? y2 + 9 : y2;
  return (
    <g stroke={colour} strokeWidth={0.75}>
      <line x1={from} y1={y1} x2={x} y2={y1} />
      <line x1={from} y1={y2} x2={x} y2={y2} />
      <line x1={x} y1={a} x2={x} y2={b} />
      <path
        d={`M${x} ${y1} l-2.5 ${tight ? -6 : 6} h5 z M${x} ${y2} l-2.5 ${tight ? 6 : -6} h5 z`}
        fill={colour}
        stroke="none"
      />
      <rect x={x - 7} y={(y1 + y2) / 2 - 17} width={14} height={34} fill={surface} stroke="none" />
      <text
        x={x}
        y={(y1 + y2) / 2}
        textAnchor="middle"
        transform={`rotate(-90 ${x} ${(y1 + y2) / 2})`}
        className="font-mono"
        fontSize={10}
        fill={colour}
        stroke="none"
        dy={3.5}
      >
        {text}
      </text>
    </g>
  );
}

const CX = 160;
const fig = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3))));

export function ChipViews({
  p, top, bottom, tone,
}: {
  p: ChipPart;
  top: number;
  bottom: number;
  /** Body fill from the stated finish, or null when none was stated. */
  tone?: string | null;
}) {
  const ink = "var(--color-ink-900)";
  const hair = "var(--color-ink-400)";
  const dim = "var(--color-spot-700)";
  const surface = "var(--color-surface)";

  const bandH = bottom - top;
  const planH = Math.min(bandH * 0.5, 100);
  const elevH = bandH - planH;

  /*
    Where no height was stated the elevation still has to be *some* thickness or
    there is nothing to draw. A fixed fraction of the width is used, and because
    no figure is printed against it the sheet makes no claim about it.
  */
  const drawnHeight = p.height ?? p.width * 0.4;

  const scale = Math.min(
    140 / p.length,
    (planH * 0.55) / p.width,
    (elevH * 0.30) / drawnHeight,
  );

  const l = p.length * scale;
  const w = p.width * scale;
  const th = drawnHeight * scale;
  // Terminations run about a sixth of the body length in from each end.
  const band = l / 6;

  /*
    The elevation hangs a fixed distance under the plan rather than being
    centred in its own half. A chip whose height is unknown draws as a sliver,
    and centring a sliver in 100 units of band opens a hole in the middle of the
    sheet that reads as a missing view.
  */
  const planCy = top + planH / 2;
  const elevCy = planCy + w / 2 + 34 + th / 2;
  const x0 = CX - l / 2;
  const x1 = CX + l / 2;

  return (
    <g>
      <g stroke={hair} strokeWidth={0.5} strokeDasharray="7 2 1.5 2">
        <line x1={CX} y1={planCy - w / 2 - 8} x2={CX} y2={elevCy + th / 2 + 8} />
      </g>

      {/* plan: body, with a termination at each end */}
      <rect x={x0} y={planCy - w / 2} width={l} height={w} fill={tone ?? "none"} stroke={ink} strokeWidth={1.25} />
      <g fill={hair} stroke={ink} strokeWidth={0.9} opacity={0.55}>
        <rect x={x0} y={planCy - w / 2} width={band} height={w} />
        <rect x={x1 - band} y={planCy - w / 2} width={band} height={w} />
      </g>

      {/* elevation, same length, terminations wrapping the ends */}
      <rect x={x0} y={elevCy - th / 2} width={l} height={th} fill={tone ?? "none"} stroke={ink} strokeWidth={1.25} />
      <g fill={hair} stroke={ink} strokeWidth={0.9} opacity={0.55}>
        <rect x={x0} y={elevCy - th / 2} width={band} height={th} />
        <rect x={x1 - band} y={elevCy - th / 2} width={band} height={th} />
      </g>

      <g stroke={hair} strokeWidth={0.45} strokeDasharray="2 2">
        <line x1={x0} y1={planCy + w / 2} x2={x0} y2={elevCy - th / 2} />
        <line x1={x1} y1={planCy + w / 2} x2={x1} y2={elevCy - th / 2} />
      </g>

      <DimV
        y1={planCy - w / 2} y2={planCy + w / 2} x={x0 - 22} from={x0 - 4}
        text={fig(p.width)} colour={dim} surface={surface}
      />
      <DimH
        x1={x0} x2={x1} y={elevCy + th / 2 + 24}
        text={fig(p.length)} colour={dim} surface={surface}
      />
      {/* only when the listing gave one — see the note at the top of this file */}
      {p.height !== null && (
        <DimV
          y1={elevCy - th / 2} y2={elevCy + th / 2} x={x1 + 22} from={x1 + 4}
          text={fig(p.height)} colour={dim} surface={surface}
        />
      )}
    </g>
  );
}
