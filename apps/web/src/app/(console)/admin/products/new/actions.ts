"use server";

import { revalidatePath } from "next/cache";
import { resolveAttributes, toSpecRows, type Definition } from "@/lib/pim";
import { actionStaff } from "@/lib/actionAuth";

/**
 * Writing a product from the form a person actually fills in.
 *
 * Everything runs as the **signed-in user**, not with `overrideAccess`. A
 * console that writes as root is a console where RBAC is decoration — the `ops`
 * role would quietly be able to create catalogue rows because nothing ever
 * checked. Passing the session through means the rules that guard the CMS guard
 * this form too.
 *
 * Every export in this file is a public HTTP endpoint. Next compiles a
 * `"use server"` function into a POST route addressable by its action id, so
 * the page guard in `page.tsx` protects the *screen* and nothing else — anyone
 * who has seen the id can call these directly, signed in or not. That is why
 * each one re-checks the session itself rather than trusting its caller.
 */

const session = () => actionStaff("admin", "catalog");

export type TemplateField = Pick<
  Definition,
  "key" | "label" | "type" | "unit" | "isRequired" | "enumValues"
>;

/** The specs this shelf expects — what becomes labelled inputs on the form. */
export async function templateFor(categoryPath: string): Promise<TemplateField[]> {
  if (!categoryPath) return [];
  // Reads the catalogue schema, so it is gated like the writes beside it —
  // an unauthenticated caller should not be able to enumerate the model.
  const { user } = await session();
  if (!user) return [];
  const defs = await resolveAttributes(categoryPath);
  return defs.map((d) => ({
    key: d.key,
    label: d.label,
    type: d.type,
    unit: d.unit ?? null,
    isRequired: d.isRequired,
    enumValues: d.enumValues,
  }));
}

export type CreateInput = {
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  categoryPath: string;
  brandId: string;
  hsnCode: string;
  gstRate: string;
  /** rupees exactly as typed, "3.10" — converted to paise here */
  price: string;
  compareAt: string;
  weightG: string;
  sku: string;
  stock: string;
  specs: Record<string, string>;
  publish: boolean;
};

export type CreateResult =
  | { ok: true; productId: number | string; variantId: number | string; slug: string }
  | { ok: false; errors: Record<string, string> };

/** ₹ as typed → integer paise. "3.10" → 310. No float survives past this line. */
function toPaise(rupees: string): number | null {
  const n = Number(String(rupees ?? "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function createProduct(input: CreateInput): Promise<CreateResult> {
  const { payload, user } = await session();
  if (!user) return { ok: false, errors: { _: "Your session expired — sign in again." } };

  const errors: Record<string, string> = {};
  const title = input.title.trim();
  const sku = input.sku.trim().toUpperCase();
  const slug = input.slug.trim().toLowerCase();

  if (!title) errors.title = "Give it the name an engineer would say out loud.";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) errors.slug = "Lowercase letters, digits and hyphens.";
  if (!/^[A-Z0-9][A-Z0-9-]{3,}$/.test(sku)) errors.sku = "At least 4 characters: letters, digits, hyphens.";
  if (!input.categoryId) errors.categoryId = "Pick the shelf this belongs on.";
  if (!/^\d{8}$/.test(input.hsnCode.trim())) errors.hsnCode = "HSN is 8 digits. Without it we cannot invoice.";

  const paise = toPaise(input.price);
  if (paise === null || paise === 0) errors.price = "What does one of these cost a buyer?";

  const weight = Number(input.weightG);
  if (!Number.isFinite(weight) || weight <= 0) errors.weightG = "Grams. This decides the shipping charge.";

  const stock = Number(input.stock || "0");
  if (!Number.isFinite(stock) || stock < 0) errors.stock = "Zero or more.";

  const defs = await resolveAttributes(input.categoryPath);
  for (const d of defs) {
    if (!d.isRequired) continue;
    if (!(input.specs[d.key] ?? "").trim()) {
      errors[`spec.${d.key}`] = `${d.label} is how buyers filter this shelf.`;
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  try {
    const product = await payload.create({
      collection: "products",
      user,
      overrideAccess: false,
      data: {
        title,
        slug,
        subtitle: input.description.trim() || undefined,
        primaryCategory: Number(input.categoryId),
        brand: input.brandId ? Number(input.brandId) : undefined,
        hsnCode: input.hsnCode.trim(),
        gstRate: input.gstRate,
        status: input.publish ? "active" : "draft",
      } as never,
    });

    // Typed against the definitions, never stuffed into a blob.
    const attributes = toSpecRows(defs, input.specs);

    const compare = toPaise(input.compareAt);
    const variant = await payload.create({
      collection: "variants",
      user,
      overrideAccess: false,
      data: {
        product: product.id,
        sku,
        basePrice: paise,
        compareAt: compare && compare > 0 ? compare : undefined,
        weightG: Math.round(weight),
        attributes,
        isActive: true,
      } as never,
    });

    /*
      Opening stock is a ledger movement, not a number typed into a field.
      `inventory.onHand` is read-only by design: every unit is accounted for by
      a row saying who put it there and why. This is that row.
    */
    if (stock > 0) {
      const wh = await payload.find({
        collection: "warehouses",
        where: { isActive: { equals: true } },
        limit: 1, depth: 0, overrideAccess: true,
      });
      if (wh.docs[0]) {
        await payload.create({
          collection: "inventory-movements",
          user,
          overrideAccess: false,
          data: {
            variant: variant.id,
            warehouse: wh.docs[0].id,
            delta: Math.round(stock),
            reason: "count",
            note: "Opening balance — created from the admin form",
          } as never,
        });
      }
    }

    revalidatePath("/admin/products");
    revalidatePath("/admin/pim");
    return { ok: true, productId: product.id, variantId: variant.id, slug };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Prefer the collection's own words — they are written for a human.
    if (/unique/i.test(msg) && /sku/i.test(msg)) return { ok: false, errors: { sku: `${sku} already exists.` } };
    if (/unique/i.test(msg) && /slug/i.test(msg)) return { ok: false, errors: { slug: `/p/${slug} is taken.` } };
    if (/leaves only/i.test(msg)) return { ok: false, errors: { categoryId: msg } };
    return { ok: false, errors: { _: msg } };
  }
}
