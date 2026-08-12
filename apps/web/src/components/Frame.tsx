import Image from "next/image";
import { Halftone } from "./Halftone";
import { plateFor, plateParam } from "@/lib/plates";
import type { GlyphKey } from "@/lib/types";

/**
 * Ratio-locked image slot.
 *
 * Drop a real file in /public and pass `src`; until then the slot prints the
 * part as a halftone plate. That is not a placeholder standing in for a
 * photograph — imagery on this site is processed by rule, so when the real
 * photography lands it gets screened too and the slot keeps its character.
 *
 * The old fill was a tinted grid with a line-art glyph floating in it, which
 * made every tile in a grid of 48 look identical from two feet away.
 */
type Ratio = "1/1" | "4/3" | "3/2" | "16/9" | "21/9";

const RATIO: Record<Ratio, string> = {
  "1/1": "aspect-square",
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "16/9": "aspect-video",
  "21/9": "aspect-[21/9]",
};

export function Frame({
  src,
  alt = "",
  glyph,
  ratio = "1/1",
  tone = "tint",
  label,
  className = "",
  cell = 5,
  part,
  priority = false,
  sizes = "(max-width: 768px) 50vw, 25vw",
  children,
}: {
  src?: string;
  alt?: string;
  glyph?: GlyphKey;
  ratio?: Ratio;
  /** the SKU behind this slot, so the plate can take its real proportions */
  part?: { sku: string; attrs: Record<string, unknown> };
  /** tint = the oxide plate prints too · neutral = single black plate */
  tone?: "tint" | "neutral";
  /** small mono caption pinned to the bottom of the plate */
  label?: string;
  className?: string;
  /** dot pitch — smaller for small slots, so the part stays identifiable */
  cell?: number;
  priority?: boolean;
  sizes?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden bg-bg ${RATIO[ratio]} ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.03]"
        />
      ) : (
        <>
          <Halftone
            plate={plateFor(glyph, part?.attrs ?? {})}
            param={part ? plateParam(part.attrs, part.sku) : 0.5}
            cell={cell}
            duotone={tone === "tint"}
            className="absolute inset-0"
          />
          {label && (
            <span className="bin absolute inset-x-0 bottom-1.5 text-center">{label}</span>
          )}
        </>
      )}
      {children}
    </div>
  );
}
