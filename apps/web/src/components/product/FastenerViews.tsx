import type { Fastener } from "@/lib/fastenerStd";

/**
 * Two orthographic views of a standard screw: the head from above, the part
 * from the side.
 *
 * This replaces the envelope rectangle for the fraction of the catalogue whose
 * geometry is actually known — 1,228 of 3,355 categorised fastener rows in the
 * current harvest. The rectangle was honest but uninformative: it said "a part
 * this long and this wide" for a countersunk screw and a cheese head alike,
 * when the difference between those two is the entire reason a buyer is
 * looking at the drawing.
 *
 * Unlike the envelope, this **is** drawn to proportion. One scale factor is
 * derived from the real figures and applied to both views, so an M3 × 60 draws
 * long and thin and an M8 × 6 draws stubby, and the two look like what they
 * are. The parent sheet's "NOT TO SCALE" therefore does not apply here and is
 * replaced — see `SpecDrawing`'s footer. The drive recess is the one thing not
 * to proportion: slot width and socket size are tabulated per standard and
 * this file does not hold those tables, so the recess is drawn indicatively
 * and never dimensioned. Nothing on the sheet points a figure at it.
 */

const SLANT_MIN_PX = 9;

/** The side profile of the head, left face outward, bearing face at `xh1`. */
function headPath(f: Fastener, xh0: number, hh: number, hd: number, td: number, cy: number): string {
  const xh1 = xh0 + hh;
  const top = cy - hd / 2;
  const bot = cy + hd / 2;

  switch (f.head) {
    case "csk":
      // A cone: full head diameter at the outer face, shank diameter at the
      // bearing face. The 90° included angle is a consequence of the ISO
      // dk/k ratio, so drawing the two figures to scale draws the angle too.
      return `M ${xh0} ${top} L ${xh1} ${cy - td / 2} L ${xh1} ${cy + td / 2} L ${xh0} ${bot} Z`;

    case "button":
      // Low dome over a flat, wide bearing face.
      return (
        `M ${xh1} ${top} Q ${xh0} ${top} ${xh0} ${cy - hd * 0.18} ` +
        `L ${xh0} ${cy + hd * 0.18} Q ${xh0} ${bot} ${xh1} ${bot} Z`
      );

    case "pan":
      // Cylindrical for most of the height, rounded over at the outer face.
      return (
        `M ${xh1} ${top} L ${xh0 + hh * 0.55} ${top} Q ${xh0} ${top} ${xh0} ${cy - hd * 0.3} ` +
        `L ${xh0} ${cy + hd * 0.3} Q ${xh0} ${bot} ${xh0 + hh * 0.55} ${bot} L ${xh1} ${bot} Z`
      );

    case "cheese": {
      // A cylinder with the small edge radius ISO 1207 gives it.
      const r = Math.min(hd * 0.12, hh * 0.5);
      return (
        `M ${xh1} ${top} L ${xh0 + r} ${top} Q ${xh0} ${top} ${xh0} ${top + r} ` +
        `L ${xh0} ${bot - r} Q ${xh0} ${bot} ${xh0 + r} ${bot} L ${xh1} ${bot} Z`
      );
    }

    case "socket":
    default:
      return `M ${xh1} ${top} L ${xh0} ${top} L ${xh0} ${bot} L ${xh1} ${bot} Z`;
  }
}

/** The drive recess as seen from above. Indicative, never dimensioned. */
function drivePath(f: Fastener, cx: number, cy: number, r: number): string {
  if (f.drive === "hex") {
    // Across-flats is √3 × circumradius; the socket runs a little over half
    // the head on every standard here, which is close enough to read as one.
    const R = (r * 1.1) / Math.sqrt(3);
    return (
      [0, 1, 2, 3, 4, 5]
        .map((i) => {
          const a = (Math.PI / 3) * i + Math.PI / 6;
          return `${i === 0 ? "M" : "L"} ${(cx + R * Math.cos(a)).toFixed(2)} ${(cy + R * Math.sin(a)).toFixed(2)}`;
        })
        .join(" ") + " Z"
    );
  }

  const w = Math.max(1.4, r * 0.3);
  // A slot runs the full diameter; a cross recess stops short of the edge.
  const arm = f.drive === "slotted" ? r : r * 0.66;
  const across = `M ${cx - arm} ${cy - w / 2} H ${cx + arm} V ${cy + w / 2} H ${cx - arm} Z`;
  if (f.drive === "slotted") return across;
  return `${across} M ${cx - w / 2} ${cy - arm} H ${cx + w / 2} V ${cy + arm} H ${cx - w / 2} Z`;
}

export function FastenerViews({
  f,
  top,
  bottom,
  tone,
}: {
  f: Fastener;
  /** Body fill from the stated finish, or null when none was stated. */
  tone?: string | null;
  /** Top of the band the drawing may use. */
  top: number;
  /** Bottom of that band. */
  bottom: number;
}) {
  const CX = 160;
  const MAX_W = 150;

  const bandH = bottom - top;
  // The end view takes a third; the elevation is the drawing people read.
  const tvH = Math.min(bandH * 0.34, 72);
  const elevH = bandH - tvH;

  // Head is inside the length for a countersunk screw and outside it otherwise,
  // which is what `headInLength` records. Getting this backwards draws an M6×20
  // csk 3.7 mm too long, and the length dimension would then contradict itself.
  const totalLen = f.headInLength ? f.length : f.length + f.headHeight;

  const scale = Math.min(
    MAX_W / totalLen,
    (elevH * 0.5) / f.headDia,
    (tvH * 0.82) / f.headDia,
  );

  const hd = f.headDia * scale;
  const hh = f.headHeight * scale;
  const td = f.threadDia * scale;

  const w = totalLen * scale;
  const x0 = CX - w / 2;
  const xh1 = x0 + hh;
  const cy = top + tvH + elevH / 2;
  const tvCy = top + tvH / 2;
  const r = hd / 2;

  // Where the shank runs, and where the length dimension spans.
  const xs0 = xh1;
  const xs1 = x0 + w;
  const lenFrom = f.headInLength ? x0 : xh1;

  const ink = "var(--color-ink-700)";
  const hair = "var(--color-ink-400)";
  const dim = "var(--color-spot-600)";
  const label = "var(--color-spot-700)";

  const minor = td * 0.41;
  const slant = td > SLANT_MIN_PX;
  const pitchPx = Math.max(3.2, td * 0.5);
  const crests: number[] = [];
  if (slant) for (let x = xs0 + pitchPx; x < xs1 - 1; x += pitchPx) crests.push(x);

  const fig = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

  return (
    <g>
      {/* centre lines — dash-dot, the convention that makes this read as a drawing */}
      <g stroke={hair} strokeWidth={0.5} strokeDasharray="7 2 1.5 2">
        <line x1={CX} y1={tvCy - r - 8} x2={CX} y2={tvCy + r + 8} />
        <line x1={x0 - 10} y1={cy} x2={xs1 + 10} y2={cy} />
      </g>

      {/* ---------- end view ---------- */}
      <circle cx={CX} cy={tvCy} r={r} fill={tone ?? "none"} stroke={ink} strokeWidth={1.1} />
      <path d={drivePath(f, CX, tvCy, r)} fill="var(--color-ink-200)" stroke={ink} strokeWidth={0.7} />

      {/* ---------- side elevation ---------- */}
      <path d={headPath(f, x0, hh, hd, td, cy)} fill={tone ?? "none"} stroke={ink} strokeWidth={1.25} />

      {/* shank at major diameter, with the minor-diameter pair that denotes a thread */}
      <path
        d={`M ${xs0} ${cy - td / 2} H ${xs1 - td * 0.22} L ${xs1} ${cy - td * 0.3} L ${xs1} ${cy + td * 0.3} L ${xs1 - td * 0.22} ${cy + td / 2} H ${xs0} Z`}
        fill={tone ?? "none"}
        stroke={ink}
        strokeWidth={1.25}
      />
      <g stroke={hair} strokeWidth={0.6}>
        <line x1={xs0} y1={cy - minor} x2={xs1 - td * 0.22} y2={cy - minor} />
        <line x1={xs0} y1={cy + minor} x2={xs1 - td * 0.22} y2={cy + minor} />
        {crests.map((x) => (
          <line key={x} x1={x} y1={cy - td / 2} x2={x - pitchPx * 0.6} y2={cy + td / 2} />
        ))}
      </g>

      {/* ---------- dimensions ---------- */}
      {/* head diameter, vertical, left of the head — from the standard */}
      <g stroke={dim} strokeWidth={0.75}>
        <line x1={x0 - 4} y1={cy - hd / 2} x2={x0 - 22} y2={cy - hd / 2} />
        <line x1={x0 - 4} y1={cy + hd / 2} x2={x0 - 22} y2={cy + hd / 2} />
        <line x1={x0 - 18} y1={cy - hd / 2} x2={x0 - 18} y2={cy + hd / 2} />
        <path
          d={`M ${x0 - 18} ${cy - hd / 2} l -2.5 6 h5 z M ${x0 - 18} ${cy + hd / 2} l -2.5 -6 h5 z`}
          fill={dim}
          stroke="none"
        />
        <rect x={x0 - 25} y={cy - 11} width={14} height={22} fill="var(--color-surface)" stroke="none" />
        <text
          x={x0 - 18}
          y={cy}
          textAnchor="middle"
          transform={`rotate(-90 ${x0 - 18} ${cy - 4})`}
          className="font-mono"
          fontSize={10}
          fill={label}
          stroke="none"
        >
          {`⌀${fig(f.headDia)}`}
        </text>
      </g>

      {/* head height, horizontal, above the head — from the standard */}
      <g stroke={dim} strokeWidth={0.75}>
        <line x1={x0} y1={cy - hd / 2 - 4} x2={x0} y2={cy - hd / 2 - 20} />
        <line x1={xh1} y1={cy - hd / 2 - 4} x2={xh1} y2={cy - hd / 2 - 20} />
        <line x1={x0 - 7} y1={cy - hd / 2 - 16} x2={xh1 + 7} y2={cy - hd / 2 - 16} />
        <path
          d={`M ${x0} ${cy - hd / 2 - 16} l -6 -2.5 v5 z M ${xh1} ${cy - hd / 2 - 16} l 6 -2.5 v5 z`}
          fill={dim}
          stroke="none"
        />
        <text
          x={(x0 + xh1) / 2}
          y={cy - hd / 2 - 21}
          textAnchor="middle"
          className="font-mono"
          fontSize={9.5}
          fill={label}
          stroke="none"
        >
          {fig(f.headHeight)}
        </text>
      </g>

      {/* thread diameter, vertical, right of the shank — as listed */}
      <g stroke={dim} strokeWidth={0.75}>
        <line x1={xs1 + 4} y1={cy - td / 2} x2={xs1 + 22} y2={cy - td / 2} />
        <line x1={xs1 + 4} y1={cy + td / 2} x2={xs1 + 22} y2={cy + td / 2} />
        <line x1={xs1 + 18} y1={cy - td / 2 - 9} x2={xs1 + 18} y2={cy + td / 2 + 9} />
        <path
          d={`M ${xs1 + 18} ${cy - td / 2} l -2.5 -6 h5 z M ${xs1 + 18} ${cy + td / 2} l -2.5 6 h5 z`}
          fill={dim}
          stroke="none"
        />
        <rect x={xs1 + 11} y={cy - 13} width={14} height={26} fill="var(--color-surface)" stroke="none" />
        <text
          x={xs1 + 18}
          y={cy}
          textAnchor="middle"
          transform={`rotate(-90 ${xs1 + 18} ${cy - 4})`}
          className="font-mono"
          fontSize={10}
          fill={label}
          stroke="none"
        >
          {f.thread}
        </text>
      </g>

      {/* length, horizontal, below — as listed */}
      <g stroke={dim} strokeWidth={0.75}>
        <line x1={lenFrom} y1={cy + hd / 2 + 4} x2={lenFrom} y2={cy + hd / 2 + 24} />
        <line x1={xs1} y1={cy + hd / 2 + 4} x2={xs1} y2={cy + hd / 2 + 24} />
        <line x1={lenFrom} y1={cy + hd / 2 + 19} x2={xs1} y2={cy + hd / 2 + 19} />
        <path
          d={`M ${lenFrom} ${cy + hd / 2 + 19} l 6 -2.5 v5 z M ${xs1} ${cy + hd / 2 + 19} l -6 -2.5 v5 z`}
          fill={dim}
          stroke="none"
        />
        <rect
          x={(lenFrom + xs1) / 2 - 16}
          y={cy + hd / 2 + 12}
          width={32}
          height={14}
          fill="var(--color-surface)"
          stroke="none"
        />
        <text
          x={(lenFrom + xs1) / 2}
          y={cy + hd / 2 + 23}
          textAnchor="middle"
          className="font-mono"
          fontSize={11}
          fill={label}
          stroke="none"
        >
          {fig(f.length)}
        </text>
      </g>
    </g>
  );
}
