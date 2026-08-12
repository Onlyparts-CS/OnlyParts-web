import type { CollectionConfig } from "payload";
import { anyone, catalogWrite } from "./access";

/**
 * The purchasable unit. "M3 × 10 mm, SS304" — the thing with a SKU, a price,
 * a weight and a number on a shelf.
 *
 * **All money is integer paise.** Not rupees, not floats. ₹3.10 is `310`.
 * Floating-point money is how a cart of 4,200 screws ends up a paisa off the
 * invoice, and a GST invoice that disagrees with the cart by any amount is a
 * compliance problem rather than a rounding one.
 *
 * Two things are inline arrays rather than separate collections:
 *
 * - **`attributes`** — Payload writes these to their own `variants_attributes`
 *   table with real typed columns (`value_text`, `value_number`, `value_bool`),
 *   which is exactly the shape `07-DATA-MODEL.md` §2.4 asks for and the reason
 *   that section rejects a `specs jsonb` blob. Range facets, unit-aware search
 *   and "which SKUs are missing a required spec?" all need typed columns.
 * - **`priceTiers`** — `06-BACKEND-ARCHITECTURE.md` §2 specifies the admin UI
 *   for these as "inline on the variant", and nobody edits a price break
 *   without looking at the price it breaks from.
 */

type AttrRow = {
  definition?: unknown;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBool?: boolean | null;
};

export const Variants: CollectionConfig = {
  slug: "variants",
  admin: {
    useAsTitle: "sku",
    defaultColumns: ["sku", "product", "basePrice", "isActive"],
    group: "Catalogue",
  },
  access: { read: anyone, create: catalogWrite, update: catalogWrite, delete: catalogWrite },

  hooks: {
    /*
      Clear the stock rows first, or the delete fails at the database.

      `07-DATA-MODEL.md` §3 specifies `inventory_levels.variant_id ... ON DELETE
      CASCADE`. Payload's Drizzle adapter does not emit that — it leaves the
      column NOT NULL and tries to null it out, so Postgres refuses and the
      variant is undeletable for as long as it has ever held stock. Measured:
      `null value in column "variant_id" of relation "inventory" violates
      not-null constraint`.

      Deleting is for mistakes. A SKU that has genuinely traded is retired with
      `isActive: false`, which keeps its ledger and its order history intact.
    */
    beforeDelete: [
      async ({ id, req }) => {
        for (const collection of ["inventory-movements", "inventory"] as const) {
          const rows = await req.payload.find({
            collection, where: { variant: { equals: id } },
            limit: 1000, depth: 0, req, overrideAccess: true,
          });
          for (const row of rows.docs) {
            await req.payload.delete({ collection, id: row.id, req, overrideAccess: true });
          }
        }
      },
    ],

    beforeChange: [
      async ({ data, req }) => {
        if (data.sku) data.sku = String(data.sku).trim().toUpperCase();

        /* ---------- typed attributes ---------- */
        const rows = (data.attributes ?? []) as AttrRow[];
        const seen = new Set<string>();

        for (const row of rows) {
          const defId = typeof row.definition === "object"
            ? (row.definition as { id: unknown }).id
            : row.definition;
          if (defId === undefined || defId === null) continue;

          const key = String(defId);
          if (seen.has(key)) {
            throw new Error("The same attribute is set twice on this variant.");
          }
          seen.add(key);

          const def = await req.payload.findByID({
            collection: "attribute-definitions",
            id: defId as string | number,
            depth: 0,
            req,
          });

          const filled = [row.valueText, row.valueNumber, row.valueBool].filter(
            (v) => v !== null && v !== undefined && v !== "",
          );
          if (filled.length !== 1) {
            throw new Error(
              `"${def.label}" must have exactly one value — ${filled.length} were given.`,
            );
          }

          /*
            The type check is the entire point of a typed schema. Letting a
            number attribute hold text is how a range facet silently stops
            matching half its own catalogue.
          */
          const wants =
            def.type === "number" || def.type === "dimension"
              ? "valueNumber"
              : def.type === "boolean"
                ? "valueBool"
                : "valueText";

          const given =
            row.valueNumber !== null && row.valueNumber !== undefined
              ? "valueNumber"
              : row.valueBool !== null && row.valueBool !== undefined
                ? "valueBool"
                : "valueText";

          if (wants !== given) {
            throw new Error(
              `"${def.label}" is declared ${def.type} — it needs the ${wants.replace("value", "").toLowerCase()} field, not ${given.replace("value", "").toLowerCase()}.`,
            );
          }

          if (def.type === "enum") {
            const allowed = (def.enumValues ?? []).map((e: { value: string }) => e.value);
            if (allowed.length && !allowed.includes(String(row.valueText))) {
              throw new Error(
                `"${row.valueText}" is not one of ${def.label}'s values (${allowed.join(", ")}).`,
              );
            }
          }
        }

        /* ---------- price breaks ---------- */
        const tiers = (data.priceTiers ?? []) as { minQty: number; unitPrice: number; customerGroup?: string | null }[];
        const combos = new Set<string>();
        for (const t of tiers) {
          const combo = `${t.minQty}::${t.customerGroup ?? ""}`;
          if (combos.has(combo)) {
            throw new Error(`Two price breaks both start at quantity ${t.minQty}.`);
          }
          combos.add(combo);

          // A "break" that costs more than buying one is not a break.
          if (typeof data.basePrice === "number" && t.unitPrice > data.basePrice) {
            throw new Error(
              `The break at quantity ${t.minQty} is priced above the single-unit price. Bulk should not cost more.`,
            );
          }
        }
        // Stored ascending so tier resolution is a scan from the end, not a sort per request.
        if (tiers.length) {
          data.priceTiers = [...tiers].sort((a, b) => a.minQty - b.minQty);
        }

        return data;
      },
    ],
  },

  fields: [
    {
      name: "product",
      type: "relationship",
      relationTo: "products",
      required: true,
      index: true,
    },
    {
      name: "sku",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "Uppercased on save. This is what buyers paste into search and BOMs." },
      validate: (v: unknown) =>
        /^[A-Za-z0-9][A-Za-z0-9-]{3,}$/.test(String(v ?? "")) ||
        "Letters, digits and hyphens, at least 4 characters.",
    },
    {
      type: "row",
      fields: [
        { name: "titleSuffix", type: "text", admin: { width: "34%", description: "'10mm' — appended to the product title." } },
        { name: "mpn", type: "text", admin: { width: "33%", description: "Manufacturer part number." } },
        { name: "barcode", type: "text", admin: { width: "33%" } },
      ],
    },

    {
      type: "collapsible",
      label: "Price",
      admin: { initCollapsed: false },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "basePrice",
              type: "number",
              required: true,
              min: 0,
              admin: { width: "34%", description: "Paise, GST-inclusive. ₹3.10 is 310." },
            },
            {
              name: "compareAt",
              type: "number",
              min: 0,
              admin: { width: "33%", description: "Paise. Only for a genuine former price." },
            },
            {
              name: "costPrice",
              type: "number",
              min: 0,
              admin: { width: "33%", description: "Paise. Internal — never serialised to the storefront." },
              access: { read: ({ req }) => Boolean(req.user) },
            },
          ],
        },
        {
          name: "priceTiers",
          type: "array",
          labels: { singular: "Price break", plural: "Price breaks" },
          admin: {
            description:
              "Resolution: the highest break whose quantity is ≤ what the buyer wants; otherwise the base price.",
          },
          fields: [
            {
              type: "row",
              fields: [
                { name: "minQty", type: "number", required: true, min: 2, admin: { width: "34%" } },
                { name: "unitPrice", type: "number", required: true, min: 0, admin: { width: "33%", description: "Paise." } },
                {
                  name: "customerGroup",
                  type: "select",
                  options: [
                    { label: "Everyone", value: "" },
                    { label: "B2B", value: "b2b" },
                    { label: "Institution", value: "institution" },
                  ],
                  admin: { width: "33%" },
                },
              ],
            },
          ],
        },
      ],
    },

    {
      type: "collapsible",
      label: "Physical & ordering",
      fields: [
        {
          type: "row",
          fields: [
            { name: "weightG", type: "number", required: true, min: 0, admin: { width: "25%", description: "Grams. Drives shipping." } },
            { name: "lengthMm", type: "number", admin: { width: "25%" } },
            { name: "widthMm", type: "number", admin: { width: "25%" } },
            { name: "heightMm", type: "number", admin: { width: "25%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "packSize", type: "number", defaultValue: 1, min: 1, admin: { width: "34%", description: "Sold in packs of N." } },
            {
              name: "moq",
              type: "number",
              defaultValue: 1,
              min: 1,
              admin: { width: "33%", description: "1 means no minimum — which is the whole proposition. Raise it only when a supplier forces it." },
            },
            { name: "qtyIncrement", type: "number", defaultValue: 1, min: 1, admin: { width: "33%" } },
          ],
        },
      ],
    },

    {
      name: "attributes",
      type: "array",
      labels: { singular: "Spec", plural: "Specs" },
      admin: {
        description:
          "Typed against the category's attribute schema. Fill exactly one value field — the one matching the attribute's declared type.",
      },
      fields: [
        {
          name: "definition",
          type: "relationship",
          relationTo: "attribute-definitions",
          required: true,
          index: true,
        },
        {
          type: "row",
          fields: [
            { name: "valueText", type: "text", admin: { width: "34%", description: "text / enum" } },
            { name: "valueNumber", type: "number", admin: { width: "33%", description: "number / dimension" } },
            { name: "valueBool", type: "checkbox", admin: { width: "33%", description: "boolean" } },
          ],
        },
      ],
    },

    {
      type: "row",
      fields: [
        { name: "position", type: "number", defaultValue: 0, admin: { width: "50%" } },
        { name: "isActive", type: "checkbox", defaultValue: true, admin: { width: "50%" } },
      ],
    },
  ],
};
