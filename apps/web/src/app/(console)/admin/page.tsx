import Link from "next/link";
import { getPayload } from "payload";
import config from "@payload-config";
import { dbAllSkus } from "@/lib/catalogDb";
import { tree } from "@/lib/taxonomy";
import { inr } from "@/lib/catalog";
import { ArrowRight } from "@/components/Icons";

export default async function AdminOverview() {
  const skus = await dbAllSkus();

  // Untriaged rather than total: a classified failure is decided work, not
  // waiting work, and a queue count that never goes down stops being read.
  const payload = await getPayload({ config });
  const [zero, exceptions] = await Promise.all([
    payload.find({
      collection: "search-queries",
      where: { and: [{ resultCount: { equals: 0 } }, { triage: { equals: "untriaged" } }] },
      limit: 0, depth: 0, overrideAccess: true,
    }),
    payload.find({
      collection: "import-exceptions",
      where: { status: { equals: "open" } },
      limit: 0, depth: 0, overrideAccess: true,
    }),
  ]);
  const zeroResults = zero.totalDocs;
  const openExceptions = exceptions.totalDocs;
  const nodes = tree();
  const l2 = nodes.flatMap((n) => n.children);
  const l3 = l2.flatMap((n) => n.children);

  const seededLeaves = new Set(skus.map((s) => s.categories[0].join("/")));
  const outOfStock = skus.filter((s) => s.stock === 0).length;
  const lowStock = skus.filter((s) => s.stock > 0 && s.stock < 10).length;
  const noImage = skus.length;              // every SKU is placeholder-only today
  const catalogueValue = skus.reduce((n, s) => n + s.price * s.stock, 0);

  return (
    <div className="container-page page-shell">
      <h1 className="text-[clamp(1.5rem,3vw,2.25rem)]">Catalogue overview</h1>
      <p className="mt-2 max-w-2xl text-muted">
        The daily job here is working queues, not typing products — see{" "}
        <span className="font-mono text-spot-700">14-ADMIN-CATALOG-OPS.md</span>.
      </p>

      <div className="rack mt-8 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live SKUs" value={skus.length.toLocaleString("en-IN")} sub="active variants in Postgres" />
        <Stat label="Category nodes" value={(nodes.length + l2.length + l3.length).toLocaleString("en-IN")}
          sub={`${nodes.length} L1 · ${l2.length} L2 · ${l3.length} L3`} />
        <Stat label="Seeded leaves" value={`${seededLeaves.size} / ${l3.length}`}
          sub="the real gap to launch" tone="warning" />
        <Stat label="Stock value" value={inr(catalogueValue)} sub="on-hand × unit price" />
      </div>

      <h2 className="mt-10 mb-4 text-lg">Work queues</h2>
      <div className="rack sm:grid-cols-2 lg:grid-cols-3">
        <Queue
          title="Attribute completeness"
          count={l3.length - seededLeaves.size}
          body="Leaf categories with no products. Invisible to facets and to search."
          href="/admin/queues"
          tone="danger"
        />
        <Queue
          title="Missing imagery"
          count={noImage}
          body="Live SKUs with no photograph — every frame is a designed placeholder."
          href="/admin/queues"
          tone="warning"
        />
        <Queue
          title="Out of stock"
          count={outOfStock}
          body="Showing as made-to-order. Substitutes are surfaced automatically."
          href="/admin/products?stock=out"
        />
        <Queue
          title="Low stock"
          count={lowStock}
          body="Below 10 units. Reorder before these flip to made-to-order."
          href="/admin/products?stock=low"
          tone="warning"
        />
        <Queue
          title="Zero-result searches"
          count={zeroResults}
          body="Searches that found nothing, still unclassified. The highest-leverage list in the company."
          href="/admin/queues"
          tone="danger"
        />
        <Queue
          title="Import exceptions"
          count={openExceptions}
          body="Rows a committed import refused — a malformed SKU, a bad HSN, a category that does not exist. Fix and re-upload."
          href="/admin/queues"
          tone="warning"
        />
      </div>

      <div className="mt-10 rounded-md border border-spot-200 bg-spot-50 p-5">
        <h2 className="text-base text-spot-900">How products actually get in</h2>
        <p className="mt-2 max-w-3xl text-[0.875rem] text-spot-900/80">
          Manual entry is ~2% of SKUs. At 3 minutes each, typing 50,000 products is
          2,500 hours — 15 months of full-time work, by the end of which the first
          records are stale. The pipeline instead is:
        </p>
        <ol className="mt-4 grid gap-2 text-[0.875rem] text-spot-900">
          {[
            ["~60%", "Supplier feed sync", "scheduled, automatic; price and stock apply themselves, new products queue for review"],
            ["~30%", "Bulk CSV / XLSX import", "upload a sheet, map columns once, review the dry-run diff, commit"],
            ["~8%", "Duplicate & vary", "clone a product and generate a variant axis — 3 SKUs in 30 seconds"],
            ["~2%", "Manual create", "one genuinely new product, guided by its category's attribute schema"],
          ].map(([pct, name, note]) => (
            <li key={name} className="flex flex-wrap items-baseline gap-x-3">
              <span className="w-12 shrink-0 font-mono text-[0.8125rem] text-spot-700">{pct}</span>
              <span className="font-medium">{name}</span>
              <span className="text-spot-900/70">— {note}</span>
            </li>
          ))}
        </ol>
        <Link href="/admin/import" className="btn btn-primary btn-sm mt-5">
          Try a bulk import <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "warning" }) {
  return (
    <div className="bg-surface p-4">
      <div className="bin">{label}</div>
      <div className={`mt-1.5 font-display text-2xl font-bold tnum ${tone === "warning" ? "text-warning" : "text-heading"}`}>
        {value}
      </div>
      <div className="mt-1 font-mono text-[0.6875rem] text-disabled">{sub}</div>
    </div>
  );
}

function Queue({ title, count, body, href, tone }: {
  title: string; count: number; body: string; href: string; tone?: "warning" | "danger";
}) {
  /*
    The count is a measurement, so it is set as one — the same display
    numeral as `Stat`, coloured by severity. It used to be a filled pill,
    which put six saturated lozenges in a grid and made the two that
    actually needed attention indistinguishable from the four that did not.

    Nothing lifts on hover: in a rack the cells share a 1px rule, and a
    tile that rises tears the line it is ruled against.
  */
  return (
    <Link href={href} className="group bg-surface p-4 transition-colors hover:bg-sunken">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[0.9375rem] transition-colors group-hover:text-spot-700">{title}</h3>
        <span className={`shrink-0 font-display text-xl font-bold tnum ${
          count === 0 ? "text-disabled"
            : tone === "danger" ? "text-danger"
            : tone === "warning" ? "text-warning"
            : "text-heading"
        }`}>
          {count.toLocaleString("en-IN")}
        </span>
      </div>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{body}</p>
    </Link>
  );
}
