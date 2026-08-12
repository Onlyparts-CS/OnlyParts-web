import pg from "pg";
const c = new pg.Client("postgres://onlyparts:onlyparts@localhost:5433/onlyparts");
await c.connect();
const t = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
console.log(`TABLES (${t.rows.length}):`);
for (const r of t.rows) {
  const n = await c.query(`SELECT count(*)::int n FROM "${r.table_name}"`);
  console.log(`  ${r.table_name.padEnd(38)} ${n.rows[0].n}`);
}
console.log("\nvariants_attributes columns:");
const a = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='variants_attributes' ORDER BY ordinal_position`);
for (const r of a.rows) console.log(`  ${r.column_name.padEnd(24)} ${r.data_type}`);
console.log("\nvariants_price_tiers columns:");
const p = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='variants_price_tiers' ORDER BY ordinal_position`);
for (const r of p.rows) console.log(`  ${r.column_name.padEnd(24)} ${r.data_type}`);
await c.end();
