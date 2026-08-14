import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv, dryRun, ORIGINS, IMPORT_FIELDS, specsOf, rule6Complete, RULE6_GATED, imageUrl } from "./import.ts";
import { SCHEMAS, UNIVERSAL } from "./taxonomy.ts";

/**
 * Run: `node src/lib/import.check.ts` from `apps/web`.
 *
 * A CSV parser that mis-splits one row does not fail — it invents a product.
 * Every case below is one that produced a wrong row rather than an error.
 */

/* the basics still work */
{
  const { headers, rows } = parseCsv("sku,price\nOP-1,10\nOP-2,20\n");
  assert.deepEqual(headers, ["sku", "price"]);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].sku, "OP-2");
}

/* quoted commas do not split a field */
{
  const { rows } = parseCsv('sku,title\nOP-1,"M3 x 10, SS304, pack of 25"\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "M3 x 10, SS304, pack of 25");
}

/* escaped quotes survive */
{
  const { rows } = parseCsv('sku,title\nOP-1,"1/4"" drive socket"\n');
  assert.equal(rows[0].title, '1/4" drive socket');
}

/*
  The regression. A quoted field containing a newline is one record, not two.

  The old parser split on \n first, so this produced a second row whose `sku`
  was "and a second line" — eleven of these appeared in a 107,509-row feed, and
  they were only caught because a mangled SKU happens to fail validation.
*/
{
  const { rows } = parseCsv('sku,description,price\nOP-1,"first line\nand a second line",99\n');
  assert.equal(rows.length, 1, "an embedded newline must not start a new record");
  assert.equal(rows[0].sku, "OP-1");
  assert.equal(rows[0].description, "first line\nand a second line");
  assert.equal(rows[0].price, "99");
}

/* CRLF, and a bare CR, both behave like LF */
{
  assert.equal(parseCsv("sku,price\r\nOP-1,10\r\n").rows.length, 1);
  assert.equal(parseCsv("sku,price\rOP-1,10\r").rows.length, 1);
}

/* blank lines are not products */
{
  const { rows } = parseCsv("sku,price\n\nOP-1,10\n\n\n");
  assert.equal(rows.length, 1);
}

/* nothing in, nothing out */
{
  assert.deepEqual(parseCsv(""), { headers: [], rows: [] });
  assert.deepEqual(parseCsv("\n\n"), { headers: [], rows: [] });
}

/* short rows pad rather than shift */
{
  const { rows } = parseCsv("sku,price,stock\nOP-1,10\n");
  assert.equal(rows[0].stock, "");
}

/*
  Round trip against what the feed writer actually emits.

  `cell()` in tools/feeds/pull.mjs is reproduced here rather than imported —
  it lives in a script that runs on import. If that escaping ever changes,
  this copy is the thing that should fail.
*/
{
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const title = 'He said "yes", then\nleft';
  const csv = `sku,title,price\n${["OP-1", title, "10"].map(cell).join(",")}\n`;

  const round = parseCsv(csv);
  assert.equal(round.rows.length, 1);
  assert.equal(round.rows[0].title, title);
  assert.equal(round.rows[0].price, "10");
}

console.log("import.check.ts — all assertions passed");

/* ------------------------------------------------------------------ *
 * Legal Metrology Rule 6(1) columns
 * ------------------------------------------------------------------ */

const ctx = { existing: [], projectSlugs: [], leafPaths: ["fasteners.nuts.hex-nuts"] };
const base: Record<string, string> = {
  sku: "OP-LM1", title: "M3 Hex Nut", price: "100", stock: "5",
  hsn: "73181600", gst_rate: "18", weight_g: "2", category: "fasteners.nuts.hex-nuts",
};
const errs = (extra: Record<string, string> = {}) => {
  const row = { ...base, ...extra };
  const headers = Object.keys(row);
  const csv = `${headers.join(",")}\n${headers.map((h) => row[h]).join(",")}\n`;
  const parsed = parseCsv(csv);
  const out = dryRun(parsed.rows, parsed.headers, ctx);
  const o = out.outcomes[0];
  return o.kind === "error" ? o.errors : [];
};

/*
  The list is duplicated into import.ts so the dry run can parse in the browser
  without dragging the Payload collection in. Duplication is fine; drift is not
  — a country the importer accepts and the collection rejects is a row that
  passes the dry run and fails the write.
*/
{
  const collection = readFileSync(new URL("../collections/Products.ts", import.meta.url), "utf8");
  const block = collection.slice(collection.indexOf("const ORIGINS = ["));
  const inCollection = [...block.slice(0, block.indexOf("] as const")).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ORIGINS, inCollection, "ORIGINS in import.ts must match Products.ts exactly");
}

/* the five columns are accepted and are not "unknown column" warnings */
{
  const e = errs({
    country_of_origin: "India", mrp: "150", net_quantity: "1 piece",
    importer_name: "OnlyParts", importer_address: "Pune",
  });
  assert.deepEqual(e, [], `clean Rule 6 row should pass, got ${JSON.stringify(e)}`);
}

/* ...and stay optional, because 116,719 supplier rows arrive without them */
{
  assert.deepEqual(errs({}), [], "Rule 6 fields must not block an import");
}

/*
  A row without the four declarations is a Draft, not an error — and the dry run
  has to say so before the operator commits.

  The importer used to create every row `status: "active"`, which the collection
  gate then rejected. 2,150 of 3,800 rows failed on a real feed with a raw
  Payload field error, after the commit, with nothing written.
*/
{
  const full = {
    mrp: "150", net_quantity: "1 piece",
    importer_name: "OnlyParts", importer_address: "Bengaluru, Karnataka, India",
  };
  assert.equal(rule6Complete({ ...base, ...full } as never), true, "all four present -> Active");

  for (const drop of RULE6_GATED) {
    const partial = { ...full, [drop]: "" };
    assert.equal(
      rule6Complete({ ...base, ...partial } as never), false,
      `missing ${drop} must hold the row in Draft rather than fail the write`,
    );
  }

  const warn = (extra: Record<string, string>) => {
    const row = { ...base, ...extra };
    const headers = Object.keys(row);
    const csv = `${headers.join(",")}\n${headers.map((h) => row[h]).join(",")}\n`;
    const parsed = parseCsv(csv);
    return dryRun(parsed.rows, parsed.headers, ctx).warnings;
  };

  const bare = warn({});
  assert.ok(
    bare.some((w) => /will land as Draft/.test(w)),
    `the dry run must warn about drafts before the commit, got ${JSON.stringify(bare)}`,
  );
  assert.ok(
    bare.some((w) => /no mrp, net_quantity, importer_name, importer_address column/.test(w)),
    "and name the columns the sheet is missing",
  );
  assert.ok(
    !warn(full).some((w) => /will land as Draft/.test(w)),
    "a complete sheet must not be warned at",
  );
}

/* an origin off the list splits the 10A facet — reject it at the row */
{
  const e = errs({ country_of_origin: "PRC" });
  assert.equal(e.length, 1);
  assert.match(e[0], /not a recognised country/);
}

/* MRP is a ceiling: selling above it is the offence, so catch it before listing */
{
  const e = errs({ mrp: "90", price: "100" });
  assert.equal(e.length, 1);
  assert.match(e[0], /above the MRP/);
}
{
  assert.deepEqual(errs({ mrp: "100", price: "100" }), [], "price may equal MRP");
}

/* MRP is money and goes through the numeric guard */
{
  const e = errs({ mrp: "abc" });
  assert.ok(e.some((x: string) => /mrp: "abc" is not a number/.test(x)), JSON.stringify(e));
}

/*
  Every spec column the importer accepts must be declared by some attribute
  definition, or the value is discarded without a word.

  `toSpecRows` emits a row only where `resolveAttributes` returned a definition
  with that key. A column in `IMPORT_FIELDS` that no `AttrDef` declares passes
  the dry run, shows in the diff, commits — and lands nowhere. That is how
  `compatibility` came to be parsed out of 840 supplier listings, written to
  the CSV, and then thrown away on import, with `worksWith` left permanently
  unable to match on a platform token because the column reached the database
  empty every time.

  `UNIVERSAL` is the floor here: it is seeded on every L1 drawer and inherited,
  so this assertion is really "the floor covers what the importer accepts".
*/
{
  const declared = new Set([
    ...UNIVERSAL.map((a) => a.key),
    ...Object.values(SCHEMAS).flatMap((defs) => defs.map((d) => d.key)),
  ]);

  // Whatever `specsOf` keeps out of a full row is exactly the set that needs a
  // definition — derived rather than re-listed, so a new column is covered the
  // day it is added instead of the day someone remembers this file.
  const specKeys = Object.keys(
    specsOf(Object.fromEntries(IMPORT_FIELDS.map((f) => [f, "x"]))),
  );
  const orphans = specKeys.filter((k) => !declared.has(k));

  assert.deepEqual(
    orphans, [],
    `these import columns resolve to no attribute definition and would be silently dropped: ${orphans.join(", ")}`,
  );
  assert.ok(specKeys.includes("compatibility"), "compatibility must be a spec, not a core field");
}

/*
  The image column is a trust boundary, not a convenience.

  `next/image` fetches whatever it is pointed at, server-side, before the
  browser is involved. An unvalidated `image` cell in an uploaded CSV is a
  request this server makes on a stranger's behalf.
*/
{
  const ok = "https://cdn.shopify.com/s/files/1/x/screw.jpg?v=1";
  assert.equal(imageUrl(ok), ok, "an allowlisted host passes through unchanged");
  assert.equal(
    imageUrl("https://robu-prod-media.s3.ap-south-1.amazonaws.com/a.png"),
    "https://robu-prod-media.s3.ap-south-1.amazonaws.com/a.png",
  );

  for (const bad of [
    "http://cdn.shopify.com/a.jpg",              // downgraded to http
    "https://evil.example.com/a.jpg",            // host not on the list
    "https://cdn.shopify.com.evil.com/a.jpg",    // suffix that looks like the list
    "file:///etc/passwd",                        // not even http
    "http://169.254.169.254/latest/meta-data/",  // link-local metadata
    "//cdn.shopify.com/a.jpg",                   // protocol-relative, no host to parse
    "not a url",
    "",
    undefined,
  ]) {
    assert.equal(imageUrl(bad as string), "", `must reject ${JSON.stringify(bad)}`);
  }
}

/*
  A re-import must be able to correct a product-level field, and the preview
  must say so before it does.

  These were read, diffed against nothing, and applied only on create. The
  catalogue could not be fixed by re-uploading a corrected sheet — only by
  deleting it and starting again.
*/
{
  const ctx2 = {
    ...ctx,
    existing: [{
      sku: "OP-LM1", variantId: 1, productId: 1, title: "M3 Hex Nut",
      price: 10000, stock: 5, projects: [], attrs: {},
    }],
  };
  const changed = (extra: Record<string, string>) => {
    const row = { ...base, ...extra };
    const headers = Object.keys(row);
    const csv = `${headers.join(",")}\n${headers.map((h) => row[h]).join(",")}\n`;
    const parsed = parseCsv(csv);
    const o = dryRun(parsed.rows, parsed.headers, ctx2).outcomes[0];
    return o.kind === "update" ? o.changes.map((c) => c.field) : [];
  };

  const fields = changed({
    mrp: "150", net_quantity: "1 piece",
    importer_name: "OnlyParts", importer_address: "Bengaluru",
    country_of_origin: "India",
    image: "https://cdn.shopify.com/s/files/1/x/nut.jpg",
  });
  for (const f of ["mrp", "net_quantity", "importer_name", "importer_address", "country_of_origin", "image"]) {
    assert.ok(fields.includes(f), `${f} must appear in the diff, got ${JSON.stringify(fields)}`);
  }

  // A sheet that omits a column means "I did not mention it", not "blank it".
  assert.deepEqual(changed({}), [], "an unchanged row is still unchanged");
}

console.log("import.check.ts — Rule 6(1) assertions passed");
