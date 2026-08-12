import type { Access, CollectionConfig } from "payload";
import { hasRole } from "./access";
import { customerCookieStrategy } from "@/lib/customerSession";

/**
 * The buyer, as a record — and now also as a login.
 *
 * This collection existed first as a pure record: an order has to be
 * attributable to somebody, and without it "every order this person has
 * placed" is a `LIKE` over an email column. The note here said adding auth
 * later would be additive. It was, and this is it.
 *
 * Guests stay first-class. Checkout still works without an account, and a
 * guest order still creates one of these rows keyed on the phone number, so
 * the second order from the same buyer joins the first.
 *
 * **Identity is phone-first, sign-in is email-first, and those are different
 * questions.** In India the mobile number is the durable handle — it is what
 * the courier calls and what a repeat buyer is matched on — but Google hands
 * us a verified email and no phone at all. So `phone` is no longer required at
 * the collection level: a Google account can exist before a phone number does,
 * and checkout collects it at the point it is actually needed. Matching still
 * prefers `googleSub`, then `email`, then `phone`.
 *
 * Never mixed into `users`. Staff and buyers in one collection is how a
 * storefront sign-in becomes a route to catalogue write access — which is why
 * the local password strategy is disabled outright below rather than merely
 * left unused.
 */

/** Staff see everyone; a signed-in buyer sees only themselves. */
const selfOrStaff: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (user.collection === "users") return true;
  // A customer authenticated by `customerCookieStrategy`. Scoped to their own
  // row rather than granted a blanket true — otherwise signing in would hand
  // every buyer the whole customer table.
  if (user.collection === "customers") return { id: { equals: user.id } };
  return false;
};

const staffOnly: Access = ({ req: { user } }) =>
  Boolean(user && user.collection === "users");

export const Customers: CollectionConfig = {
  slug: "customers",
  admin: {
    useAsTitle: "phone",
    defaultColumns: ["phone", "name", "email", "company", "orderCount"],
    group: "Customers",
    description: "Created by checkout (including guest) or by signing in with Google.",
  },

  /*
    Auth, with the local strategy switched off.

    `disableLocalStrategy` removes the password field, the password-reset
    endpoints and the `/api/customers/login` route entirely. There is no
    password to phish, stuff or leak, and no second way in to keep hardened —
    the only route to a session is `customerCookieStrategy`, which is only ever
    issued by the Google callback after an ID token has been verified.
  */
  auth: {
    disableLocalStrategy: true,
    strategies: [customerCookieStrategy],
  },

  access: {
    read: selfOrStaff,
    create: hasRole("admin", "ops"),
    update: selfOrStaff,
    delete: hasRole("admin"),
    // Buyers must never reach the CMS. Payload grants admin-panel access to any
    // authenticated collection unless told otherwise, and this collection is
    // now authenticated.
    admin: () => false,
  },

  fields: [
    {
      name: "phone",
      type: "text",
      unique: true,
      index: true,
      admin: {
        description:
          "Ten digits, no +91. The identity a repeat buyer is matched on. Absent until a " +
          "Google sign-in reaches checkout — Google does not give us one.",
      },
      validate: (v: unknown) => {
        const s = String(v ?? "").trim();
        // Optional, but never *wrong*: an empty phone is a customer who has not
        // checked out yet, whereas a malformed one is a parcel nobody can deliver.
        if (!s) return true;
        return /^[6-9]\d{9}$/.test(s) || "A ten-digit Indian mobile number.";
      },
    },
    {
      name: "googleSub",
      type: "text",
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          "Google's immutable subject id. Matched on before email, because a Google account " +
          "can change its email address and this never changes.",
      },
    },
    {
      name: "emailVerified",
      type: "checkbox",
      defaultValue: false,
      admin: {
        readOnly: true,
        description: "True only when Google asserted it. Never set from user input.",
      },
    },
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true, admin: { width: "50%" } },
        { name: "email", type: "email", admin: { width: "50%", description: "Optional — the invoice goes here when present." } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "company", type: "text", admin: { width: "50%" } },
        {
          name: "gstin",
          type: "text",
          admin: {
            width: "50%",
            description: "15 characters. Its first two digits are the buyer's state and decide IGST versus CGST+SGST.",
          },
          validate: (v: unknown) => {
            const s = String(v ?? "").trim();
            if (!s) return true;
            return /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(s.toUpperCase())
              || "That is not a valid GSTIN.";
          },
        },
      ],
    },
    {
      name: "tier",
      type: "select",
      defaultValue: "retail",
      admin: { description: "Selects the price break band. Retail pays the base price." },
      options: [
        { label: "Retail", value: "retail" },
        { label: "B2B", value: "b2b" },
        { label: "Institution", value: "institution" },
      ],
    },
    {
      name: "addresses",
      type: "array",
      labels: { singular: "Address", plural: "Addresses" },
      fields: [
        {
          type: "row",
          fields: [
            { name: "label", type: "text", admin: { width: "34%", description: "Home, Works, Lab" } },
            { name: "name", type: "text", required: true, admin: { width: "33%" } },
            { name: "phone", type: "text", required: true, admin: { width: "33%" } },
          ],
        },
        { name: "line1", type: "text", required: true },
        { name: "line2", type: "text" },
        {
          type: "row",
          fields: [
            { name: "city", type: "text", required: true, admin: { width: "34%" } },
            {
              name: "stateCode",
              type: "text",
              required: true,
              admin: { width: "33%", description: "Two-digit GST state code." },
              validate: (v: unknown) => /^\d{2}$/.test(String(v ?? "")) || "Two digits, e.g. 29.",
            },
            {
              name: "pincode",
              type: "text",
              required: true,
              admin: { width: "33%" },
              validate: (v: unknown) => /^\d{6}$/.test(String(v ?? "")) || "Six digits.",
            },
          ],
        },
        { name: "isDefault", type: "checkbox" },
      ],
    },

    /*
      Denormalised, and honest about it: these are written by the checkout
      action when an order is placed, not computed on read. A customer list
      that counts orders per row with a subquery is a list that gets slower
      every month. Whoever writes an order writes these.
    */
    {
      type: "row",
      fields: [
        {
          name: "orderCount",
          type: "number",
          defaultValue: 0,
          admin: { width: "50%", readOnly: true, description: "Maintained by checkout." },
        },
        {
          name: "lifetimeValue",
          type: "number",
          defaultValue: 0,
          admin: { width: "50%", readOnly: true, description: "Paise, gross. Maintained by checkout." },
        },
      ],
    },
    {
      name: "notes",
      type: "textarea",
      admin: { description: "Staff-visible only. Never shown to the buyer." },
    },
  ],
};
