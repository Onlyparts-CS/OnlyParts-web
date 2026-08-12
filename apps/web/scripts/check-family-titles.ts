import { allSkus } from "../src/lib/skus";
import { familyTitle, variantSuffix, weightFor } from "./seedHelpers";

/**
 * What each product family will be called, without re-seeding to find out.
 *
 *   npm run payload -- run scripts/check-family-titles.ts
 *
 * A family name that still contains a value which *varies inside* that family
 * is the bug this catches: "M2 × 4mm Hex Socket Head Cap Screw, SS 304 Series"
 * as the name of 272 different screws.
 */
const byLeaf = new Map<string, {
  title: string; sample: string; suffix: string; weight: number; n: number;
}>();

for (const sku of allSkus()) {
  const leaf = sku.categories[0].at(-1)!;
  const seen = byLeaf.get(leaf);
  if (seen) { seen.n++; continue; }
  byLeaf.set(leaf, {
    title: familyTitle(sku, leaf, leaf),
    sample: sku.title,
    suffix: variantSuffix(sku, leaf),
    weight: weightFor(sku, sku.categories[0][0]),
    n: 1,
  });
}

let bad = 0;
for (const [leaf, f] of byLeaf) {
  // Any digit-plus-unit, a dimension separator, or a leftover part code.
  const leaks = /\d\s?mm\b|·|\bID \d|\bOD \d|\b\d+(ZZ|2RS)\b/i.test(f.title);
  if (leaks) bad++;
  console.log(`${leaks ? "✗" : "✓"} ${leaf.padEnd(18)} ${String(f.n).padStart(4)}  ${f.title}`);
  console.log(`     from    ${f.sample}`);
  console.log(`     variant ${f.suffix}   ·   ${f.weight} g\n`);
}

console.log(`${byLeaf.size - bad} clean, ${bad} still carrying variant detail`);
process.exit(bad === 0 ? 0 : 1);
