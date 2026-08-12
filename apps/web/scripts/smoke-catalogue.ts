import { getPayload } from "payload";
import config from "@payload-config";

/**
 * Exercises the catalogue invariants, not just the tables.
 *
 *   npm run payload -- run scripts/smoke-catalogue.ts
 *
 * Anyone can prove a column exists. What is worth proving is that the rules
 * refuse the things they claim to refuse — a depth-4 category, a product hung
 * on a branch, a spec whose type disagrees with its definition, a bulk price
 * above the single-unit price, a stock movement that takes on-hand negative,
 * an edit to the append-only ledger. Each of those is a real mistake somebody
 * will make during an import.
 *
 * Runs as the system and cleans up after itself, so it is safe to repeat.
 */
const payload = await getPayload({ config });
const req = { overrideAccess: true } as const;

let pass = 0;
let fail = 0;

function ok(what: string) {
  pass++;
  console.log(`  ✓ ${what}`);
}
function bad(what: string, detail?: string) {
  fail++;
  console.log(`  ✗ ${what}${detail ? ` — ${detail}` : ""}`);
}

/** Asserts the operation is refused, and that it is refused for the stated reason. */
async function refuses(what: string, expect: RegExp, fn: () => Promise<unknown>) {
  try {
    await fn();
    bad(what, "it was allowed");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (expect.test(msg)) ok(what);
    else bad(what, `refused, but for the wrong reason: ${msg.slice(0, 120)}`);
  }
}

/**
 * Just the fields this script reads back. `payload.create` is overloaded per
 * collection and a generic helper collapses those overloads to `never`, so the
 * shape is stated here rather than fought for.
 */
type Doc = {
  id: string | number;
  depth?: number;
  path?: string;
  sku?: string;
  publishedAt?: string | null;
  priceTiers?: { minQty: number }[];
  items?: { note?: string | null }[];
};

const made: { collection: string; id: string | number }[] = [];

async function make(collection: string, data: Record<string, unknown>): Promise<Doc> {
  const doc = (await payload.create({ collection, data, ...req } as never)) as Doc;
  made.push({ collection, id: doc.id });
  return doc;
}

const tag = `smoke${Date.now().toString(36)}`;

/**
 * Clear anything a previous run left behind.
 *
 * The `finally` block below handles the normal path, but it cannot help if the
 * process dies first — an unhandled rejection kills Node before `finally` ever
 * runs, which is exactly what happened once here and left a full tree of
 * orphans in the dev database. A smoke test that poisons the next run, and the
 * seed after it, is worse than no smoke test.
 *
 * Everything this script creates is slug-prefixed `smoke`, so the sweep is
 * exact. Order is child-first; categories go deepest-first.
 */
async function purge() {
  let removed = 0;

  const wipe = async (collection: string, field: string) => {
    const found = await payload.find({
      collection, where: { [field]: { like: "smoke%" } }, limit: 500, depth: 0, ...req,
    } as never);
    for (const d of found.docs as { id: string | number }[]) {
      await payload.delete({ collection, id: d.id, ...req } as never);
      removed++;
    }
  };

  // Child-first. Each collection is keyed on whatever it actually uses —
  // variants on `sku`, warehouses on `code`, the rest on `slug`.
  await wipe("variants", "sku");
  await wipe("products", "slug");
  await wipe("builds", "slug");
  await wipe("brands", "slug");
  await wipe("warehouses", "code");

  const cats = await payload.find({
    collection: "categories", where: { slug: { like: "smoke%" } }, limit: 500, depth: 0, ...req,
  });
  if (cats.docs.length) {
    // Definitions have no slug of their own; they are reachable via category.
    const defs = await payload.find({
      collection: "attribute-definitions",
      where: { category: { in: cats.docs.map((c) => c.id) } },
      limit: 500, depth: 0, ...req,
    });
    for (const d of defs.docs) {
      await payload.delete({ collection: "attribute-definitions", id: d.id, ...req });
      removed++;
    }
    // Deepest first, so a parent is never removed out from under a child.
    for (const c of [...cats.docs].sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0))) {
      await payload.delete({ collection: "categories", id: c.id, ...req });
      removed++;
    }
  }

  if (removed) console.log(`swept ${removed} orphan(s) from an earlier run`);
}

await purge();

try {
  /* ---------------- the tree ---------------- */
  console.log("\ncategories");
  const l1 = await make("categories", { name: "Fasteners", slug: `${tag}-fasteners` });
  const l2 = await make("categories", { name: "Screws by Head", slug: `${tag}-by-head`, parent: l1.id });
  const l3 = await make("categories", { name: "Socket Head Cap", slug: `${tag}-shc`, parent: l2.id });

  if (l1.depth === 1 && l1.path === `${tag}-fasteners`) ok("root gets depth 1 and its own path");
  else bad("root path/depth", `depth=${l1.depth} path=${l1.path}`);

  if (l3.depth === 3 && l3.path === `${tag}-fasteners.${tag}-by-head.${tag}-shc`) {
    ok("leaf path is the materialised chain");
  } else bad("leaf path", `depth=${l3.depth} path=${l3.path}`);

  await refuses("a fourth level is refused", /exceeds the 3-level limit/i, () =>
    make("categories", { name: "Too deep", slug: `${tag}-deep`, parent: l3.id }),
  );

  /* ---------------- typed attributes ---------------- */
  console.log("\nattribute definitions");
  const material = await make("attribute-definitions", {
    category: l1.id, key: "material", label: "Material", type: "enum",
    enumValues: [{ value: "SS304" }, { value: "SS316" }, { value: "Alloy 12.9" }],
  });
  const lengthMm = await make("attribute-definitions", {
    category: l3.id, key: "length_mm", label: "Length", type: "dimension", unit: "mm", facetStyle: "range",
  });
  ok("enum declared on the root, dimension declared on the leaf");

  await refuses("an enum with no values is refused", /must list at least one value/i, () =>
    make("attribute-definitions", { category: l3.id, key: "finish", label: "Finish", type: "enum" }),
  );

  /* ---------------- product filing ---------------- */
  console.log("\nproducts");
  const brand = await make("brands", { name: "Generic", slug: `${tag}-generic`, isGeneric: true });

  await refuses("a product cannot hang on a branch", /leaves only/i, () =>
    make("products", {
      title: "Wrongly filed", slug: `${tag}-wrong`, primaryCategory: l2.id,
      hsnCode: "73181500", gstRate: "18", brand: brand.id,
    }),
  );

  // Payload reports field-level validation as "The following field is invalid: <path>",
  // so the assertion matches the field, not the validator's own sentence.
  await refuses("HSN must be eight digits", /hsn/i, () =>
    make("products", {
      title: "Bad HSN", slug: `${tag}-badhsn`, primaryCategory: l3.id, hsnCode: "7318", gstRate: "18",
    }),
  );

  const product = await make("products", {
    title: "M3 Hex Socket Head Cap Screw, SS 304",
    slug: `${tag}-m3-shc-ss304`,
    primaryCategory: l3.id,
    hsnCode: "73181500",
    gstRate: "18",
    brand: brand.id,
    status: "active",
    variantAxes: ["length_mm", "material"],
  });
  if (product.publishedAt) ok("going active stamps publishedAt");
  else bad("publishedAt not stamped");

  /* ---------------- variants, specs, price breaks ---------------- */
  console.log("\nvariants");
  await refuses("a spec must match its declared type", /needs the number field/i, () =>
    make("variants", {
      product: product.id, sku: `${tag}-typemismatch`, basePrice: 310, weightG: 1,
      attributes: [{ definition: lengthMm.id, valueText: "ten" }],
    }),
  );

  await refuses("a value outside the enum is refused", /not one of Material/i, () =>
    make("variants", {
      product: product.id, sku: `${tag}-badenum`, basePrice: 310, weightG: 1,
      attributes: [{ definition: material.id, valueText: "Cheese" }],
    }),
  );

  await refuses("exactly one value per spec", /exactly one value/i, () =>
    make("variants", {
      product: product.id, sku: `${tag}-twovalues`, basePrice: 310, weightG: 1,
      attributes: [{ definition: lengthMm.id, valueNumber: 10, valueText: "10" }],
    }),
  );

  await refuses("a bulk break cannot cost more than one", /Bulk should not cost more/i, () =>
    make("variants", {
      product: product.id, sku: `${tag}-badtier`, basePrice: 310, weightG: 1,
      priceTiers: [{ minQty: 100, unitPrice: 400 }],
    }),
  );

  const variant = await make("variants", {
    product: product.id,
    sku: `${tag}-fs-shc-m3-010`,
    titleSuffix: "10mm",
    basePrice: 310,
    weightG: 1,
    attributes: [
      { definition: lengthMm.id, valueNumber: 10 },
      { definition: material.id, valueText: "SS304" },
    ],
    // deliberately out of order — the hook should sort them
    priceTiers: [
      { minQty: 500, unitPrice: 222 },
      { minQty: 10, unitPrice: 288 },
      { minQty: 100, unitPrice: 249 },
    ],
  });

  const qtys = (variant.priceTiers ?? []).map((t: { minQty: number }) => t.minQty);
  if (String(qtys) === "10,100,500") ok(`price breaks stored ascending (${qtys})`);
  else bad("price breaks not sorted", String(qtys));

  if (variant.sku === `${tag}-fs-shc-m3-010`.toUpperCase()) ok("SKU uppercased on save");
  else bad("SKU not uppercased", variant.sku);

  await refuses("a duplicate SKU is refused", /unique|invalid/i, () =>
    make("variants", { product: product.id, sku: variant.sku, basePrice: 310, weightG: 1 }),
  );

  /* ---------------- builds ---------------- */
  console.log("\nbuilds");
  await refuses("the same part twice in one build is refused", /listed twice/i, () =>
    make("builds", {
      name: "Drone", slug: `${tag}-drone`,
      items: [{ product: product.id }, { product: product.id }],
    }),
  );
  const build = await make("builds", {
    name: "Drone", slug: `${tag}-drone`,
    items: [{ product: product.id, note: "M3 hardware for the arms" }],
  });
  if (build.items?.[0]?.note) ok("membership carries its own per-build note");
  else bad("note missing");

  /* ---------------- stock ---------------- */
  console.log("\ninventory");
  const wh = await make("warehouses", {
    code: `${tag}-blr`, name: "Peenya", stateCode: "29", pincode: "560058",
  });

  await make("inventory-movements", { variant: variant.id, warehouse: wh.id, delta: 250, reason: "purchase" });
  await make("inventory-movements", { variant: variant.id, warehouse: wh.id, delta: -4, reason: "sale" });

  const levels = await payload.find({
    collection: "inventory",
    where: { and: [{ variant: { equals: variant.id } }, { warehouse: { equals: wh.id } }] },
    depth: 0, ...req,
  });
  const level = levels.docs[0];
  if (level?.onHand === 246) ok("on-hand is the sum of the ledger (250 − 4 = 246)");
  else bad("on-hand wrong", String(level?.onHand));
  if (level) made.push({ collection: "inventory", id: level.id });

  await refuses("stock cannot be driven negative", /cannot go negative/i, () =>
    make("inventory-movements", { variant: variant.id, warehouse: wh.id, delta: -9999, reason: "sale" }),
  );

  const ledger = await payload.find({
    collection: "inventory-movements",
    where: { variant: { equals: variant.id } },
    depth: 0, ...req,
  });
  const sum = ledger.docs.reduce((n, m) => n + (m.delta as number), 0);
  if (sum === level?.onHand) ok(`SUM(delta) equals on-hand (${sum})`);
  else bad("ledger drift", `sum=${sum} onHand=${level?.onHand}`);

  const first = ledger.docs[0];
  await refuses("the ledger cannot be edited", /not allowed|forbidden|Unauthorized/i, () =>
    payload.update({
      collection: "inventory-movements", id: first.id, data: { delta: 1 }, overrideAccess: false,
    }),
  );
} finally {
  /* ---------------- cleanup ---------------- */
  /*
    Reverse creation order, so a row is gone before whatever it points at.
    Failures are reported rather than swallowed — a smoke test that quietly
    leaves rows behind poisons the next run and, worse, the seed after it.
  */
  const stuck: string[] = [];
  for (const { collection, id } of made.reverse()) {
    try {
      await payload.delete({ collection, id, overrideAccess: true } as never);
    } catch (e) {
      stuck.push(`${collection}#${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (stuck.length) {
    console.log(`\n${stuck.length} row(s) could not be removed:`);
    for (const s of stuck) console.log(`  ! ${s}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
