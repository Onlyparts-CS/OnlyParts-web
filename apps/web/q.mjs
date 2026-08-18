import pg from 'pg';
const c = new pg.Client({connectionString: process.env.DATABASE_URI});
await c.connect();
const r = await c.query(`
  select split_part(path,'.',1) as drawer, count(distinct v.id) variants
  from categories c
  join products p on p.primary_category_id=c.id and p.status='active'
  join variants v on v.product_id=p.id and v.is_active=true
  group by 1 order by 2 desc limit 8`);
console.log('variants per top-level drawer:', r.rows);
await c.end();
