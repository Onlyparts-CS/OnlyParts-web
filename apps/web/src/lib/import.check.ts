import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv, dryRun, ORIGINS } from "./import.ts";

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

console.log("import.check.ts — Rule 6(1) assertions passed");
