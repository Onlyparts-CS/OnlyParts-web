import Link from "next/link";
import { categories, resolveAttributes, completeness, type Definition } from "@/lib/pim";
import { guard } from "@/lib/adminAuth";
import { Denied } from "@/components/admin/Denied";
import { GapRow } from "./GapRow";

export const dynamic = "force-dynamic";

/* ============================================================
   /admin/pim — the enrichment workbench.
   ------------------------------------------------------------
   This is the PIM, and it is deliberately not a product form.

   A product form is the right tool for someone with forty
   products who knows all forty. This catalogue is heading for
   fifty thousand rows whose entire value is their typed specs:
   a bearing with no bore diameter is invisible to the one facet
   anybody would use to find it, and no amount of good copy on
   its page fixes that.

   So the unit of work here is a **category's attribute template
   and the variants underneath it that are missing part of it** —
   the same shape Akeneo uses, and the reason it exists.

   Staff only. The layout above this gates on the Payload
   session; nothing here is reachable by a customer.
   ============================================================ */

type Props = { searchParams: Promise<{ path?: string }> };

export default async function PimPage({ searchParams }: Props) {
  const g = await guard("admin", "catalog");
  if (!g.ok) return <Denied staff={g.staff} needed={g.needed} />;

  const { path } = await searchParams;
  const cats = await categories();

  if (!cats.length) return <Empty />;

  const selected = cats.find((c) => c.path === path) ?? cats.find((c) => c.isLeaf) ?? cats[0];
  const [defs, score] = await Promise.all([
    resolveAttributes(selected.path),
    completeness(selected.path),
  ]);

  return (
    <div className="container-page page-shell">
      <header className="mb-8">
        <p className="bin mb-2">Product information management</p>
        <h1 className="monumental text-[clamp(1.75rem,4vw,3rem)]">Enrichment</h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
          Pick a category, read its attribute template, and fill the gaps. Completeness
          is measured per <em>cell</em> — variants × required attributes — because
          &ldquo;80% of products have at least one spec&rdquo; sounds like progress and
          means nothing.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        {/* ---------- the tree ---------- */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <p className="overline mb-2">Categories</p>
          <ul className="max-h-[70vh] overflow-y-auto border border-line bg-surface">
            {cats.map((c) => (
              <li key={String(c.id)}>
                <Link
                  href={`/admin/pim?path=${encodeURIComponent(c.path)}`}
                  aria-current={c.path === selected.path}
                  className={`flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-[0.8125rem] transition-colors last:border-b-0 ${
                    c.path === selected.path
                      ? "bg-ink-900 text-bg"
                      : "text-muted hover:bg-sunken hover:text-heading"
                  }`}
                  style={{ paddingLeft: `${0.75 + (c.depth - 1) * 0.85}rem` }}
                >
                  <span className="truncate">{c.name}</span>
                  {c.isLeaf && <span className="bin shrink-0 opacity-70">leaf</span>}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0">
          {/* ---------- the score ---------- */}
          <section className="mb-8 border border-line bg-surface p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="bin">{selected.path.replace(/\./g, " › ")}</p>
                <h2 className="monumental mt-1 text-[clamp(1.25rem,2.4vw,1.875rem)]">{selected.name}</h2>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl font-bold tnum text-heading">
                  {Math.round(score.ratio * 100)}%
                </p>
                <p className="bin mt-1">complete</p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden bg-sunken">
              <div
                className="h-full bg-spot-500 transition-[width] duration-500"
                style={{ width: `${Math.round(score.ratio * 100)}%` }}
              />
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-4">
              <Stat label="Required attributes" value={score.required} />
              <Stat label="Variants filed here" value={score.variants} />
              <Stat label="With gaps" value={score.missing.length} accent={score.missing.length > 0} />
            </dl>
          </section>

          {/* ---------- the template ---------- */}
          <section className="mb-8">
            <h2 className="mb-3 text-[1.125rem]">Attribute template</h2>
            {defs.length === 0 ? (
              <p className="border border-dashed border-line bg-surface p-5 text-[0.875rem] text-muted">
                No attributes apply here. Declare them in the CMS — as high in the tree as
                they are true, because they inherit downward.
              </p>
            ) : (
              <div className="overflow-x-auto border border-line bg-surface">
                <table className="w-full min-w-[44rem] text-left text-[0.8125rem]">
                  <thead>
                    <tr className="border-b border-line bg-sunken">
                      <Th>Attribute</Th><Th>Key</Th><Th>Type</Th><Th>Declared on</Th><Th>Flags</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {defs.map((d) => <DefRow key={d.key} d={d} />)}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ---------- the work ---------- */}
          <section>
            <h2 className="mb-3 text-[1.125rem]">Gaps</h2>
            {score.variants === 0 ? (
              <p className="border border-dashed border-line bg-surface p-5 text-[0.875rem] text-muted">
                Nothing is filed under this category yet.
              </p>
            ) : score.missing.length === 0 ? (
              <p className="border border-success/30 bg-success-bg p-5 text-[0.875rem] text-success">
                Every variant here has its full required schema.
              </p>
            ) : (
              <div className="overflow-x-auto border border-line bg-surface">
                <table className="w-full min-w-[36rem] text-left text-[0.8125rem]">
                  <thead>
                    <tr className="border-b border-line bg-sunken">
                      <Th>SKU</Th><Th>Missing</Th><Th> </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {/*
                      The gap is the input. This used to be a list of red chips
                      naming what was absent beside a link to go and fix it
                      somewhere else — which is a queue that reports work rather
                      than a queue you can work.
                    */}
                    {score.missing.map((m) => (
                      <GapRow
                        key={String(m.id)}
                        sku={m.sku}
                        variantId={Number(m.id)}
                        categoryPath={selected.path}
                        fields={m.keys.flatMap((k) => {
                          const d = defs.find((x) => x.key === k);
                          return d
                            ? [{ key: d.key, label: d.label, type: d.type, unit: d.unit ?? null, enumValues: d.enumValues }]
                            : [];
                        })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="container-page page-shell">
      <div className="mx-auto max-w-xl border border-dashed border-line bg-surface p-8 text-center">
        <p className="bin mb-3">Nothing to enrich</p>
        <h1 className="monumental text-[clamp(1.5rem,3vw,2.25rem)]">The catalogue is empty</h1>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
          There are no categories in the database yet, so there is no attribute template
          to work against. Seed it first:
        </p>
        <pre className="mt-4 overflow-x-auto border border-line bg-bg p-3 text-left font-mono text-[0.75rem] text-body">
npm run payload -- run scripts/seed-catalogue.ts
        </pre>
        <p className="mt-4 text-[0.75rem] text-faint">
          This screen reads Postgres directly through the Local API — it never shows the
          generated demo catalogue, because enriching invented rows teaches nothing.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <dt className="bin">{label}</dt>
      <dd className={`mt-1 font-mono text-lg tnum ${accent ? "text-danger" : "text-heading"}`}>{value}</dd>
    </div>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="bin px-3 py-2">{children}</th>
);

function DefRow({ d }: { d: Definition }) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-3 py-2 text-heading">{d.label}</td>
      <td className="px-3 py-2 font-mono text-[0.75rem] text-muted">{d.key}</td>
      <td className="px-3 py-2 font-mono text-[0.75rem] text-muted">
        {d.type}{d.unit ? ` · ${d.unit}` : ""}
      </td>
      <td className="px-3 py-2 text-[0.75rem]">
        <span className={d.inherited ? "text-faint" : "text-heading"}>{d.declaredOn.name}</span>
        {d.inherited && <span className="bin ml-1.5">inherited</span>}
      </td>
      <td className="px-3 py-2">
        <span className="flex flex-wrap gap-1">
          {d.isRequired && <Flag tone="danger">required</Flag>}
          {d.isVariantAxis && <Flag tone="accent">axis</Flag>}
          {d.isFacet && <Flag>facet</Flag>}
        </span>
      </td>
    </tr>
  );
}

function Flag({ children, tone }: { children: React.ReactNode; tone?: "danger" | "accent" }) {
  const cls =
    tone === "danger" ? "text-danger"
      : tone === "accent" ? "text-spot-700"
        : "text-faint";
  /* `.stamp` borders in currentColor, so the tone class carries edge and text together. */
  return <span className={`stamp stamp-flat ${cls}`}>{children}</span>;
}
