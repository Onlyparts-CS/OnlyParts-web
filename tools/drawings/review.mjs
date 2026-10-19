/* One family, several sizes, big enough to read — the claim under test. */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "out");
const rows = JSON.parse(readFileSync(path.join(OUT, "drawable.json"), "utf8"));
const bySku = new Map(rows.map((r) => [r.sku, r]));

const PICKS = [
  ["One family, five sizes — only the drawing changes",
   ["FS-SHC-M4-006-SS304", "FS-SHC-M4-012-SS304", "FS-SHC-M4-020-SS304", "FS-SHC-M4-030-SS304", "FS-SHC-M4-050-SS304"]],
  ["One size, five head styles — the shape really is drawn, not templated",
   ["FS-SHC-M4-012-SS304", "FS-BTN-M4-012-SS304", "FS-CSK-M4-012-SS304", "FS-PAN-M4-012-SS304", "OS-CHM308"]],
  ["Bearings and magnets, same treatment",
   ["BR-6001-2RS-CS", "BR-6203-ZZ-CS", "OS-LM12UU", "MG-N35-10X1", "MG-N35-10X10"]],
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const blocks = PICKS.map(([heading, skus]) => {
  const cards = skus.map((sku) => {
    const r = bySku.get(sku);
    if (!r) return `<figure class="miss"><figcaption>${esc(sku)} — not drawable</figcaption></figure>`;
    return `<figure>
        <img src="sheets/${esc(sku)}.svg" alt="${esc(sku)}">
        <figcaption><b>${esc(sku)}</b><span>${esc(r.size)}</span></figcaption>
      </figure>`;
  }).join("");
  return `<section><h2>${esc(heading)}</h2><div class="row">${cards}</div></section>`;
}).join("");

writeFileSync(path.join(OUT, "review.html"), `<!doctype html>
<meta charset="utf-8"><title>Sheet review</title>
<style>
  body { margin:0; padding:34px; background:#F7F5F1; color:#1C1813;
         font:15px/1.5 ui-sans-serif,system-ui,sans-serif; }
  h2 { font-size:14px; margin:0 0 12px; font-family:ui-monospace,monospace; color:#57503F; }
  section { margin:0 0 34px; }
  .row { display:grid; grid-template-columns:repeat(5,1fr); gap:16px; }
  figure { margin:0; background:#fff; border:1px solid #E2DDD3; border-radius:3px; overflow:hidden; }
  img { display:block; width:100%; height:auto; }
  figcaption { display:flex; justify-content:space-between; gap:8px; padding:8px 11px;
               border-top:1px solid #E2DDD3; font-family:ui-monospace,monospace; font-size:12px; }
  figcaption span { color:#6E6656; }
  .miss { padding:20px; color:#B03A2E; font-family:ui-monospace,monospace; font-size:12px; }
</style>
${blocks}
`);
console.log("review page written");
