# OnlyParts — Build Roadmap

**Version:** 1.0 · Target public launch: **~19 weeks** from kickoff
Assumed team: 1 full-stack lead, 1 frontend, 1 backend, 1 designer (half-time), 1 catalog ops (full-time from week 2).

The catalog-ops hire is not optional. Search quality is the product thesis, search quality is downstream of attribute quality, and attribute quality is a full-time job for 12,000 SKUs. A team that ships perfect code against a sloppy catalog ships a mediocre product.

---

## Phase 0 — Foundation (weeks 1–3)

| Deliverable | Owner |
|---|---|
| Turborepo scaffold: `web`, `admin`, `api`, `tokens`, `ui`, `types`, `search`, `config` | Lead |
| Design tokens implemented from `03-DESIGN-SYSTEM.md`; Tailwind v4 `@theme` wired | FE + Design |
| Core UI kit: Button, Input, Select, Checkbox, Badge, Chip, Card, Modal, Drawer, Toast, Skeleton | FE |
| Postgres schema + Prisma migrations for catalog, inventory, users (per `07-DATA-MODEL.md`) | BE |
| Auth: register/login/OTP/refresh, RBAC guards | BE |
| Admin shell: layout, auth, data table, form primitives | BE + FE |
| Docker Compose local stack; CI pipeline green end to end | Lead |
| Attribute schemas authored for the 13 L1s and all L2s | Catalog ops + Design |

**Exit criteria:** a developer clones, runs one command, and has a working local stack with seeded data. CI blocks on lint/type/test/a11y.

## Phase 1 — Catalog & search (weeks 4–7)

| Deliverable | |
|---|---|
| Full 3-level taxonomy seeded — 13 L1, ~120 L2, ~600 L3 | |
| Attribute definitions for every L3 node | |
| Product/variant/media CRUD in admin + CSV import with dry-run diff | |
| Meilisearch deployed; indexer worker + transactional outbox | |
| Query parser (`packages/search`) with the 40-query regression suite green | |
| Search overlay component: tokens, sections, keyboard, zero-state | |
| PLP with schema-driven facets, URL state, sorting | |
| PDP with variant matrix, spec table, price breaks, gallery | |
| Category L1/L2 landing templates | |
| **Wave 1 catalog loaded: 4,000 SKUs** (Fasteners, Bearings, Magnets, Hardware) | |

**Exit criteria:** every query in the regression suite returns the right top result against real data; zero-result rate on internal testing < 5%; PLP p95 < 400 ms.

## Phase 2 — Commerce (weeks 8–11)

| Deliverable | |
|---|---|
| Cart: add/update/remove, price-break resolution, merge-on-login, persistence | |
| Checkout: prepare → reservations → order, single-page 4-block form | |
| Razorpay integration + webhooks + reconciliation job | |
| COD with value limits and velocity checks | |
| GST engine: per-line CGST/SGST/IGST, HSN mapping, gapless invoice numbering | |
| Invoice PDF generation | |
| Shipping: Shiprocket/Delhivery rates, serviceability, AWB, tracking | |
| Order state machine + admin order management + fulfilment | |
| Transactional notifications (email + SMS + WhatsApp) | |
| Inventory ledger, reservations, allocation, low-stock alerts | |
| Account area: orders, addresses, reorder, wishlist | |
| **Wave 2 catalog: +3,500 SKUs** (Electronic Components, Motors) | |

**Exit criteria:** 50 end-to-end test orders including refunds, cancellations and partial fulfilment. A CA has signed off on a real GST invoice. Playwright covers the full money path.

## Phase 3 — Landing page & brand (weeks 12–14)

| Deliverable | |
|---|---|
| Hero with the animated parts field (canvas, budget-enforced) | |
| Category constellation with 13 signature hover animations | |
| Pinned scroll-driven search demo | |
| Trust band, project rail, MoD teaser, review marquee | |
| Project collection pages (Drone, 3D Printer, Robot, EV, CNC, Repair Bench) | |
| Full SEO: JSON-LD, sitemaps, canonicals, the indexable-facet allowlist | |
| Blog/guides engine + 10 launch articles | |
| Reduced-motion and low-end-device paths verified on real hardware | |
| **Wave 3 catalog: +2,000 SKUs** (3D Printing, Drones, Batteries) | |

**Exit criteria:** Lighthouse ≥ 90 on the landing page on a throttled 4G mid-range Android; landing route JS ≤ 60 KB gz; the reduced-motion page contains every piece of information the animated one does.

## Phase 4 — Make-on-Demand (weeks 15–17)

| Deliverable | |
|---|---|
| RFQ wizard: upload → specify → contact → confirm | |
| Presigned S3 uploads, virus scanning, STEP/STL preview generation | |
| NDA handling: separate bucket prefix, access logging, restricted IAM | |
| Admin RFQ queue with SLA timers and assignment | |
| Cost-sheet tool → structured `cost_breakdown` → quote PDF | |
| Customer portal: status timeline, files, quotes, comment thread | |
| Quote acceptance → Job + milestones + advance payment link | |
| MoD marketing page and the landing-page section | |
| **Wave 4 catalog: +2,500 SKUs** (Tools, CNC, Industrial Electricals, EV) | |

**Exit criteria:** 10 real RFQs processed end to end with actual suppliers, median first response under 4 business hours.

## Phase 5 — Hardening & launch (weeks 18–19)

Load test at 3× peak · security review and pen test · full a11y audit at 200% zoom and 320 px · catalog QA sweep (every SKU: complete attributes, 3 photos, price breaks, ≥ 1 category, correct HSN) · backup restore drill · runbooks written · support team trained · soft launch to a private list for 1 week · public launch.

---

## Post-launch backlog

**Q1 after launch** — BOM importer (CSV/paste → cart) · back-in-stock alerts · verified reviews with photos · product Q&A · saved and shareable BOMs · abandoned-cart recovery · B2B customer-group pricing · credit terms for MSME accounts.

**Q2** — Instant-quote engine for 3D printing (the easiest process to automate; mesh volume + bounding box + material rate) · supplier portal for MoD vendors · PWA install + offline catalog · Hindi and Tamil localisation · loyalty credits · subscription/auto-replenish for consumables.

**Q3** — Instant quoting for CNC (feature recognition) · vendor-managed inventory for high-volume B2B · ERP/Tally integration · a public parts API for institutional customers · ATL/college bulk programme (a proven Indian segment) · marketplace pilot for the long tail.

---

## Sequencing rationale

Three orderings are deliberate and worth defending:

**Search before commerce.** If search doesn't work, a perfect checkout has nothing to check out. Phase 1 proves the thesis on real data before a rupee of commerce code is written — and if the 40-query suite can't be made green, that is a signal worth having in week 7 rather than week 19.

**Commerce before the landing page.** The landing page is the most visible work and the most tempting to do first. It is also the easiest to redo. Building it in Phase 3 means it is designed around a catalog and a search experience that actually exist, rather than around mockups.

**MoD last, but in v1.** It shares nothing with the retail checkout, so it parallelises cleanly and can slip a week without blocking launch. But it ships *in v1* because it is the strategic differentiator and because every zero-result search is a free MoD lead — the two businesses only compound when both are live.

## Risk buffer

The plan has no slack in it. Realistically, add 2–3 weeks: catalog data cleanup always takes longer than estimated, Razorpay KYC has been known to take two weeks, and courier rate negotiation is a business process, not an engineering one. **Start GSTIN, Razorpay KYC and courier accounts in week 1**, in parallel with Phase 0 — they are the only items on this roadmap that engineering cannot unblock by working harder.
