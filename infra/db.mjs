/**
 * The development database.
 *
 * Postgres 18, embedded — the binary ships with `embedded-postgres` and runs
 * out of `infra/data/db`, so a new machine needs no Docker, no service install
 * and no port 5432 already free. Production is a managed Postgres; this exists
 * so the schema, the migrations and the seed can be exercised locally against
 * the real engine rather than against a mock.
 *
 *   node db.mjs start     initialise if needed, start, and hold the cluster up
 *   node db.mjs stop      stop a running cluster
 *
 * `start` blocks: the cluster is a child process and `embedded-postgres` tears
 * it down when this script exits. Run it in its own terminal.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Overridable so a throwaway cluster can be stood up beside the real one —
    which is how the encoding fix below was verified without touching dev data. */
const databaseDir = process.env.PGDATA ?? join(here, "data", "db");

/** Matches DATABASE_URI in apps/web/.env.local. 5433, not 5432, so a system
    Postgres already on the default port is not a problem on day one. */
export const PORT = Number(process.env.PGPORT ?? 5433);
export const USER = process.env.PGUSER ?? "onlyparts";
export const DATABASE = process.env.PGDATABASE ?? "onlyparts";

/**
 * Overridable, and the default is only safe because of where it listens.
 *
 * `embedded-postgres` binds loopback and this cluster holds nothing but seed
 * data, so a shared dev credential costs nothing — but a literal password in a
 * committed file is still the pattern that ends up copied into a deploy script,
 * and Snyk is right to flag it (CWE-798). Production never reaches this file:
 * it reads `DATABASE_URI` and this script is not run at all.
 */
export const PASSWORD = process.env.PGPASSWORD ?? "onlyparts";

/**
 * `07-DATA-MODEL.md` §0 requires these. Payload's Drizzle adapter will not
 * create them, and `ltree` in particular is not optional — the category tree
 * is a materialised path and subtree queries (`path <@ 'fasteners'`) are how
 * a three-level catalogue is read without recursive CTEs.
 */
const EXTENSIONS = ["pgcrypto", "ltree", "pg_trgm", "citext"];

const pg = new EmbeddedPostgres({
  databaseDir,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
  /*
    UTF-8, explicitly, or Windows quietly gives you WIN1252.

    `initdb` with no encoding inherits the system ANSI codepage, and on a
    Windows machine that is WIN1252 — which has no ₹ (U+20B9). Measured on the
    first cluster this script ever made: `select '₹100.00'::text` failed
    outright, and so did every order whose timeline said what it cost.

    For an India-first catalogue that is not a corner case. WIN1252 also cannot
    hold Devanagari or Tamil, so no product could ever carry a Hindi name, and
    it cannot hold an em-dash — which this codebase's own copy is full of.

    Encoding is fixed at initdb time and cannot be altered afterwards: a cluster
    made before this line has to be recreated, not migrated. `--locale=C` keeps
    collation predictable across machines; the search spec sorts explicitly.
  */
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: (e) => process.stderr.write(`postgres: ${e}\n`),
});

const cmd = process.argv[2] ?? "start";

if (cmd === "stop") {
  await pg.stop();
  console.log("stopped");
  process.exit(0);
}

// `PG_VERSION` only exists once initdb has run, so this is the honest test for
// "has this cluster ever been created" — a bare or half-made directory re-inits.
const fresh = !existsSync(join(databaseDir, "PG_VERSION"));

if (fresh) {
  console.log("initialising cluster …");
  await pg.initialise();
}

await pg.start();
console.log(`postgres up on :${PORT}`);

if (fresh) {
  await pg.createDatabase(DATABASE);
  console.log(`created database "${DATABASE}"`);
}

// Idempotent, so a cluster created before this list grew still catches up.
const client = pg.getPgClient(DATABASE);
await client.connect();
for (const ext of EXTENSIONS) {
  await client.query(`CREATE EXTENSION IF NOT EXISTS ${ext}`);
}
const { rows } = await client.query(
  `SELECT extname FROM pg_extension WHERE extname = ANY($1) ORDER BY extname`,
  [EXTENSIONS],
);

/*
  Refuse to look healthy on a cluster that cannot store the currency.
  A warning here is cheaper than an insert failing in checkout later.
*/
const { rows: enc } = await client.query(`SELECT current_setting('server_encoding') AS e`);
await client.end();

console.log(`extensions: ${rows.map((r) => r.extname).join(", ")}`);
if (enc[0].e !== "UTF8") {
  console.error(
    `\n  !!  This cluster is ${enc[0].e}, not UTF8.\n` +
      `      It cannot store the rupee sign, any Indian-language text, or an em-dash.\n` +
      `      Encoding cannot be changed in place. Recreate it:\n\n` +
      `        node infra/db.mjs stop\n` +
      `        rm -rf infra/data/db\n` +
      `        node infra/db.mjs start\n` +
      `        npm --prefix apps/web run payload -- run scripts/seed-catalogue.ts\n\n` +
      `      Staff accounts do not survive this — recreate at /cms/create-first-user.\n`,
  );
}
console.log(`postgres://${USER}:***@localhost:${PORT}/${DATABASE}`);
console.log("ready — Ctrl-C to stop");

// Hold the process open; the cluster dies with it.
process.stdin.resume();
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await pg.stop().catch(() => {});
    process.exit(0);
  });
}
