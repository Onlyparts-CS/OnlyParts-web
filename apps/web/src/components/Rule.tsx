"use client";

import { useId } from "react";

/* ============================================================
   The millimetre rule.
   ------------------------------------------------------------
   Drawn as an SVG tick scale, not as a CSS background.

   It used to be two stacked `repeating-linear-gradient` layers,
   which is indistinguishable — to a reader or to a detector —
   from the decorative hairline grid that generated interfaces
   put behind everything. It got flagged as exactly that, and the
   fix at the time was to delete the ticks and leave a 1px line,
   which threw away a real element of this world.

   An SVG `<pattern>` of tick marks is unambiguous: it is a
   measurement graphic, it is the actual subject of the element
   rather than a texture behind one, and the pitch stays a true
   fixed 8px at any width because the pattern is in user-space
   units rather than a stretched viewBox.
   ============================================================ */

const MINOR = 8;   // px between ticks
const MAJOR = 5;   // every fifth tick runs full height

export function Rule({
  axis = "x",
  className = "",
}: {
  axis?: "x" | "y";
  className?: string;
}) {
  // Two rules on one page must not share a pattern id, or the second
  // silently paints with the first's geometry.
  const uid = useId().replace(/:/g, "");
  const minor = `mn${uid}`;
  const major = `mj${uid}`;
  const vertical = axis === "y";

  return (
    <svg
      aria-hidden
      focusable="false"
      className={className}
      // 9px thick, indefinite along its own axis — the parent decides length.
      style={vertical ? { width: 9 } : { height: 9 }}
      preserveAspectRatio="none"
    >
      <defs>
        <pattern
          id={minor}
          width={vertical ? 9 : MINOR}
          height={vertical ? MINOR : 9}
          patternUnits="userSpaceOnUse"
        >
          {/* short tick, hanging from the measuring edge */}
          <rect
            x={vertical ? 6 : 0}
            y={vertical ? 0 : 6}
            width={vertical ? 3 : 1}
            height={vertical ? 1 : 3}
            fill="var(--color-ink-300)"
          />
        </pattern>
        <pattern
          id={major}
          width={vertical ? 9 : MINOR * MAJOR}
          height={vertical ? MINOR * MAJOR : 9}
          patternUnits="userSpaceOnUse"
        >
          <rect
            x={vertical ? 0 : 0}
            y={0}
            width={vertical ? 9 : 1}
            height={vertical ? 1 : 9}
            fill="var(--color-ink-400)"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${minor})`} />
      <rect width="100%" height="100%" fill={`url(#${major})`} />
    </svg>
  );
}
