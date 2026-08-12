import { defineConfig, devices } from "@playwright/test";

/**
 * Browser automation, for the checks that cannot be made any other way.
 *
 * This project got a long way without it, and paid for that: `globals.css`
 * carried a note demanding that any third attempt at the grid reveal be
 * *measured* — `getComputedTiming().progress`, the computed opacity of a
 * genuinely below-fold tile — and there was nothing here that could measure it.
 * Two design decisions sat blocked on a question no amount of reading could
 * answer.
 *
 * Chromium only. The catalogue is not a cross-browser problem yet and three
 * browser downloads is 400MB of nothing.
 *
 * `reuseExistingServer` is on: the dev server is usually already running while
 * anyone is working, and the alternative is a second one fighting for port 3000
 * and for the Postgres connection pool.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    /*
      Explicit, not inherited from the host, and it lives under
      `contextOptions` rather than beside `baseURL` — the flat spelling is what
      the docs show for emulation options but the config type only accepts it
      here.

      It matters because `Reveal.arm()` returns early under
      `prefers-reduced-motion: reduce` and never sets `data-reveal-ready`. A
      machine that happens to prefer reduced motion would make every reveal
      assertion below pass for entirely the wrong reason.
    */
    contextOptions: { reducedMotion: "no-preference" },
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
