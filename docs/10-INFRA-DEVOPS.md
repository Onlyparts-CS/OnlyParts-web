# OnlyParts — Infrastructure & DevOps

**Version:** 1.0
**Domain registrar:** Hostinger

---

## 1. Recommended topology

Hostinger holds the domain. It does not need to hold the hosting — keep the registrar, point the nameservers at Cloudflare, and host each tier where it belongs.

```
Hostinger (registrar)
   └─ nameservers → Cloudflare (DNS · CDN · WAF · rate limiting · Turnstile)
         ├─ onlyparts.in            → Vercel        (Next.js storefront)
         ├─ admin.onlyparts.in      → Vercel        (admin, Cloudflare Access gated)
         ├─ api.onlyparts.in        → Hostinger VPS / Hetzner CX32  (NestJS + workers)
         ├─ search.onlyparts.in     → same VPS, Docker, private network only
         ├─ cdn.onlyparts.in        → Cloudflare R2 + Images
         └─ status.onlyparts.in     → Better Stack
```

### Why this split

| Tier | Host | Reason |
|---|---|---|
| Storefront | **Vercel** | ISR, edge caching, image optimisation and preview deploys are exactly what a 12k-page catalog needs, and none of it is worth rebuilding. Hobby→Pro is ~$20/mo |
| API + workers + Postgres + Redis + Meilisearch | **One VPS** (Hostinger VPS 4 vCPU/16 GB, or Hetzner CX32 for ~€14/mo) | Co-locating removes network latency between the API and Postgres/Meilisearch, which is where the latency budget actually goes. 16 GB is comfortable for 50k SKUs |
| Media | **Cloudflare R2 + Images** | No egress fees, automatic AVIF/WebP, resize on the fly |
| DNS/CDN/WAF | **Cloudflare** | Free tier covers everything at this scale |

**If you prefer to keep everything on Hostinger:** their VPS plans will run the whole stack including the Next.js app under PM2 behind Nginx. It is cheaper and simpler, and it costs you ISR-at-the-edge, preview deploys, and automatic image optimisation — all of which you would then build. Recommendation: start on the split above; it is ~$35/mo total and buys back weeks.

**Region: Mumbai / `ap-south-1`.** Almost all traffic is Indian; a US-East database adds ~200 ms to every uncached request and quietly ruins the performance targets.

---

## 2. Environments

| Env | Purpose | Data |
|---|---|---|
| `local` | Docker Compose: Postgres, Redis, Meilisearch, MinIO | Seeded, ~500 SKUs |
| `preview` | Per-PR Vercel deploy → shared staging API | Anonymised staging data |
| `staging` | Full mirror of production | Anonymised production snapshot, refreshed weekly |
| `production` | Live | Live |

`docker-compose.yml` brings up the full backing stack locally in one command. No developer should need cloud credentials to run the storefront.

## 3. CI/CD (GitHub Actions)

```
PR opened
 ├─ lint (eslint + prettier + the no-hardcoded-colors rule)
 ├─ typecheck (tsc --noEmit, all packages)
 ├─ unit tests (Vitest) + coverage gate 70%
 ├─ build (turbo build, cache-hit aware)
 ├─ E2E (Playwright: search → PDP → cart → checkout → order; RFQ submit)
 ├─ a11y (axe-core on landing, PLP, PDP, cart, checkout)
 ├─ Lighthouse CI (fails: LCP > 2.5 s, perf < 90, route JS over budget)
 ├─ search regression (the 40-query suite from 09-SEARCH-SPEC.md §9)
 ├─ security (npm audit, Trivy on images, gitleaks)
 └─ preview deploy + a comment with the URL

merge → main
 ├─ migrate (Prisma, forward-only; CONCURRENTLY indexes; auto-rollback on failure)
 ├─ deploy API (blue/green on the VPS via Docker + Caddy, health-gated)
 ├─ deploy storefront (Vercel, atomic)
 ├─ smoke tests against production
 └─ Sentry release + source maps + Slack notification
```

Branching: trunk-based off `main`, short-lived feature branches, squash merge, conventional commits. Release tags are `v{semver}` cut from `main`.

Feature flags (Unleash or a simple DB-backed table) gate anything half-built — the landing animation, the BOM importer, and the MoD portal all ship behind flags first.

## 4. Database operations

- **Backups:** continuous WAL archiving to R2 + a nightly `pg_dump`. 30-day retention. **A restore is rehearsed monthly into staging** — an unrehearsed backup is a hope, not a backup.
- **PITR:** 7-day window.
- **Migrations:** forward-only, reviewed for lock behaviour, expand-and-contract for breaking changes. Anything touching `products`, `variants` or `orders` runs `CREATE INDEX CONCURRENTLY` outside peak hours.
- **Connection pooling:** PgBouncer in transaction mode; Prisma pool sized to `(cores × 2) + effective_spindle_count`.
- **Monitoring:** `pg_stat_statements`, slow-query log at 200 ms, bloat and vacuum checks, replication lag alert.
- **Meilisearch:** daily snapshot to R2; the index is rebuildable from Postgres in ~15 minutes, so it is treated as a cache, not a system of record.

## 5. Security operations

- TLS 1.3 everywhere, HSTS with preload, automatic certs via Caddy/Cloudflare.
- Cloudflare WAF: OWASP ruleset, bot fight mode, rate limiting on `/api/auth/*`, `/api/rfqs/*` and `/api/search`.
- Admin behind **Cloudflare Access** (Google SSO) plus application-level RBAC — two independent gates.
- SSH: key-only, no root login, non-standard port, fail2ban.
- Secrets in Doppler; nothing in the repo; gitleaks in CI; quarterly rotation.
- Dependabot weekly; security patches within 48 h of a critical advisory.
- Annual external penetration test before scaling spend.
- Incident runbooks in `docs/runbooks/`: payment gateway down · search down · database failover · data breach · courier API down.

## 6. Cost model (monthly, INR, at launch scale)

| Item | Cost |
|---|---|
| VPS (4 vCPU / 16 GB, Mumbai) | ₹1,800 |
| Vercel Pro | ₹1,700 |
| Cloudflare (free tier + R2) | ₹400 |
| Postgres backups + object storage | ₹300 |
| Razorpay | 2% per transaction (variable) |
| Email (SES/Resend) | ₹400 |
| SMS/WhatsApp (MSG91) | ₹1,500 |
| Sentry + PostHog (self-hosted on the same VPS) | ₹0–1,600 |
| Domain (Hostinger, amortised) | ₹100 |
| **Fixed total** | **≈ ₹6,200–7,800/month** |

At 500 orders/day this is a rounding error against transaction fees. Resist the urge to over-provision early; the single-VPS design has substantial headroom.

## 7. Launch checklist

**Technical** — [ ] DNS + SSL live on all subdomains · [ ] backups verified by an actual restore · [ ] monitoring and alerts firing to a real phone · [ ] load test at 3× expected peak · [ ] Lighthouse ≥ 90 on landing/PLP/PDP · [ ] axe clean on all money paths · [ ] search regression suite green · [ ] Razorpay in live mode, tested with a real ₹1 transaction and a real refund · [ ] courier serviceability tested against 20 real pincodes · [ ] GST invoice reviewed by a CA · [ ] 404/500 pages branded · [ ] sitemap + robots + GSC verified · [ ] rate limits tuned against realistic traffic

**Content** — [ ] all 13 L1 and every L2 have real copy, not lorem · [ ] ≥ 8,000 SKUs with complete attributes, 3 photographs and price breaks · [ ] every L3 node has an attribute schema · [ ] cross-listings applied per `02-TAXONOMY.md` §4 · [ ] 10 launch guides published · [ ] policy pages (privacy, terms, refunds, shipping) legally reviewed

**Business** — [ ] GSTIN and current account active · [ ] Razorpay KYC complete · [ ] courier accounts live with negotiated rates · [ ] warehouse stocked and cycle-counted · [ ] support channels staffed (WhatsApp + phone + email) with published hours · [ ] MoD supplier list with quoted rates for the top 5 processes · [ ] return and RTO process written down

## 8. Post-launch operating cadence

| Cadence | Activity |
|---|---|
| Daily | Order exceptions, failed payments, RFQ SLA queue, error budget |
| Weekly | **Zero-result report → catalog backlog** (the highest-leverage recurring meeting) · top searches with no click · stock-outs on top-100 SKUs · Core Web Vitals from field data |
| Monthly | Cohort retention, AOV by category, cross-category order rate, MoD win rate, backup restore drill, dependency updates |
| Quarterly | Taxonomy review (are any L3 nodes dead? any facets that should be categories?), pricing review, competitor teardown, security review |
