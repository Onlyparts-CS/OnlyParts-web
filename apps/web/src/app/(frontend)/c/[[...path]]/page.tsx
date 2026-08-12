import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { tree, resolve, schemaFor, COMMON_FACETS, type Node } from "@/lib/taxonomy";
import { dbSkusInPath } from "@/lib/catalogDb";
import { applyFilters, applySort, buildFacets, activeChips, type Params } from "@/lib/facets";
import { Breadcrumbs } from "@/components/catalog/Breadcrumbs";
import { FacetRail } from "@/components/catalog/FacetRail";
import { PlpControls } from "@/components/catalog/PlpControls";
import { ProductTile, ProductRow } from "@/components/catalog/ProductTile";
import { Reveal } from "@/components/Reveal";
import { Frame } from "@/components/Frame";
import { Glyph } from "@/components/Glyph";
import { Halftone } from "@/components/Halftone";
import { PLATE_FOR_GLYPH } from "@/lib/plates";
import { ArrowRight } from "@/components/Icons";
import { CATEGORIES, skuCountLabel, COMING_SOON, DRAWER_COUNT, brandsForCategory } from "@/lib/catalog";
import { CATALOGUE_EMPTY, EMPTY_COPY } from "@/lib/demo";

/** slug → 1-based drawer number, so a category page can state its address */
const CATEGORY_INDEX: Record<string, number> = Object.fromEntries(
  CATEGORIES.map((c, i) => [c.slug, i + 1]),
);

type Props = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Params>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path = [] } = await params;
  if (!path.length) return { title: "All categories — OnlyParts" };
  const hit = resolve(path);
  if (!hit) return {};
  return {
    title: `${hit.node.name} — Buy online at OnlyParts`,
    description: hit.node.blurb ?? `${hit.node.name} at OnlyParts. No minimum order, GST invoices, ships in 24 hours.`,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { path = [] } = await params;
  const sp = await searchParams;

  if (!path.length) return <AllCategories />;

  const hit = resolve(path);
  if (!hit) notFound();
  const { node, trail } = hit;

  // A node with children is a landing page; a leaf is a product listing.
  return node.children.length
    ? <CategoryLanding node={node} trail={trail} />
    : <ProductListing node={node} trail={trail} sp={sp} />;
}

/* ============================================================
   /c — index of all 13
   ============================================================ */
function AllCategories() {
  return (
    <div className="container-page page-shell">
      <Breadcrumbs trail={[]} />
      <h1 className="text-[clamp(1.75rem,3.5vw,2.75rem)]">All categories</h1>
      <p className="mt-3 max-w-2xl text-muted">
        {DRAWER_COUNT} top-level categories, three levels deep. Parts are cross-listed,
        so the same M3 screw appears under Fasteners and under Drones.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tree().map((n) => (
          <Link key={n.slug} href={`/c/${n.slug}`}
            className="group flex flex-col overflow-hidden rounded-md border border-line bg-surface shadow-e1 transition-all hover:-translate-y-1 hover:border-spot-600 hover:shadow-e2">
            <Frame ratio="4/3" glyph={n.glyph} className="border-b border-line" sizes="25vw" />
            <div className="p-4">
              <h2 className="text-[1.0625rem]">{n.name}</h2>
              <p className="mt-1 font-mono text-[0.6875rem] text-faint">
                {n.children.length} subcategories · <span className="text-spot-700">{skuCountLabel(n.count) ?? COMING_SOON}</span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   L1 / L2 landing — subcategory tiles + facet shortcuts
   ============================================================ */
async function CategoryLanding({ node, trail }: { node: Node; trail: Node[] }) {
  const skus = await dbSkusInPath(node.path);
  const bestsellers = [...skus].sort((a, b) => b.ratingCount - a.ratingCount).slice(0, 6);

  // "Shop by X" rows are pre-built facet links — the SEO long-tail surface,
  // and they teach the facet vocabulary before the user reaches the PLP.
  const shortcuts = buildShortcuts(node);
  // Brands are attached to the top-level drawer, so a shelf inherits its parent's.
  const brands = brandsForCategory(node.path[0]);

  return (
    <div className="container-page page-shell">
      <Breadcrumbs trail={trail} />

      {/* The drawer's own front: plate on the left, label on the right. The
          eyebrow that used to read "Category" above a heading called
          "Fasteners" said nothing the breadcrumb had not already said. */}
      <header className="mb-10 grid gap-6 border-b border-ink-900 pb-8 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-center lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
        <span className="block aspect-[4/3] w-full overflow-hidden border border-line bg-bg">
          <Halftone plate={PLATE_FOR_GLYPH[node.glyph] ?? "screw"} cell={6} className="h-full w-full" />
        </span>
        <div className="min-w-0">
          <p className="bin mb-2">
            Drawer {String(CATEGORY_INDEX[node.path[0]] ?? 0).padStart(2, "0")}
            {node.level > 1 && ` · shelf ${node.name}`}
          </p>
          <h1 className="monumental text-[clamp(2rem,5vw,4rem)]">{node.name}</h1>
          {node.blurb && <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">{node.blurb}</p>}
          <p className="mt-4 font-mono text-[0.8125rem] text-faint">
            {skuCountLabel(node.count)
              ? <><span className="text-spot-700">{node.count.toLocaleString("en-IN")}</span> products · </>
              : <><span className="text-spot-700">{COMING_SOON}</span> · </>}
            {node.children.length} {node.level === 1 ? "shelves" : "types"}
          </p>
        </div>
      </header>

      <section className="mb-12">
        <h2 className="mb-4 text-[1.375rem]">{node.level === 1 ? "Shelves" : "Types"}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {node.children.map((c) => (
            <Link key={c.slug} href={`/c/${c.path.join("/")}`}
              className="card-index group flex items-center gap-3 p-3">
              <span className="block size-16 shrink-0 overflow-hidden bg-bg">
                <Halftone plate={PLATE_FOR_GLYPH[c.glyph] ?? "screw"} cell={4} duotone={false} className="h-full w-full" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-medium text-heading transition-colors group-hover:text-spot-700">{c.name}</span>
                <span className="bin mt-1 block">
                  {c.children.length ? `${c.children.length} types · ` : ""}{skuCountLabel(c.count) ?? COMING_SOON}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-disabled transition-transform group-hover:translate-x-0.5 group-hover:text-spot-600" />
            </Link>
          ))}
        </div>
      </section>

      {/*
        Brands as a row of shortcuts, not as a level of the tree.

        The link narrows *this* category by brand; the brand's own name goes to
        its shelf across every category it appears in. A buyer who does not care
        who made it never has to walk through this.
      */}
      {brands.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-faint">
            Shop by brand
          </h2>
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <Link key={b.slug} href={`/c/${node.path.join("/")}?brand=${b.slug}`} className="chip">
                {b.name}
              </Link>
            ))}
            <Link href={`/b/${brands[0].slug}`} className="chip">All brands →</Link>
          </div>
        </section>
      )}

      {shortcuts.map((s) => (
        <section key={s.title} className="mb-8">
          <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-faint">{s.title}</h2>
          <div className="flex flex-wrap gap-2">
            {s.items.map((it) => (
              <Link key={it.label} href={it.href} className="chip">{it.label}</Link>
            ))}
          </div>
        </section>
      ))}

      {bestsellers.length > 0 && (
        <section className="section-gap">
          <h2 className="mb-4 text-lg">Bestsellers in {node.name}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {bestsellers.map((s) => <ProductTile key={s.sku} sku={s} />)}
          </div>
        </section>
      )}
    </div>
  );
}

/** Pre-built facet links per category — hand-curated, indexable entry points. */
function buildShortcuts(node: Node) {
  const l1 = node.path[0];
  const out: { title: string; items: { label: string; href: string }[] }[] = [];
  if (l1 === "fasteners") {
    const leaf = "/c/fasteners/screws-by-head/socket-head-cap";
    out.push({
      title: "Shop by thread",
      items: ["M2", "M2.5", "M3", "M4", "M5", "M6", "M8"].map((t) => ({ label: t, href: `${leaf}?thread=${t}` })),
    });
    out.push({
      title: "Shop by material",
      items: ["SS 304", "SS 316", "Alloy 12.9", "Brass"].map((m) => ({ label: m, href: `${leaf}?material=${encodeURIComponent(m)}` })),
    });
  }
  if (l1 === "bearings") {
    const leaf = "/c/bearings/ball-bearings/deep-groove";
    out.push({
      title: "Shop by bore",
      items: [3, 4, 5, 6, 8, 10, 12, 15, 17, 20].map((b) => ({ label: `${b} mm`, href: `${leaf}?bore_id_mm=${b}-${b}` })),
    });
    out.push({
      title: "Shop by seal",
      items: ["ZZ (metal shielded)", "2RS (rubber sealed)", "Open"].map((s) => ({ label: s, href: `${leaf}?seal_type=${encodeURIComponent(s)}` })),
    });
  }
  if (l1 === "magnets") {
    const leaf = "/c/magnets/neodymium-ndfeb/disc";
    out.push({
      title: "Shop by grade",
      items: ["N35", "N42", "N52"].map((g) => ({ label: g, href: `${leaf}?grade=${g}` })),
    });
  }
  return out;
}

/* ============================================================
   L3 leaf — the product listing page
   ============================================================ */
async function ProductListing({ node, trail, sp }: { node: Node; trail: Node[]; sp: Params }) {
  const all = await dbSkusInPath(node.path);
  // own schema where the leaf has one; inferred from the SKUs where products
  // arrived by cross-listing (e.g. Drones › Drone Screws)
  const schema = [...schemaFor(node, all), ...COMMON_FACETS];
  const facets = buildFacets(all, schema);
  const filtered = applyFilters(all, schema, sp);
  const sort = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort ?? "relevance";
  const sorted = applySort(filtered, sort, schema);
  const chips = activeChips(schema, sp);
  const view = (Array.isArray(sp.view) ? sp.view[0] : sp.view) === "table" ? "table" : "grid";

  const cols = schema
    .filter((d) => d.key !== "price" && d.key !== "availability")
    .slice(0, 5)
    .map((d) => ({ key: d.key, label: d.label, unit: d.unit }));

  return (
    <div className="container-page page-shell">
      <Breadcrumbs trail={trail} />

      <header className="mb-6">
        <h1 className="text-[clamp(1.5rem,3vw,2.25rem)]">{node.name}</h1>
        {all.length > 0 && (
          <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted">
            {all.length.toLocaleString("en-IN")} listed. Filter by the specs that
            actually decide the part — no minimum order on any of them.
          </p>
        )}
      </header>

      {all.length === 0 ? (
        <EmptyLeaf node={node} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[256px_1fr]">
          <FacetRail facets={facets} total={all.length} />

          <div className="min-w-0">
            <PlpControls chips={chips} total={sorted.length} />

            {sorted.length === 0 ? (
              <ZeroResults />
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
                {/*
                  Each tile is wrapped in a `grid`, not a bare div: a
                  `.card-index` is a block-level flex column and will not
                  stretch to a grid row's height on its own, so a plain
                  wrapper leaves short tiles floating off the rule line. A
                  one-cell grid stretches its child and the row keeps shape.

                  `index` is the position within a row, not the position in
                  the list — a row of five arrives together, and tile 52 must
                  not wait for fifty-one predecessors.
                */}
                {sorted.slice(0, 60).map((s, i) => (
                  <Reveal key={s.sku} className="grid" index={i % 5}>
                    <ProductTile sku={s} />
                  </Reveal>
                ))}
              </div>
            )}

            {sorted.length > 60 && (
              <p className="mt-6 text-center font-mono text-[0.8125rem] text-faint">
                Showing 60 of {sorted.length.toLocaleString("en-IN")} — pagination lands with the API
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Never a dead end — docs/09-SEARCH-SPEC.md §6. */
function ZeroResults() {
  return (
    <div className="rounded-md border border-line bg-surface px-6 py-14 text-center">
      <h2 className="text-lg">No parts match every filter.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Remove a filter above to widen the search — or if this combination
        genuinely doesn&apos;t exist off the shelf, we can make it.
      </p>
      <Link href="/make/rfq" className="btn btn-primary btn-sm mt-5">Get it made on demand →</Link>
    </div>
  );
}

/**
 * Two different empty states, because they are two different situations.
 *
 * Catalogue empty (production, pre-launch): a customer is here, so the copy is
 * customer-facing and routes them to the two things we can still do — source it
 * or make it.
 *
 * Catalogue present but this leaf unseeded (demo): an internal reader is here,
 * so the copy names the wave and links to leaves that do have data.
 */
function EmptyLeaf({ node }: { node: Node }) {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-sm border border-spot-200 bg-spot-50 text-spot-600">
        <Glyph name={node.glyph} className="size-6" />
      </span>

      {CATALOGUE_EMPTY ? (
        <>
          <h2 className="text-lg">{node.name} — {COMING_SOON.toLowerCase()}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">{EMPTY_COPY.body}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/make/rfq" className="btn btn-primary btn-sm">Tell us what you need</Link>
            <Link href="/c" className="btn btn-secondary btn-sm">Browse the full tree</Link>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-lg">{node.name} isn&apos;t seeded yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            The taxonomy node and its attribute schema exist — {node.count.toLocaleString("en-IN")} SKUs
            are planned here in catalogue wave {waveOf(node.path[0])}. Seeded leaves you can try now:
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/c/fasteners/screws-by-head/socket-head-cap" className="chip">Socket Head Cap Screws</Link>
            <Link href="/c/bearings/ball-bearings/deep-groove" className="chip">Deep Groove Bearings</Link>
            <Link href="/c/magnets/neodymium-ndfeb/disc" className="chip">Neodymium Discs</Link>
            <Link href="/c/motors/stepper-motors/nema-17" className="chip">NEMA 17 Steppers</Link>
          </div>
        </>
      )}
    </div>
  );
}

const waveOf = (l1: string) =>
  ["fasteners", "bearings", "magnets", "hardware"].includes(l1) ? 1
    : ["electronic-components", "motors"].includes(l1) ? 2
    : ["3d-printing", "3d-printers", "drones-parts", "batteries-power"].includes(l1) ? 3 : 4;
