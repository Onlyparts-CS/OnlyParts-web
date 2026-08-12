import { test, expect } from "@playwright/test";

/**
 * The scroll reveal, measured.
 *
 * `globals.css` records two failed attempts at revealing the product grid and
 * demands the third be measured rather than assumed. This is that measurement,
 * kept as a test so it stays true.
 *
 * The assertion that matters most is the last one. A reveal effect's worst
 * failure is not looking wrong — it is a blank page when the JavaScript does
 * not run, and this project shipped exactly that for months because the CSS
 * said `.reveal { opacity: 0 }` with no gate while a comment three lines above
 * claimed there was one.
 */

const GRID = "/c/fasteners/screws-by-head/socket-head-cap";
const TILE = 'a[href^="/p/"]';

test.describe("scroll reveal", () => {
  test("arms itself, and reveals below-fold tiles on scroll", async ({ page }) => {
    await page.goto(GRID, { waitUntil: "networkidle" });
    await expect(page.locator(TILE).first()).toBeVisible();

    // The gate. Without this attribute on <html> nothing is ever hidden.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.hasAttribute("data-reveal-ready")))
      .toBe(true);

    const before = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('a[href^="/p/"]')];
      const opacityOf = (el: Element | undefined) =>
        el ? Number(getComputedStyle(el.closest(".reveal") ?? el).opacity) : null;

      // On a narrow viewport the header and facet rail can push every tile
      // below the fold, so "above" is legitimately empty and the flash
      // assertion simply does not apply there.
      const above = tiles.find((t) => t.getBoundingClientRect().top < window.innerHeight * 0.9);
      const below = tiles.filter((t) => t.getBoundingClientRect().top > window.innerHeight);
      const sample = below[Math.floor(below.length / 2)];
      /*
        Grouped by row, not measured across the whole grid. Rows legitimately
        differ from each other — a two-column phone wraps titles to different
        line counts — but every tile *within* one row must share its height, or
        the wrapper has failed to stretch and short cards float off the rule.
      */
      const rows = new Map<number, Set<number>>();
      for (const t of tiles.slice(0, 20)) {
        const r = t.getBoundingClientRect();
        const top = Math.round(r.top);
        (rows.get(top) ?? rows.set(top, new Set()).get(top)!).add(Math.round(r.height));
      }
      const raggedRows = [...rows.values()].filter((h) => h.size > 1).length;

      return {
        tiles: tiles.length,
        raggedRows,
        aboveOpacity: opacityOf(above),
        belowOpacity: opacityOf(sample),
        sampleTop: sample ? Math.round(sample.getBoundingClientRect().top) : null,
      };
    });

    expect(before.tiles).toBeGreaterThan(20);
    // The `grid` wrapper must not break the row.
    expect(before.raggedRows).toBe(0);
    // "Above the fold is not a reveal" — it is there on first paint, no flash.
    if (before.aboveOpacity !== null) expect(before.aboveOpacity).toBe(1);
    /*
      Exactly 0, not merely low. A non-zero value here means the element is
      mid-transition on its way *to* hidden — which is what happens when the
      transition is declared on `.reveal` instead of on `.reveal.in`, and is
      how the first recorded attempt failed. This assertion is the guard
      against reintroducing it.
    */
    expect(before.belowOpacity).toBe(0);

    // Scroll to the sample rather than a fixed pixel: the page is twice as
    // tall on a phone and 4200px lands somewhere else entirely.
    await page.evaluate((y: number) => window.scrollTo(0, y - 200), before.sampleTop!);

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const inView = [...document.querySelectorAll(".reveal")].filter((w) => {
            const r = w.getBoundingClientRect();
            return r.top < window.innerHeight && r.bottom > 0;
          });
          return inView.length > 0 && inView.every((w) => getComputedStyle(w).opacity === "1");
        }),
      )
      .toBe(true);
  });

  test("without JavaScript, every tile is simply visible", async ({ browser }) => {
    /*
      The whole point. A reveal that fails closed leaves a blank catalogue, and
      "it works in my browser with JS on" is not evidence against that.
    */
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(GRID, { waitUntil: "domcontentloaded" });

    const state = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('a[href^="/p/"]')];
      return {
        tiles: tiles.length,
        armed: document.documentElement.hasAttribute("data-reveal-ready"),
        opacities: [...new Set(tiles.map((t) => getComputedStyle(t.closest(".reveal") ?? t).opacity))],
      };
    });

    expect(state.tiles).toBeGreaterThan(20);
    expect(state.armed).toBe(false);
    expect(state.opacities).toEqual(["1"]);
    await ctx.close();
  });
});

test("the storefront chrome stays out of the console", async ({ page }) => {
  /*
    `/admin` used to live under the storefront layout and hide the chrome with a
    client-side path check, which shipped the whole shop's JavaScript in order
    to render none of it. It has its own route group now; this catches a
    regression that would be invisible on screen.
  */
  // Generous: this route is often compiled cold and Payload pulls its schema
  // on the first request, which has been measured at over 30 seconds.
  test.slow();
  await page.goto("/admin", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.locator("header").filter({ hasText: "MAKE" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /wishlist/i })).toHaveCount(0);
});
