# OnlyParts — API Specification

**Version:** 1.0 · Base: `https://api.onlyparts.in/api/v1`
**Auth:** httpOnly cookies (`op_at` access 15 min, `op_rt` refresh 30 d). Admin also requires SSO + IP allowlist.
**Contracts:** Zod schemas in `packages/types`; OpenAPI 3.1 generated from them at `/api/v1/openapi.json`.

---

## 0. Conventions

**Success**
```json
{ "data": { … }, "meta": { "cursor": "eyJpZCI6…", "hasMore": true, "total": 524 } }
```

**Error**
```json
{ "error": {
    "code": "OUT_OF_STOCK",
    "message": "Only 12 pcs of FS-SHC-M3-010-SS304 are available.",
    "details": { "variantId": "…", "requested": 100, "available": 12 },
    "traceId": "01J8…"
} }
```

| Code | HTTP | |
|---|---|---|
| `VALIDATION_FAILED` | 422 | Zod issues in `details.issues` |
| `UNAUTHENTICATED` / `FORBIDDEN` | 401 / 403 | |
| `NOT_FOUND` | 404 | |
| `CONFLICT` | 409 | Duplicate slug/SKU, version conflict |
| `OUT_OF_STOCK` | 409 | |
| `PRICE_CHANGED` | 409 | Client must re-confirm |
| `QUOTE_EXPIRED` | 410 | |
| `RATE_LIMITED` | 429 | `Retry-After` header |
| `PAYMENT_FAILED` | 402 | |
| `INTERNAL` | 500 | |

**Headers:** `Idempotency-Key` (required on `POST /orders`, `/payments/*`, `/rfqs/:id/submit`) · `X-Request-Id` · `If-None-Match` on catalog GETs.

---

## 1. Catalog

### `GET /categories/tree`
Full 3-level tree. Cached 1 h, ETag'd. `?depth=2` to trim.
```json
{ "data": [{
  "id":"…","slug":"fasteners","name":"Fasteners","depth":1,
  "iconKey":"hex-socket","productCount":3412,
  "children":[{ "slug":"screws-by-head","name":"Screws — by Head","productCount":1933,
    "children":[{ "slug":"socket-head-cap-screws","name":"Socket Head Cap Screws",
                  "productCount":524 }]}]
}]}
```

### `GET /categories/:slugPath`
`slugPath` = `fasteners/screws-by-head/socket-head-cap-screws`. Returns the node, ancestors (breadcrumb), children, its resolved attribute schema, and merchandising blocks.

### `GET /products`
| Param | |
|---|---|
| `category` | slug path; includes descendants |
| `collection` | project collection slug |
| `filter` | repeatable `key:op:value` — `thread:eq:M3`, `length_mm:range:6..40`, `material:in:ss304,ss316` |
| `sort` | `relevance`(default) `price_asc` `price_desc` `newest` `bestselling` `{attrKey}_asc/desc` |
| `inStock` | boolean |
| `cursor`, `limit` | max 60 |

Returns tiles with `id, slug, title, sku, image, price{unit,compareAt,nextTier}, stock{state,qty}, badges[], variantAxisPreview[]`.

### `GET /products/:slug`
Full PDP payload: product, all variants with attributes, resolved attribute schema grouped into display sections, price tiers per variant, media, documents (datasheet/drawing/STEP), all category assignments with `isPrimary`, breadcrumb from primary, related/frequently-bought/collections, rating summary.

### `GET /variants/:sku` · `POST /variants/batch`
Direct SKU lookup and batch resolution — the BOM importer's backbone. `POST /variants/batch` takes `{ "skus": ["FS-SHC-M3-010-SS304", …] }` (max 200) and returns matches plus `unmatched[]` with fuzzy suggestions.

### `GET /products/:id/stock` · `POST /stock/batch`
Live stock only, never cached. `{ state: "in_stock"|"low"|"made_to_order"|"out_of_stock", available: 2480, leadDays: null }`.

---

## 2. Search

The storefront queries **Meilisearch directly** for instant search (`09-SEARCH-SPEC.md` §6). These endpoints back SSR, SEO, the BOM matcher, and anything needing our server-side ranking or logging.

### `GET /search`
`?q=m3x10 ss304 socket&category=&filter=&sort=&cursor=&limit=`

```json
{ "data": {
  "parsed": {
    "tokens": [
      {"key":"thread","label":"M3","value":"M3","confidence":0.98},
      {"key":"length_mm","label":"10 mm","value":10,"unit":"mm","confidence":0.95},
      {"key":"material","label":"SS 304","value":"ss304","confidence":0.92}
    ],
    "residual": "socket"
  },
  "products": [ … ],
  "categories": [ {"path":"fasteners/screws-by-head/socket-head-cap-screws","count":524} ],
  "collections": [ … ],
  "facets": { "thread": {"M3":128,"M4":116}, "length_mm": {"min":3,"max":80} },
  "correction": { "original":"sockte", "corrected":"socket" },
  "relaxed": null
}, "meta": { "total": 47, "tookMs": 38 } }
```

`relaxed` is non-null when the exact query returned nothing and the server widened a constraint — it names which one, so the UI can say "we relaxed length to 40 mm" with an undo.

### `GET /search/suggest` — lightweight autocomplete, ≤ 8 terms.
### `POST /search/events` — click/conversion telemetry `{queryId, variantId, position, type}`. Feeds ranking and the zero-result backlog.

---

## 3. Cart

| Method | Path | |
|---|---|---|
| `GET` | `/cart` | Current cart, fully priced. Creates one on first call |
| `POST` | `/cart/lines` | `{variantId, qty}`. Validates MOQ, pack multiples, stock |
| `PATCH` | `/cart/lines/:id` | `{qty}`; `qty:0` removes |
| `DELETE` | `/cart/lines/:id` | |
| `POST` | `/cart/merge` | On login; body `{anonymousCartId}` |
| `POST` | `/cart/import-bom` | CSV/XLSX or `{lines:[{sku,qty}]}` → matched + unmatched with suggestions |
| `POST` | `/cart/coupon` · `DELETE /cart/coupon` | |

Response always includes per-line `unitPrice`, `appliedTier`, `nextTier` (`"Add 40 more → ₹3.10/pc, save ₹280"`) and order-level `{subtotal, discount, shipping, cgst, sgst, igst, grandTotal}`.

---

## 4. Checkout & orders

### `POST /checkout/prepare`
`{ shippingAddress, billingAddress?, gstin?, shippingMethodId? }`
Validates every line, re-resolves prices, creates 15-minute soft stock reservations, quotes shipping, computes GST by place-of-supply. Returns a locked, priced quote with `expiresAt` plus `changes[]` if anything moved since the cart was last seen. **Any change requires explicit user re-confirmation before `POST /orders`.**

### `POST /orders` — `Idempotency-Key` required
`{ checkoutToken, paymentMethod: "razorpay"|"cod", notes? }` → order + Razorpay payload, or a confirmed order for COD.

### `GET /orders` · `GET /orders/:number` · `POST /orders/:id/cancel` · `POST /orders/:id/reorder`
`reorder` pushes all still-purchasable lines into the cart and reports what changed or is unavailable.

### `GET /orders/:id/invoice` → signed PDF URL (5 min).

### `GET /shipping/rates?pincode=&weight=` · `GET /shipping/serviceability/:pincode`
Serviceability is called on the PDP for the "Delivered by" promise.

---

## 5. Payments

| Method | Path | |
|---|---|---|
| `POST` | `/payments/razorpay/order` | Create a Razorpay order for an existing OnlyParts order |
| `POST` | `/payments/razorpay/verify` | Verify the client-side signature |
| `POST` | `/webhooks/razorpay` | HMAC-verified, idempotent by `razorpay_payment_id`. Handles `payment.captured`, `payment.failed`, `refund.processed` |
| `POST` | `/payments/:id/refund` | Admin/finance only |

Webhooks are the source of truth. The client-side verify is a UX accelerator only — an order is never marked paid on the client's word.

---

## 6. Make-on-Demand

| Method | Path | |
|---|---|---|
| `POST` | `/rfqs` | Create draft → `{id, rfqNumber}` |
| `POST` | `/rfqs/:id/upload-url` | `{filename, mime, bytes, kind}` → presigned S3 PUT (15 min, content-type and size bound) |
| `POST` | `/rfqs/:id/files` | Register the uploaded object; enqueues virus scan + preview |
| `DELETE` | `/rfqs/:id/files/:fileId` | |
| `PATCH` | `/rfqs/:id` | Process, material, finish, tolerance, `quantities[]`, `needBy`, `targetPrice`, notes, `isNda` |
| `POST` | `/rfqs/:id/submit` | Requires ≥1 clean file **or** a non-empty description. Starts the 4 h SLA. Turnstile-protected |
| `GET` | `/rfqs` · `/rfqs/:number` | Customer portal; includes quotes, files, milestones, comment thread (internal comments filtered out) |
| `POST` | `/rfqs/:id/comments` | |
| `POST` | `/rfqs/:id/quotes/:qid/accept` | → Job + advance payment link |
| `POST` | `/rfqs/:id/quotes/:qid/decline` | `{reason}` |
| `GET` | `/rfqs/:id/files/:fileId/download` | 5-minute single-use URL; logged to `file_access_log` |

Constraints: 100 MB/file, 20 files/RFQ, allowed types `step|stp|stl|iges|igs|dxf|dwg|pdf|png|jpg|xlsx|csv|zip`. Rate limit 5 submissions/hour/IP.

---

## 7. Account

`POST /auth/register` · `/auth/login` · `/auth/otp/request` · `/auth/otp/verify` · `/auth/refresh` · `/auth/logout` · `/auth/password/forgot` · `/auth/password/reset`
`GET/PATCH /account` · `GET/POST/PATCH/DELETE /account/addresses` · `/account/boms` · `/account/wishlist` · `/account/stock-alerts`
`POST /account/export` · `POST /account/delete` — DPDP obligations.

Auth endpoints: 10 req/min/IP, exponential lockout after 5 failures, refresh-token reuse revokes the whole family.

---

## 8. Admin (`/admin/*`, RBAC-gated, fully audit-logged)

**Catalog** — CRUD for categories, attribute definitions, products, variants, media, brands, collections. `POST /admin/catalog/import` (CSV/XLSX, chunked, **dry-run diff returned before commit**), `POST /admin/catalog/bulk-edit` (filter + patch, preview then apply), `POST /admin/catalog/bulk-price`.

**Inventory** — `POST /admin/inventory/adjust` `{variantId, warehouseId, delta, reason, note}`; `GET /admin/inventory/movements`; `GET /admin/inventory/low-stock`.

**Orders** — list with filters, status transitions, `POST /admin/orders/:id/ship` `{courier, awb}`, refunds, notes.

**RFQ pipeline** — `GET /admin/rfqs?status=&overdueOnly=`, assign, `POST /admin/rfqs/:id/quotes` (cost sheet → PDF), send, `POST /admin/jobs/:id/milestones/:mid`.

**Search tuning** — `GET /admin/search/zero-results` (the catalog backlog, ranked by volume), `GET /admin/search/top-queries`, CRUD `/admin/search/synonyms`, `POST /admin/search/reindex`, `POST /admin/search/pin` (pin a product to a query).

**Content** — blog, guides, banners, SEO overrides, the indexable-facet-URL allowlist.

---

## 9. Webhooks we emit

For internal consumers (the storefront's ISR revalidator, analytics, an eventual ERP). HMAC-SHA256 signed with a per-subscriber secret, 5 retries with exponential backoff, replayable from the admin.

`product.created|updated|deleted` · `price.changed` · `stock.changed` · `category.updated` · `order.created|paid|shipped|delivered|cancelled` · `rfq.submitted|quoted|accepted` · `review.created`

## 10. Versioning & deprecation

URI-versioned (`/api/v1`). Additive changes ship without a version bump. Breaking changes get a new version, both run for 90 days, and the deprecated one returns `Deprecation` and `Sunset` headers plus a `warnings[]` array in `meta`.
