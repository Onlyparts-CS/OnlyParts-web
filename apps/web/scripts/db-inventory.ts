import { getPayload } from "payload";
import config from "@payload-config";

const payload = await getPayload({ config });
const req = { overrideAccess: true, depth: 0 } as const;

for (const c of ["categories", "products", "variants", "brands", "attribute-definitions", "inventory", "orders", "customers"] as const) {
  const r = await payload.find({ collection: c, limit: 0, ...req });
  console.log(`${c.padEnd(24)} ${r.totalDocs}`);
}

console.log("\nproducts and how many variants each carries:");
const products = await payload.find({ collection: "products", limit: 50, ...req });
for (const p of products.docs) {
  const v = await payload.find({ collection: "variants", where: { product: { equals: p.id } }, limit: 0, ...req });
  const cat = await payload.findByID({ collection: "categories", id: p.primaryCategory as number, ...req }).catch(() => null);
  console.log(`  ${String(p.title).slice(0, 44).padEnd(46)} ${String(v.totalDocs).padStart(5)}   ${cat?.path ?? "?"}`);
}

console.log("\ncategories holding products:");
const cats = await payload.find({ collection: "categories", limit: 1000, sort: "path", ...req });
let withProducts = 0;
for (const c of cats.docs) {
  const n = await payload.find({ collection: "products", where: { primaryCategory: { equals: c.id } }, limit: 0, ...req });
  if (n.totalDocs > 0) { withProducts++; console.log(`  ${c.path}  →  ${n.totalDocs}`); }
}
console.log(`\n${withProducts} of ${cats.totalDocs} categories have any product at all.`);

process.exit(0);
