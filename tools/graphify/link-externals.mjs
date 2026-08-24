/*
  Give every import target a node, so the edge to it survives the build.

  graphify's AST mints an id for each import target — `ref_next_link` for
  `next/link` — but creates a node only for targets that are files inside the
  scanned corpus. `build.py:1163` then drops any edge whose endpoint has no
  node, commented "expected, not an error", which it is: an external package is
  not part of the corpus.

  The cost is that the graph cannot answer "what imports payload?", and the
  diagnostic reports the loss as 370 dangling edges, which reads like
  corruption and is not.

  Two kinds of target are missing, and only one of them is genuinely external:

    - packages (react, next/link, node:path) — 39 of 45 here
    - `src/payload-types.ts` — a real repo file that is gitignored because it is
      generated, so `detect` never scans it. Its edges were being dropped as if
      it were a third-party package.

  The label is read out of the source line the edge points at rather than
  reconstructed from the flattened id: `ref_payloadcms_richtext_lexical_client`
  cannot be turned back into `@payloadcms/richtext-lexical/client` without
  guessing where the slashes and the @ went.
*/
import { readFileSync, writeFileSync } from "node:fs";

const EXTRACT = "graphify-out/.graphify_extract.json";
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const g = JSON.parse(readFileSync(EXTRACT, "utf8"));
const ids = new Set(g.nodes.map((n) => n.id));

// One representative edge per missing endpoint: whichever mentions it first.
const missing = new Map();
for (const e of g.edges) {
  for (const end of [e.source, e.target]) {
    if (!ids.has(end) && !missing.has(end)) missing.set(end, e);
  }
}

const lineCache = new Map();
function specifierAt(file, loc) {
  if (!file || !loc) return null;
  const n = Number(String(loc).replace(/^L/, ""));
  if (!Number.isFinite(n)) return null;
  if (!lineCache.has(file)) {
    try { lineCache.set(file, readFileSync(file, "utf8").split("\n")); }
    catch { lineCache.set(file, null); }
  }
  const lines = lineCache.get(file);
  if (!lines) return null;
  // An import can wrap, so look at the pointed-at line and the two after it.
  for (let i = n - 1; i < Math.min(n + 2, lines.length); i++) {
    const quoted = [...(lines[i] ?? "").matchAll(/['"]([^'"\n]+)['"]/g)].map((m) => m[1]);
    // The specifier is the last quoted string on an import line — everything
    // before it is the named bindings.
    for (const q of quoted.reverse()) if (q.trim()) return q.trim();
  }
  return null;
}

const added = [];
for (const [id, e] of missing) {
  const spec = specifierAt(e.source_file, e.source_location);
  const external = id.startsWith("ref_");
  // Only trust the read specifier when it round-trips to the id we are filling;
  // otherwise the line held something else and a label from it would be a lie.
  const trusted = spec && external && `ref_${norm(spec)}` === id;
  const label = trusted ? spec : (spec && !external ? spec : id.replace(/^ref_/, "").replace(/_/g, "/"));
  added.push({
    id,
    label,
    file_type: "code",
    // Where it was first seen. These have no file of their own in this corpus.
    source_file: e.source_file ?? null,
    source_location: e.source_location ?? null,
    source_url: null, captured_at: null, author: null, contributor: null,
    external: external || undefined,
    label_verified: trusted || undefined,
  });
}

g.nodes.push(...added);
writeFileSync(EXTRACT, JSON.stringify(g, null, 2));

const verified = added.filter((n) => n.label_verified).length;
console.log(`linked ${added.length} import targets (${verified} labels read from source, ${added.length - verified} derived from the id)`);
for (const n of added.filter((x) => !x.external)) console.log(`  internal: ${n.id}  ->  ${n.label}`);
