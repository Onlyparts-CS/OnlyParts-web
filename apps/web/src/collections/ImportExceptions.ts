import type { CollectionConfig } from "payload";
import { hasRole } from "./access";

/**
 * Rows an import refused, kept as work rather than as a log line.
 *
 * `/admin/queues` carried a "Feed exceptions" card for a supplier feed that
 * does not exist. This is the same queue against data that does: every row a
 * committed import rejected — a malformed SKU, an eight-digit HSN that is
 * seven, a category nobody has created yet.
 *
 * Until now those rows existed for exactly as long as the workbench tab stayed
 * open. The operator could download them as CSV in that moment and never again,
 * which means a sheet of 400 rows with 12 failures was 12 problems that
 * disappeared the instant somebody navigated away.
 *
 * **Written on commit, not on analysis.** Looking at a dry run and thinking
 * better of it should not create twelve work items; committing is the act that
 * says "I accepted this import, minus these rows".
 *
 * When a supplier feed does land, its rejections are the same shape and belong
 * in the same queue — a different `source` and nothing else.
 */

export const EXCEPTION_STATUS = ["open", "resolved", "ignored"] as const;
export type ExceptionStatus = (typeof EXCEPTION_STATUS)[number];

export const ImportExceptions: CollectionConfig = {
  slug: "import-exceptions",
  labels: { singular: "Import exception", plural: "Import exceptions" },
  admin: {
    useAsTitle: "sku",
    defaultColumns: ["sku", "source", "at", "status"],
    group: "Catalogue",
    description: "Rows a committed import refused, and what was decided about each.",
  },
  access: {
    read: hasRole("admin", "catalog"),
    create: hasRole("admin", "catalog"),
    update: hasRole("admin", "catalog"),
    delete: hasRole("admin"),
  },

  indexes: [{ fields: ["status", "at"] }],

  fields: [
    {
      type: "row",
      fields: [
        {
          name: "sku",
          type: "text",
          required: true,
          index: true,
          admin: { width: "34%", description: "As written in the sheet. May be blank or malformed — that is often the fault." },
        },
        {
          name: "source",
          type: "text",
          required: true,
          admin: { width: "33%", description: "The file it came from. A supplier feed would name itself here." },
        },
        { name: "at", type: "date", required: true, admin: { width: "33%", readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
      ],
    },
    {
      name: "batch",
      type: "relationship",
      relationTo: "import-batches",
      index: true,
      admin: { description: "The commit that rejected it, for context on what else was in the sheet." },
    },
    {
      name: "reasons",
      type: "text",
      required: true,
      admin: { description: "Why it was refused, joined. The validator's own words." },
    },
    {
      /*
        The original cells, so the row can be corrected and re-imported without
        hunting for the source sheet — which is usually on somebody's laptop and
        two revisions further on by the time anybody looks.
      */
      name: "row",
      type: "json",
      admin: { description: "The row exactly as it arrived." },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      index: true,
      options: [
        { label: "Open", value: "open" },
        { label: "Resolved", value: "resolved" },
        { label: "Ignored", value: "ignored" },
      ],
    },
    { name: "note", type: "text", admin: { description: "What was decided. Internal." } },
  ],
};
