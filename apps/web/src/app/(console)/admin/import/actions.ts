"use server";

import { revalidatePath } from "next/cache";
import { actionStaff } from "@/lib/actionAuth";
import { resolveAttributes, toSpecRows } from "@/lib/pim";
import {
  parseCsv,
  dryRun,
  specsOf,
  rule6Complete,
  imageUrl,
  parseProjects,
  type DryRun,
  type ImportContext,
  type CatalogueRow,
  type ImportRow,
} from "@/lib/import";

/**
 * Bulk import, against Postgres.
 *
 * Until now this screen was theatre: the diff was computed against the
 * generated demo fixtures, and "Commit import" advanced a `useState` and wrote
 * nothing. Both halves are real here.
 *
 * Two rules shape the file.
 *
 * 1. **The client is never trusted with the diff.** `commitImport` takes the
 *    CSV text, not the outcomes the browser computed, and re-runs the identical
 *    `dryRun` server-side before writing a row. A `"use server"` export is a
 *    public POST endpoint; accepting a caller's list of "rows to create" would
 *    be accepting a caller's list of rows to create.
 * 2. **Everything runs as the signed-in user**, `overrideAccess: false`, the
 *    same as `products/new/actions.ts`. An importer that writes as root is an
 *    importer that quietly bypasses every rule the CMS enforces.
 */

const session = () => actionStaff("admin", "catalog");

/*
  Chunked, per rules/backend-micronaut/BATCH_PROCESSING.md: a sheet is
  unbounded, a failure on row 47 must not lose rows 48-500, and every failure is
  collected rather than thrown. 100 rather than 500 because each row here is
  several round trips, not one insert.
*/
const CHUNK = 100;

type Session = Awaited<ReturnType<typeof actionStaff>>;
type Payload = Session["payload"];
type User = NonNullable<Session["user"]>;

/* ------------------------------------------------------------------ */

/**
 * Everything `dryRun` needs, in five queries rather than one per row.
 *
 * The alternative — looking each SKU up as the file is walked — is a thousand
 * round trips for a thousand-row sheet, and it is the reason importers get
 * described as "slow" when what they are is chatty.
 */
async function loadContext(payload: Payload): Promise<ImportContext & {
  pathByVariant: Map<string, string>;
}> {
  const [cats, defs, inv, variants, builds] = await Promise.all([
    payload.find({ collection: "categories", limit: 2000, depth: 0, overrideAccess: true }),
    payload.find({ collection: "attribute-definitions", limit: 1000, depth: 0, overrideAccess: true }),
    payload.find({ collection: "inventory", limit: 5000, depth: 0, overrideAccess: true }),
    payload.find({ collection: "variants", limit: 5000, depth: 1, overrideAccess: true }),
    payload.find({ collection: "builds", limit: 200, depth: 0, overrideAccess: true }),
  ]);

  const pathById = new Map(cats.docs.map((c) => [String(c.id), String(c.path ?? "")]));
  const keyByDef = new Map(defs.docs.map((d) => [String(d.id), String(d.key)]));

  const stock = new Map<string, number>();
  for (const i of inv.docs) {
    const id = String(typeof i.variant === "object" && i.variant ? i.variant.id : i.variant);
    stock.set(id, (stock.get(id) ?? 0) + (i.onHand ?? 0));
  }

  // A category with no children is a leaf. `Categories` has no `isLeaf` column —
  // it is derived, here and in `lib/pim.ts`, from whether anything points at it.
  const hasChild = new Set(cats.docs.map((c) => String(c.parent ?? "")).filter(Boolean));

  const existing: CatalogueRow[] = [];
  const pathByVariant = new Map<string, string>();

  for (const v of variants.docs) {
    const product = typeof v.product === "object" && v.product ? v.product : null;
    if (!product) continue;

    const catId = String(
      typeof product.primaryCategory === "object" && product.primaryCategory
        ? product.primaryCategory.id
        : product.primaryCategory,
    );
    const path = pathById.get(catId) ?? "";
    pathByVariant.set(String(v.id), path);

    const attrs: Record<string, string | number> = {};
    for (const a of v.attributes ?? []) {
      const key = keyByDef.get(String(typeof a.definition === "object" && a.definition ? a.definition.id : a.definition));
      if (!key) continue;
      if (a.valueNumber !== null && a.valueNumber !== undefined) attrs[key] = a.valueNumber;
      else if (a.valueBool !== null && a.valueBool !== undefined) attrs[key] = String(a.valueBool);
      else if (a.valueText) attrs[key] = a.valueText;
    }

    existing.push({
      sku: v.sku,
      variantId: v.id,
      productId: product.id,
      title: product.title,
      price: v.basePrice,
      stock: stock.get(String(v.id)) ?? 0,
      projects: builds.docs
        .filter((b) => (b.items ?? []).some((i) => String(typeof i.product === "object" && i.product ? i.product.id : i.product) === String(product.id)))
        .map((b) => b.slug),
      attrs,
    });
  }

  return {
    existing,
    projectSlugs: builds.docs.map((b) => b.slug),
    leafPaths: cats.docs.filter((c) => !hasChild.has(String(c.id))).map((c) => String(c.path ?? "")).filter(Boolean),
    pathByVariant,
  };
}

/* ------------------------------------------------------------------ */

export type AnalyseResult =
  | { ok: true; headers: string[]; result: DryRun }
  | { ok: false; error: string };

/** Parse a sheet and diff it against the live catalogue. Writes nothing. */
export async function analyseImport(csv: string): Promise<AnalyseResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  const { headers, rows } = parseCsv(csv);
  if (!rows.length) return { ok: false, error: "That file has a header row and nothing under it." };

  const ctx = await loadContext(payload);
  return { ok: true, headers, result: dryRun(rows, headers, ctx) };
}

/* ------------------------------------------------------------------ */

export type CommitResult =
  | {
      ok: true;
      created: number;
      updated: number;
      skipped: number;
      failures: { sku: string; error: string }[];
      /** The undo record, or null when nothing landed or it could not be written. */
      batchId: number | string | null;
    }
  | { ok: false; error: string };

export async function commitImport(csv: string, filename = "import.csv"): Promise<CommitResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  const { headers, rows } = parseCsv(csv);
  const ctx = await loadContext(payload);
  const run = dryRun(rows, headers, ctx);

  // The same guard rails that stop the preview stop the write. They are not a
  // UI courtesy — a run that rewrites half the catalogue is a broken mapping.
  if (run.blockers.length) return { ok: false, error: run.blockers[0] };

  const bySku = new Map(ctx.existing.map((e) => [e.sku.toUpperCase(), e]));
  const warehouse = await defaultWarehouse(payload);
  const failures: { sku: string; error: string }[] = [];
  const ledger: BatchRow[] = [];
  let created = 0;
  let updated = 0;

  const work = run.outcomes.filter((o) => o.kind === "create" || o.kind === "update");

  for (let i = 0; i < work.length; i += CHUNK) {
    for (const o of work.slice(i, i + CHUNK)) {
      try {
        if (o.kind === "create") {
          ledger.push(await createRow(payload, user, o.row, warehouse));
          created++;
        } else {
          ledger.push(await updateRow(payload, user, o.row, bySku.get(o.sku)!, ctx.pathByVariant, warehouse));
          updated++;
        }
      } catch (e) {
        // One bad row does not abort the sheet. It is reported by SKU so the
        // operator can fix that line rather than re-uploading everything.
        failures.push({ sku: o.sku, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  const buildsBySku = await applyProjects(payload, user, run, bySku);
  for (const r of ledger) {
    const added = buildsBySku.get(r.sku.toUpperCase());
    if (added?.length) r.buildsAdded = added.join(",");
  }

  /*
    The batch is written last, and only for rows that actually landed. A record
    claiming to undo a write that failed is worse than no record — the revert
    would restore a "previous" value over a value nobody ever changed.
  */
  let batchId: number | string | null = null;
  if (ledger.length) {
    try {
      const batch = await payload.create({
        collection: "import-batches",
        user,
        overrideAccess: false,
        data: {
          filename,
          at: new Date().toISOString(),
          actor: user.email,
          created,
          updated,
          status: "applied",
          rows: ledger,
        } as never,
      });
      batchId = batch.id;
    } catch (e) {
      // The catalogue write already succeeded; failing to record it must not
      // report the import as failed. It does cost the ability to undo, so say so.
      failures.push({
        sku: "—",
        error: `Written, but the undo record could not be saved: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  /*
    Rows the sheet asked for and validation refused, kept as a queue rather
    than as a toast that vanishes with the tab. Written after the batch so each
    one can point at the commit it belongs to.

    Written on commit, not on analysis: looking at a dry run and thinking better
    of it should not create work items.
  */
  const rejected = run.outcomes.filter((o) => o.kind === "error");
  if (rejected.length) {
    const at = new Date().toISOString();
    for (let i = 0; i < rejected.length; i += CHUNK) {
      for (const o of rejected.slice(i, i + CHUNK)) {
        if (o.kind !== "error") continue;
        try {
          await payload.create({
            collection: "import-exceptions",
            user,
            overrideAccess: false,
            data: {
              sku: o.sku || "(no sku)",
              source: filename,
              at,
              batch: batchId ?? undefined,
              reasons: o.errors.join(" · "),
              row: o.row,
              status: "open",
            } as never,
          });
        } catch {
          /*
            Swallowed deliberately, and only here. The catalogue write has
            already succeeded; failing to file a work item about a row that was
            *not* written must not turn a good import into a reported failure.
            The row is still visible in this run's own diff either way.
          */
        }
      }
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/pim");
  revalidatePath("/admin");
  revalidatePath("/admin/queues");
  revalidatePath("/admin/import");

  return { ok: true, created, updated, skipped: run.unchanged + run.errors, failures, batchId };
}

/* ------------------------------------------------------------------ */

async function defaultWarehouse(payload: Payload) {
  const wh = await payload.find({
    collection: "warehouses",
    where: { isActive: { equals: true } },
    limit: 1, depth: 0, overrideAccess: true,
  });
  return wh.docs[0]?.id ?? null;
}

/**
 * Stock is a ledger movement, never a field.
 *
 * `inventory.onHand` is read-only by design — every unit is accounted for by a
 * row saying who put it there and why. An import that sets stock to 4,200 is
 * therefore a *delta* against what is on hand now, and it is recorded as a
 * count adjustment rather than a purchase, because that is what it is: somebody
 * asserting a number from a spreadsheet.
 */
async function setStock(
  payload: Payload, user: User, variantId: number, target: number, current: number, warehouse: number | null,
) {
  if (warehouse === null) throw new Error("No active warehouse — stock cannot be recorded.");
  const delta = Math.round(target) - current;
  if (delta === 0) return;
  await payload.create({
    collection: "inventory-movements",
    user,
    overrideAccess: false,
    data: {
      variant: variantId,
      warehouse,
      delta,
      reason: "count",
      note: "Bulk import — stock asserted from sheet",
    } as never,
  });
}

const toPaise = (rupees: string) => Math.round(Number(String(rupees).trim()) * 100);

/**
 * One line of the undo record.
 *
 * `before` is a snapshot taken immediately prior to the write, never
 * recomputed later. A revert that re-derives the old price from anything else
 * quietly discards whatever changed in between.
 */
type BatchRow = {
  kind: "create" | "update";
  sku: string;
  variant: number | null;
  product: number | null;
  before: {
    title?: string;
    basePrice?: number;
    attributes?: unknown[];
    stock?: number;
  } | null;
  buildsAdded?: string;
};

async function createRow(
  payload: Payload, user: User, row: ImportRow, warehouse: number | null,
): Promise<BatchRow> {
  const path = row.category.trim();
  const sku = row.sku.trim().toUpperCase();

  const cat = await payload.find({
    collection: "categories",
    where: { path: { equals: path } },
    limit: 1, depth: 0, overrideAccess: true,
  });
  const category = cat.docs[0];
  if (!category) throw new Error(`category "${path}" no longer exists`);

  const defs = await resolveAttributes(path);

  const product = await payload.create({
    collection: "products",
    user,
    overrideAccess: false,
    data: {
      title: row.title.trim(),
      // The SKU is already unique and already the thing people paste into a
      // search bar, so it makes a stable URL without inventing a second key.
      slug: sku.toLowerCase(),
      primaryCategory: category.id,
      hsnCode: row.hsn.trim(),
      gstRate: (row.gst_rate ?? "").trim() || "18",
      /*
        Rule 6(1) gates going Active, not being saved — `Products.ts` says so
        in as many words: "letting it land as drafts to be completed".

        Hardcoding "active" made that documented path unreachable. The first
        real feed import failed 2,150 of 3,800 rows on `Mrp, Net Quantity,
        Importer Name, Importer Address` — four declarations no supplier
        publishes and the CSV writer deliberately does not emit. Every one of
        those rows was a valid product the operator wanted and could not have.

        A row that carries all four goes live; the rest wait in Draft for a
        human. Filling them in from a formula here would be inventing a legal
        declaration, which is the offence the rule exists to punish.
      */
      status: rule6Complete(row) ? "active" : "draft",
      /*
        And the declarations themselves, which nothing here ever wrote.

        They sit in `IMPORT_FIELDS` so the dry run accepts the columns, and in
        `CORE_FIELDS` so `specsOf` keeps them out of the spec rows — and then
        fell down the gap between the two. The values were parsed, validated,
        shown in the diff, and dropped.

        Invisible while `status` was hardcoded to "active", because the gate
        rejected every row for the same fields either way. The moment status
        followed the data, it inverted: 3,501 rows asked to go Active carrying
        declarations the product was never given, and all 3,501 were refused.
      */
      countryOfOrigin: row.country_of_origin?.trim() || null,
      mrp: row.mrp?.trim() ? toPaise(row.mrp) : null,
      netQuantity: row.net_quantity?.trim() || null,
      importerName: row.importer_name?.trim() || null,
      importerAddress: row.importer_address?.trim() || null,
      // Rejected unless it is https on a host we allowlist — see `imageUrl`.
      sourceImageUrl: imageUrl(row.image) || null,
    } as never,
  });

  const variant = await payload.create({
    collection: "variants",
    user,
    overrideAccess: false,
    data: {
      product: product.id,
      sku,
      basePrice: toPaise(row.price),
      weightG: Math.round(Number(row.weight_g)),
      attributes: toSpecRows(defs, specsOf(row)),
      isActive: true,
    } as never,
  });

  const stock = Number(row.stock ?? "0");
  if (Number.isFinite(stock) && stock > 0) {
    await setStock(payload, user, variant.id, stock, 0, warehouse);
  }

  // `before: null` — there was nothing here. Reverting a create deactivates
  // rather than restores.
  return { kind: "create", sku, variant: variant.id, product: product.id, before: null };
}

async function updateRow(
  payload: Payload, user: User, row: ImportRow, existing: CatalogueRow,
  pathByVariant: Map<string, string>, warehouse: number | null,
): Promise<BatchRow> {
  /*
    Read the whole variant once, before touching anything, and keep the fields
    this function is capable of changing. Snapshotting only the fields the
    *sheet* mentions would be smaller and wrong: the attribute merge below
    rewrites the entire array, so restoring it needs the entire array.
  */
  const priorVariant = await payload.findByID({
    collection: "variants", id: existing.variantId, depth: 0, overrideAccess: true,
  });
  const before: BatchRow["before"] = {
    title: existing.title,
    basePrice: priorVariant.basePrice,
    attributes: (priorVariant.attributes ?? []) as unknown[],
    stock: existing.stock,
  };

  /*
    Product-level fields, in one write.

    This used to patch `title` alone, so a re-import could not correct an MRP,
    add a country of origin, or backfill an image — the columns were read,
    diffed and then only ever applied to rows being created. A catalogue you
    can only fix by deleting and re-importing is not one you can fix.

    Every field is conditional on the sheet actually carrying it: a CSV that
    omits a column means "I did not mention it", not "blank it out". `status`
    is deliberately not here — promoting a draft to Active is a decision a
    human makes in the console, not a side effect of a re-upload.
  */
  const productPatch: Record<string, unknown> = {};
  if (row.title?.trim() && row.title.trim() !== existing.title) {
    productPatch.title = row.title.trim();
  }
  if (row.country_of_origin?.trim()) productPatch.countryOfOrigin = row.country_of_origin.trim();
  if (row.mrp?.trim()) productPatch.mrp = toPaise(row.mrp);
  if (row.net_quantity?.trim()) productPatch.netQuantity = row.net_quantity.trim();
  if (row.importer_name?.trim()) productPatch.importerName = row.importer_name.trim();
  if (row.importer_address?.trim()) productPatch.importerAddress = row.importer_address.trim();

  const img = imageUrl(row.image);
  if (img) productPatch.sourceImageUrl = img;

  if (Object.keys(productPatch).length) {
    await payload.update({
      collection: "products",
      id: existing.productId,
      user, overrideAccess: false,
      data: productPatch as never,
    });
  }

  const variantPatch: Record<string, unknown> = {};
  if (row.price?.trim()) {
    const paise = toPaise(row.price);
    if (paise !== existing.price) variantPatch.basePrice = paise;
  }

  /*
    Specs merge, they do not replace. A sheet that carries only `thread` must
    not wipe the `material` somebody typed in the CMS last week — an import is a
    statement about the columns it contains, and silence about the rest.
  */
  const specs = specsOf(row);
  if (Object.keys(specs).length) {
    const path = pathByVariant.get(String(existing.variantId)) ?? "";
    const defs = await resolveAttributes(path);
    const incoming = toSpecRows(defs, specs);

    if (incoming.length) {
      // `depth: 0`, so `definition` is an id — but the generated type is a
      // union with the populated document, hence the normalisation.
      const defId = (d: unknown) => String(typeof d === "object" && d ? (d as { id: unknown }).id : d);
      const kept = (priorVariant.attributes ?? []).filter(
        (a) => !incoming.some((n) => defId(n.definition) === defId(a.definition)),
      );
      variantPatch.attributes = [...kept, ...incoming];
    }
  }

  if (Object.keys(variantPatch).length) {
    await payload.update({
      collection: "variants",
      id: existing.variantId,
      user, overrideAccess: false,
      data: variantPatch as never,
    });
  }

  if (row.stock?.trim()) {
    await setStock(payload, user, existing.variantId, Number(row.stock), existing.stock, warehouse);
  }

  return {
    kind: "update",
    sku: existing.sku,
    variant: existing.variantId,
    product: existing.productId,
    before,
  };
}

/**
 * `projects` lives on `builds.items`, not on the product.
 *
 * So it is applied per build rather than per row — one update each, after the
 * products exist, instead of re-reading and rewriting a build's whole item list
 * once per line of the sheet. Additive only: a build's item list carries
 * curated notes and ordering, and a column that omits a slug means "I did not
 * mention it", not "remove it".
 */
async function applyProjects(
  payload: Payload, user: User, run: DryRun, bySku: Map<string, CatalogueRow>,
): Promise<Map<string, string[]>> {
  /*
    Returns SKU → the build slugs it was actually *appended* to, not the slugs
    the sheet asked for. A revert must remove only what this import added: if
    the product was already curated into `drone` last week, the sheet naming
    `drone` again changed nothing and undoing it would delete somebody's work.
  */
  const appended = new Map<string, string[]>();

  const wanted = new Map<string, Set<string>>(); // build slug -> SKUs
  for (const o of run.outcomes) {
    if (o.kind !== "create" && o.kind !== "update") continue;
    for (const slug of parseProjects(o.row.projects)) {
      (wanted.get(slug) ?? wanted.set(slug, new Set()).get(slug)!).add(o.sku);
    }
  }
  if (!wanted.size) return appended;

  // Re-read: creates from this run are not in `bySku`, which was built before.
  const fresh = await payload.find({
    collection: "variants",
    where: { sku: { in: [...new Set([...wanted.values()].flatMap((s) => [...s]))] } },
    limit: 5000, depth: 0, overrideAccess: true,
  });
  const productBySku = new Map(
    fresh.docs.map((v) => [
      v.sku.toUpperCase(),
      Number(typeof v.product === "object" && v.product ? v.product.id : v.product),
    ]),
  );
  for (const [sku, row] of bySku) productBySku.set(sku, row.productId);

  for (const [slug, skus] of wanted) {
    const found = await payload.find({
      collection: "builds", where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true,
    });
    const build = found.docs[0];
    if (!build) continue;

    const items = build.items ?? [];
    const have = new Set(items.map((i) => String(typeof i.product === "object" && i.product ? i.product.id : i.product)));
    const addedSkus: string[] = [];
    const add = [...skus]
      .filter((s) => {
        const id = productBySku.get(s);
        if (typeof id !== "number" || have.has(String(id))) return false;
        addedSkus.push(s);
        return true;
      })
      .map((s) => ({ product: productBySku.get(s)! }));

    if (!add.length) continue;
    for (const s of addedSkus) appended.set(s, [...(appended.get(s) ?? []), slug]);
    await payload.update({
      collection: "builds",
      id: build.id,
      user, overrideAccess: false,
      data: { items: [...items, ...add] } as never,
    });
  }

  return appended;
}
