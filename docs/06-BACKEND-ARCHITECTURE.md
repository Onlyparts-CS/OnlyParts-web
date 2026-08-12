# OnlyParts — Backend Architecture

**Version:** 2.1 — *Payload CMS 3.0, revised after the frontend review*
**Stack:** Payload CMS 3.0 (in the Next.js App Router) · Drizzle ORM · PostgreSQL 16 · Redis 7 · Meilisearch 1.x · Payload Jobs Queue · S3

> **v2 decision: Payload CMS 3.0 replaces the NestJS modular monolith.**
>
> v1 specified a hand-built NestJS API with a hand-built admin console. That was
> the wrong call, and `12-COMPETITIVE-RESEARCH.md` §6 already flagged it: *"two
> components we should not build — GST invoicing, and the admin CRUD shell."*
> We were going to build the second one anyway.
>
> **What changes:** Payload 3.0 installs *into* the Next.js App Router rather
> than running as a separate service, so there is one deployable instead of two.
> Its **Local API** queries PostgreSQL directly from Server Components with no
> HTTP hop — the fastest way to read data in Next.js, and it removes an entire
> network tier from every catalogue page. It ships a generated, React-based
> **admin panel**, access control, auth, media handling and a **jobs queue** out
> of the box.
>
> **What does not change:** the data model in `07-DATA-MODEL.md` (typed
> attributes, many-to-many categories, the inventory ledger), the GST engine, the
> search spec, and the ISR strategy. Payload is the *delivery mechanism* for that
> design, not a replacement for it.
>
> **Note on "Prisma":** Prisma is an ORM, not a CMS — it has no admin UI, no auth
> and no content modelling. Payload 3.0 uses Drizzle internally and gives the same
> type-safe database access plus everything Prisma deliberately leaves out.

> **v2.1 — four things the frontend build discovered.** Each was a real defect
> found in the working prototype, not a design preference, and each has a
> consequence the backend has to honour rather than re-litigate.
>
> 1. **Project membership must be curated, never derived.** The prototype
>    inferred it from category overlap and every fastener in the catalogue
>    claimed to be a drone part. `collection_items` is now a first-class table
>    with ingest-time validation — `07-DATA-MODEL.md` §2.3a.
> 2. **The invoice PDF must be generated and stored server-side.** Browser print
>    clipped the Total column off A4 and printed the site header onto the
>    letterhead. §8.2a.
> 3. **`verified` on a review is a join, not a column.** The badge is only
>    meaningful if it cannot be granted — `07` §6.1.
> 4. **Unmatched BOM lines are the valuable ones.** They are catalogue gaps and
>    Make-on-Demand leads; the importer keeps them rather than dropping them —
>    `07` §6.2.
>
> **What has not changed:** the catalogue model, the GST engine, the search spec,
> and the ISR strategy. The admin panel still mounts at `/cms`; the bespoke
> workflow console — bulk-import diff, completeness queues, the product form with
> the project picker — stays at `/admin`, because those are the parts Payload does
> not give us.

---

## 1. Shape of the system

**One Next.js application** containing both the storefront and Payload CMS,
backed by PostgreSQL, with a separate worker for background jobs.

```
Cloudflare (DNS · CDN · WAF · DDoS)
        │
        ▼
Next.js app (AWS ECS/Fargate or Vercel, ap-south-1 Mumbai)
 ├── /(shop)          storefront — RSC, ISR-cached
 ├── /admin           Payload admin panel (generated, customised)
 ├── /api/[...slug]   Payload REST + GraphQL (external consumers)
 └── Payload Local API → direct Drizzle → Postgres, no HTTP hop
        │
        ├── AWS RDS PostgreSQL 16 (Multi-AZ, AES-256 at rest)
        ├── Redis (sessions, rate limits, hot projections)
        ├── Meilisearch (search index)
        ├── S3 (media, RFQ files, invoices)
        └── Payload Jobs Queue (indexing, email, WhatsApp, imports)
```

At 500 orders/day and 50k SKUs, microservices buy distributed-systems problems
and no benefit. Payload collections are the module boundary, and they are drawn
where a future service split would go.

### 1.1 Why the Local API matters at 50k SKUs

A category page rendering 60 tiles under the v1 design did: Next.js → HTTP →
NestJS → Prisma → Postgres, and back. Under v2 the Server Component calls
`payload.find()` in-process. On a page that is ISR-cached anyway the saving is
modest; on the **admin panel, checkout and any uncached path it removes 15–40 ms
per query**, and it removes an entire service from the deployment, the monitoring
surface and the failure modes.

```
                         Cloudflare (CDN · WAF · DDoS)
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
      Next.js storefront                          Next.js admin
      (Node runtime, SSR/ISR)                     (internal, IP+SSO gated)
              │                                           │
              │        ┌──────── direct search ───────────┤
              │        │   (search-only key)              │
              ▼        ▼                                  ▼
      ┌───────────────────────┐              ┌────────────────────────┐
      │  NestJS API (monolith)│◀────────────▶│   Meilisearch          │
      │  REST + Zod contracts │   indexing   │   products/categories  │
      └───────────┬───────────┘              └────────────────────────┘
                  │
     ┌────────────┼────────────┬───────────────┬──────────────┐
     ▼            ▼            ▼               ▼              ▼
┌─────────┐  ┌────────┐  ┌──────────┐   ┌───────────┐  ┌──────────┐
│Postgres │  │ Redis  │  │ S3 / R2  │   │  BullMQ   │  │ External │
│ primary │  │ cache  │  │ media &  │   │  workers  │  │ Razorpay │
│ +replica│  │ session│  │ RFQ files│   │ (own proc)│  │ Shiprocket│
└─────────┘  │ queue  │  └──────────┘   └───────────┘  │ MSG91/SES│
             └────────┘                                 └──────────┘
```

## 2. Collections (Payload) and services

Payload models everything as **collections** (rows with access control, hooks and
an admin UI) and **globals** (singletons). What v1 called modules become
collections plus a thin service layer for logic that isn't CRUD — pricing, tax,
allocation.

| Payload collection | Backing table(s) | Admin UI |
|---|---|---|
| `categories` | `categories` (ltree `path`) | Tree editor, drag-reorder |
| `attribute-definitions` | `attribute_definitions` | Per-category schema editor |
| `products` / `variants` | `products`, `variants`, `attribute_values` | Table + bulk edit + CSV import |
| `media` | `media`, `product_media` | Upload, auto-resize, alt text |
| `brands`, `collections` | `brands`, `collections`, `collection_items` | Project membership picker on the product form — curated, never derived (`07` §2.3a) |
| `reviews` | `reviews` | Moderation queue; `verified` is a join on `order_line_id`, not an editable field |
| `wishlists`, `boms` | `wishlists`, `wishlist_items`, `boms`, `bom_lines` | Read-mostly; `bom_lines.raw_sku` feeds the catalogue-gap report |
| `inventory` | `inventory_levels`, `inventory_movements` | Adjustment form writing a ledger row |
| `price-tiers` | `price_tiers` | Inline on the variant |
| `orders`, `payments`, `shipments`, `invoices` | as named | Read-mostly, status transitions |
| `rfqs`, `quotes`, `jobs` | as named | The MoD queue with SLA timers |
| `users`, `addresses` | as named | RBAC, MFA enforced |
| `suppliers`, `supplier-feeds` | new — see `14-ADMIN-CATALOG-OPS.md` | Feed config + run history |
| `search-synonyms`, `search-pins` | as named | Search tuning |
| `redirects`, `audit-log` | as named | |

**Services (not collections)** — plain TypeScript modules called from Payload
hooks and Server Actions: `pricing` (tier resolution), `tax` (the GST engine),
`inventory` (reserve/allocate/release), `search` (index projection), `shipping`,
`invoicing`.

**Legacy module map** — the v1 table below still describes the *responsibilities*;
read "module" as "collection + service".

| Module | Responsibility |
|---|---|
| `auth` | Registration, login, OTP (phone), sessions, refresh rotation, RBAC, password reset |
| `catalog` | Categories, products, variants, attributes, attribute schemas, media, brands |
| `inventory` | Stock levels, reservations, adjustments, low-stock alerts, backorders |
| `pricing` | Base prices, price-break tiers, customer-group pricing, promotions, GST computation |
| `search` | Meilisearch index management, document projection, sync, synonyms, analytics |
| `cart` | Cart lifecycle, line validation, price/stock re-resolution, merge-on-login |
| `checkout` | Order creation, address validation, shipping-rate quoting, payment intent |
| `orders` | Order state machine, fulfilment, shipments, returns, cancellations |
| `payments` | Razorpay integration, webhooks, refunds, reconciliation |
| `shipping` | Courier integration, rate cards, AWB, tracking, serviceability by pincode |
| `invoicing` | GST invoice generation, HSN mapping, credit notes, e-invoice hooks |
| `mod` | **Make-on-Demand:** RFQs, files, quotes, jobs, milestones |
| `content` | Blog, guides, project collections, banners, SEO overrides |
| `reviews` | Verified-purchase reviews, Q&A, moderation |
| `notifications` | Email, SMS, WhatsApp templates and dispatch |
| `admin` | Bulk import/export, audit log, dashboards, search tuning |
| `common` | Config, logging, tracing, error filters, guards, pagination, idempotency |

Cross-module communication is via **injected services within a request** and **domain events for anything asynchronous** (email, indexing, cache invalidation, analytics). No module imports another module's Prisma models directly — each exposes a service interface.

## 3. API design

REST, versioned at `/api/v1`. Full contracts: `08-API-SPEC.md`.

- **Contracts are Zod schemas in `packages/types`**, shared verbatim with the frontend. The OpenAPI document is generated from them, so the docs cannot drift from reality.
- Cursor pagination on every collection (`?cursor=&limit=`); offset pagination only in the admin where page numbers are genuinely useful.
- Consistent envelope:
  ```json
  { "data": …, "meta": { "cursor": "…", "hasMore": true } }
  { "error": { "code": "OUT_OF_STOCK", "message": "…", "details": {…}, "traceId": "…" } }
  ```
- `Idempotency-Key` required on `POST /orders`, `POST /payments/*`, `POST /rfqs`. Keys stored in Redis for 24 h with the original response.
- ETag + `If-None-Match` on catalog reads.
- Rate limits: 100 req/min per IP anonymous, 600 authenticated, 10/min on auth endpoints, 5/hour on RFQ submission.

## 4. Data layer

PostgreSQL 16 via Prisma. Full schema and ERD: `07-DATA-MODEL.md`.

Load-bearing decisions:

1. **Typed attributes, not a JSON blob.** `attribute_definitions` (per category) + `product_attribute_values` with typed columns (`value_text`, `value_number`, `value_bool`, `value_unit`). A JSONB blob would be faster to build and would make faceting, unit conversion and range queries permanently painful. This is the schema decision that determines whether search works.
2. **Many-to-many product↔category** via `product_categories` with an `is_primary` flag and a partial unique index enforcing exactly one primary per product.
3. **Depth capped at 3** by a check constraint on `categories.depth`, with a `path` ltree column for fast subtree queries.
4. **Money as `integer` paise**, never float. Currency fixed to INR in v1 but the column exists.
5. **Stock is a ledger, not a counter.** `inventory_movements` is append-only; `inventory_levels.on_hand` is a derived, transactionally-maintained cache. This is what makes overselling debuggable.
6. **Orders are immutable snapshots.** `order_lines` copy title, SKU, attributes, unit price and tax rate at purchase time. A later catalog edit never rewrites history.
7. **Soft deletes** (`deleted_at`) on catalog entities; hard deletes only via a data-retention job.

Read replicas serve catalog reads. The primary handles all writes and anything in the checkout path.

## 5. Search indexing

```
Postgres change (product/variant/price/stock/category)
   → domain event on the outbox table (same transaction as the write)
   → outbox relay publishes to BullMQ
   → indexer worker projects the full search document
   → Meilisearch batch update (debounced 2 s, max batch 1,000)
```

The **transactional outbox** matters: without it, a crash between the DB commit and the queue publish silently desynchronises search from the catalog, which is the failure mode most likely to go unnoticed for weeks.

A nightly reconciliation job diffs Postgres against the index and repairs drift. Reindexing is done into an alias — build `products_v2`, verify document count and a sample of queries, then swap the alias. Never mutate the live index in place.

Document projection, ranking rules, synonyms and facet configuration: `09-SEARCH-SPEC.md`.

## 6. Caching

| Layer | What | TTL | Invalidation |
|---|---|---|---|
| Cloudflare | Static assets, images | 1 year | Content-hashed filenames |
| Cloudflare | Catalog HTML | 60 s edge | Purge by tag on publish |
| Next ISR | Category/product pages | 300–600 s | On-demand webhook |
| Redis | Category tree | 1 h | Event on category write |
| Redis | Attribute schemas | 1 h | Event on schema write |
| Redis | Product detail projection | 10 min | Event on product write |
| Redis | Shipping rates by pincode | 6 h | Scheduled refresh |
| Redis | Session, cart, idempotency, rate limits | varies | — |
| In-process | Config, feature flags | 60 s | — |

**Never cached:** stock levels, cart totals at checkout, payment state, RFQ contents.

Cache keys are namespaced with a schema version (`v1:cat:tree`) so a deploy that changes a projection shape can invalidate everything by bumping one constant.

## 7. Background jobs (BullMQ, separate worker process)

| Queue | Jobs |
|---|---|
| `search` | index product, index category, bulk reindex, nightly reconcile |
| `media` | image resize/transcode to AVIF+WebP ×5 sizes, EXIF strip, blurhash |
| `notifications` | order confirmation, shipment, delivery, back-in-stock, abandoned cart, RFQ status, quote ready |
| `orders` | payment reconciliation, courier status polling, auto-cancel unpaid after 30 min, release stock reservations |
| `catalog` | CSV import (chunked with a dry-run diff), bulk price update, sitemap generation |
| `mod` | virus-scan uploads, thumbnail/preview generation for STEP/STL, quote PDF rendering, SLA breach alerts |
| `analytics` | zero-result report, search-term rollup, stock-velocity computation |
| `maintenance` | cache warm, expired-cart cleanup, DPDP data-retention purge, DB vacuum checks |

Retry policy: exponential backoff, 5 attempts, dead-letter queue with an admin UI. Every job is idempotent by design — a job that can't safely run twice is a bug.

## 8. Key flows

### 8.1 Checkout

```
POST /checkout/prepare
  ├─ validate every cart line: exists, active, purchasable
  ├─ re-resolve price breaks server-side  → report any change to the user
  ├─ check stock, create SOFT reservations (15 min TTL, Redis + DB row)
  ├─ compute shipping from pincode + weight + dimensional weight
  ├─ compute GST per line from HSN + place-of-supply (CGST+SGST intra / IGST inter)
  └─ return a priced, locked quote with an expiry

POST /orders  (Idempotency-Key)
  ├─ single Postgres transaction:
  │    create order + immutable lines + address snapshot
  │    convert soft reservations → HARD allocations
  │    write inventory_movements
  ├─ create Razorpay order, return the payment payload
  └─ emit order.created

Razorpay webhook: payment.captured
  ├─ verify HMAC signature (reject on mismatch, always)
  ├─ idempotent by razorpay_payment_id
  ├─ order → PAID, generate the GST invoice
  ├─ enqueue confirmation email/SMS/WhatsApp
  └─ enqueue fulfilment

Failure paths
  ├─ payment failed / abandoned → release allocations after 30 min, restore stock
  ├─ webhook never arrives     → reconciliation job polls Razorpay every 5 min for 2 h
  └─ partial stock at allocation → whole transaction rolls back; the user is told
                                    exactly which line failed and by how much
```

Stock is never decremented outside a transaction that also writes the ledger. COD orders allocate stock immediately but flag for manual confirmation above a value threshold.

### 8.1a Razorpay — server-side integrity

**The client is never trusted to report a successful payment.** A browser can be
made to say anything; the only authority is a signed server-to-server webhook.

```
1  Server Action computes the order total from the DATABASE
   (never from a client-supplied price) via the Payload Local API.
2  Server creates a Razorpay order with key_id / key_secret from the
   secret store, and returns only the razorpay_order_id to the client.
3  Client opens the Razorpay checkout modal. No card data touches us.
4  Razorpay POSTs a webhook with an `x-razorpay-signature` header.
5  We recompute the signature ourselves and compare:

     const expected = crypto
       .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
       .update(rawBody)                       // raw bytes, not parsed JSON
       .digest("hex");

     if (!crypto.timingSafeEqual(Buffer.from(expected),
                                 Buffer.from(signature))) return 400;

6  Only now: order → PAID, allocate stock, generate the invoice,
   enqueue email + WhatsApp.
```

Three details that are easy to get wrong and expensive to get wrong:

- **Hash the raw request body**, not `JSON.parse`d-and-restringified output. Key
  order changes and the signature stops matching.
- **Use `timingSafeEqual`**, not `===`. String comparison leaks timing.
- **Idempotency by `razorpay_payment_id`.** Razorpay retries; a naive handler
  allocates stock twice.

The client-side `handler` callback is a UX accelerator that shows a success
screen. It never changes order state.

### 8.1b Notifications — closing the trust gap

The competitor teardown in `12-COMPETITIVE-RESEARCH.md` §4a shows the single
loudest complaint against every Indian incumbent is *silence after payment*.
Every state transition therefore emits a message, queued through Payload's jobs
queue so a courier API outage never blocks a checkout:

| Event | Email (SES) | WhatsApp (MSG91) |
|---|---|---|
| `order.paid` | Confirmation + GST invoice PDF | Confirmation + invoice |
| `order.packed` | — | "Packed, dispatching today" |
| `order.shipped` | AWB + tracking link | AWB + live tracking link |
| `order.delivered` | Review request | — |
| `order.delayed` | **Proactive**, with a new date | **Proactive** |
| `rfq.submitted` | Acknowledgement + SLA | Acknowledgement |
| `rfq.quoted` | Quote PDF | "Your quote is ready" |

`order.delayed` is the important one. Incumbents let the customer discover a
delay by waiting; we announce it. That costs nothing and is most of the
differentiation.

Invoices render to PDF and are stored in S3, then attached to both channels.

### 8.2 GST

Computed per line, not on the order total.

- Each product carries an `hsn_code` and a `gst_rate` (0/5/12/18/28).
- Place of supply = delivery state. Seller state = warehouse state.
- Intra-state → CGST + SGST at half each; inter-state → IGST at full.
- Prices are stored and displayed **inclusive** of GST for retail (Indian convention); the invoice back-computes the taxable value. B2B customers with a GSTIN can toggle to exclusive display.
- Invoice numbering is a gapless per-financial-year sequence backed by a dedicated Postgres sequence table with row-level locking — GST audits care about gaps.
- Credit notes for returns reference the original invoice.
- E-invoice (IRN/QR) integration is stubbed behind an interface; required only above the ₹5 crore turnover threshold.

### 8.2a Invoice rendering — why the PDF is generated server-side

Added after the frontend review. The prototype relied on `window.print()`, and
printing the live page produced a document that was not usable as a tax record:
the site header printed onto the letterhead, the announcement strip's fill was
dropped so its text landed near-white on white paper, and the line-items table —
760px wide inside an `overflow-x-auto` container — was **clipped at roughly 700px
of printable A4, taking the Total column off the sheet**.

A print stylesheet now fixes the interim path (`globals.css`, `@page` A4 with
12/14mm margins, `.print-hide` on chrome, `colgroup` + `table-layout: fixed` on
the table). That is enough for a customer who hits Ctrl-P. It is **not** enough
for the invoice we are legally obliged to retain, because that document must be
byte-identical every time it is fetched, must not depend on the customer's
browser, fonts or paper size, and must be attachable to email and WhatsApp.

So invoice generation is a server responsibility:

```
order.paid  →  outbox_events  →  invoice worker (BullMQ)
                                   │
                                   ├─ allocate invoice_number  (per-FY sequence,
                                   │    SELECT … FOR UPDATE, gapless)
                                   ├─ snapshot buyer, seller, lines, per-line tax
                                   │    into invoices/invoice_lines
                                   ├─ render PDF/A-3 from the snapshot
                                   ├─ store at s3://…/invoices/{fy}/{number}.pdf
                                   │    (versioning on, object-lock, SSE-KMS)
                                   └─ enqueue email + WhatsApp with the link
```

Rules the implementation must hold:

| Rule | Why |
|---|---|
| Render from the **snapshot**, never from live product rows | A price or title change must not retroactively alter an issued invoice |
| Number allocated **inside** the same transaction as the snapshot | A gap in the sequence is an audit finding |
| Regeneration is idempotent — same input, same object key, same bytes | Re-sending must not mint a second invoice |
| Corrections issue a **credit note**, never a re-render | Amending an issued invoice is not permitted |
| PDF/A-3 with the source data embedded as XML | Survives long-term retention and feeds e-invoicing later |
| Storage is write-once (object-lock) for 8 years | Section 36 of the CGST Act; see `16-DPDP-COMPLIANCE.md` §retention |

The browser print path stays as a convenience for order confirmations. The
authoritative artefact is the stored object, and the UI links to it rather than
re-rendering it.

### 8.3 Make-on-Demand

```
Customer                          System                         Ops
────────                          ──────                         ───
POST /rfqs (draft)          →  create RFQ, status=DRAFT
GET  /rfqs/:id/upload-url   →  presigned S3 PUT (15 min, content-type
                                and size constrained)
PUT  → S3 directly          →  object created
POST /rfqs/:id/files        →  register file, enqueue virus scan +
                               preview generation
POST /rfqs/:id/submit       →  validate ≥1 file or a described part,
                               status=SUBMITTED, notify ops (email +
                               WhatsApp), start the 4 h SLA clock
                                                            →  claim, review files,
                                                               open the cost sheet
                               POST /admin/rfqs/:id/quote   ←  materials + machining
                               render quote PDF, status=QUOTED   + finishing + tooling
                               notify customer                   + margin + GST
GET  /rfqs/:id              →  quote visible in the portal
POST /rfqs/:id/accept       →  status=ACCEPTED, create Job,
                               create a payment link for the advance
                                                            →  milestones:
                                                               MATERIAL → PRODUCTION
                                                               → QC → DISPATCH
GET  /rfqs/:id (poll/SSE)   →  live status, files, comments
```

**Design for the automated future now:** the `quotes` table already stores a structured `cost_breakdown` JSONB (material volume, machining minutes, setup, finishing, tooling amortisation, margin). When the Phase-2 geometry service lands, it populates the same fields — no schema migration, and we will have a year of human-priced training data sitting in that column.

**Confidentiality:** files marked NDA are stored in a separate bucket prefix with restricted IAM, every access is written to `file_access_log`, and presigned URLs are 5-minute, single-use.

## 9. Security

| Concern | Control |
|---|---|
| AuthN | Argon2id passwords; phone OTP via MSG91; JWT access (15 min) + rotating refresh (30 d) in httpOnly cookies; refresh-token reuse detection revokes the family |
| AuthZ | RBAC — `guest`, `customer`, `b2b`, `ops`, `catalog`, `finance`, `admin`. Guards at controller level, row-level ownership checks in services |
| Input | Zod validation on every endpoint; Prisma parameterised queries only; no raw SQL with interpolation |
| Uploads | Extension + magic-byte + size validation, ClamAV scan, stored outside the web root, served only via presigned URLs, `Content-Disposition: attachment` |
| Secrets | Doppler / AWS Secrets Manager; nothing in the repo; rotation runbook |
| Transport | TLS 1.3, HSTS preload, secure cookies |
| Headers | CSP with nonces, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` |
| Webhooks | HMAC signature verification, replay window, per-event idempotency |
| PII | Encrypted at rest (column-level for phone/GSTIN), redacted in logs, DPDP-compliant export and deletion endpoints |
| Payments | PCI scope minimised — Razorpay hosted checkout, card data never touches our infrastructure |
| Audit | `audit_log` on every admin mutation: actor, entity, before/after diff, IP, timestamp |
| Abuse | Rate limits, Cloudflare Turnstile on RFQ and registration, velocity checks on COD orders |

## 10. Observability

- **Logs:** Pino, structured JSON, `traceId` propagated from the edge through the API into workers. Shipped to Loki/Better Stack.
- **Metrics:** OpenTelemetry → Prometheus → Grafana. Business metrics (orders/hour, cart abandonment, zero-result rate, RFQ SLA compliance) sit on the same dashboards as technical ones — an ops team that has to switch tools will only look at one.
- **Traces:** OTel spans across HTTP → service → Prisma → Meilisearch → external API.
- **Errors:** Sentry, release-tagged, source-mapped.
- **Uptime:** external synthetic checks every 60 s on `/`, a PLP, a PDP, and `POST /checkout/prepare` (the money path deserves a synthetic).
- **Alerts (PagerDuty):** p95 latency > 500 ms for 5 min · error rate > 1% · checkout failure rate > 2% · search index lag > 5 min · payment webhook backlog > 50 · DB connections > 80% · disk > 85% · RFQ SLA breach.

## 11. Scaling path

v1 targets 200k sessions and 500 orders/day on a single API instance plus one worker — that is deliberately modest hardware, and it will hold.

Growth order, cheapest first:
1. Horizontally scale the stateless API behind the load balancer (sessions are already in Redis).
2. Add Postgres read replicas; route catalog reads via Prisma's read replica extension.
3. Scale Meilisearch vertically (it is RAM-bound), then to a replicated cluster.
4. Move media to Cloudflare R2 + Images (already the interface).
5. Split the highest-churn modules into services along the existing boundaries — `search` and `mod` are the natural first cuts, since neither is in the checkout path.
6. Partition `orders` and `inventory_movements` by month if either passes ~50 M rows.

The one thing that must not be deferred: **the outbox pattern and the inventory ledger**. Both are cheap now and effectively un-retrofittable once there is live order data.
