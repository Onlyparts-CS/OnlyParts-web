import { Halftone } from "@/components/Halftone";
import { Rule } from "@/components/Rule";
import type { PlateKey } from "@/lib/plates";

/**
 * A dead end, in the cabinet's own vocabulary.
 *
 * The empty cart was always right — a monumental line, real copy, and somewhere
 * to go next. The checkout's "Nothing to check out" and the order page's "Order
 * not found" were a centred `h1` and a sentence, which is the layout every
 * framework ships as its 404 and belongs to no product in particular.
 *
 * They matter more than most screens, not less: a person reaching one has
 * already tried to do something and failed. The plate on the left is the point
 * — a drawer pulled open with nothing filed in it is a picture of the problem,
 * and it makes the moment feel authored rather than like an error page.
 */
export function DeadEnd({
  label,
  title,
  plate = "screw",
  children,
  actions,
  caption,
}: {
  /** The `.bin` line above the title — the coordinate, not a kicker. */
  label: string;
  title: React.ReactNode;
  plate?: PlateKey;
  children: React.ReactNode;
  actions: React.ReactNode;
  /** Marginalia along the bottom of the plate, e.g. the number that was tried. */
  caption?: string;
}) {
  return (
    <div className="container-page page-shell">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
        <div className="relative order-2 border border-line-strong bg-surface lg:order-1">
          {/*
            `duotone={false}` — a dead end is not a moment for the spot plate.
            The accent on this page belongs to the way out, and nothing else.
          */}
          <Halftone plate={plate} cell={7} duotone={false} className="aspect-square w-full" />
          <span className="bin absolute left-3 top-3">{label}</span>
          {caption && <span className="bin absolute bottom-3 left-3 max-w-[80%] truncate">{caption}</span>}
          <Rule axis="y" className="absolute inset-y-0 right-0 h-full opacity-60" />
        </div>

        <div className="order-1 min-w-0 lg:order-2">
          <h1 className="monumental text-[clamp(2rem,5.5vw,4rem)]">{title}</h1>
          <div className="mt-5 max-w-lg text-[1.0625rem] leading-relaxed text-muted">{children}</div>
          <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
        </div>
      </div>
    </div>
  );
}
