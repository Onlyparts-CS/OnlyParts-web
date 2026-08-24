import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { SpecDrawing } from "../src/components/product/SpecDrawing";

/**
 * Step 2 of 2: one dimensioned sheet per SKU, named for the SKU.
 *
 *   npx tsx scripts/draw-sheets.tsx        (after scripts/dump-drawable.ts)
 *
 * Within a family every part is the same shape, so one photograph serves the
 * lot and only the drawing changes per size. These are those drawings — the
 * same component the product page renders, put through `react-dom/server`
 * instead of the browser, so a sheet reviewed here is the sheet a customer
 * sees.
 */

/*
  The component paints with design tokens and one utility class, neither of
  which means anything to a file opened outside the app. Substituting literals
  keeps each sheet self-contained rather than silently black-on-black.
*/
const TOKENS: Record<string, string> = {
  "--color-ink-200": "#E2DDD3",
  "--color-ink-400": "#A39A88",
  "--color-ink-500": "#6E6656",
  "--color-ink-700": "#423C2E",
  "--color-ink-800": "#2E2921",
  "--color-ink-900": "#1C1813",
  "--color-line": "#E2DDD3",
  "--color-spot-600": "#3B8736",
  "--color-spot-700": "#2F682A",
  "--color-surface": "#FFFFFF",
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function standalone(markup: string): string {
  let svg = markup;
  for (const [name, hex] of Object.entries(TOKENS)) svg = svg.replaceAll(`var(${name})`, hex);
  // That class is positioning for the page's frame; on its own the sheet only
  // needs the surface colour it also carried.
  svg = svg.replace(' class="absolute inset-0 size-full bg-surface"', ' style="background:#FFFFFF"');
  svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="620" height="620" ');
  return svg.replace(">", `><style>.font-mono{font-family:${MONO}}</style>`);
}

type Row = {
  sku: string; title: string; attrs: Record<string, string | number>;
  categoryPath?: string; family: string; size: string; kind: string;
};

const OUT = path.resolve(import.meta.dirname, "../../../tools/drawings/out");
const rows: Row[] = JSON.parse(readFileSync(path.join(OUT, "drawable.json"), "utf8"));

const SHEETS = path.join(OUT, "sheets");
rmSync(SHEETS, { recursive: true, force: true });
mkdirSync(SHEETS, { recursive: true });

for (const r of rows) {
  const svg = standalone(
    renderToStaticMarkup(
      <SpecDrawing sku={r.sku} attrs={r.attrs} title={r.title} categoryPath={r.categoryPath} />,
    ),
  );
  // The SKU is the filename, so a sheet is findable from an order line.
  writeFileSync(path.join(SHEETS, `${r.sku}.svg`), svg);
}

console.log(`wrote ${rows.length} sheets to ${SHEETS}`);
