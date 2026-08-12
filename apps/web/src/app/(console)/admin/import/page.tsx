import { getPayload } from "payload";
import config from "@payload-config";
import { guard } from "@/lib/adminAuth";
import { Denied } from "@/components/admin/Denied";
import { ImportWorkbench } from "./ImportWorkbench";
import { ImportHistory, type BatchSummary } from "./ImportHistory";
import { ist } from "@/lib/adminOps";

export const dynamic = "force-dynamic";

/**
 * Server shell over the bulk importer.
 *
 * Same reason as the products table: the workbench reads the upload in the
 * browser and so must be a client component, which cannot read the session.
 * This is the only place the guard can run before anything renders.
 *
 * Build slugs are fetched here rather than in the workbench because they are
 * the one thing the upload panel needs before a file exists — and a client
 * component that has to fetch its own reference data shows an empty list first.
 */
export default async function AdminImportPage() {
  const g = await guard("admin", "catalog");
  if (!g.ok) return <Denied staff={g.staff} needed={g.needed} />;

  const payload = await getPayload({ config });
  const [builds, history] = await Promise.all([
    payload.find({
      collection: "builds", limit: 200, depth: 0, sort: "slug",
      user: g.staff as never, overrideAccess: false,
    }),
    payload.find({
      collection: "import-batches", limit: 10, depth: 0, sort: "-at",
      user: g.staff as never, overrideAccess: false,
    }),
  ]);

  const batches: BatchSummary[] = history.docs.map((b) => ({
    id: b.id,
    filename: b.filename,
    at: ist(b.at),
    actor: b.actor ?? null,
    created: b.created ?? 0,
    updated: b.updated ?? 0,
    status: (b.status ?? "applied") as BatchSummary["status"],
    revertedAt: b.revertedAt ? ist(b.revertedAt) : null,
    revertedBy: b.revertedBy ?? null,
  }));

  /*
    Only the newest applied batch can be reverted. Undoing an older one while a
    newer one sits on top of it would restore a snapshot over values the later
    import deliberately set, and leave the catalogue in neither state.
  */
  const revertableId = history.docs.find((b) => b.status !== "reverted")?.id ?? null;

  return (
    <>
      <ImportWorkbench projectSlugs={builds.docs.map((b) => b.slug)} />
      <div className="container-page pb-16">
        <ImportHistory batches={batches} revertableId={revertableId} />
      </div>
    </>
  );
}
