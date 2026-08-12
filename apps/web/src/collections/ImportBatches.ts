import type { CollectionConfig } from "payload";
import { hasRole } from "./access";

/**
 * What one bulk import did, in enough detail to undo it.
 *
 * The workbench claimed for months that "every import records the previous
 * values and can be reverted in one click". Nothing recorded anything; the
 * copy was removed rather than left lying. This is the record that makes the
 * sentence true.
 *
 * **The before-state is stored, not recomputed.** A revert that re-derives the
 * old price from anywhere other than a snapshot taken at write time is a
 * revert that silently loses whatever changed in between. Each row carries
 * exactly what it was.
 *
 * A batch is never edited and never deleted — only flipped to `reverted`. It
 * is the audit trail for a bulk write to a live catalogue, and an audit trail
 * you can rewrite is decoration.
 */
export const ImportBatches: CollectionConfig = {
  slug: "import-batches",
  labels: { singular: "Import", plural: "Imports" },
  admin: {
    useAsTitle: "filename",
    defaultColumns: ["filename", "at", "created", "updated", "status"],
    group: "Catalogue",
    description: "One row per committed import, with the prior values needed to undo it.",
  },
  access: {
    read: hasRole("admin", "catalog"),
    create: hasRole("admin", "catalog"),
    update: hasRole("admin", "catalog"),
    // Never. Deleting a batch destroys the only record of what a bulk write
    // changed, and the ability to undo it.
    delete: () => false,
  },

  indexes: [{ fields: ["status", "at"] }],

  fields: [
    {
      type: "row",
      fields: [
        { name: "filename", type: "text", required: true, admin: { width: "50%" } },
        { name: "at", type: "date", required: true, admin: { width: "50%", readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "actor", type: "text", admin: { width: "34%", description: "Staff email at commit time." } },
        { name: "created", type: "number", required: true, defaultValue: 0, admin: { width: "33%" } },
        { name: "updated", type: "number", required: true, defaultValue: 0, admin: { width: "33%" } },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "applied",
      index: true,
      options: [
        { label: "Applied", value: "applied" },
        { label: "Reverted", value: "reverted" },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "revertedAt", type: "date", admin: { width: "50%", readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
        { name: "revertedBy", type: "text", admin: { width: "50%", readOnly: true } },
      ],
    },
    {
      name: "rows",
      type: "array",
      labels: { singular: "Row", plural: "Rows" },
      admin: {
        description:
          "One per SKU written. `before` is the snapshot taken immediately prior to the write — it is what a revert restores.",
      },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "kind",
              type: "select",
              required: true,
              options: [
                { label: "Created", value: "create" },
                { label: "Updated", value: "update" },
              ],
              admin: { width: "25%" },
            },
            { name: "sku", type: "text", required: true, admin: { width: "35%" } },
            { name: "variant", type: "relationship", relationTo: "variants", index: true, admin: { width: "20%" } },
            { name: "product", type: "relationship", relationTo: "products", index: true, admin: { width: "20%" } },
          ],
        },
        {
          name: "before",
          type: "json",
          admin: {
            description:
              "For an update: title, basePrice, attributes and stock as they were. For a create: null — there was nothing.",
          },
        },
        {
          name: "buildsAdded",
          type: "text",
          admin: { description: "Build slugs this row was appended to, so a revert can remove only those." },
        },
      ],
    },
  ],
};
