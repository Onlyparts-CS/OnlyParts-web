/**
 * Builds one importable CSV out of the harvested feeds, balanced across drawers.
 *
 *   npx tsx scripts/sample-feeds.ts [rows] [--selftest]
 *
 * Why not just take the first N rows: the harvest is 77% electronic-components
 * (92,000 of 116,723 mapped rows), so any unstratified slice is an electronics
 * shop with a fasteners page that says "nothing here yet". This spreads the
 * quota evenly over the 14 drawers, then evenly again over each drawer's leaves,
 * so every category page has stock.
 *
 * The default target is deliberately short of the 5,000 read ceiling in
 * `catalogDb.ts` — `seed-catalogue.ts` has already put ~1,172 generated SKUs in
 * front of these, and rows past 5,000 are silently invisible to the storefront.
 *
 * Output goes to `tools/feeds/out/demo-sample.csv`. Upload it at /admin/import;
 * the dry run there is the validation pass, not this script.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, type ImportRow } from "../src/lib/import";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "../../../tools/feeds/out");
const OUT_FILE = path.join(OUT_DIR, "demo-sample.csv");

/**
 * Hands out `target` places over buckets that hold at most `caps[i]` each,
 * as evenly as the caps allow. A bucket that runs dry gives its share back to
 * the ones that have not — which is the whole point, since `magnets` has 90
 * rows and `electronic-components` has 92,000.
 */
export function allocate(target: number, caps: number[]): number[] {
  const out = caps.map(() => 0);
  let remaining = Math.max(0, target);
  let active = caps.map((_, i) => i).filter((i) => caps[i] > 0);

  while (remaining > 0 && active.length) {
    const share = Math.max(1, Math.floor(remaining / active.length));
    let progressed = false;
    for (const i of active) {
      if (remaining <= 0) break;
      const give = Math.min(share, caps[i] - out[i], remaining);
      if (give > 0) {
        out[i] += give;
        remaining -= give;
        progressed = true;
      }
    }
    active = active.filter((i) => out[i] < caps[i]);
    if (!progressed) break;
  }
  return out;
}

/** `n` evenly-spaced picks out of `items` — the head of a feed is one supplier's
 *  alphabetical first page, which is not a sample of anything. */
export function spread<T>(items: T[], n: number): T[] {
  if (n >= items.length) return items.slice();
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
}

/** Rows the importer would reject anyway — dropped here so the dry run is readable. */
function usable(r: ImportRow): boolean {
  return (
    /^[A-Za-z0-9][A-Za-z0-9-]{3,}$/.test((r.sku ?? "").trim()) &&
    Boolean(r.title?.trim()) &&
    Boolean(r.category?.trim()) &&
    /^\d{8}$/.test((r.hsn ?? "").trim()) &&
    Number(r.price) > 0 &&
    Number(r.weight_g) > 0
  );
}

const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

function main(target: number) {
  const files = fs.readdirSync(OUT_DIR).filter((f) => /\.\d{3}\.csv$/.test(f)).sort();
  if (!files.length) throw new Error(`No feed chunks in ${OUT_DIR} — run tools/feeds/pull.mjs first.`);

  let headers: string[] = [];
  const bySku = new Map<string, ImportRow>();
  let read = 0;

  for (const f of files) {
    const { headers: h, rows } = parseCsv(fs.readFileSync(path.join(OUT_DIR, f), "utf8"));
    if (!headers.length) headers = h;
    else if (h.join() !== headers.join()) throw new Error(`${f} has a different header to ${files[0]}`);
    read += rows.length;
    // Last write wins on a duplicate SKU; the feeds overlap on re-listed parts.
    for (const r of rows) if (usable(r)) bySku.set(r.sku.trim().toUpperCase(), r);
  }

  // leaf path -> rows, and drawer -> its leaf paths.
  const byLeaf = new Map<string, ImportRow[]>();
  for (const r of bySku.values()) {
    const k = r.category.trim();
    (byLeaf.get(k) ?? byLeaf.set(k, []).get(k)!).push(r);
  }
  const drawers = new Map<string, string[]>();
  for (const leaf of byLeaf.keys()) {
    const d = leaf.split(".")[0];
    (drawers.get(d) ?? drawers.set(d, []).get(d)!).push(leaf);
  }

  const names = [...drawers.keys()].sort();
  const quota = allocate(target, names.map((d) => drawers.get(d)!.reduce((n, l) => n + byLeaf.get(l)!.length, 0)));

  const picked: ImportRow[] = [];
  const report: [string, number, number][] = [];
  names.forEach((d, i) => {
    const leaves = drawers.get(d)!.sort();
    const per = allocate(quota[i], leaves.map((l) => byLeaf.get(l)!.length));
    leaves.forEach((l, j) => picked.push(...spread(byLeaf.get(l)!, per[j])));
    report.push([d, quota[i], leaves.length]);
  });

  picked.sort((a, b) => a.sku.localeCompare(b.sku));
  fs.writeFileSync(
    OUT_FILE,
    [headers.join(","), ...picked.map((r) => headers.map((h) => esc(r[h] ?? "")).join(","))].join("\n") + "\n",
  );

  console.log(`read ${read.toLocaleString("en-IN")} rows from ${files.length} chunks · ${bySku.size.toLocaleString("en-IN")} usable & unique\n`);
  for (const [d, n, leaves] of report.sort((a, b) => b[1] - a[1])) {
    console.log(`  ${d.padEnd(24)} ${String(n).padStart(5)}  across ${leaves} categories`);
  }
  console.log(`\nwrote ${picked.length.toLocaleString("en-IN")} rows -> ${OUT_FILE}`);
}

function selftest() {
  const eq = (a: unknown, b: unknown, m: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  };
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  eq(sum(allocate(10, [5, 5, 5])), 10, "hands out the whole target when there is room");
  eq(allocate(100, [1, 1, 1]), [1, 1, 1], "never exceeds a cap");
  eq(allocate(0, [5]), [0], "zero target");
  eq(allocate(5, []), [], "no buckets");
  eq(allocate(9, [1, 100]), [1, 8], "a dry bucket gives its share back");
  // The property that matters: a huge bucket must not eat the target.
  const a = allocate(300, [90, 92000, 1670]);
  eq(sum(a), 300, "balanced sum");
  if (a[1] > 150) throw new Error(`the 92k bucket took ${a[1]} of 300 — not balanced`);
  if (a[0] !== 90) throw new Error(`the 90-row bucket should be exhausted, got ${a[0]}`);

  eq(spread([1, 2, 3, 4, 5, 6], 3), [1, 3, 5], "evenly spaced, not the head");
  eq(spread([1, 2], 9), [1, 2], "asking for more than exists returns everything");
  eq(new Set(spread([...Array(1000).keys()], 137)).size, 137, "picks stay distinct");

  eq(usable({ sku: "OS-X1", title: "t", category: "a.b", hsn: "73181500", price: "1", weight_g: "5" }), true, "good row");
  eq(usable({ sku: "OS-X1", title: "t", category: "", hsn: "73181500", price: "1", weight_g: "5" }), false, "no category");
  eq(usable({ sku: "OS-X1", title: "t", category: "a.b", hsn: "731", price: "1", weight_g: "5" }), false, "short hsn");
  eq(usable({ sku: "OS-X1", title: "t", category: "a.b", hsn: "73181500", price: "0", weight_g: "5" }), false, "free");
  console.log("sample-feeds.ts — ok");
}

if (process.argv.includes("--selftest")) selftest();
else main(Number(process.argv[2]) || 3800);
