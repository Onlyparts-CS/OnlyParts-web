import { getPayload } from "payload";
import config from "@payload-config";
import { CATEGORIES } from "../src/lib/catalog";
import { SCHEMAS, UNIVERSAL, slugify, type AttrDef } from "../src/lib/taxonomy";
import { allSkus } from "../src/lib/skus";
import { familyTitle, variantSuffix, weightFor } from "./seedHelpers";

/** HSN by top-level category. Mirrors src/lib/product.ts, keyed by slug. */
const HSN_BY_DRAWER: Record<string, string> = {
  fasteners: "73181500", bearings: "84821011", magnets: "85051190",
  motors: "85013119", "electronic-components": "85411000",
  "batteries-power": "85065000", "3d-printers": "84779000",
  "3d-printing": "84771000", "drones-parts": "88062400", tools: "82055900",
  "cnc-machines-parts": "84592900", "industrial-electricals": "85361000",
  "ev-parts": "87089900", hardware: "76042990",
};
const hsnFor = (drawer: string) => HSN_BY_DRAWER[drawer] ?? "73181500";

/**
 * Seeds the catalogue database with 13 top-level categories (~475 nodes),
 * attribute schemas, brands, warehouses, products, variants, and initial inventory ledgers.
 *
 * Usage:
 *   npm run payload -- run scripts/seed-catalogue.ts
 */

async function main() {
  const payload = await getPayload({ config });
  const req = { overrideAccess: true } as const;

  console.log("🌱 Starting Catalogue Seed...\n");

  // 1. Purge previous seed data to ensure clean idempotency
  console.log("🧹 Purging existing catalogue data...");
  const wipe = async (collection: string) => {
    let docs;
    do {
      docs = await payload.find({ collection, limit: 200, depth: 0, ...req } as never);
      for (const d of docs.docs as { id: string | number }[]) {
        try {
          await payload.delete({ collection, id: d.id, ...req } as never);
        } catch {
          // ignore dependency delete errors during cascade
        }
      }
    } while (docs.docs.length > 0);
  };

  await wipe("inventory-movements");
  await wipe("inventory");
  await wipe("variants");
  await wipe("products");
  await wipe("builds");
  await wipe("attribute-definitions");
  await wipe("categories");
  await wipe("brands");
  await wipe("warehouses");

  console.log("  ✓ Database cleared.\n");

  // 2. Seed Default Warehouse
  console.log("🏢 Seeding Warehouses & Brands...");
  const warehouse = await payload.create({
    collection: "warehouses",
    data: {
      code: "PEENYA",
      name: "Peenya Central Warehouse",
      // 29 = Karnataka. This is the origin for place-of-supply: it decides
      // CGST+SGST versus IGST on every order shipped from here.
      stateCode: "29",
      pincode: "560058",
    },
    ...req,
  } as never) as { id: string | number };

  const defaultBrand = await payload.create({
    collection: "brands",
    data: {
      name: "OnlyParts Direct",
      slug: "onlyparts-direct",
      isGeneric: true,
    },
    ...req,
  } as never) as { id: string | number };
  console.log("  ✓ Warehouse 'PEENYA' and Brand 'OnlyParts Direct' created.\n");

  // 3. Seed Category Hierarchy (13 L1s, L2s, L3s ~475 nodes)
  console.log("📁 Seeding 13 Top-level Categories & Tree Nodes...");
  let categoryCount = 0;
    /*
    Keyed by full path, not by slug.

    Sibling slugs are unique but cousins are not — "Electronics" is a shelf
    under Motors *and* under 3D Printing Supplies. A slug-keyed map silently
    filed half the catalogue under the wrong drawer.
  */
  const leafMap = new Map<string, string | number>(); // 'a.b.c' -> category ID
  const leafNames = new Map<string, string>();        // leaf slug -> display name
  /** '<categoryId>::<attrKey>' -> the definition and whether it wants a number. */
  const defsByCategory = new Map<string, { id: string | number; numeric: boolean }>();

  for (const l1 of CATEGORIES) {
    const l1Doc = (await payload.create({
      collection: "categories",
      data: {
        name: l1.name,
        slug: l1.slug,
        blurb: l1.blurb,
        glyph: l1.glyph,
        parent: null,
      },
      ...req,
    } as never)) as { id: string | number; slug: string };
    categoryCount++;
    leafMap.set(l1.slug, l1Doc.id);

    if (l1.subs) {
      for (const sub of l1.subs) {
        const l2Slug = slugify(sub.name);
        const l2Doc = (await payload.create({
          collection: "categories",
          data: {
            name: sub.name,
            slug: l2Slug,
            parent: l1Doc.id,
          },
          ...req,
        } as never)) as { id: string | number; slug: string };
        categoryCount++;
        leafMap.set(`${l1.slug}.${l2Slug}`, l2Doc.id);

        if (sub.children) {
          for (const child of sub.children) {
            const l3Slug = slugify(child.name);
            const l3Doc = (await payload.create({
              collection: "categories",
              data: {
                name: child.name,
                slug: l3Slug,
                parent: l2Doc.id,
              },
              ...req,
            } as never)) as { id: string | number; slug: string };
            categoryCount++;
            leafMap.set(`${l1.slug}.${l2Slug}.${l3Slug}`, l3Doc.id);
            leafNames.set(l3Slug, child.name);
          }
        }
      }
    }
  }
  console.log(`  ✓ Seeded ${categoryCount} category nodes.\n`);

  // 4. Seed Attribute Definitions
  console.log("⚙️  Seeding Attribute Definitions...");
  let attrCount = 0;

  /*
    Root first, leaves second, and the order matters.

    `resolveAttributes` merges a category's ancestry root → leaf and lets the
    nearer declaration win, so seeding `UNIVERSAL` on every L1 drawer gives
    every category in the tree a definition for the generic descriptors the
    feed harvests, and the seven curated leaves in `SCHEMAS` still override
    `thread` and `length_mm` with their chip and range facets.

    Without the root pass the importer silently discarded 86.6% of every typed
    spec it had just validated — `toSpecRows` emits nothing for a key no
    definition claims, and nothing anywhere logs that it dropped one.
  */
  const attrTargets: [string | number, AttrDef[]][] = [];
  for (const l1 of CATEGORIES) {
    const id = leafMap.get(l1.slug);
    if (id) attrTargets.push([id, UNIVERSAL]);
  }
  for (const [key, attrs] of Object.entries(SCHEMAS)) {
    // SCHEMAS is keyed by leaf slug; find the one path that ends in it.
    const path = [...leafMap.keys()].find((k) => k === key || k.endsWith(`.${key}`));
    const categoryId = path ? leafMap.get(path) : undefined;
    if (categoryId) attrTargets.push([categoryId, attrs]);
  }

  for (const [categoryId, attrs] of attrTargets) {
    for (const attr of attrs) {
      /*
        The storefront's `AttrDef` and the collection's schema are not the same
        shape, and pretending they were is what broke this: it wrote `facet`
        and `enumOptions`, neither of which exists on the collection.

        Two real translations happen here:
        · `facet: "chips"` is a *rendering* choice on the storefront. The
          collection only knows checkbox / range / swatch, and chips are a
          checkbox list that keeps engineering order.
        · an enum with no declared values is not an enum — it is free text, and
          the collection refuses it on purpose. Degrading to `text` keeps the
          attribute rather than failing the whole seed for it.
      */
      const values = (attr.order ?? []).map((v) => ({ value: String(v) }));
      const isEnum = attr.type === "enum" && values.length > 0;

      const created = (await payload.create({
        collection: "attribute-definitions",
        data: {
          category: categoryId,
          key: attr.key,
          label: attr.label,
          type: isEnum ? "enum" : attr.type === "number" ? "dimension" : "text",
          unit: attr.unit ?? null,
          facetStyle: attr.facet === "range" ? "range" : "checkbox",
          enumValues: isEnum ? values : [],
          // `none` still records the value; it just declines to build a rail
          // out of it. An inherited `dia_mm` covers 8% of a drawer, and a range
          // slider that hides the other 92% is worse than no slider.
          isFacet: attr.facet !== "none",
          isSearchable: true,
          // A defining spec — thread, bore, material. These are what the facet
          // rail is built from, so a variant missing one is genuinely incomplete.
          isRequired: isEnum || attr.facet === "range",
          isVariantAxis: isEnum,
        },
        ...req,
      } as never)) as { id: string | number };
      defsByCategory.set(`${categoryId}::${attr.key}`, {
        id: created.id,
        numeric: !isEnum && attr.type === "number",
      });
      attrCount++;
    }
  }
  console.log(`  ✓ Seeded ${attrCount} attribute definitions.\n`);

  // 5. Seed Products, Variants & Inventory
  console.log("📦 Seeding Products, Variants & Inventory Ledgers...");
  const generatedSkus = allSkus(); // generates SKUs
  console.log(`   Found ${generatedSkus.length} generated SKUs to seed...`);

  const productMap = new Map<string, string | number>(); // product slug -> ID
  let productCount = 0;
  let variantCount = 0;
  let ledgerCount = 0;

  for (const sku of generatedSkus) {
    // Determine category path (last segment is leaf)
    const catPath = sku.categories[0] ?? ["fasteners"];
    const leafSlug = catPath[catPath.length - 1];
    const categoryId = leafMap.get(catPath.join(".")) ?? leafMap.get("fasteners")!;

    /*
      One product per family, where "family" is what `VARIANT_AXES` says it is.

      For screws the axes are thread × length × material and everything else on
      the leaf is constant, so the leaf *is* the family — 272 variants under one
      "Hex Socket Head Cap Screw" is correct merchandising, the same shape as a
      shirt in sizes and colours. Keyed on the leaf rather than hardcoded to it
      so a leaf that later holds two genuinely different families splits cleanly.
    */
    const productSlug = `${leafSlug}-product`;
    let productId = productMap.get(productSlug);

    if (!productId) {
      const prodDoc = (await payload.create({
        collection: "products",
        data: {
          title: familyTitle(sku, leafSlug, leafNames.get(leafSlug) ?? leafSlug),
          slug: productSlug,
          brand: defaultBrand.id,
          primaryCategory: categoryId,
          // HSN drives the GST line on every invoice, so it is per-category
          // rather than one constant pretending every part is a screw.
          hsnCode: hsnFor(catPath[0]),
          gstRate: "18",
          // Rule 6(1) declarations. `rule6` in Products.ts gates `active` on
          // these, so a seed that publishes must carry them.
          //
          // `countryOfOrigin` is deliberately absent and must stay absent. It
          // no longer gates publishing precisely so that nothing has to invent
          // one, and seeding "India" here would put a fabricated declaration on
          // every product — the misdeclaration the omission exists to avoid.
          // These rows render "Not declared" like any other unverified listing.
          //
          // The other four are placeholders in the sense that a real listing
          // takes them from the Bill of Entry, but each is a claim we can stand
          // behind for seeded fixtures: OnlyParts is the packer, the unit is one
          // piece, and the MRP is a ceiling above the selling price.
          mrp: Math.ceil(sku.price * 1.15),
          netQuantity: "1 piece",
          importerName: "OnlyParts",
          importerAddress: "Bengaluru, Karnataka, India",
          status: "active",
        },
        ...req,
      } as never)) as { id: string | number };
      productId = prodDoc.id;
      productMap.set(productSlug, productId);
      productCount++;
    }

    /*
      Specs resolve to a *definition id*, not a bare key.

      This is the whole point of typed attributes: the row in
      `variants_attributes` points at the definition that declares its type,
      which is what lets a range facet trust `value_number`. A spec whose
      category never declared it is dropped rather than invented — an
      undeclared attribute has no type, so there is no column to put it in.
    */
    type Spec = {
      definition: string | number;
      valueText?: string;
      valueNumber?: number;
    };

    /*
      The definition decides the column, and the value is coerced to fit it.

      Not the other way round. `shaft` is declared text on its category but the
      generator stores 5 as a number, and writing the number into a text
      attribute is exactly what the collection refuses — correctly, because a
      range facet that trusts `value_number` must be able to trust it.

      A value that cannot be coerced is dropped rather than forced. Better a
      missing spec the enrichment queue will surface than a wrong one nothing
      ever will.
    */
    const specs: Spec[] = Object.entries(sku.attrs).flatMap(([key, val]): Spec[] => {
      const def = defsByCategory.get(`${categoryId}::${key}`);
      if (!def) return [];
      if (def.numeric) {
        const n = typeof val === "number" ? val : Number(String(val).replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? [{ definition: def.id, valueNumber: n }] : [];
      }
      return [{ definition: def.id, valueText: String(val) }];
    });

    // Create Variant
    const variantDoc = (await payload.create({
      collection: "variants",
      data: {
        sku: sku.sku,
        titleSuffix: variantSuffix(sku, leafSlug),
        product: productId,
        basePrice: sku.price,
        weightG: weightFor(sku, catPath[0]),
        // qty 1 is the base price, not a break — the collection refuses a
        // "break" that starts at one, and rightly.
        priceTiers: sku.breaks.filter((b) => b.qty > 1).map((b) => ({ minQty: b.qty, unitPrice: b.price })),
        attributes: specs,
        isActive: true,
      },
      ...req,
    } as never)) as { id: string | number };
    variantCount++;

    // Initial Inventory Ledger entry if stock > 0
    if (sku.stock > 0) {
      await payload.create({
        collection: "inventory-movements",
        data: {
          variant: variantDoc.id,
          warehouse: warehouse.id,
          delta: sku.stock,
          reason: "count",
          note: "Opening balance — catalogue seed",
        },
        ...req,
      } as never);
      ledgerCount++;
    }
  }

  console.log(`  ✓ Seeded ${productCount} products, ${variantCount} variants, and ${ledgerCount} inventory movements.\n`);
  console.log("✨ Seed completed successfully!");
}

/*
  Awaited at the top level.

  It used to be `main().catch(...)` — a floating promise. `payload run`
  finishes evaluating the module, sees nothing pending, and exits; the process
  died inside the first `await getPayload()` before a single line printed.
  Exit code 0, no output, no rows. This file is ESM, so top-level await is the
  fix and the failure becomes a real non-zero exit.
*/
try {
  await main();
} catch (err) {
  console.error("❌ Seed failed:", err);
  process.exit(1);
}
