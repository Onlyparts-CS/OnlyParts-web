/*
  Builds one page showing every generated sheet, grouped by family.

  The grouping is the argument, not decoration: a family is a set of parts that
  are the same shape at different sizes, which is exactly the set where one
  photograph and N drawings beats N photographs.
*/
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "out");
const rows = JSON.parse(readFileSync(path.join(OUT, "drawable.json"), "utf8"));
const have = new Set(readdirSync(path.join(OUT, "sheets")));

const byFamily = new Map();
for (const r of rows) {
  if (!have.has(`${r.sku}.svg`)) continue;
  if (!byFamily.has(r.family)) byFamily.set(r.family, []);
  byFamily.get(r.family).push(r);
}

const families = [...byFamily.entries()].sort((a, b) => b[1].length - a[1].length);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const sections = families.map(([family, items]) => {
  const sizes = new Set(items.map((i) => i.size)).size;
  const cards = items.map((i) => `
    <figure id="${esc(i.sku)}">
      <img src="sheets/${esc(i.sku)}.svg" alt="${esc(i.sku)}" loading="lazy">
      <figcaption><b>${esc(i.sku)}</b><span>${esc(i.size)}</span></figcaption>
    </figure>`).join("");
  return `
  <section>
    <h2>${esc(family)}</h2>
    <p class="meta">${items.length} SKUs · ${sizes} distinct sizes · one photograph would cover all of them</p>
    <div class="grid">${cards}</div>
  </section>`;
}).join("");

writeFileSync(path.join(OUT, "index.html"), `<!doctype html>
<meta charset="utf-8"><title>OnlyParts — generated sheets</title>
<style>
  :root { --ink:#1C1813; --mid:#6E6656; --line:#E2DDD3; --paper:#F7F5F1; }
  body { margin:0; padding:40px; background:var(--paper); color:var(--ink);
         font:15px/1.5 ui-sans-serif,system-ui,sans-serif; }
  h1 { font-size:26px; margin:0 0 4px; letter-spacing:-.01em; }
  .lede { color:var(--mid); margin:0 0 36px; max-width:64ch; }
  section { margin:0 0 48px; }
  h2 { font-size:15px; margin:0 0 2px; font-family:ui-monospace,monospace; }
  .meta { color:var(--mid); font-size:13px; margin:0 0 16px; }
  .grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fill,minmax(215px,1fr)); }
  figure { margin:0; background:#fff; border:1px solid var(--line); border-radius:3px; overflow:hidden; }
  img { display:block; width:100%; height:auto; }
  figcaption { display:flex; justify-content:space-between; gap:8px;
               padding:7px 10px; border-top:1px solid var(--line);
               font-family:ui-monospace,monospace; font-size:11px; }
  figcaption span { color:var(--mid); }
</style>
<h1>Generated sheets — ${rows.length} SKUs, ${families.length} families</h1>
<p class="lede">Every part inside a family is the same shape at a different size. That is the set
where one photograph plus a per-SKU drawing replaces a photograph per SKU. Each sheet is the
component the product page renders, saved as <code>&lt;SKU&gt;.svg</code>.</p>
${sections}
`);

console.log(`contact sheet: ${path.join(OUT, "index.html")}`);
for (const [f, items] of families) {
  console.log(`  ${String(items.length).padStart(4)}  ${f}`);
}
