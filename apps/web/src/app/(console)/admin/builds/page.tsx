import Link from "next/link";
import { getPayload } from "payload";
import config from "@payload-config";
import { guard } from "@/lib/adminAuth";
import { Denied } from "@/components/admin/Denied";
import { BuildEditor, type BuildRow } from "./BuildEditor";
import { NewBuild } from "./NewBuild";

export const dynamic = "force-dynamic";

/**
 * Builds — "Build a Drone" and the parts that go in it.
 *
 * The last thing in this console that could only be done in the CMS. A build
 * is the one merchandising surface here that is entirely editorial: it is a
 * person deciding that an M3 cap screw belongs in a drone bill of materials
 * and an M8 does not, and there is no query that produces that answer.
 */
export default async function AdminBuildsPage() {
  const g = await guard("admin", "catalog");
  if (!g.ok) return <Denied staff={g.staff} needed={g.needed} />;

  const payload = await getPayload({ config });
  const [builds, cats] = await Promise.all([
    payload.find({ collection: "builds", limit: 100, depth: 1, sort: "position", overrideAccess: true }),
    payload.find({ collection: "categories", limit: 2000, depth: 0, overrideAccess: true }),
  ]);
  const pathById = new Map(cats.docs.map((c) => [String(c.id), String(c.path ?? "")]));

  const rows: BuildRow[] = builds.docs.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    blurb: b.blurb ?? "",
    glyph: b.glyph ?? "",
    position: b.position ?? 0,
    items: (b.items ?? []).flatMap((i) => {
      const p = i.product;
      if (typeof p !== "object" || !p) return [];
      return [{
        product: p.id,
        title: p.title,
        path: pathById.get(String(typeof p.primaryCategory === "object" && p.primaryCategory
          ? p.primaryCategory.id : p.primaryCategory)) ?? "",
        note: i.note ?? "",
      }];
    }),
  }));

  const empty = rows.filter((r) => r.items.length === 0).length;

  return (
    <div className="container-page page-shell">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <h1 className="text-[clamp(1.5rem,3vw,2.25rem)]">Builds</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Curated bills of materials. A part is here because somebody decided it
            belongs — never because it shares a category with the build. Inferring
            membership once made every fastener in the catalogue a drone part.
          </p>
        </div>
        <NewBuild />
      </div>

      {rows.length === 0 ? (
        <div className="section-gap border border-dashed border-line-strong bg-surface p-12 text-center">
          <p className="bin mb-3">Nothing yet</p>
          <h2 className="monumental text-[clamp(1.25rem,2.5vw,1.75rem)]">No builds</h2>
          <p className="mx-auto mt-4 max-w-md text-[0.875rem] leading-relaxed text-muted">
            A build gives the storefront a <span className="font-mono">/projects/…</span> page
            and an “add the whole BOM to cart” button. It is also the only thing the
            importer&rsquo;s <span className="font-mono">projects</span> column can point at.
          </p>
        </div>
      ) : (
        <>
          <p className="section-gap mb-3 font-mono text-[0.8125rem] text-faint">
            {rows.length} builds
            {empty > 0 && <span className="text-warning"> · {empty} with no parts</span>}
          </p>
          <div className="grid gap-2">
            {rows.map((b) => <BuildEditor key={b.id} build={b} />)}
          </div>
        </>
      )}

      <p className="section-gap max-w-3xl text-[0.8125rem] leading-relaxed text-faint">
        Each build appears at{" "}
        <Link href="/projects/drone" target="_blank" className="text-spot-700 hover:underline">/projects/&lt;slug&gt;</Link>,
        in the footer, and as a value the bulk importer&rsquo;s{" "}
        <span className="font-mono">projects</span> column accepts. Removing a part here
        removes it from the storefront page; it does not touch the product.
      </p>
    </div>
  );
}
