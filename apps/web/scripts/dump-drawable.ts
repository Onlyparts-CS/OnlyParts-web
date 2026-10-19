import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { dbAllSkus } from "../src/lib/catalogDb";
import { specDrawing } from "../src/lib/specDrawing";

/**
 * Step 1 of 2: dump every SKU whose title states a real shape.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx payload run scripts/dump-drawable.ts
 *
 * Split from the rendering step because React refuses to load
 * `react-dom/server` under the `react-server` condition, and `catalogDb`
 * requires that condition (it imports `server-only`). One process reads the
 * catalogue, the other draws it. See `draw-sheets.tsx`.
 */
const OUT = path.resolve(import.meta.dirname, "../../../tools/drawings/out");
mkdirSync(OUT, { recursive: true });

const skus = await dbAllSkus();
const drawable = [];

for (const s of skus) {
  const categoryPath = s.categories[0]?.join(".");
  const part = specDrawing(s.attrs, s.title, categoryPath).part;
  if (!part) continue;

  // The family is what makes this worth doing: everything sharing one is the
  // same shape at a different size, so one photograph covers the lot.
  const family =
    part.kind === "fastener" ? `${part.standard} · ${part.head} head, ${part.drive} drive`
    : part.kind === "round" ? (part.bore === null ? "disc (solid)" : `${part.standard ?? "as listed"} · annulus`)
    : part.kind === "chip" ? `${part.standard} · ${part.code} chip`
    : "block";

  const size =
    part.kind === "fastener" ? `${part.thread}×${part.length}`
    : part.kind === "round" ? `⌀${part.od}×${part.width}${part.bore === null ? "" : ` ⌀${part.bore} bore`}`
    : part.kind === "chip" ? `${part.length}×${part.width}${part.height === null ? "" : `×${part.height}`}`
    : `${part.length}×${part.breadth}×${part.thickness}`;

  drawable.push({ sku: s.sku, title: s.title, attrs: s.attrs, categoryPath, family, size, kind: part.kind });
}

writeFileSync(path.join(OUT, "drawable.json"), JSON.stringify(drawable, null, 2));
console.log(`${drawable.length} drawable of ${skus.length} skus`);
