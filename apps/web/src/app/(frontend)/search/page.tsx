import Link from "next/link";
import type { Metadata } from "next";
import { after } from "next/server";

import { logSearch } from "@/lib/searchLog";
import { searchSkus } from "@/lib/searchSkus";
import { dbAllSkus } from "@/lib/catalogDb";
import { SUGGESTIONS } from "@/lib/search";
import { inferSchema, COMMON_FACETS } from "@/lib/taxonomy";
import { applyFilters, applySort, buildFacets, activeChips, type Params } from "@/lib/facets";
import { TokenBar } from "@/components/search/TokenBar";
import { FacetRail } from "@/components/catalog/FacetRail";
import { PlpControls } from "@/components/catalog/PlpControls";
import { ProductTile, ProductRow } from "@/components/catalog/ProductTile";
import { Reveal } from "@/components/Reveal";
import { Glyph } from "@/components/Glyph";
import { SearchIcon } from "@/components/Icons";
import { CATEGORIES, skuCountLabel, COMING_SOON } from "@/lib/catalog";

type Props = { searchParams: Promise<Params> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = str((await searchParams).q);
  return {
    title: q ? `${q} — search results | OnlyParts` : "Search — OnlyParts",
    // parameterised queries are never indexed
    robots: { index: false, follow: true },
  };
}

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = str(sp.q).trim();

  if (!q) return <EmptyQuery />;

  const found = searchSkus(q, await dbAllSkus(), 500);

  /*
    Logged after the response is sent, never before. The visitor is not waiting
    on our bookkeeping, and `logSearch` swallows its own failures — a database
    hiccup must not turn a search into an error page.

    `found.total` rather than the post-filter count: this records whether the
    catalogue could answer the question at all, not whether the facets the
    visitor then ticked left anything behind.
  */
  after(() => logSearch(q, found.total));

  // facets are inferred from the result set — a search can span categories, so
  // there is no single leaf schema to read from
  const schema = [...inferSchema(found.results), ...COMMON_FACETS];
  const facets = buildFacets(found.results, schema);
  const filtered = applyFilters(found.results, schema, sp);
  // searchSkus already ranked these — "relevance" must preserve that order
  const sorted = applySort(filtered, str(sp.sort) || "relevance", schema, true);
  const chips = activeChips(schema, sp);
  const view = str(sp.view) === "table" ? "table" : "grid";

  const cols = schema
    .filter((d) => d.key !== "price" && d.key !== "availability")
    .slice(0, 5)
    .map((d) => ({ key: d.key, label: d.label, unit: d.unit }));

  return (
    <div className="container-page page-shell">
      <header className="mb-5">
        <h1 className="text-[clamp(1.375rem,2.6vw,2rem)]">
          {found.total.toLocaleString("en-IN")} results for{" "}
          <span className="font-mono text-spot-700">“{q}”</span>
        </h1>
      </header>

      <TokenBar q={q} tokens={found.tokens} />

      {found.relaxed && (
        <div className="mb-5 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-[0.875rem] text-warning">
          {found.relaxed.values.length > 0 ? (
            <>
              Nothing at <span className="font-mono">{found.relaxed.label}</span> — we relaxed it to the
              nearest stocked values: <span className="font-mono">{found.relaxed.values.join(", ")}</span>.
            </>
          ) : (
            <>
              We ignored <span className="font-mono">{found.relaxed.label}</span> — nothing in these
              results is measured that way.
            </>
          )}
        </div>
      )}

      {/* category rail — narrow a broad query before touching a facet */}
      {found.categories.length > 1 && (
        <section className="mb-6">
          <h2 className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
            Your results span {found.categories.length} categories
          </h2>
          <div className="flex flex-wrap gap-2">
            {found.categories.map((c) => (
              <Link key={c.path.join("/")} href={`/c/${c.path.join("/")}`} className="chip">
                {c.full}
                <span className="ml-1 text-spot-700">{c.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {found.total === 0 ? (
        <ZeroResults q={q} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[256px_1fr]">
          <FacetRail facets={facets} total={found.results.length} />

          <div className="min-w-0">
            <PlpControls chips={chips} total={sorted.length} />

            {sorted.length === 0 ? (
              <div className="rounded-md border border-line bg-surface px-6 py-14 text-center">
                <h2 className="text-lg">No results match every filter.</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  Remove a filter above to widen the search.
                </p>
              </div>
            ) : view === "table" ? (
              <div className="overflow-x-auto rounded-md border border-line bg-surface">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line bg-sunken">
                      <th className="py-2 pl-3 pr-2 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-faint">Product</th>
                      {cols.map((c) => (
                        <th key={c.key} className="whitespace-nowrap px-2 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-faint">
                          {c.label}{c.unit ? ` (${c.unit})` : ""}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-faint">1 pc</th>
                      <th className="px-2 py-2 text-right text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-faint">100+</th>
                      <th className="py-2 pl-2 pr-3 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-faint">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.slice(0, 60).map((s) => <ProductRow key={s.sku} sku={s} cols={cols} />)}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {/* Same wrapper as the category listing — see the note there. */}
                {sorted.slice(0, 60).map((s, i) => (
                  <Reveal key={s.sku} className="grid" index={i % 5}>
                    <ProductTile sku={s} />
                  </Reveal>
                ))}
              </div>
            )}

            {sorted.length > 60 && (
              <p className="mt-6 text-center font-mono text-[0.8125rem] text-faint">
                Showing 60 of {sorted.length.toLocaleString("en-IN")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Zero results is never a dead end — docs/09-SEARCH-SPEC.md §6.
 * Step 4 of the cascade turns the worst moment in the funnel into an MoD lead,
 * which is the reason both businesses live on one site.
 */
function ZeroResults({ q }: { q: string }) {
  return (
    <div className="rounded-md border border-line bg-surface px-6 py-14 text-center">
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-spot-50 text-spot-600">
        <SearchIcon className="size-5" />
      </span>
      <h2 className="text-lg">Nothing in the catalogue matches “{q}”.</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
        We don&apos;t stock it — but we can make it. Upload a drawing or describe
        the part and an engineer will quote it within 24 hours.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/make/rfq" className="btn btn-primary btn-sm">Get it made on demand →</Link>
        <Link href="/c" className="btn btn-secondary btn-sm">Browse all categories</Link>
      </div>
      <div className="mt-8 border-t border-line pt-6">
        <p className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">Try one of these</p>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="chip">{s}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyQuery() {
  return (
    <div className="container-page page-shell">
      <h1 className="text-[clamp(1.5rem,3vw,2.25rem)]">Search 12,000+ parts</h1>
      <p className="mt-3 max-w-xl text-muted">
        Type a spec, a SKU or a dimension — <span className="font-mono text-spot-700">m3x10 ss304</span>,{" "}
        <span className="font-mono text-spot-700">608zz</span>,{" "}
        <span className="font-mono text-spot-700">n52 15x3</span>. We parse it into attributes
        before we look anything up.
      </p>

      <div className="mt-8">
        <p className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">Popular searches</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="chip">{s}</Link>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <p className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">Or browse</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/c/${c.slug}`}
              className="group flex items-center gap-3 rounded-md border border-line bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-spot-600 hover:shadow-e2">
              <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-spot-200 bg-spot-50 text-spot-600">
                <Glyph name={c.glyph} className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[0.9375rem] font-medium text-heading">{c.name}</span>
                <span className="block font-mono text-[0.6875rem] text-faint">{skuCountLabel(c.count) ?? COMING_SOON}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
