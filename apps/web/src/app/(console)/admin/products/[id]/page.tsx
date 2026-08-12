import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayload } from "payload";
import config from "@payload-config";
import { guard } from "@/lib/adminAuth";
import { Denied } from "@/components/admin/Denied";
import { MediaManager, type MediaEntry } from "./MediaManager";
import { CopyAndShelves, type Leaf } from "./CopyAndShelves";
import type { MediaRole } from "@/lib/mediaRoles";
import { ArrowRight } from "@/components/Icons";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * One product, edited without opening the CMS.
 *
 * The console could create a product and generate its variants, and then had
 * nowhere to put a photograph, fix a typo in the title, or file the thing on a
 * second shelf. All three lived in `/cms` — the panel this console exists so an
 * operator never has to learn.
 *
 * Variants stay on their own screen. Adding an axis is a different job from
 * describing the product, and the matrix needs the whole width.
 */
export default async function ProductEditPage({ params }: Props) {
  const g = await guard("admin", "catalog");
  if (!g.ok) return <Denied staff={g.staff} needed={g.needed} />;

  const { id } = await params;
  const payload = await getPayload({ config });

  let product;
  try {
    // `depth: 2` so `media.image` arrives as the upload document with its URL
    // and sizes, rather than an id this page would have to resolve per row.
    product = await payload.findByID({
      collection: "products", id, depth: 2, overrideAccess: true,
    });
  } catch {
    notFound();
  }
  if (!product) notFound();

  const cats = await payload.find({
    collection: "categories", limit: 2000, depth: 0, sort: "path", overrideAccess: true,
  });
  const hasChild = new Set(cats.docs.map((c) => String(c.parent ?? "")).filter(Boolean));
  const leaves: Leaf[] = cats.docs
    .filter((c) => !hasChild.has(String(c.id)) && c.path)
    .map((c) => ({ id: c.id, path: String(c.path), name: String(c.name) }));

  const primaryId = String(typeof product.primaryCategory === "object" && product.primaryCategory
    ? product.primaryCategory.id : product.primaryCategory);
  const primaryPath = String(
    cats.docs.find((c) => String(c.id) === primaryId)?.path ?? "",
  );

  const media: MediaEntry[] = ((product.media ?? []) as { image: unknown; role?: string | null }[])
    .flatMap((m) => {
      const img = m.image;
      if (typeof img !== "object" || !img) return [];
      const doc = img as { id: number; url?: string | null; alt?: string | null; width?: number | null; height?: number | null };
      if (!doc.url) return [];
      return [{
        id: doc.id,
        url: doc.url,
        alt: doc.alt ?? "",
        role: (m.role ?? "gallery") as MediaRole,
        width: doc.width ?? null,
        height: doc.height ?? null,
      }];
    });

  const variantCount = await payload.find({
    collection: "variants", where: { product: { equals: product.id } },
    limit: 0, depth: 0, overrideAccess: true,
  });

  return (
    <div className="container-page page-shell">
      <Link href="/admin/products" className="bin hover:text-spot-700">&larr; All products</Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="monumental text-[clamp(1.5rem,3.5vw,2.5rem)]">{product.title}</h1>
          <p className="mt-2 font-mono text-[0.8125rem] text-muted">
            /p/{product.slug} · {primaryPath.replace(/\./g, " › ") || "unfiled"} ·{" "}
            {variantCount.totalDocs} {variantCount.totalDocs === 1 ? "variant" : "variants"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/products/${product.id}/variants`} className="btn btn-secondary btn-sm">
            Variants <ArrowRight className="size-3.5" />
          </Link>
          <Link href={`/p/${product.slug}`} target="_blank" className="btn btn-ghost btn-sm">
            View on the storefront
          </Link>
        </div>
      </div>

      <div className="section-gap grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <MediaManager productId={product.id} media={media} />
        <CopyAndShelves
          productId={product.id}
          title={product.title}
          subtitle={product.subtitle ?? ""}
          primaryPath={primaryPath}
          leaves={leaves}
          crossListed={((product.crossListedIn ?? []) as unknown[]).map((c) =>
            Number(typeof c === "object" && c ? (c as { id: unknown }).id : c))}
        />
      </div>
    </div>
  );
}
