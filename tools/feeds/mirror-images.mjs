#!/usr/bin/env node
/*
  Mirror every harvested product image to disk, once.

    node tools/feeds/mirror-images.mjs                 # all sources except onlyscrews
    node tools/feeds/mirror-images.mjs --only=robu     # one source
    node tools/feeds/mirror-images.mjs --include-onlyscrews
    node tools/feeds/mirror-images.mjs --limit=500     # bounded trial run

  246,271 distinct URLs, 19-55 GB. That size is the whole design: the job will be
  interrupted, so every part of it is resumable and nothing is fetched twice.

  `manifest.jsonl` is the resume log and the index — one line per URL, appended
  as it completes. Restarting reads it and skips what it already has, so the
  cost of stopping is one in-flight request rather than the run.

  Files are named by the SHA-1 of their *content*, not of their URL. Suppliers
  reuse one photograph across sizes — one robu shot serves five bearing sizes,
  and RB-1645749 (21x30) and RB-1645752 (15x24) are the same file — so
  content-addressing both saves the duplicate and makes the reuse measurable,
  which is the thing worth knowing about this imagery.

  Licence is untouched by any of this. Mirroring changes where a photograph is
  served from and nothing about who owns it; see tools/feeds/watermark.mjs.
  onlyscrews is excluded by default because it was ruled out and purged.
*/
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const OUT = "tools/feeds/out/images";
const MANIFEST = path.join(OUT, "manifest.jsonl");
const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split("=").slice(1).join("=") : (args.includes(`--${n}`) ? true : d);
};
const ONLY = flag("only");
const LIMIT = Number(flag("limit", 0)) || 0;
const INCLUDE_ONLYSCREWS = flag("include-onlyscrews", false);
const CONCURRENCY = Number(flag("concurrency", 12));
// Ten third-party servers, hours of traffic. Polite by construction.
const GAP_MS = Number(flag("gap", 60));

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg" };

/* ---- what to fetch ---- */
const feedDir = "tools/feeds/out";
const feeds = readdirSync(feedDir).filter(
  (f) => f.endsWith(".json") && !/state|mpn|comparison|purged|watermark|^_/.test(f),
);
const urlSource = new Map();
for (const f of feeds) {
  const src = f.replace(/\.json$/, "");
  if (ONLY && src !== ONLY) continue;
  if (src === "onlyscrews" && !INCLUDE_ONLYSCREWS) continue;
  const d = JSON.parse(readFileSync(path.join(feedDir, f), "utf8"));
  for (const r of Array.isArray(d) ? d : (d.rows ?? d.products ?? [])) {
    for (const u of [r.image, ...(r.images ?? [])]) {
      if (typeof u === "string" && u.startsWith("http") && !urlSource.has(u)) urlSource.set(u, src);
    }
  }
}

/* ---- resume ---- */
mkdirSync(OUT, { recursive: true });
const done = new Set();
if (existsSync(MANIFEST)) {
  for (const line of readFileSync(MANIFEST, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { done.add(JSON.parse(line).url); } catch { /* a torn last line from a kill */ }
  }
}

let queue = [...urlSource.keys()].filter((u) => !done.has(u));
if (LIMIT) queue = queue.slice(0, LIMIT);
console.log(`${urlSource.size.toLocaleString()} urls | ${done.size.toLocaleString()} already done | ${queue.length.toLocaleString()} to fetch`);
if (!queue.length) process.exit(0);

/* ---- fetch ---- */
let ok = 0, failed = 0, bytes = 0, dupes = 0, i = 0;
const started = Date.now();
const seenHash = new Set();

async function grab(url) {
  const src = urlSource.get(url);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "image/*,*/*" }, redirect: "follow" });
      if (!res.ok) {
        // 404 is a dead link, not a rate limit — no point retrying it.
        if (res.status === 404 || res.status === 410) return { url, src, status: res.status, error: "gone" };
        throw new Error(`HTTP ${res.status}`);
      }
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      const buf = Buffer.from(await res.arrayBuffer());
      if (!type.startsWith("image/")) return { url, src, status: res.status, error: `not an image (${type})` };
      const sha = createHash("sha1").update(buf).digest("hex");
      const file = path.join(src, `${sha}.${EXT[type] ?? "bin"}`);
      const abs = path.join(OUT, file);
      if (seenHash.has(sha) || existsSync(abs)) { dupes++; }
      else { mkdirSync(path.dirname(abs), { recursive: true }); writeFileSync(abs, buf); seenHash.add(sha); }
      return { url, src, status: res.status, file, sha, bytes: buf.length, type };
    } catch (e) {
      if (attempt === 2) return { url, src, error: String(e.message ?? e) };
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

async function worker() {
  while (i < queue.length) {
    const url = queue[i++];
    const rec = await grab(url);
    appendFileSync(MANIFEST, JSON.stringify(rec) + "\n");
    if (rec.error) failed++; else { ok++; bytes += rec.bytes ?? 0; }
    const n = ok + failed;
    if (n % 250 === 0) {
      const mins = (Date.now() - started) / 60000;
      const rate = n / mins;
      const left = (queue.length - n) / Math.max(rate, 1);
      console.log(`  ${n.toLocaleString()}/${queue.length.toLocaleString()} | ok ${ok.toLocaleString()} fail ${failed.toLocaleString()} dup ${dupes.toLocaleString()} | ${(bytes / 1e9).toFixed(2)} GB | ${rate.toFixed(0)}/min | ~${left.toFixed(0)} min left`);
    }
    if (GAP_MS) await new Promise((r) => setTimeout(r, GAP_MS));
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`done: ${ok.toLocaleString()} ok, ${failed.toLocaleString()} failed, ${dupes.toLocaleString()} duplicate content, ${(bytes / 1e9).toFixed(2)} GB`);
