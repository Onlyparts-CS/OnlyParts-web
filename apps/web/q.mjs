import pg from 'pg';
const c = new pg.Client({connectionString: process.env.DATABASE_URI});
await c.connect();
const q = async (label, sql) => console.log(label, (await c.query(sql)).rows);
await q('variants total/with attrs:', `select count(*) total, count(distinct a._parent_id) with_attrs from variants v left join variants_attributes a on a._parent_id=v.id`);
await q('titles with Dia/Length pattern:', `select count(*) from products where title ~* '(dia\\.?\\s*[0-9.]+\\s*mm|length\\s*[0-9.]+\\s*mm|[0-9.]+\\s*mm)'`);
await q('products total:', `select count(*) from products`);
await c.end();
