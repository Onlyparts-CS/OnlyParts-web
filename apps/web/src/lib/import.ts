/**
 * Bulk import with a dry-run diff — docs/14-ADMIN-CATALOG-OPS.md §4.
 *
 * The rule this whole module exists to enforce: **nothing commits until a human
 * has seen the counts.** An import that changes 8,000 prices looks exactly like
 * one that changes 3 until you show the numbers.
 *
 * Pure. No database, no Payload, no `fs` — it takes the catalogue as an
 * argument and returns a diff. That is deliberate: the same function has to run
 * twice, once to show a human the counts and once on commit to decide what to
 * actually write, and those two answers must be produced by the same code. It
 * used to read the generated demo fixtures, which meant the diff described a
 * catalogue nobody was importing into.
 */

export type ImportRow = Record<string, string>;

/**
 * What the importer needs to know about a SKU that already exists.
 *
 * Deliberately not the `Sku` type from the storefront: this needs `variantId`
 * and `productId` to write against, and it must not drag rendering concerns
 * (glyphs, ratings, dispatch hours) into a module that decides what changes.
 */
export type CatalogueRow = {
  sku: string;
  variantId: number;
  productId: number;
  title: string;
  /** paise */
  price: number;
  stock: number;
  projects: string[];
  attrs: Record<string, string | number>;
};

/** Everything `dryRun` needs from the database, gathered once by the caller. */
export type ImportContext = {
  existing: CatalogueRow[];
  /** Build slugs, from the `builds` collection — a `projects` cell must match one. */
  projectSlugs: string[];
  /** Category paths, dotted, from `categories`. A new product must land on a leaf. */
  leafPaths: string[];
};

export type RowOutcome =
  | { kind: "create"; sku: string; row: ImportRow }
  | { kind: "update"; sku: string; row: ImportRow; changes: FieldChange[] }
  | { kind: "unchanged"; sku: string }
  | { kind: "error"; sku: string; row: ImportRow; errors: string[] };

export type FieldChange = { field: string; from: string; to: string };

export type DryRun = {
  outcomes: RowOutcome[];
  create: number;
  update: number;
  unchanged: number;
  errors: number;
  /** guard rails that stop the run regardless of row-level validity */
  blockers: string[];
  /**
   * A run large enough to look like a mis-mapped sheet, when it might not be.
   *
   * Separate from `blockers` because it is the one guard with a legitimate
   * reason to be passed: backfilling a column that did not exist yesterday
   * touches everything, and so does a genuine repricing. A rail that can never
   * be released is a rail an operator gets past by deleting the catalogue and
   * re-importing, which is the outcome it was put there to prevent.
   */
  bulkChange: { update: number; live: number; pct: number } | null;
  warnings: string[];
};

/** Columns the importer understands. Anything else is ignored with a warning. */
export const IMPORT_FIELDS = [
  "sku", "title", "price", "stock", "hsn", "gst_rate", "weight_g", "category", "projects",
  // Legal Metrology Rule 6(1). Optional on import for the same reason they are
  // optional on the collection: the data is on import documents, not on the
  // supplier's page, so requiring them here would reject the catalogue instead
  // of landing it as drafts. `Products` blocks the listing, not the row.
  "country_of_origin", "mrp", "net_quantity", "importer_name", "importer_address",
  "thread", "length_mm", "material", "finish", "grade",
  "bore_id_mm", "outer_od_mm", "width_mm", "seal_type",
  "dia_mm", "thickness_mm", "coating",
  "torque_ncm", "body_length_mm", "shaft_dia_mm",
  // Pipe-separated platform tokens as the supplier stated them — "NEMA17",
  // "Raspberry Pi 5", "R9 series". One more typed attribute rather than a
  // relationship table, because it is what pairs a part with the parts that
  // complete it, and a typed attribute is the mechanism the catalogue already
  // runs on. Never inferred from the title: a listing that says "Compatible
  // with Arduino" in prose has not declared anything.
  "compatibility",
  // The supplier's photograph, hotlinked rather than mirrored. Validated
  // against `IMAGE_HOSTS` on the way in — an image URL from a CSV is a URL the
  // Next optimiser will fetch server-side, so it is a trust boundary.
  "image",
] as const;

/**
 * The four Legal Metrology declarations that block a product going Active.
 *
 * `country_of_origin` is the deliberate exception and is not here — see the
 * note on it in `Products.ts`. One list because `dryRun` warns on it and the
 * importer decides `status` from it, and those two must not drift.
 */
export const RULE6_GATED = ["mrp", "net_quantity", "importer_name", "importer_address"] as const;

/** True when a row carries every declaration a live listing needs. */
export const rule6Complete = (row: ImportRow) =>
  RULE6_GATED.every((f) => row[f]?.trim());

/**
 * Core columns that live on the product and that a re-import may correct.
 *
 * Not `title` (diffed against a value we hold) and not `sku`, `category`,
 * `hsn`, `gst_rate`, `price`, `stock` or `projects`, which have their own
 * handling above.
 */
const PRODUCT_FIELDS = [
  "country_of_origin", "mrp", "net_quantity", "importer_name", "importer_address", "image",
] as const;

/** Columns that are the product/variant itself rather than one of its specs. */
const CORE_FIELDS = [
  "sku", "title", "price", "stock", "hsn", "gst_rate", "weight_g", "category", "projects",
  "country_of_origin", "mrp", "net_quantity", "importer_name", "importer_address",
  "image",
];

/**
 * Hosts an imported image may come from.
 *
 * `next/image` fetches whatever it is pointed at, from the server, before the
 * browser sees it — so an unrestricted `image` column is a CSV that can make
 * the app issue arbitrary outbound requests. These two are the only hosts the
 * harvested feeds actually use, and `next.config.ts` allowlists the same pair
 * so a URL that slipped past here still could not be optimised.
 */
export const IMAGE_HOSTS = ["cdn.shopify.com", "robu-prod-media.s3.ap-south-1.amazonaws.com"];

/** The image on a row, or "" when it is absent or not from a host we allow. */
/**
 * Filenames that are on a product page but are not a photograph of the product.
 *
 * A crawler takes the largest image it finds, which on a Shopify theme is
 * sometimes the theme's own furniture. Two products in the current sheet were
 * carrying `LeagueSpartan_30.png` — a type specimen for the shop's heading
 * font — as their catalogue photograph. Nothing downstream can tell that from
 * a screw, because it is a valid PNG on an allowed host.
 *
 * Deliberately narrow. Matching on "badge" or "panel" would throw away the
 * name-badge magnets and solar panels this catalogue actually sells, so this
 * only names things that cannot be a product here.
 */
const NOT_A_PRODUCT = /leaguespartan|(^|[-_/])(logo|favicon|placeholder|sprite)[-_.]|\.svg$/i;

export function imageUrl(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || !IMAGE_HOSTS.includes(u.host)) return "";
    return NOT_A_PRODUCT.test(u.pathname) ? "" : v;
  } catch {
    return "";
  }
}

/**
 * Countries the `products.countryOfOrigin` select accepts.
 *
 * Duplicated from the collection rather than imported, because this module is
 * parsed in the browser for the dry run and importing a Payload collection
 * drags the server bundle in with it. `import.check.ts` asserts the two lists
 * agree, so the copy cannot drift silently.
 */
export const ORIGINS = [
  "India", "China", "Taiwan", "Hong Kong", "Japan", "South Korea", "Vietnam",
  "Malaysia", "Thailand", "Singapore", "Indonesia", "Philippines",
  "Germany", "Italy", "France", "United Kingdom", "Switzerland", "Netherlands",
  "Czech Republic", "Poland", "Turkey", "Israel",
  "United States", "Canada", "Mexico", "Brazil", "Australia",
];

/** The rates the `products.gstRate` select accepts. */
export const GST_RATES = ["0", "5", "12", "18", "28"];

/**
 * `projects` is a pipe-separated list of build slugs — the "Used in these
 * projects" block on the product page. It is set here, on upload, because it is
 * a curatorial judgement: whoever loads the part knows whether it actually
 * belongs in a drone build. Deriving it from the category tree put every
 * fastener in every build.
 *
 * The relationship lives on `builds.items`, not on the product, so importing it
 * appends the product to those builds. It never removes: a build's item list
 * carries curated notes and ordering, and a CSV that omits a slug almost always
 * means "I did not mention it", not "delete it".
 */
function parseProjects(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[|;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const NUMERIC = new Set([
  "price", "stock", "weight_g", "mrp", "length_mm", "bore_id_mm", "outer_od_mm", "width_mm",
  "dia_mm", "thickness_mm", "torque_ncm", "body_length_mm", "shaft_dia_mm",
]);

/**
 * CSV parser — quoted fields, embedded commas, and embedded newlines.
 *
 * The newline case is the one that matters and the one the first version got
 * wrong. It split on `\n` before it looked at quotes, so a description
 * containing a line break — which Excel, Sheets and every product feed emit as
 * a quoted multi-line field, entirely legally — was torn into two rows. The
 * second half then had the tail of a description sitting in the `sku` column.
 *
 * That failed loudly enough to notice here (eleven rows out of 107,509, caught
 * because a mangled SKU happens to be invalid) but the quiet version is worse:
 * split a row whose remainder lines up plausibly and it imports as a real
 * product with someone else's price.
 *
 * So the scan runs over the whole document, and a newline only ends a record
 * when it is not inside quotes.
 */
export function parseCsv(text: string): { headers: string[]; rows: ImportRow[] } {
  const src = text.replace(/\r\n?/g, "\n");
  const records: string[][] = [];
  let record: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c !== '"') cur += c;
      else if (src[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = false;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { record.push(cur); cur = ""; }
    else if (c === "\n") { record.push(cur); records.push(record); record = []; cur = ""; }
    else cur += c;
  }
  record.push(cur);
  records.push(record);

  // Blank lines are not records — including the one a trailing newline leaves.
  const clean = records.map((r) => r.map((s) => s.trim())).filter((r) => r.some(Boolean));
  if (!clean.length) return { headers: [], rows: [] };

  const headers = clean[0].map((h) => h.toLowerCase());
  const rows = clean.slice(1).map((cells) => {
    const row: ImportRow = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
  return { headers, rows };
}

function validate(row: ImportRow, existing: CatalogueRow | undefined, ctx: ImportContext): string[] {
  const errors: string[] = [];
  const sku = (row.sku ?? "").trim();

  if (!sku) errors.push("sku is required");
  else if (!/^[A-Za-z0-9][A-Za-z0-9-]{3,}$/.test(sku)) errors.push(`sku "${sku}" is malformed`);

  if (!existing && !row.title?.trim()) errors.push("title is required for a new product");

  for (const f of NUMERIC) {
    const v = row[f];
    if (v === undefined || v === "") continue;
    if (!Number.isFinite(Number(v))) errors.push(`${f}: "${v}" is not a number`);
    else if (Number(v) < 0) errors.push(`${f} cannot be negative`);
  }

  if (row.price !== undefined && row.price !== "" && Number(row.price) <= 0)
    errors.push("price must be greater than zero");

  // HSN blocks GST invoicing downstream — catch it at import, not at checkout
  if (!existing && !row.hsn?.trim()) errors.push("hsn is required for a new product");
  if (row.hsn && !/^\d{8}$/.test(row.hsn.trim())) errors.push(`hsn "${row.hsn}" must be 8 digits`);

  if (row.gst_rate && !GST_RATES.includes(row.gst_rate.trim()))
    errors.push(`gst_rate "${row.gst_rate}" must be one of ${GST_RATES.join(", ")}`);

  /*
    Origin is checked against the closed list rather than accepted as typed.

    "PRC", "Made in China" and "china" are all the same country and all
    different facet values, and sub-rule 10A asks for a filter buyers can
    actually use. Rejecting the row is the cheap correction; discovering the
    split after 40,000 listings is not.
  */
  if (row.country_of_origin?.trim() && !ORIGINS.includes(row.country_of_origin.trim()))
    errors.push(
      `country_of_origin "${row.country_of_origin}" is not a recognised country — it must match the list exactly, e.g. "India", "China", "United States"`,
    );

  // MRP is a ceiling, not a suggestion: selling above it is the offence.
  if (row.mrp?.trim() && row.price?.trim() && Number(row.mrp) > 0 && Number(row.price) > Number(row.mrp))
    errors.push(`price ${row.price} is above the MRP ${row.mrp} — the MRP is the maximum, inclusive of all taxes`);

  /*
    Two columns are only required when the row is a create, and both are
    required because something downstream silently breaks without them: with no
    category the product is filed nowhere and is unreachable by browsing, and
    with no weight the shipping charge is computed against zero grams.
  */
  if (!existing) {
    const path = (row.category ?? "").trim();
    if (!path) errors.push("category is required for a new product");
    else if (!ctx.leafPaths.includes(path))
      errors.push(`category "${path}" is not a leaf category — a product cannot be filed on a branch`);

    if (!(row.weight_g ?? "").trim()) errors.push("weight_g is required for a new product — it decides the shipping charge");
    else if (Number(row.weight_g) <= 0) errors.push("weight_g must be greater than zero");
  }

  // A typo here would silently drop the part out of a build page, or invent a
  // collection that does not exist — fail the row instead.
  const bad = parseProjects(row.projects).filter((p) => !ctx.projectSlugs.includes(p));
  if (bad.length)
    errors.push(`unknown project ${bad.length > 1 ? "slugs" : "slug"} ${bad.map((b) => `"${b}"`).join(", ")} — expected one of ${ctx.projectSlugs.join(", ") || "(no builds defined)"}`);

  return errors;
}

export function dryRun(rows: ImportRow[], headers: string[], ctx: ImportContext): DryRun {
  const outcomes: RowOutcome[] = [];
  const seen = new Set<string>();
  const blockers: string[] = [];
  const warnings: string[] = [];

  const bySku = new Map(ctx.existing.map((e) => [e.sku.toUpperCase(), e]));

  const unknown = headers.filter((h) => h && !IMPORT_FIELDS.includes(h as never));
  if (unknown.length) warnings.push(`Ignored unrecognised columns: ${unknown.join(", ")}`);
  if (!headers.includes("sku")) blockers.push("No `sku` column — every row must identify a product.");

  /*
    Say it before the commit, not after.

    Rows without the four Rule 6(1) declarations land in Draft and stay off the
    storefront. That is correct — inventing an MRP is the offence the rule
    exists to punish — but discovering it from an empty catalogue an hour later
    is not. Which columns are missing is more useful than how many rows.
  */
  const missing = RULE6_GATED.filter((f) => !headers.includes(f));
  const drafts = rows.filter((r) => !rule6Complete(r)).length;
  if (drafts) {
    warnings.push(
      `${drafts.toLocaleString()} row${drafts === 1 ? "" : "s"} will land as Draft and stay off the storefront — ` +
        `Legal Metrology Rule 6(1) needs ${RULE6_GATED.join(", ")} before a product can go Active` +
        (missing.length ? `. This sheet has no ${missing.join(", ")} column${missing.length === 1 ? "" : "s"}.` : "."),
    );
  }

  for (const row of rows) {
    const sku = (row.sku ?? "").trim().toUpperCase();
    const existing = sku ? bySku.get(sku) : undefined;
    const errors = validate(row, existing, ctx);

    if (sku && seen.has(sku)) errors.push(`duplicate sku "${sku}" in this file`);
    if (sku) seen.add(sku);

    if (errors.length) { outcomes.push({ kind: "error", sku, row, errors }); continue; }
    if (!existing) { outcomes.push({ kind: "create", sku, row }); continue; }

    const changes = diff(existing, row);
    outcomes.push(changes.length
      ? { kind: "update", sku, row, changes }
      : { kind: "unchanged", sku });
  }

  const count = (k: RowOutcome["kind"]) => outcomes.filter((o) => o.kind === k).length;
  const update = count("update");

  // Guard rail from docs/14 §3.3 — a run that rewrites most of the catalogue is
  // almost always a broken mapping, not a real repricing.
  const live = ctx.existing.length;
  const bulkChange = update > live * 0.5 && live > 0
    ? { update, live, pct: Math.round((update / live) * 100) }
    : null;
  if (count("error") > rows.length * 0.2 && rows.length > 10) {
    warnings.push(`${count("error")} of ${rows.length} rows failed validation — the column mapping may be wrong.`);
  }

  /*
    `title` lives on the product, and a product owns every variant under it. So
    a sheet listing twenty lengths of one screw with twenty slightly different
    titles rewrites the same field twenty times and the last row silently wins —
    and the other nineteen SKUs get renamed along with it. Worth saying out
    loud, because nothing about a spreadsheet suggests it.
  */
  const titlesByProduct = new Map<string, Set<string>>();
  for (const o of outcomes) {
    if (o.kind !== "update" || !o.row.title?.trim()) continue;
    const pid = String(bySku.get(o.sku)?.productId ?? "");
    if (!pid) continue;
    (titlesByProduct.get(pid) ?? titlesByProduct.set(pid, new Set()).get(pid)!).add(o.row.title.trim());
  }
  const clashing = [...titlesByProduct.values()].filter((s) => s.size > 1).length;
  if (clashing > 0) {
    warnings.push(
      `${clashing} product${clashing > 1 ? "s have" : " has"} rows carrying different titles. ` +
      `A title belongs to the product, not the variant — every SKU under it will end up with the last one.`,
    );
  }

  return {
    outcomes,
    create: count("create"),
    update,
    unchanged: count("unchanged"),
    errors: count("error"),
    blockers,
    bulkChange,
    warnings,
  };
}

function diff(existing: CatalogueRow, row: ImportRow): FieldChange[] {
  const changes: FieldChange[] = [];
  const push = (field: string, from: unknown, to: unknown) => {
    const f = String(from ?? ""), t = String(to ?? "");
    if (t !== "" && f !== t) changes.push({ field, from: f, to: t });
  };

  if (row.title) push("title", existing.title, row.title);
  if (row.price) push("price", (existing.price / 100).toFixed(2), Number(row.price).toFixed(2));
  if (row.stock) push("stock", existing.stock, row.stock);
  if (row.projects) {
    // Additive: only slugs the product is not already in count as a change.
    const add = parseProjects(row.projects).filter((p) => !existing.projects.includes(p));
    if (add.length) push("projects", existing.projects.join("|") || "—", [...existing.projects, ...add].join("|"));
  }

  for (const [k, v] of Object.entries(row)) {
    if (CORE_FIELDS.includes(k)) continue;
    if (!IMPORT_FIELDS.includes(k as never) || !v) continue;
    push(k, existing.attrs[k], v);
  }

  /*
    Product-level columns the preview used to stay silent about.

    `updateRow` writes these now, and a diff that does not mention a field the
    commit is about to change is worse than no diff — the whole contract of
    this screen is that nothing lands until a human has seen the counts.

    `existing` does not carry their current values (it is built for matching,
    not for rendering), so these show as "set" rather than "a -> b". That is
    honest about what is known: the sheet has a value and the commit will
    apply it. Widening `CatalogueRow` to diff them properly costs a column per
    field on a query that already reads the whole catalogue.
  */
  for (const k of PRODUCT_FIELDS) {
    if (row[k]?.trim()) push(k, "", row[k].trim());
  }

  return changes;
}

/** The specs on a row — everything the importer understands that is not core. */
export function specsOf(row: ImportRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (CORE_FIELDS.includes(k)) continue;
    if (!IMPORT_FIELDS.includes(k as never) || !v?.trim()) continue;
    out[k] = v.trim();
  }
  return out;
}

export { parseProjects };

/** Errors download as the original sheet plus an `_error` column. */
export function errorCsv(outcomes: RowOutcome[], headers: string[]): string {
  const errs = outcomes.filter((o): o is Extract<RowOutcome, { kind: "error" }> => o.kind === "error");
  const cols = [...headers, "_error"];
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [
    cols.join(","),
    ...errs.map((e) => cols.map((c) => esc(c === "_error" ? e.errors.join("; ") : e.row[c] ?? "")).join(",")),
  ].join("\n");
}

/**
 * A sample that exercises every outcome against the real catalogue.
 *
 * The first two SKUs exist in the seeded catalogue, so they demonstrate an
 * update and — because the values match — an unchanged row. The rest are
 * deliberate: one clean create, and three rows that each fail a different way,
 * because an importer whose sample only ever succeeds teaches nothing about
 * what it does when a sheet is wrong.
 */
export const SAMPLE_CSV = `sku,title,price,stock,hsn,gst_rate,weight_g,category,seal_type,bore_id_mm,outer_od_mm,width_mm
BR-6000-ZZ-CS,,24.50,1500,,,,,,,,
BR-6000-2RS-CS,,,,,,,,,,,
BR-6210-ZZ-CS,6210ZZ Deep Groove Ball Bearing,148.00,300,84821011,18,462,bearings.ball-bearings.deep-groove,ZZ,50,90,20
BR-NO-CATEGORY,6003ZZ Deep Groove Ball Bearing,33.00,400,84821011,18,24,,ZZ,17,35,10
BR-BAD-HSN,6004ZZ Deep Groove Ball Bearing,35.00,300,999,18,28,bearings.ball-bearings.deep-groove,ZZ,20,42,12
BR-BAD-ROW,,-5,abc,84821011,18,30,bearings.ball-bearings.deep-groove,ZZ,25,47,12`;
