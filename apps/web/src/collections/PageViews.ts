import type { CollectionConfig } from "payload";
import { hasRole } from "./access";

/**
 * Which pages get looked at.
 *
 * The privacy policy promises "anonymised usage analytics" and until now there
 * were none, which made the promise the only inaccurate sentence in it. This is
 * that analytics, built to the same rule as `SearchQueries`: **one row per
 * distinct path, and nothing whatsoever about the person who asked for it.**
 * No visitor, no session, no cookie, no IP, no referrer, no user agent. There
 * is nothing here to identify anybody with, which is why the word "anonymised"
 * is now literally true rather than aspirational, and why the site needs no
 * consent banner — a banner exists to ask about the identifier, and there is
 * not one.
 *
 * It is also why this could not have been Plausible, Fathom or GA. `proxy.ts`
 * sets `connect-src 'self'` and `script-src 'self' 'nonce-…' 'strict-dynamic'`;
 * a third-party tag violates both, and the same-origin property those headers
 * buy is worth more than a hosted dashboard.
 *
 * **Lifetime totals, not a time series.** A row per path per day would be four
 * thousand rows a day against a four-thousand-page catalogue and a million and
 * a half a year, to answer a question — what do people actually look at — that
 * a running total answers just as well. `lastSeen` carries recency; `count`
 * ranks. When a genuine time series is needed it belongs in a warehouse, not
 * in the collection the admin panel paginates.
 */
export const PageViews: CollectionConfig = {
  slug: "page-views",
  admin: {
    useAsTitle: "path",
    defaultColumns: ["path", "count", "lastSeen"],
    group: "Orders",
    description:
      "Every distinct page that has been viewed, and how often. Holds no identifiers — not a visitor, a session or an IP.",
  },
  access: {
    read: hasRole("admin", "catalog", "ops"),
    // Same reasoning as `SearchQueries`: the writer is an anonymous visitor's
    // request and there is no session to check. Nothing here is readable
    // without a staff role, and the row holds no identifier, so an open create
    // leaks nothing — the worst it permits is an inflated count.
    create: () => true,
    update: () => true,
    delete: hasRole("admin"),
  },

  indexes: [{ fields: ["count"] }],

  fields: [
    {
      name: "path",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: "Pathname only. Query strings and fragments are dropped before the row is written.",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "count",
          type: "number",
          required: true,
          defaultValue: 1,
          admin: { width: "50%", description: "Views since the page was first seen." },
        },
        {
          name: "lastSeen",
          type: "date",
          required: true,
          index: true,
          admin: { width: "50%", readOnly: true, date: { pickerAppearance: "dayAndTime" } },
        },
      ],
    },
  ],
};
