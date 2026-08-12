# OnlyParts — Frontend Architecture

**Version:** 1.0
**Stack:** Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Zustand · TanStack Query

---

## 1. Stack decisions

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15, App Router** | SSR/ISR is non-negotiable for a 12k-SKU catalog's SEO; RSC keeps the catalog pages nearly JS-free; the same app serves the animated landing page and the dense PLP |
| Language | TypeScript, `strict: true` | Attribute schemas are the heart of the product — they must be typed end to end |
| Styling | **Tailwind CSS v4** + CSS custom properties | v4's `@theme` consumes our token file directly; no runtime CSS-in-JS cost |
| Components | Custom, built on **Radix UI primitives** | Radix gives correct a11y for combobox/dialog/popover; we own the visuals entirely |
| Server state | **TanStack Query v5** | Search, facets, cart, stock — all benefit from caching, dedup and background refetch |
| Client state | **Zustand** | Cart, recently-viewed, BOM builder, UI prefs. Small, no provider tree |
| Forms | **React Hook Form + Zod** | Zod schemas are shared with the API for one source of validation truth |
| Animation | **CSS scroll-driven animations** first; **Motion (framer-motion)** only where CSS can't reach | Keeps the landing page's JS budget at 60 KB. Motion is lazily imported and never on the critical path |
| Search client | **Meilisearch JS (instant-meilisearch)** | Queries the search service directly from the browser with a scoped, search-only key — removes an API hop and gets us the < 120 ms p95 |
| Images | `next/image` + Cloudflare Images / imgproxy | AVIF/WebP, responsive srcset, blur placeholders |
| Testing | Vitest + Testing Library · Playwright · axe-core | Unit, E2E on the four money paths, automated a11y in CI |
| Analytics | PostHog (self-hosted) + GA4 | Funnels, session replay on checkout, search analytics |
| Errors | Sentry | Source-mapped, release-tagged |

---

## 2. Repository layout

Turborepo monorepo — the storefront, the admin, and the shared token/type packages must not drift.

```
onlyparts/
├─ apps/
│  ├─ web/                      Next.js storefront (public)
│  ├─ admin/                    Next.js admin console (internal, separate deploy)
│  └─ api/                      NestJS backend  → see 06-BACKEND-ARCHITECTURE.md
├─ packages/
│  ├─ tokens/                   design tokens → css/ts/json
│  ├─ ui/                       shared component library (Button, Input, Badge…)
│  ├─ types/                    shared TS types generated from the Prisma schema + Zod contracts
│  ├─ search/                   Meilisearch client, query parser, facet helpers
│  └─ config/                   eslint, tsconfig, tailwind presets
├─ prototype/                   the standalone design prototype (this repo, no build step)
└─ docs/
```

### `apps/web` structure

```
apps/web/
├─ app/
│  ├─ (marketing)/
│  │  ├─ page.tsx                       landing (the scroll narrative)
│  │  ├─ make/page.tsx                  Make-on-Demand pitch
│  │  ├─ make/rfq/page.tsx              RFQ wizard
│  │  └─ projects/[slug]/page.tsx       project collections
│  ├─ (shop)/
│  │  ├─ c/[...path]/page.tsx           L1/L2/L3 category — one catch-all route
│  │  ├─ p/[slug]/page.tsx              PDP
│  │  ├─ search/page.tsx                full search results
│  │  ├─ cart/page.tsx
│  │  └─ checkout/page.tsx
│  ├─ (account)/
│  │  ├─ orders/…  addresses/  boms/  rfqs/  settings/
│  ├─ api/
│  │  ├─ revalidate/route.ts            ISR webhook from the backend
│  │  └─ og/[...]/route.tsx             dynamic OG images
│  ├─ layout.tsx                        fonts, theme script, providers
│  ├─ error.tsx  not-found.tsx  global-error.tsx
│  └─ sitemap.ts  robots.ts
├─ components/
│  ├─ landing/                 Hero · PartsField · CategoryConstellation ·
│  │                           SearchDemo · TrustBand · ProjectRail · MakeSection
│  ├─ catalog/                 ProductTile · ProductGrid · FacetRail · FacetGroup ·
│  │                           RangeFacet · SortSelect · Breadcrumbs · CategoryTile
│  ├─ product/                 Gallery · VariantMatrix · PriceBreakTable · SpecTable ·
│  │                           StockBadge · AddToCart · QtyStepper · Reviews · QnA
│  ├─ search/                  SearchTrigger · SearchOverlay · TokenChips ·
│  │                           ResultRow · ZeroState
│  ├─ cart/  checkout/  rfq/  account/
│  ├─ layout/                  Header · MegaMenu · MobileNav · Footer · ThemeToggle
│  └─ ui/                      re-exports from packages/ui
├─ lib/
│  ├─ api.ts                   typed fetch wrapper (server + client)
│  ├─ search/                  query parser, synonyms, unit normaliser
│  ├─ cart/                    cart engine, price-break resolution
│  ├─ format.ts                INR, GST, dimensions, tabular numbers
│  ├─ seo.ts                   JSON-LD builders
│  └─ analytics.ts
├─ hooks/                      useSearch · useFacets · useCart · useVariantMatrix …
├─ stores/                     cart.ts · bom.ts · ui.ts · recentlyViewed.ts
└─ styles/                     globals.css (imports @onlyparts/tokens)
```

---

## 3. Rendering strategy per route

| Route | Strategy | Revalidate | Notes |
|---|---|---|---|
| `/` landing | **Static** | on deploy | Zero data dependency except counters; those hydrate client-side |
| `/c/[...path]` | **ISR** | 300 s + on-demand | Facet counts come from a client-side Meilisearch call so the HTML stays cacheable |
| `/p/[slug]` | **ISR** | 600 s + on-demand | Price and stock hydrate from a client fetch; the HTML carries the last-known values for SEO and instant paint |
| `/search` | **Client-rendered shell, SSR'd for crawlable queries** | — | `noindex` on parameterised queries |
| `/cart`, `/checkout` | **Dynamic (SSR, no cache)** | — | `noindex` |
| `/account/*` | **Dynamic, auth-gated** | — | `noindex` |
| `/make`, `/projects/*` | **Static / ISR** | 3600 s | Marketing |
| `/make/rfq` | **Dynamic** | — | Uploads |

**On-demand revalidation:** the backend emits `product.updated`, `category.updated`, `price.changed` events; a worker calls `POST /api/revalidate` with a shared secret and a tag list. Cache tags are `product:{id}`, `category:{id}`, `collection:{id}`.

The critical trade-off: catalog HTML must be cacheable for speed and SEO, but price/stock must be live for correctness. Resolution — **render last-known values server-side (correct for crawlers, instant for users), then reconcile on the client within 200 ms.** Any mismatch surfaces as an inline notice rather than a silent swap, and the cart re-validates every line at checkout regardless.

---

## 4. Component conventions

- **Server Components by default.** `'use client'` only for interaction: search, facets, variant matrix, cart, animation hosts.
- Client boundaries pushed as deep as possible — the PLP is a Server Component that renders a client `<FacetRail>` and a client `<ProductGrid>`, not a client page.
- Every component: named export, colocated `.test.tsx`, props typed via an exported interface, no default exports outside `app/`.
- Composition over configuration. `<ProductTile>` takes children slots rather than 14 boolean props.
- No component reads a raw hex, spacing, or font value — tokens only.

### Naming
`PascalCase` components · `camelCase` hooks/utils prefixed `use`/verb · `SCREAMING_SNAKE` constants · `kebab-case` files in `app/`, `PascalCase.tsx` elsewhere.

---

## 5. The search client

Search runs **browser → Meilisearch directly** with a search-only API key scoped to the public indexes. This is the single most important latency decision: routing search through our API would add 40–80 ms per keystroke.

```
keystroke
  → debounce 120 ms (0 ms for the first 2 chars → we prefetch on focus)
  → parseQuery(raw)                        packages/search/parser
      ├─ tokens: {thread:"M3", length_mm:10, material:"SS304"}
      └─ residual free text: "socket head"
  → build Meilisearch request
      q = residual, filter = tokens → facet filters, facets = category schema
  → render results + token chips
  → on select: prefetch the PDP route
```

The parser is shared with the backend (`packages/search`) so server-side search, sitemaps and the admin's zero-result report all agree. Spec: `09-SEARCH-SPEC.md`.

**Facet state lives in the URL**, not in React state. `?thread=M3&material=ss304&length=6-40` — shareable, back-button correct, server-renderable. A `useFacetParams()` hook wraps `useSearchParams` + `router.replace` with a 200 ms transition so rapid toggling doesn't thrash history.

---

## 6. Cart architecture

Zustand store, `localStorage`-persisted for guests, server-synced for authenticated users.

```ts
type CartLine = {
  variantId: string; sku: string; qty: number;
  unitPrice: number;       // resolved from the price-break tier
  listPrice: number;       // tier-1 price, for the "you save" display
  snapshot: { title, image, attrs, packSize, moq };
};
```

- **Price breaks resolve client-side for instant feedback and are re-resolved server-side at checkout.** The server is authoritative; a mismatch shows a clear "price updated" notice rather than a silent change.
- Stock is validated on cart open, on quantity change (debounced), and hard-validated at checkout.
- Merge-on-login: guest lines union with server lines, quantities summed, conflicts resolved to the higher quantity, and the user is shown what merged.
- Optimistic add-to-cart with rollback on failure.
- The **BOM builder** is a second store: a named list of variant+qty that can be saved, shared by URL, re-ordered, and pushed into the cart wholesale.

---

## 7. Landing page implementation

The hardest performance target in the project: a heavily animated page that must hit LCP < 2.0 s on 4G.

```tsx
// app/(marketing)/page.tsx — Server Component
export default function Landing() {
  return (
    <>
      <Hero />                 {/* server-rendered; headline is the LCP element */}
      <CategoryConstellation />{/* server-rendered markup, CSS-only reveal      */}
      <SearchDemo />           {/* client, but lazy: mounts on intersection      */}
      <TrustBand />            {/* server; counters hydrate client-side          */}
      <ProjectRail />          {/* server; CSS scroll-driven parallax            */}
      <MakeSection />          {/* server; CSS transform sequence                */}
      <ReviewMarquee />        {/* server; CSS animation                         */}
    </>
  );
}
```

Rules that make the budget work:

1. **The hero canvas (`PartsField`) is `next/dynamic` with `ssr:false` and mounts after `requestIdleCallback`.** It never blocks LCP. It self-disables below 480 px, under `prefers-reduced-motion`, when `hardwareConcurrency < 4`, or when `navigator.connection.saveData` is set.
2. **Section reveals are pure CSS** via `animation-timeline: view()`. An IntersectionObserver polyfill (~1.2 KB) adds a class for browsers without support. No JS runs per frame.
3. **The pinned SearchDemo** uses `animation-timeline: scroll()` for the scrub. Its fallback is a static, fully-legible panel — not a broken one.
4. **Fonts preloaded**, `size-adjust` fallbacks configured so there is no layout shift on swap.
5. **Above-the-fold imagery ≤ 180 KB**, AVIF, explicit width/height.
6. Budget enforced in CI: Lighthouse CI fails the build at LCP > 2.5 s (lab), total JS > 180 KB gzipped site-wide, or landing-route JS > 60 KB.

---

## 8. Performance

| Budget | Target |
|---|---|
| LCP (p75, mobile 4G) | < 2.0 s |
| INP (p75) | < 200 ms |
| CLS | < 0.1 |
| Route JS — landing | ≤ 60 KB gz |
| Route JS — PLP | ≤ 90 KB gz |
| Route JS — PDP | ≤ 85 KB gz |
| Shared chunk | ≤ 120 KB gz |
| Search keystroke → paint | < 120 ms p95 |

Techniques: RSC everywhere possible · route-level code splitting · `next/dynamic` for the variant matrix, review list, Q&A and the RFQ dropzone · prefetch on hover/viewport for tiles · `content-visibility: auto` on below-fold product rows · virtualised grid past 100 tiles · optimistic UI on cart and facets · Brotli · immutable asset caching · Cloudflare in front of everything.

---

## 9. SEO

- **JSON-LD:** `Organization` + `WebSite` (with `SearchAction`) sitewide; `BreadcrumbList` + `CollectionPage` on category pages; `Product` with `Offer`, `AggregateRating`, `priceValidUntil`, `gtin`/`mpn`, and `shippingDetails` on PDPs; `FAQPage` on guides; `HowTo` on project pages.
- **Canonicals:** the PDP canonical is `/p/{slug}` regardless of the browsing path. Facet URLs are `noindex,follow` **except** a curated allowlist of high-intent combinations (e.g. `?thread=M3&material=ss304`) which get self-canonicals, hand-written titles and H1s. That allowlist is managed in the admin — it is the long-tail organic strategy.
- **Sitemaps:** index + per-category product sitemaps, ≤ 45k URLs each, regenerated nightly, with `lastmod` from the product's `updated_at`.
- **Internal linking:** every PDP links to its primary category, its cross-listed categories, related products, and any project collections it belongs to. The many-to-many model is an SEO asset, not just a UX one.
- Titles: `{Product title} — Buy Online at OnlyParts` (≤ 60 chars where possible). Meta descriptions generated from the attribute schema, never truncated mid-spec.
- `hreflang` reserved for `en-IN` now, extensible later.

---

## 10. Error, loading and empty states

- Route-level `loading.tsx` with skeletons matching the final layout exactly — no CLS on hydration.
- `error.tsx` per route group with a retry action and a Sentry event ID the user can quote to support.
- Every empty state carries a recovery action: empty cart → recent categories; zero search results → relaxed-facet suggestion + "request it made to order"; empty order history → shop CTA.
- Offline: a service worker serves a branded offline page and keeps the cart readable.

## 11. Security (frontend)

- CSP with nonces, `strict-dynamic`; no `unsafe-inline` outside the theme-init script (which is nonced).
- The Meilisearch key exposed to the browser is **search-only, index-scoped, and rotated monthly**; it can neither write nor read private indexes.
- Auth via httpOnly, `SameSite=Lax`, `Secure` cookies. No tokens in `localStorage`.
- Payments are handled entirely by Razorpay's hosted flow — card data never enters our DOM.
- RFQ uploads go to pre-signed S3 URLs directly; the browser never holds a long-lived credential. Client-side type/size validation is a UX affordance only — the server re-validates and virus-scans.
- All external links `rel="noopener noreferrer"`. DOMPurify on any admin-authored rich text.
