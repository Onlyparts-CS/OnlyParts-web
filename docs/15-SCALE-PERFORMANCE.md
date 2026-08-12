# OnlyParts — Scale & Performance at 50,000+ SKUs

**Version:** 1.0
**Answers:** *"How do we handle 50,000+ products on a live server?"*

---

## 1. The shape of the problem

50,000 SKUs is not a large database. A single PostgreSQL instance handles
millions of rows without complaint. **The database is never the thing that
breaks — the query plan is.**

The failure mode is specific: a missing index turns a 2 ms index lookup into a
4-second sequential scan across every row. At 50 concurrent users that saturates
the connection pool, requests queue, and the site stops. This is why catalogue
sites fall over at exactly the moment traffic arrives.

Three layers prevent it, in order of how much load each removes:

| Layer | Removes | Handles |
|---|---|---|
| **1. Edge + ISR cache** | ~95% of catalogue traffic | Product and category pages |
| **2. Meilisearch** | ~100% of search traffic | Search, faceting, autocomplete |
| **3. Indexed PostgreSQL** | the remainder | Cart, checkout, admin, orders |

Most requests never reach Postgres at all. That is the design.

---

## 2. Layer 1 — ISR: how 50,000 pages stay fast

Rendering a product page per request means a database round trip per visitor.
Pre-building all 50,000 at deploy time means a 40-minute build and stale stock.
**Incremental Static Regeneration** takes neither trade.

### 2.1 Behaviour

| Cache state | Trigger | What happens |
|---|---|---|
| **HIT** | Page previously generated | Served from the CDN edge. **Zero database queries** |
| **MISS** | Never visited | Rendered on demand, served, then cached |
| **STALE** | Admin edited it, or stock changed | User still gets the cached page **instantly**; Next.js regenerates in the background; the next visitor gets the new one |

Long-tail SKUs are never built until someone actually wants them, so the build
stays fast no matter how large the catalogue grows.

### 2.2 On-demand revalidation — the correctness half

Time-based revalidation alone reproduces the ghost-inventory problem. Every
mutation therefore invalidates precisely what it touched:

```ts
// Payload afterChange hook on `variants`
revalidateTag(`product:${doc.productId}`);
doc.categories.forEach(c => revalidateTag(`category:${c}`));

// after an order is paid — stock moved
revalidateTag(`product:${variantId}`);
```

Tags used: `product:{id}` · `category:{id}` · `collection:{id}` · `brand:{id}`.

### 2.3 The exception that makes it honest

**Price and stock are never trusted from the cache at the moment of truth.**

The cached HTML carries last-known values — correct for crawlers, instant for
users — and the client reconciles live within ~200 ms. Any mismatch surfaces as
a visible notice rather than a silent swap, and **checkout re-validates every
line server-side regardless**. Cached pages are a performance decision; they are
never allowed to become a correctness decision.

### 2.4 What is never cached

Cart · checkout · account · admin · live stock endpoints · anything with PII.

---

## 3. Layer 2 — Search

Search is never a `LIKE '%query%'` against Postgres. At 50k rows that is a full
scan on every keystroke.

Meilisearch holds one document per **variant**, projected from Postgres through
the transactional outbox (`09-SEARCH-SPEC.md` §8). It is RAM-bound: ~50k
documents with our attribute set is roughly **1.5–2 GB**, comfortable on a 16 GB
host with room for the catalogue to triple.

**The fallback matters.** If Meilisearch is unreachable, the API degrades to a
`pg_trgm` query against Postgres — slower and dumber, with a visible "search is
running in reduced mode" notice, but the site stays sellable. That path is
exercised in staging monthly; an untested fallback is not a fallback.

---

## 4. Layer 3 — PostgreSQL indexing

The queries that survive to the database must all hit an index. Different query
shapes need different index types, and using the wrong one is the same as having
none.

### 4.1 B-tree — the default

Equality and range on scalar columns: `price < 50000`, `sku = '…'`,
`placed_at BETWEEN`. O(log n), self-balancing.

```sql
CREATE INDEX ON products (status, published_at DESC);
CREATE INDEX ON orders (user_id, placed_at DESC);
CREATE INDEX ON variants (product_id, position);
```

### 4.2 GIN — parametric search over JSONB

A resistor has resistance and tolerance; a screw has thread and pitch. A column
per possible attribute across 50,000 disparate parts produces a sparse,
unmaintainable table.

**Our resolution is deliberately hybrid**, and worth being precise about:

- **`attribute_values`** stays a typed relational table (`07-DATA-MODEL.md` §2.4).
  It is the source of truth, it enforces types, and it is what makes "which SKUs
  are missing a required spec?" answerable.
- **A denormalised `attrs jsonb` column on `variants`** is maintained by trigger
  as a read projection, indexed with GIN, for fast containment queries.

```sql
ALTER TABLE variants ADD COLUMN attrs jsonb NOT NULL DEFAULT '{}';
CREATE INDEX variants_attrs_gin ON variants USING gin (attrs jsonb_path_ops);

-- "M3 thread in SS304" — index lookup, not a scan
SELECT * FROM variants WHERE attrs @> '{"thread":"M3","material":"ss304"}';
```

`jsonb_path_ops` builds a smaller, faster index than the default when you only
need containment — which is all faceting needs.

This gives GIN speed without giving up type safety. Writes cost a little more;
reads are the thing that happens 10,000× more often.

### 4.3 GiST + pg_trgm — fuzzy text

For the typo-tolerant behaviour users expect from Reddit or Quora — and for the
Meilisearch fallback:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX products_title_trgm ON products USING gin (title gin_trgm_ops);
CREATE INDEX variants_sku_trgm  ON variants USING gin (sku   gin_trgm_ops);

-- "raspbery pi" still finds "Raspberry Pi"
SELECT title, similarity(title, 'raspbery pi') AS s
FROM products WHERE title % 'raspbery pi'
ORDER BY s DESC LIMIT 20;
```

GIN with `gin_trgm_ops` is the right default for read-heavy trigram search; GiST
is preferred only when the table is write-heavy or you need nearest-neighbour
ordering.

### 4.4 ltree — the category tree

Recursive CTEs over an adjacency list get slower with every level. `ltree` makes
subtree queries a single indexed operation:

```sql
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE INDEX categories_path_gist ON categories USING gist (path);

-- everything under Fasteners, at any depth
SELECT * FROM categories WHERE path <@ 'fasteners';
```

### 4.5 Partial indexes — the cheapest win

Most queries only ever touch live, in-stock rows. Indexing the rest wastes RAM
and slows writes.

```sql
CREATE INDEX products_live ON products (published_at DESC)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX inventory_low ON inventory_levels (variant_id)
  WHERE on_hand <= reorder_point;

CREATE INDEX outbox_pending ON outbox_events (created_at)
  WHERE published_at IS NULL;
```

The outbox index is the clearest case: the table grows forever, but the
interesting rows are the handful not yet published. The partial index stays
small permanently.

### 4.6 Summary

| Type | Use | Why |
|---|---|---|
| B-tree | Price, dates, SKU lookup, foreign keys | O(log n), ordered |
| GIN (`jsonb_path_ops`) | Parametric attribute filtering | Inverted index; containment without a scan |
| GIN (`gin_trgm_ops`) | Fuzzy title/SKU search | Typo tolerance |
| GiST (`ltree`) | Category subtree | Hierarchy in one operation |
| Partial | Active/low-stock/pending subsets | Up to 90% smaller, faster writes |

---

## 5. Planner tuning

Correct indexes are wasted if the planner prefers a sequential scan. Two
settings matter most on cloud SSD:

```conf
random_page_cost = 1.1        # default 4.0 assumes spinning disks.
                              # On SSD/EBS gp3 random I/O ≈ sequential;
                              # leaving it at 4.0 makes the planner
                              # avoid index scans it should be using.
effective_cache_size = 12GB   # ~75% of RAM. Not an allocation — it tells
                              # the planner how much is likely cached.
shared_buffers = 4GB          # ~25% of RAM
work_mem = 32MB               # per sort/hash node — raise carefully
maintenance_work_mem = 1GB    # index builds, VACUUM
max_connections = 100         # real pooling happens in PgBouncer
```

`random_page_cost` is the single highest-impact line. Every query is verified
with `EXPLAIN (ANALYZE, BUFFERS)` before it ships; any plan containing `Seq Scan`
on `products`, `variants` or `orders` fails review.

---

## 6. Connection pooling

Next.js Server Components and serverless functions open connections
aggressively. Without pooling, Postgres runs out long before CPU does.

**PgBouncer in transaction mode**, app pool sized to `(cores × 2) + spindles`.
Payload/Drizzle connects to PgBouncer, never to Postgres directly.

---

## 7. Read replicas

Not needed at launch; the path is planned so it isn't an emergency.

- **Primary:** all writes, plus every read in the checkout path.
- **Replica:** catalogue reads, search index projection, reports, exports.

Anything that reads-then-writes in the same request must use the primary —
replica lag causes overselling, which is the one bug this whole design exists to
prevent.

---

## 8. Infrastructure and latency

**Everything in AWS `ap-south-1` (Mumbai).** Traffic is overwhelmingly Indian;
a US-East database adds ~200 ms to every uncached request and quietly destroys
the performance targets. Intra-region AZ latency in `ap-south-1` is
**≈ 2 ms**, so co-locating compute and database makes the network cost
effectively disappear.

```
Hostinger (registrar)
  └─ nameservers → Cloudflare  ── DNS · CDN · WAF · DDoS · rate limiting
        ├─ onlyparts.in        → Next.js + Payload (ECS Fargate or Vercel), ap-south-1
        ├─ admin.onlyparts.in  → same app, Cloudflare Access gated
        ├─ cdn.onlyparts.in    → S3 + CloudFront (or Cloudflare R2)
        └─ search.onlyparts.in → Meilisearch, private subnet only
                                 │
                                 ├─ RDS PostgreSQL 16, Multi-AZ, AES-256 at rest
                                 ├─ ElastiCache Redis
                                 └─ S3 (media, RFQ files, invoices)
```

**Vercel vs ECS Fargate.** Vercel handles the App Router and ISR natively with
no configuration and is the faster path to launch; ECS/Fargate gives full
control, keeps everything inside the VPC with the database, and is cheaper at
scale. Start on Vercel, keep the app containerised so the move is a deployment
change and not a rewrite.

---

## 9. Budgets and the load test

| Metric | Target |
|---|---|
| LCP p75, mobile 4G | < 2.0 s |
| Search keystroke → paint p95 | < 120 ms |
| Cached catalogue page TTFB | < 100 ms |
| Uncached PDP render | < 400 ms |
| DB query p95 | < 50 ms |
| Checkout `prepare` p95 | < 600 ms |
| Cache hit ratio, catalogue | > 90% |

Load test at **3× expected peak** before launch: 1,500 concurrent browsers,
500 searches/second, 50 checkouts/minute. The pass condition is not just
latency — no `Seq Scan` may appear in `pg_stat_statements` for the top 50
queries by total time.

---

## 10. Ordered plan

1. Schema with **every index above created at build time**, not retrofitted.
2. `random_page_cost` and `effective_cache_size` set on day one.
3. Transactional outbox + Meilisearch indexer — un-retrofittable later.
4. ISR with tag-based on-demand revalidation on every mutation.
5. PgBouncer from the first deploy.
6. `pg_stat_statements` on, slow-query log at 200 ms, `EXPLAIN` review in PR.
7. Load test at 3× peak.
8. Read replicas only when the primary passes ~60% CPU at peak.
