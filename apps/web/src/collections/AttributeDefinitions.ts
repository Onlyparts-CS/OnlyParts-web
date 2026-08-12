import type { CollectionConfig } from "payload";
import { anyone, catalogWrite } from "./access";

/**
 * The typed spec schema, per category.
 *
 * This is the collection the whole search proposition rests on. A facet rail
 * that offers "Thread: M3" and "Length: 6–40 mm" only exists because `thread`
 * is an enum and `length_mm` is a number with a unit — not because someone
 * typed them into a description.
 *
 * Definitions are **inherited down the tree**: one declared on `Bearings`
 * applies to every descendant, and a descendant may add to it or override a key.
 * Resolution happens at read time (`resolveAttributes`), so moving a definition
 * up the tree instantly applies it to everything below without a backfill.
 */
export const AttributeDefinitions: CollectionConfig = {
  slug: "attribute-definitions",
  labels: { singular: "Attribute", plural: "Attributes" },
  admin: {
    useAsTitle: "label",
    defaultColumns: ["label", "key", "type", "category", "isFacet"],
    group: "Catalogue",
    description:
      "Inherited down the category tree. Declare an attribute as high as it is true — 'material' belongs on Fasteners, not on each of its forty leaves.",
  },
  access: { read: anyone, create: catalogWrite, update: catalogWrite, delete: catalogWrite },

  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data;
        // An enum with no values is a facet that renders empty and filters nothing.
        if (data.type === "enum" && !(data.enumValues?.length > 0)) {
          throw new Error(`"${data.key}" is an enum and must list at least one value.`);
        }
        if (data.type === "number" && data.enumValues?.length) {
          throw new Error(`"${data.key}" is a number — enum values do not apply.`);
        }
        return data;
      },
    ],
  },

  indexes: [{ fields: ["category", "key"], unique: true }],

  fields: [
    {
      name: "category",
      type: "relationship",
      relationTo: "categories",
      required: true,
      index: true,
      admin: { description: "Applies to this category and everything under it." },
    },
    {
      name: "key",
      type: "text",
      required: true,
      index: true,
      admin: {
        description:
          "snake_case, stable forever — it is the URL facet key and the search field name. `thread`, `bore_id_mm`, `kv_rating`.",
      },
    },
    { name: "label", type: "text", required: true, admin: { description: "Shown to buyers. 'Bore (ID)'." } },
    {
      name: "type",
      type: "select",
      required: true,
      defaultValue: "text",
      options: [
        { label: "Text", value: "text" },
        { label: "Number", value: "number" },
        { label: "Boolean", value: "boolean" },
        { label: "Enum — a fixed list", value: "enum" },
        { label: "Dimension — a number with a unit", value: "dimension" },
      ],
    },
    {
      name: "unit",
      type: "text",
      admin: {
        description: "mm, V, mAh, kg, N·m. Required in practice for dimensions — '10' alone is not a spec.",
        condition: (_, sibling) => sibling?.type === "number" || sibling?.type === "dimension",
      },
    },
    {
      name: "enumValues",
      type: "array",
      admin: { condition: (_, sibling) => sibling?.type === "enum" },
      fields: [{ name: "value", type: "text", required: true }],
    },
    {
      name: "isVariantAxis",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Drives the variant matrix on the product page — thread × length." },
    },
    { name: "isFacet", type: "checkbox", defaultValue: true, admin: { description: "Appears in the facet rail." } },
    { name: "isSearchable", type: "checkbox", defaultValue: true },
    {
      name: "isRequired",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "A variant missing a required attribute is invisible to that facet. This feeds the admin completeness queue.",
      },
    },
    {
      name: "facetStyle",
      type: "select",
      defaultValue: "checkbox",
      options: [
        { label: "Checkbox list", value: "checkbox" },
        { label: "Range slider", value: "range" },
        { label: "Swatch", value: "swatch" },
      ],
      admin: { condition: (_, sibling) => sibling?.isFacet !== false },
    },
    { name: "position", type: "number", defaultValue: 0 },
  ],
};
