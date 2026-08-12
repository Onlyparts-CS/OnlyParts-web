import type { CollectionConfig } from "payload";
import { anyone, catalogWrite } from "./access";

/**
 * Curated project bills of materials — "Build a Drone", "Build a 3D Printer".
 *
 * `07-DATA-MODEL.md` calls this `collections` / `collection_items`. Named
 * **builds** here because "collection" already means something else in Payload
 * and an operator reading a sidebar full of collections should not have to work
 * out which one is the merchandising kind.
 *
 * ## Membership is curated. Never derived.
 *
 * This is the one rule this collection exists to enforce, and it was written
 * after the prototype got it wrong. The storefront's "Used in these builds"
 * block was inferring membership from category overlap — so because a drone
 * contains fasteners, *every fastener in the catalogue* claimed to be a drone
 * part. An M2.5 pan-head screw advertised "Build a Drone" and "Build a Repair
 * Bench". That is a claim printed on a product page and it was false for almost
 * every row it appeared on.
 *
 * So: no trigger, no view, no query may synthesise membership from
 * `primaryCategory` or `crossListedIn`. If nobody has curated it, the block
 * does not render — **empty is the correct answer for most SKUs.**
 *
 * `note` is per-membership, not per-product: the same screw is described
 * differently in a drone BOM and a repair-bench BOM.
 *
 * Builds have no effect on canonical URLs. `/p/<slug>` stays the one canonical.
 */
export const Builds: CollectionConfig = {
  slug: "builds",
  labels: { singular: "Build", plural: "Builds" },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "updatedAt"],
    group: "Catalogue",
    description:
      "Curated project BOMs. Membership is an editorial judgement — it is never inferred from categories.",
  },
  access: { read: anyone, create: catalogWrite, update: catalogWrite, delete: catalogWrite },

  hooks: {
    beforeChange: [
      ({ data }) => {
        const items = (data.items ?? []) as { product?: unknown }[];
        const seen = new Set<string>();
        for (const item of items) {
          const id = typeof item.product === "object"
            ? (item.product as { id: unknown })?.id
            : item.product;
          if (id === undefined || id === null) continue;
          if (seen.has(String(id))) {
            throw new Error("The same product is listed twice in this build.");
          }
          seen.add(String(id));
        }
        return data;
      },
    ],
  },

  fields: [
    { name: "name", type: "text", required: true, admin: { description: "'Drone' — the UI renders 'Build a Drone'." } },
    { name: "slug", type: "text", required: true, unique: true, index: true },
    { name: "blurb", type: "textarea" },
    {
      name: "glyph",
      type: "text",
      admin: { description: "Key into the drawn plate set — see src/lib/plates.ts." },
    },
    { name: "heroImage", type: "upload", relationTo: "media" },
    { name: "position", type: "number", defaultValue: 0 },
    {
      name: "items",
      type: "array",
      labels: { singular: "Part", plural: "Parts" },
      admin: {
        description:
          "Add a part because it genuinely belongs in this build. An unknown slug on import fails the row rather than being dropped silently — quietly removing a part from a build page is worse than a failed import.",
      },
      fields: [
        { name: "product", type: "relationship", relationTo: "products", required: true, index: true },
        {
          name: "note",
          type: "text",
          admin: { description: "Why it is here, in this build. 'M2.5 hardware for the FPV stack.'" },
        },
        { name: "position", type: "number", defaultValue: 0 },
      ],
    },
  ],
};
