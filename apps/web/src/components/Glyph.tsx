import type { GlyphKey } from "@/lib/types";

/** Line-art category marks. One per L1, drawn on the same 24px grid, 1.5px stroke. */
const PATHS: Record<GlyphKey, React.ReactNode> = {
  hex: (<>
    <path d="M12 2 21 7v10l-9 5-9-5V7z" /><path d="M12 7.5 16 10v4l-4 2.5L8 14v-4z" />
  </>),
  rotor: (<>
    <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" />
    <path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
  </>),
  chip: (<>
    <rect x="7" y="7" width="10" height="10" rx="1" />
    <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
  </>),
  cell: (<>
    <rect x="4" y="7" width="15" height="10" rx="2" /><path d="M19 10.5h2v3h-2" />
    <path d="M7.5 10v4M10.5 10v4M13.5 10v4" />
  </>),
  nozzle: (<>
    <path d="M8 3h8v7l-4 5-4-5z" /><path d="M11 15h2v4h-2z" /><path d="M10 21h4" />
  </>),
  prop: (<>
    <circle cx="12" cy="12" r="2" />
    <path d="M12 10c0-5 6-7 6-3s-4 3-6 3M12 14c0 5-6 7-6 3s4-3 6-3M10 12c-5 0-7-6-3-6s3 4 3 6M14 12c5 0 7 6 3 6s-3-4-3-6" />
  </>),
  wrench: (<>
    <path d="M15 3a5 5 0 0 0-4.6 7L3 17.4 6.6 21 14 13.6A5 5 0 1 0 15 3z" />
    <circle cx="15.5" cy="7.5" r="1.6" />
  </>),
  bearing: (<>
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="4.6" r="1.4" /><circle cx="12" cy="19.4" r="1.4" />
    <circle cx="4.6" cy="12" r="1.4" /><circle cx="19.4" cy="12" r="1.4" />
    <circle cx="6.8" cy="6.8" r="1.2" /><circle cx="17.2" cy="17.2" r="1.2" />
  </>),
  magnet: (<>
    <path d="M6 4v9a6 6 0 0 0 12 0V4" /><path d="M6 9h4M14 9h4" /><path d="M6 4h4M14 4h4" />
  </>),
  endmill: (<>
    <path d="M9 2h6v9l-3 11-3-11z" /><path d="M9 11h6M9.6 15h4.8M10.4 19h3.2" />
  </>),
  contactor: (<>
    <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9v6M16 9v6M8 12h4l4-3" />
  </>),
  hub: (<>
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" />
    <path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" />
  </>),
  extrusion: (<>
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <path d="M3 9h6V3M21 9h-6V3M3 15h6v6M21 15h-6v6" /><circle cx="12" cy="12" r="2" />
  </>),
};

export function Glyph({
  name, className = "", strokeWidth = 1.5,
}: { name: GlyphKey; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
