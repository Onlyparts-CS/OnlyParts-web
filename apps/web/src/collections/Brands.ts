import type { CollectionConfig } from "payload";
import { anyone, catalogWrite } from "./access";

export const Brands: CollectionConfig = {
  slug: "brands",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "updatedAt"],
    group: "Catalogue",
  },
  access: { read: anyone, create: catalogWrite, update: catalogWrite, delete: catalogWrite },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "Lowercase, hyphenated. Used in facet URLs." },
    },
    { name: "logo", type: "upload", relationTo: "media" },
    {
      name: "isGeneric",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "True for unbranded commodity stock — most fasteners. Keeps 'Generic' out of the brand facet as if it were a manufacturer.",
      },
    },
  ],
};
