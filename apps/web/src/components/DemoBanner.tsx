import { DEMO_DATA } from "@/lib/demo";

/**
 * Visible whenever the demo catalogue is switched on, so nobody can mistake
 * generated data for real inventory — including us, six months from now.
 * Renders nothing in a production build.
 */
export function DemoBanner() {
  if (!DEMO_DATA) return null;

  /*
   * Shares the ink base with the announcement strip below it, so the top of the
   * page is one dark shelf rather than three stacked bands (amber, black, white)
   * inside 60px. Amber is carried by the text and the dot, which is louder on
   * near-black than a full amber fill was — and it stops the status palette
   * fighting the brand.
   *
   * `min-h` rather than a fixed height: at 390px this copy wraps to two lines,
   * and a fixed `h-7` let the second line render outside the fill, on white.
   */
  return (
    <div className="print-hide bg-ink-950 text-warning-bg">
      <div className="container-page flex min-h-7 items-center justify-center gap-2 py-1 text-center text-[0.6875rem] font-medium leading-snug">
        <span className="size-1.5 shrink-0 rounded-full bg-warning" />
        <span>
          Demo catalogue — products, prices and stock are generated.{" "}
          <span className="whitespace-nowrap">Not a live store.</span>
        </span>
      </div>
    </div>
  );
}
