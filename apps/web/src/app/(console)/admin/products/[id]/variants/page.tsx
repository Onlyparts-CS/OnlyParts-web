import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayload } from "payload";
import config from "@payload-config";
import { templateFor } from "../../new/actions";
import { guard } from "@/lib/adminAuth";
import { Denied } from "@/components/admin/Denied";
import { VariantMatrix } from "./VariantMatrix";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * Add the whole variant family to an existing product.
 *
 * The create form makes one product and one variant, which is right for a
 * one-off part and wrong for almost everything else in this catalogue. This is
 * where "M3 socket cap, in eight lengths and three materials" becomes
 * twenty-four rows without typing twenty-four rows.
 */
export default async function VariantsPage({ params }: Props) {
  const g = await guard("admin", "catalog");
  if (!g.ok) return <Denied staff={g.staff} needed={g.needed} />;

  const { id } = await params;
  const payload = await getPayload({ config });

  let product;
  try {
    product = await payload.findByID({ collection: "products", id, depth: 1, overrideAccess: true });
  } catch {
    notFound();
  }
  if (!product) notFound();

  const cat = typeof product.primaryCategory === "object"
    ? product.primaryCategory
    : await payload.findByID({
        collection: "categories", id: product.primaryCategory as number, depth: 0, overrideAccess: true,
      });

  const categoryPath = String((cat as { path?: string })?.path ?? "");
  const template = await templateFor(categoryPath);

  // Shown so the matrix can mark a clash before it tries to write it.
  const existing = await payload.find({
    collection: "variants", where: { product: { equals: product.id } },
    limit: 1000, depth: 0, overrideAccess: true,
  });

  return (
    <div className="container-page page-shell">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-faint">
        <Link href="/admin" className="hover:text-spot-700">Admin</Link>
        <span aria-hidden className="text-disabled">›</span>
        <Link href="/admin/products" className="hover:text-spot-700">Products</Link>
        <span aria-hidden className="text-disabled">›</span>
        <span className="text-heading">{String(product.title)}</span>
      </nav>

      <header className="mb-8">
        <p className="bin mb-2">
          {categoryPath.replace(/\./g, " › ")} · {existing.totalDocs} existing variant
          {existing.totalDocs === 1 ? "" : "s"}
        </p>
        <h1 className="monumental text-[clamp(1.75rem,4vw,3rem)]">Variant matrix</h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
          Pick the axes this part varies on and every combination is generated for you.
          Nothing is written until you press the button at the bottom.
        </p>
      </header>

      <VariantMatrix
        productId={product.id}
        productTitle={String(product.title)}
        categoryPath={categoryPath}
        template={template}
        existingSkus={existing.docs.map((v) => String(v.sku))}
      />
    </div>
  );
}
