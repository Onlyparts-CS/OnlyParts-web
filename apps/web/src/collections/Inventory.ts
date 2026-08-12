import type { CollectionConfig } from "payload";
import { anyone, authenticated, hasRole } from "./access";

const opsWrite = hasRole("admin", "ops", "catalog");

export const Warehouses: CollectionConfig = {
  slug: "warehouses",
  admin: { useAsTitle: "name", defaultColumns: ["code", "name", "stateCode", "isActive"], group: "Inventory" },
  access: { read: anyone, create: hasRole("admin"), update: hasRole("admin"), delete: hasRole("admin") },
  fields: [
    { name: "code", type: "text", required: true, unique: true, index: true },
    { name: "name", type: "text", required: true },
    {
      name: "stateCode",
      type: "text",
      required: true,
      admin: {
        description:
          "Two-digit GST state code. This is the *origin* for place-of-supply — it decides CGST+SGST versus IGST on every order shipped from here.",
      },
      validate: (v: unknown) => /^\d{2}$/.test(String(v ?? "")) || "Two digits, e.g. 29 for Karnataka.",
    },
    { name: "pincode", type: "text", required: true },
    { name: "isActive", type: "checkbox", defaultValue: true },
  ],
};

/**
 * Stock levels — a **cache of the ledger**, not the truth.
 *
 * `onHand` is read-only everywhere, including the admin. The only thing that
 * moves it is an `inventory-movements` row, applied in the same transaction.
 * That is the difference between a stock figure you can explain and one you
 * can only apologise for: every unit is accounted for by a row saying who
 * moved it, when, and why.
 *
 * **Available to sell = onHand − allocated − reserved.**
 * `allocated` is hard-committed to a placed order; `reserved` is a soft hold
 * during checkout. Selling against `onHand` alone is how two customers buy the
 * same last bearing.
 */
export const Inventory: CollectionConfig = {
  slug: "inventory",
  labels: { singular: "Stock level", plural: "Stock levels" },
  admin: {
    useAsTitle: "id",
    defaultColumns: ["variant", "warehouse", "onHand", "allocated", "reserved"],
    group: "Inventory",
    description: "On-hand is derived from the movement ledger. To change it, record a movement.",
  },
  access: { read: anyone, create: opsWrite, update: opsWrite, delete: hasRole("admin") },
  indexes: [{ fields: ["variant", "warehouse"], unique: true }],
  fields: [
    { name: "variant", type: "relationship", relationTo: "variants", required: true, index: true },
    { name: "warehouse", type: "relationship", relationTo: "warehouses", required: true, index: true },
    {
      type: "row",
      fields: [
        {
          name: "onHand",
          type: "number",
          defaultValue: 0,
          min: 0,
          admin: { width: "25%", readOnly: true, description: "Derived from the ledger." },
        },
        { name: "allocated", type: "number", defaultValue: 0, min: 0, admin: { width: "25%", description: "Committed to placed orders." } },
        { name: "reserved", type: "number", defaultValue: 0, min: 0, admin: { width: "25%", description: "Soft hold during checkout." } },
        { name: "reorderPoint", type: "number", defaultValue: 0, min: 0, admin: { width: "25%" } },
      ],
    },
  ],
};

/**
 * The append-only stock ledger.
 *
 * Update and delete are refused at the access layer, not merely discouraged —
 * an audit trail you can edit is not an audit trail. A mistake is corrected by
 * posting an opposing movement, which leaves both rows visible, which is the
 * point.
 *
 * `SUM(delta)` for a variant/warehouse must always equal that level's `onHand`.
 * A nightly job should assert it and alert on drift; this hook is what makes
 * the assertion hold in the first place.
 */
export const InventoryMovements: CollectionConfig = {
  slug: "inventory-movements",
  labels: { singular: "Movement", plural: "Movements" },
  admin: {
    useAsTitle: "id",
    defaultColumns: ["variant", "warehouse", "delta", "reason", "createdAt"],
    group: "Inventory",
    description: "Append-only. Correct a mistake by posting the opposite movement, never by editing.",
  },
  access: {
    read: authenticated,
    create: opsWrite,
    update: () => false,
    delete: () => false,
  },

  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === "create" && req.user && !data.actor) data.actor = req.user.id;
        if (data.delta === 0) throw new Error("A movement of zero records nothing.");
        return data;
      },
    ],

    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation !== "create") return;

        const variant = typeof doc.variant === "object" ? doc.variant.id : doc.variant;
        const warehouse = typeof doc.warehouse === "object" ? doc.warehouse.id : doc.warehouse;

        const existing = await req.payload.find({
          collection: "inventory",
          where: { and: [{ variant: { equals: variant } }, { warehouse: { equals: warehouse } }] },
          limit: 1,
          depth: 0,
          req,
        });

        const level = existing.docs[0];
        const next = (level?.onHand ?? 0) + doc.delta;

        if (next < 0) {
          throw new Error(
            `That movement would take on-hand to ${next}. Stock cannot go negative — ` +
              `check the quantity, or post a count adjustment first.`,
          );
        }

        // Same `req`, so this rides the movement's own transaction: either both
        // the ledger row and the level land, or neither does.
        if (level) {
          await req.payload.update({
            collection: "inventory",
            id: level.id,
            data: { onHand: next },
            req,
            overrideAccess: true,
          });
        } else {
          await req.payload.create({
            collection: "inventory",
            data: { variant, warehouse, onHand: next },
            req,
            overrideAccess: true,
          });
        }
      },
    ],
  },

  fields: [
    { name: "variant", type: "relationship", relationTo: "variants", required: true, index: true },
    { name: "warehouse", type: "relationship", relationTo: "warehouses", required: true, index: true },
    {
      name: "delta",
      type: "number",
      required: true,
      admin: { description: "Signed. +250 received, −4 sold, −1 damaged." },
    },
    {
      name: "reason",
      type: "select",
      required: true,
      options: ["purchase", "sale", "return", "adjustment", "damage", "transfer", "count", "production"]
        .map((r) => ({ label: r, value: r })),
    },
    {
      type: "row",
      fields: [
        { name: "referenceType", type: "text", admin: { width: "50%", description: "order, purchase-order, rfq-job…" } },
        { name: "referenceId", type: "text", admin: { width: "50%" } },
      ],
    },
    { name: "note", type: "text" },
    {
      name: "actor",
      type: "relationship",
      relationTo: "users",
      admin: { readOnly: true, description: "Stamped from the session." },
    },
  ],
};
