import type { CollectionConfig } from "payload";
import { hasRole } from "./access";

/**
 * What people typed, and whether we had it.
 *
 * `/admin/queues` calls the zero-result list "the highest-leverage list in the
 * company" and it was right to: every row is a customer who arrived intending
 * to spend money and left without a way to. It is also the only place the
 * catalogue's gaps announce themselves without anybody guessing.
 *
 * **One row per distinct query, not per search.** A busy day is fifty thousand
 * searches and perhaps three thousand distinct ones, and the queue is a list of
 * questions to answer rather than a firehose to scroll. `count` and `lastSeen`
 * carry the volume, which is what ranks the work.
 *
 * Written by the search page and nothing else. `access.create` is deliberately
 * open because the writer is an anonymous visitor's request — the storefront
 * has no session — and the collection holds no personal data for that reason:
 * the query text, the count, the date. No visitor, no session, no IP.
 */

export const TRIAGE = ["untriaged", "missing_product", "missing_synonym", "parser_gap", "noise"] as const;
export type Triage = (typeof TRIAGE)[number];

const label = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const SearchQueries: CollectionConfig = {
  slug: "search-queries",
  admin: {
    useAsTitle: "q",
    defaultColumns: ["q", "resultCount", "count", "triage", "lastSeen"],
    group: "Orders",
    description: "Every distinct search, with what it returned. Zero-result rows are the catalogue's to-do list.",
  },
  access: {
    read: hasRole("admin", "catalog", "ops"),
    // The storefront logs anonymously; there is no session to check against.
    // Nothing here is readable without a staff role, so an open create leaks
    // nothing — the worst it permits is noise, which `triage: noise` exists for.
    create: () => true,
    update: () => true,
    delete: hasRole("admin"),
  },

  indexes: [
    { fields: ["resultCount", "count"] },
    { fields: ["triage", "count"] },
  ],

  fields: [
    {
      name: "q",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: "Normalised — lowercased, collapsed whitespace." },
    },
    {
      type: "row",
      fields: [
        {
          name: "resultCount",
          type: "number",
          required: true,
          index: true,
          admin: { width: "34%", description: "From the most recent time it was run." },
        },
        {
          name: "count",
          type: "number",
          required: true,
          defaultValue: 1,
          admin: { width: "33%", description: "How many times it has been searched." },
        },
        {
          name: "lastSeen",
          type: "date",
          required: true,
          index: true,
          admin: { width: "33%", readOnly: true, date: { pickerAppearance: "dayAndTime" } },
        },
      ],
    },
    {
      name: "triage",
      type: "select",
      required: true,
      defaultValue: "untriaged",
      index: true,
      options: TRIAGE.map((v) => ({ label: label(v), value: v })),
      admin: {
        description:
          "Why it returned nothing. A missing product is a buying decision; a missing synonym or a parser gap is a bug in search.",
      },
    },
    {
      name: "note",
      type: "text",
      admin: { description: "What was decided. Internal." },
    },
  ],
};
