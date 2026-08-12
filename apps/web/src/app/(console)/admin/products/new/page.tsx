import Link from "next/link";
import { getPayload } from "payload";
import config from "@payload-config";
import { categories } from "@/lib/pim";
import { guard } from "@/lib/adminAuth";
import { Denied } from "@/components/admin/Denied";
import { NewProductForm, type BrandOpt, type Leaf } from "./NewProductForm";

export const dynamic = "force-dynamic";

/**
 * The authoring surface, and the answer to a fair complaint.
 *
 * The enrichment workbench at `/admin/pim` can tell you which rows are missing
 * specs. It cannot add one — it could only link you into the CMS, which meant
 * anybody new opening the console had nothing they could actually do. That is
 * the audit half of a PIM with none of the authoring half.
 *
 * This is the other half: one page, in the order the product appears on the
 * storefront, with a preview of what the buyer will see. Manual entry is still
 * only ~2% of how fifty thousand rows get filled — bulk import and supplier
 * feeds carry the rest — but it is the 2% that covers a one-off part, a
 * correction, and everybody's first day.
 *
 * The old version of this page validated a CSV row and printed it. It had no
 * write target at all.
 */
export default async function NewProductPage() {
  const g = await guard("admin", "catalog");
  if (!g.ok) return <Denied staff={g.staff} needed={g.needed} />;

  const payload = await getPayload({ config });

  const [cats, brands] = await Promise.all([
    categories(),
    payload.find({ collection: "brands", limit: 200, depth: 0, sort: "name", overrideAccess: true }),
  ]);

  const byPath = new Map(cats.map((c) => [c.path, c]));

  /*
    Leaves only, each labelled with its full trail.

    "Nozzles" alone is ambiguous and "Electronics" appears under two different
    drawers. "3D Printing Supplies › Hotends & Extruders › Nozzles" is not
    ambiguous, and it is the only thing that makes a picker over 389 leaves
    usable at all.
  */
  const leaves: Leaf[] = cats
    .filter((c) => c.isLeaf)
    .map((c) => {
      const segs = c.path.split(".");
      const trail = segs
        .map((_, i) => byPath.get(segs.slice(0, i + 1).join("."))?.name ?? segs[i])
        .join(" › ");
      return { id: c.id, name: c.name, path: c.path, trail };
    })
    .sort((a, b) => a.trail.localeCompare(b.trail));

  const brandOpts: BrandOpt[] = brands.docs.map((b) => ({ id: b.id, name: String(b.name) }));

  return (
    <div className="container-page page-shell">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-[0.8125rem] text-faint">
        <Link href="/admin" className="hover:text-spot-700">Admin</Link>
        <span aria-hidden className="text-disabled">›</span>
        <Link href="/admin/products" className="hover:text-spot-700">Products</Link>
        <span aria-hidden className="text-disabled">›</span>
        <span className="text-heading">New</span>
      </nav>

      <header className="mb-8">
        <h1 className="monumental text-[clamp(1.75rem,4vw,3rem)]">Add a product</h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
          Fill it in the order it appears on the site. Anything over about twenty rows
          belongs in{" "}
          <Link href="/admin/import" className="text-spot-700 underline underline-offset-2">bulk import</Link>,
          which shows you a diff before it writes.
        </p>
      </header>

      {leaves.length === 0 ? (
        <div className="mx-auto max-w-xl border border-dashed border-line bg-surface p-8 text-center">
          <p className="bin mb-3">No shelves yet</p>
          <p className="text-[0.9375rem] leading-relaxed text-muted">
            A product files onto a leaf category, and there are none in the database.
            Seed the tree first:
          </p>
          <pre className="mt-4 overflow-x-auto border border-line bg-bg p-3 text-left font-mono text-[0.75rem] text-body">
npm run payload -- run scripts/seed-catalogue.ts
          </pre>
        </div>
      ) : (
        <NewProductForm leaves={leaves} brands={brandOpts} />
      )}
    </div>
  );
}
