import type { CollectionConfig, PayloadRequest } from "payload";
import { anyone, catalogWrite } from "./access";

/**
 * The merchandising unit. "M3 Hex Socket Head Cap Screw, SS304".
 *
 * What you buy is a **variant** — every product has at least one, even when it
 * has only one configuration, so nothing downstream needs a special case for
 * "products without variants".
 *
 * Two invariants live here rather than in the database:
 *
 * 1. **Exactly one primary category.** `07-DATA-MODEL.md` §2.3 gets this with a
 *    partial unique index over `product_categories(product_id) WHERE is_primary`.
 *    Modelled instead as one required `primaryCategory` plus a separate
 *    `crossListedIn` list, which makes the invariant structural — there is no
 *    shape of this document that has two primaries, so there is no rule to
 *    enforce and no way for an import to violate it. The primary drives the
 *    canonical URL and the breadcrumb; cross-listings are how an M3 screw shows
 *    up under Fasteners, 3D Printing *and* Drones with one record behind it.
 *
 * 2. **Products attach to leaves only** (`02-TAXONOMY.md` §1.6). Hanging a
 *    product on a branch makes it invisible to the facet rail below it and
 *    double-counts it in every ancestor total.
 */

/*
  Origins, as a closed list.

  Rule 6(1) wants the country named; sub-rule 10A wants buyers to be able to
  filter by it. Free text gives you "India", "india", "INDIA" and "Made in
  India" as four separate facet values for one country, and a filter nobody
  trusts is a filter that does not satisfy 10A. A missing country here is one
  line to add — a fragmented facet is a data migration.

  These are the countries this catalogue actually sources from, plus the
  regional manufacturing hubs it is likely to. `originFrom` in
  `tools/feeds/pull.mjs` normalises supplier spellings onto exactly these
  strings, so the harvested values and the hand-entered ones are the same value.
*/
const ORIGINS = [
  "India", "China", "Taiwan", "Hong Kong", "Japan", "South Korea", "Vietnam",
  "Malaysia", "Thailand", "Singapore", "Indonesia", "Philippines",
  "Germany", "Italy", "France", "United Kingdom", "Switzerland", "Netherlands",
  "Czech Republic", "Poland", "Turkey", "Israel",
  "United States", "Canada", "Mexico", "Brazil", "Australia",
] as const;

/**
 * A Rule 6(1) declaration: optional on a draft, mandatory the moment it lists.
 *
 * Marking these `required` would have been the obvious move and it rejects the
 * whole supplier catalogue — 116,719 rows arrive with all five empty and the
 * data to fill them is on import documents, not on the supplier's page. Making
 * them optional and unchecked is the other failure, and it is the one with a
 * penalty attached. So the field is free until `status` says the product is
 * live, and then it is not.
 */
const rule6 =
  (label: string) =>
  (value: unknown, { data }: { data?: { status?: string } }) =>
    Boolean(value) ||
    data?.status !== "active" ||
    `${label} is required before a product goes Active — Legal Metrology Rule 6(1).`;

async function assertLeaf(req: PayloadRequest, id: unknown, label: string) {
  if (id === null || id === undefined) return;
  const categoryId = typeof id === "object" ? (id as { id: unknown }).id : id;

  const category = await req.payload.findByID({
    collection: "categories",
    id: categoryId as string | number,
    depth: 0,
    req,
  });

  const children = await req.payload.count({
    collection: "categories",
    where: { parent: { equals: categoryId } },
    req,
  });

  if (children.totalDocs > 0) {
    throw new Error(
      `${label}: "${category.name}" has ${children.totalDocs} sub-categories. ` +
        `Products attach to leaves only — pick one of its children.`,
    );
  }
}

export const Products: CollectionConfig = {
  slug: "products",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "primaryCategory", "status", "hsnCode", "updatedAt"],
    group: "Catalogue",
  },
  access: { read: anyone, create: catalogWrite, update: catalogWrite, delete: catalogWrite },

  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        await assertLeaf(req, data.primaryCategory, "Primary category");
        for (const c of (data.crossListedIn ?? []) as unknown[]) {
          await assertLeaf(req, c, "Cross-listed category");
        }

        // Publishing is a fact with a timestamp, not a checkbox someone remembers to set.
        if (data.status === "active" && !data.publishedAt) {
          data.publishedAt = new Date().toISOString();
        }
        return data;
      },
    ],
  },

  fields: [
    { name: "title", type: "text", required: true, index: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "The canonical URL is /p/<slug>, whatever the product is cross-listed under." },
    },
    { name: "subtitle", type: "text" },
    { name: "description", type: "richText" },

    {
      type: "row",
      fields: [
        {
          name: "status",
          type: "select",
          required: true,
          defaultValue: "draft",
          index: true,
          options: [
            { label: "Draft", value: "draft" },
            { label: "Active", value: "active" },
            { label: "Archived", value: "archived" },
          ],
          admin: { width: "34%" },
        },
        {
          name: "publishedAt",
          type: "date",
          admin: { width: "33%", readOnly: true, description: "Set the first time this goes active." },
        },
        { name: "brand", type: "relationship", relationTo: "brands", admin: { width: "33%" } },
      ],
    },

    {
      type: "collapsible",
      label: "Filing",
      admin: { initCollapsed: false },
      fields: [
        {
          name: "primaryCategory",
          type: "relationship",
          relationTo: "categories",
          required: true,
          index: true,
          admin: { description: "Leaf only. Drives the breadcrumb and the canonical listing." },
        },
        {
          name: "crossListedIn",
          type: "relationship",
          relationTo: "categories",
          hasMany: true,
          index: true,
          admin: {
            description:
              "Every other shelf this genuinely belongs on. Leaves only. One canonical record stands behind all of them.",
          },
        },
      ],
    },

    {
      type: "collapsible",
      label: "Tax",
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "hsnCode",
              type: "text",
              required: true,
              index: true,
              admin: {
                width: "50%",
                description: "Eight digits. Without it the GST invoice cannot be issued.",
              },
              validate: (v: unknown) =>
                /^\d{8}$/.test(String(v ?? "")) || "HSN must be exactly 8 digits.",
            },
            {
              name: "gstRate",
              type: "select",
              required: true,
              defaultValue: "18",
              options: ["0", "5", "12", "18", "28"].map((r) => ({ label: `${r}%`, value: r })),
              admin: { width: "50%" },
            },
          ],
        },
      ],
    },

    /*
      Legal Metrology (Packaged Commodities) Rules, Rule 6(1).

      Six declarations must appear on the listing of anything sold pre-packed:
      origin, MRP inclusive of all taxes, net quantity, and the name and address
      of whoever imported or packed it. A searchable/sortable origin filter is
      also coming, which is why `countryOfOrigin` is a select and indexed rather
      than free text — a facet built over "India" / "india" / "INDIA" is three
      filters for one country.

      (This block previously said the filter has been mandatory "since 1 July
      2026". Sources disagree: it was a draft dated 10 Nov 2025 covering imported
      goods only, and the 2026 Second Amendment puts certain provisions at 1 July
      2027. The date needs confirming alongside the HSN codes — do not act on
      either number as written.)

      None of these are `required`, and that is deliberate. 116,719 supplier rows
      import with them empty, and a required field would reject the entire
      catalogue rather than letting it land as drafts to be completed. The rule
      is not "a product must have these", it is "a *listing* must" — so the gate
      is on going active. See `rule6` below. `countryOfOrigin` is the deliberate
      exception and carries its own note.
    */
    {
      type: "collapsible",
      label: "Legal Metrology",
      admin: {
        description:
          "Rule 6(1) declarations. Required before this product can go Active, not before it can be saved.",
      },
      fields: [
        {
          name: "countryOfOrigin",
          type: "select",
          index: true,
          options: ORIGINS.map((c) => ({ label: c, value: c })),
          /*
            The one declaration that does NOT gate going Active.

            Measured on the harvested feeds: 89 of 119,864 rows carry an origin,
            because none of the four suppliers publishes it — the live pages were
            checked, not assumed. Gating on it means the catalogue never lists.

            The alternative was defaulting it to "India", and that is worse than
            leaving it out: an absent declaration is an omission, a wrong one is a
            misdeclaration, and Rule 6(1) punishes the second. So the PDP prints
            "Not declared" (`SpecTable.tsx`) and the completeness queue counts it.
            Fill it from the Bill of Entry and the row stops saying so.
          */
          admin: { description: "Origin of the goods you imported, from the Bill of Entry — not the brand's home country. Left blank, the listing says \"Not declared\"." },
        },
        {
          type: "row",
          fields: [
            {
              name: "mrp",
              type: "number",
              min: 0,
              validate: rule6("MRP"),
              admin: {
                width: "50%",
                description: "In paise, inclusive of all taxes. The ceiling price, not the selling price.",
              },
            },
            {
              name: "netQuantity",
              type: "text",
              validate: rule6("Net quantity"),
              admin: { width: "50%", description: 'With its unit — "1 piece", "100 g", "5 m".' },
            },
          ],
        },
        {
          name: "importerName",
          type: "text",
          validate: rule6("Importer / packer name"),
          admin: { description: "Importer for imported goods; manufacturer or packer for goods of Indian origin." },
        },
        {
          name: "importerAddress",
          type: "textarea",
          validate: rule6("Importer / packer address"),
        },
      ],
    },

    {
      type: "collapsible",
      label: "Make-on-Demand",
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "isMadeToOrder",
              type: "checkbox",
              defaultValue: false,
              admin: {
                width: "50%",
                description: "Manufactured against the order rather than picked from a drawer.",
              },
            },
            {
              name: "leadTimeDays",
              type: "number",
              min: 0,
              admin: { width: "50%", condition: (_, s) => Boolean(s?.isMadeToOrder) },
            },
          ],
        },
      ],
    },

    {
      name: "variantAxes",
      type: "select",
      hasMany: true,
      admin: {
        description:
          "Which attribute keys the variant matrix is drawn on — e.g. thread × length_mm. Must match attribute keys that exist on this product's category.",
      },
      options: [
        "thread", "length_mm", "material", "head_type", "drive_type", "finish",
        "bore_id_mm", "outer_od_mm", "voltage_v", "capacity_mah", "size", "colour",
      ].map((k) => ({ label: k, value: k })),
    },

    {
      /*
        The supplier's own photograph, hotlinked rather than mirrored.

        `media` above is the real answer — uploads we own, served same-origin,
        halftone-screened. But 119,862 of 119,864 harvested rows already carry
        a usable image URL and mirroring them is a bucket, a fetch pipeline and
        a licence conversation. This field lets the catalogue have pictures
        today and be migrated later without touching the storefront: anything
        in `media` wins, this is only consulted when there is nothing there.

        Not a free-text URL in practice — `imageUrl()` in `lib/import.ts`
        rejects anything off `IMAGE_HOSTS`, and `next.config.ts` allowlists the
        same pair, so a value written by any other route still cannot be
        fetched by the optimiser.
      */
      name: "sourceImageUrl",
      type: "text",
      admin: {
        description:
          "Supplier photograph, hotlinked. Anything in Media wins over this; empty falls back to the drawn plate.",
      },
    },
    {
      name: "media",
      type: "array",
      admin: { description: "Everything here is halftone-screened before display." },
      fields: [
        { name: "image", type: "upload", relationTo: "media", required: true },
        {
          name: "role",
          type: "select",
          defaultValue: "gallery",
          options: ["hero", "gallery", "scale", "drawing", "datasheet"].map((r) => ({ label: r, value: r })),
        },
      ],
    },

    {
      type: "collapsible",
      label: "Merchandising & SEO",
      admin: { initCollapsed: true },
      fields: [
        {
          name: "searchBoost",
          type: "number",
          defaultValue: 1,
          min: 0,
          admin: { description: "Manual lever. 1 is neutral. Use sparingly — it is invisible to everyone else." },
        },
        { name: "seoTitle", type: "text" },
        { name: "seoDescription", type: "textarea" },
        {
          name: "ratingAvg",
          type: "number",
          admin: { readOnly: true, description: "Derived from approved reviews." },
        },
        { name: "ratingCount", type: "number", defaultValue: 0, admin: { readOnly: true } },
      ],
    },
  ],
};
