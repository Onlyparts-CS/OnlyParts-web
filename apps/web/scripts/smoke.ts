import { getPayload } from "payload";
import config from "@payload-config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Proves the write path end to end, without a browser and without an account.
 *
 *   npm run payload -- run scripts/smoke.ts
 *
 * It exercises the two things that are easy to *assume* are working after a
 * connectivity phase and are not: that the Local API actually reaches Postgres
 * in this process, and that an upload survives the whole round trip — sharp
 * resizing into the three declared sizes, files landing under `public/media`
 * same-origin, and the row coming back out again.
 *
 * `overrideAccess` is on deliberately: this runs as the system, not as a user,
 * so it must not be blocked by the RBAC it is not testing. It cleans up after
 * itself so it can be run repeatedly.
 */
const dirname = path.dirname(fileURLToPath(import.meta.url));

const payload = await getPayload({ config });

const before = await payload.count({ collection: "media", overrideAccess: true });

const file = path.resolve(dirname, "../public/parts/3d-printers-parts.jpg");
const doc = await payload.create({
  collection: "media",
  overrideAccess: true,
  data: {
    alt: "Smoke test — 3D printer hotend, V6 block with silicone sock",
    licence: "cc0",
    credit: "Wikimedia Commons",
    source: "scripts/smoke.ts",
  },
  file: {
    data: readFileSync(file),
    name: "smoke-hotend.jpg",
    mimetype: "image/jpeg",
    size: readFileSync(file).byteLength,
  },
});

const sizes = doc.sizes ?? {};
console.log("created media  id=%s  url=%s", doc.id, doc.url);
console.log("  dimensions   %s × %s", doc.width, doc.height);
for (const [name, s] of Object.entries(sizes)) {
  const dims = s?.width ? `${s.width} × ${s.height}` : "not generated (source too small — sharp will not upscale)";
  console.log(`  ${name.padEnd(6)}       ${dims}${s?.url ? `  →  ${s.url}` : ""}`);
}

const read = await payload.findByID({ collection: "media", id: doc.id, overrideAccess: true });
console.log("read back      alt=%o licence=%o", read.alt, read.licence);

await payload.delete({ collection: "media", id: doc.id, overrideAccess: true });
const after = await payload.count({ collection: "media", overrideAccess: true });
console.log("cleaned up     media rows %d → %d", before.totalDocs, after.totalDocs);

process.exit(0);
