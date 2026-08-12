import Link from "next/link";
import { getPayload } from "payload";
import config from "@payload-config";
import { dbAllSkus } from "@/lib/catalogDb";
import { tree } from "@/lib/taxonomy";
import { istDay } from "@/lib/adminOps";
import { catalogueGaps } from "@/lib/pim";
import { ArrowRight } from "@/components/Icons";
import { ZeroResultRow } from "./ZeroResultRow";
import { ExceptionRows, type ExceptionRow } from "./ExceptionRows";
import type { Triage } from "@/collections/SearchQueries";

/**
 * The completeness queue — docs/14-ADMIN-CATALOG-OPS.md §7.
 *
 * This is the screen that turns "the catalogue is incomplete" from a vague
 * worry into a finite, ordered list of work.
 */
export default async function AdminQueues() {
  const skus = await dbAllSkus();
  const seeded = new Set(skus.map((s) => s.categories[0].join("/")));

  const empty = tree().flatMap((l1) =>
    l1.children.flatMap((l2) =>
      l2.children
        .filter((l3) => !seeded.has(l3.path.join("/")))
        .map((l3) => ({ l1: l1.name, path: l3.path, name: l3.name, planned: l3.count })),
    ),
  );

  const byL1 = new Map<string, { count: number; planned: number }>();
  for (const e of empty) {
    const cur = byL1.get(e.l1) ?? { count: 0, planned: 0 };
    byL1.set(e.l1, { count: cur.count + 1, planned: cur.planned + e.planned });
  }
  const ranked = [...byL1].sort((a, b) => b[1].planned - a[1].planned);
  const totalPlanned = ranked.reduce((n, [, v]) => n + v.planned, 0);

  /*
    Zero-result searches, most-asked first. `resultCount: 0` is the filter that
    matters — a query that used to fail and now returns forty results has been
    solved by somebody adding the product, and it drops out of the queue on its
    own the next time anybody searches it. Nothing to close by hand.
  */
  const payload = await getPayload({ config });
  const zero = await payload.find({
    collection: "search-queries",
    where: { resultCount: { equals: 0 } },
    sort: "-count",
    limit: 50,
    depth: 0,
    overrideAccess: true,
  });
  const untriaged = zero.docs.filter((d) => d.triage === "untriaged").length;

  /*
    Counted on the product, not the variant. A photograph is of the part, and
    272 lengths of one socket cap screw share one photo — reporting "1,172 SKUs
    without imagery" would make a seven-product job look like a thousand-product
    one and nobody would ever start it.
  */
  const products = await payload.find({
    collection: "products", limit: 2000, depth: 0, overrideAccess: true,
  });
  const productCount = products.totalDocs;
  const noImage = products.docs.filter((p) => (p.media ?? []).length === 0).length;

  /*
    Enrichment gaps across the whole catalogue in four queries.

    This was `completeness()` per leaf — four queries × 389 leaves, which cost
    34 seconds a page load. `catalogueGaps` resolves the inheritance in memory
    instead. An empty leaf is already counted above as a seeding job; this is
    the different problem of a stocked leaf whose parts are missing their specs.
  */
  const gaps = await catalogueGaps();

  /*
    Import exceptions, open first. Sorted by status then date so the queue reads
    as work rather than as history — a resolved row from this morning is less
    interesting than an open one from last week.
  */
  const exceptions = await payload.find({
    collection: "import-exceptions",
    sort: ["status", "-at"],
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });
  const openExceptions = exceptions.docs.filter((e) => e.status === "open").length;
  const exceptionRows: ExceptionRow[] = exceptions.docs.map((e) => ({
    id: e.id,
    sku: e.sku,
    source: e.source,
    at: istDay(e.at),
    reasons: e.reasons,
    status: (e.status ?? "open") as ExceptionRow["status"],
    note: e.note ?? null,
    row: (e.row ?? null) as Record<string, string> | null,
  }));

  return (
    <div className="container-page page-shell">
      <h1 className="text-[clamp(1.5rem,3vw,2.25rem)]">Work queues</h1>
      <p className="mt-2 max-w-2xl text-muted">
        The catalogue-ops backlog, ranked by planned SKU count — the order in which
        seeding actually pays off.
      </p>

      <section className="section-gap">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg">Empty leaf categories</h2>
          <p className="font-mono text-[0.8125rem] text-faint">
            <span className="text-warning">{empty.length}</span> leaves ·{" "}
            <span className="text-warning">{totalPlanned.toLocaleString("en-IN")}</span> planned SKUs
          </p>
        </div>

        <div className="overflow-hidden rounded-md border border-line bg-surface">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bin border-b border-line bg-sunken">
                <th className="px-4 py-2.5 font-bold">Category</th>
                <th className="px-3 py-2.5 text-right font-bold">Empty leaves</th>
                <th className="px-3 py-2.5 text-right font-bold">Planned SKUs</th>
                <th className="px-3 py-2.5 font-bold">Wave</th>
                <th className="w-8 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {ranked.map(([name, v]) => (
                <tr key={name} className="border-b border-line last:border-0 hover:bg-sunken/60">
                  <td className="px-4 py-2.5 text-[0.875rem] text-heading">{name}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[0.8125rem] tnum text-warning">{v.count}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[0.8125rem] tnum text-body">
                    {v.planned.toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-xs bg-sunken px-1.5 py-0.5 font-mono text-[0.625rem] text-faint">
                      wave {waveOf(name)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href="/admin/import" aria-label={`Import ${name}`}
                      className="grid size-6 place-items-center rounded-xs text-disabled hover:bg-sunken hover:text-spot-700">
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[0.8125rem] text-faint">
          Seeding order follows <span className="font-mono">02-TAXONOMY.md</span> §6 — wave 1
          first because those categories have the highest attribute density, which is
          what proves the search thesis.
        </p>
      </section>

      <section className="section-gap">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg">Zero-result searches</h2>
          <p className="font-mono text-[0.8125rem] text-faint">
            <span className={untriaged > 0 ? "text-danger" : ""}>{untriaged}</span> untriaged ·{" "}
            {zero.totalDocs.toLocaleString("en-IN")} distinct
          </p>
        </div>

        {zero.docs.length === 0 ? (
          <div className="border border-dashed border-line-strong bg-surface p-8 text-center">
            <p className="bin mb-3">Nothing yet</p>
            <h3 className="monumental text-[clamp(1.125rem,2vw,1.5rem)]">Every search found something</h3>
            <p className="mx-auto mt-3 max-w-lg text-[0.875rem] leading-relaxed text-muted">
              Searches are recorded as they happen, one row per distinct query. Either
              nobody has hit a gap yet, or nobody has searched — try{" "}
              <Link href="/search?q=titanium+m3" target="_blank" className="font-mono text-spot-700 hover:underline">
                something we do not stock
              </Link>{" "}
              and refresh.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border border-line bg-surface">
              <table className="w-full min-w-[840px] border-collapse text-left">
                <thead>
                  <tr className="bin border-b border-line bg-sunken">
                    <th className="px-4 py-2.5 font-bold">Query</th>
                    <th className="px-3 py-2.5 text-right font-bold">Searches</th>
                    <th className="px-3 py-2.5 font-bold">Last seen</th>
                    <th className="px-3 py-2.5 font-bold">Classification</th>
                    <th className="px-3 py-2.5 font-bold">Note</th>
                    <th className="w-20 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {zero.docs.map((d) => (
                    <ZeroResultRow
                      key={d.id}
                      id={d.id}
                      q={d.q}
                      count={d.count ?? 1}
                      lastSeen={istDay(d.lastSeen)}
                      triage={(d.triage ?? "untriaged") as Triage}
                      note={d.note ?? null}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-3xl text-[0.8125rem] leading-relaxed text-faint">
              &ldquo;Nothing matched&rdquo; is four different problems with different owners. A
              missing product is a buying decision; a missing synonym and a parser gap are
              bugs in search. Counting them together gives a number nobody can act on,
              which is why the classification is the work rather than the list.
            </p>
          </>
        )}
      </section>

      <section className="section-gap">
        <h2 className="mb-4 text-lg">Other queues</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {/*
            Two of these were "needs backend" cards for work that already
            exists. Attribute completeness *is* the enrichment screen, and
            missing imagery is one count away — a card claiming a queue is
            unbuilt while the queue is one click along is worse than no card.
          */}
          <Live
            title="Missing imagery"
            count={noImage}
            total={productCount}
            unit="products"
            body="Products with no photograph on the record. Every image slot renders a designed halftone placeholder, so the layout is already right — but a drawn plate is not a product photo, and search results with real parts in them convert differently."
            href="/cms/collections/products"
            cta="Upload in the CMS"
          />
          <Live
            title="Attribute completeness"
            count={gaps.categories}
            total={null}
            unit="categories with gaps"
            body="Variants missing a required attribute for their leaf. These are invisible to the facets a buyer would use, which makes them effectively unbuyable even though they are live. The enrichment screen fills them in place."
            href="/admin/pim"
            cta="Open enrichment"
          />
        </div>

      </section>

      <section className="section-gap">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg">Import exceptions</h2>
          <p className="font-mono text-[0.8125rem] text-faint">
            <span className={openExceptions > 0 ? "text-danger" : ""}>{openExceptions}</span> open ·{" "}
            {exceptions.totalDocs.toLocaleString("en-IN")} recorded
          </p>
        </div>

        {exceptionRows.length === 0 ? (
          <div className="border border-dashed border-line-strong bg-surface p-8 text-center">
            <p className="bin mb-3">Nothing refused</p>
            <h3 className="monumental text-[clamp(1.125rem,2vw,1.5rem)]">Every row imported cleanly</h3>
            <p className="mx-auto mt-3 max-w-lg text-[0.875rem] leading-relaxed text-muted">
              Rows a committed import refuses are filed here — a malformed SKU, a
              seven-digit HSN, a category nobody has created. They used to exist only
              until the importer tab was closed.
            </p>
          </div>
        ) : (
          <>
            <ExceptionRows rows={exceptionRows} />
            <p className="mt-3 max-w-3xl text-[0.8125rem] leading-relaxed text-faint">
              <strong className="text-heading">Resolved</strong> means the underlying problem
              is gone and the row will import next time. <strong className="text-heading">Ignored</strong>{" "}
              means it was never going to import and nobody should look at it again. Counting
              them together gives a backlog that only grows.
            </p>
          </>
        )}
      </section>

      <section className="section-gap grid gap-3 sm:grid-cols-2">
        <Pending
          title="Supplier feed sync"
          body="Scheduled pulls that create new SKUs and update price and stock automatically — roughly 60% of how a catalogue this size is meant to stay current. Its rejections would land in the exceptions queue above, which is why that queue was built against imports first: the shape is identical and the plumbing is already here."
          needs="a supplier integration. Nothing to build until one exists to integrate with."
        />
      </section>
    </div>
  );
}

const waveOf = (l1: string) =>
  ["Fasteners", "Bearings", "Magnets", "Hardware"].includes(l1) ? 1
    : ["Electronic Components", "Motors"].includes(l1) ? 2
    : ["3D Printers & Parts", "Drones & Parts", "Batteries & Power"].includes(l1) ? 3 : 4;

/** A queue with a real number behind it and somewhere to go and work it. */
function Live({ title, count, total, unit, body, href, cta }: {
  title: string; count: number; total: number | null; unit: string;
  body: string; href: string; cta: string;
}) {
  return (
    <div className="flex flex-col border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[0.9375rem]">{title}</h3>
        <span className={`shrink-0 font-display text-xl font-bold tnum ${count > 0 ? "text-warning" : "text-disabled"}`}>
          {count.toLocaleString("en-IN")}
          {total !== null && <span className="text-[0.75rem] font-normal text-disabled"> / {total.toLocaleString("en-IN")}</span>}
        </span>
      </div>
      <p className="bin mt-0.5">{unit}</p>
      <p className="mt-2 flex-1 text-[0.8125rem] leading-relaxed text-muted">{body}</p>
      <Link href={href} className="btn btn-secondary btn-sm mt-3 self-start">
        {cta} <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

/*
  Deliberately not a `.rack` cell. A rack is a run of rows of a working
  system; this one is a hole in the product, and the dashed edge is the
  thing saying so. Detached is the point.
*/
function Pending({ title, body, needs }: { title: string; body: string; needs: string }) {
  return (
    <div className="border border-dashed border-line-strong bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[0.9375rem]">{title}</h3>
        <span className="shrink-0 rounded-xs bg-sunken px-1.5 py-0.5 font-mono text-[0.625rem] text-disabled">
          needs backend
        </span>
      </div>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{body}</p>
      <p className="mt-2 font-mono text-[0.6875rem] text-disabled">blocked on: {needs}</p>
    </div>
  );
}
