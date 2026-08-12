import type { CollectionConfig, PayloadRequest } from "payload";
import { hasRole } from "./access";

/**
 * The order — the first thing in this system that is a legal document.
 *
 * Three rules drive every decision in this file, and they are not style
 * preferences:
 *
 * 1. **Lines are snapshots, never joins.** `sku`, `title`, `unitPrice`,
 *    `hsnCode` and `gstRate` are copied in at placement and frozen. Re-deriving
 *    an invoice from today's catalogue means last March's invoice silently
 *    changes when somebody edits a price, and under GST a filed invoice that
 *    moves is not a rounding problem, it is a compliance one.
 * 2. **All money is integer paise**, matching `variants`. ₹3.10 is `310`.
 * 3. **Status transitions are checked, not trusted.** A `delivered` order
 *    cannot go back to `pending_payment` because somebody clicked the wrong
 *    row, and nothing may leave a terminal state at all.
 *
 * Fulfilment and payment are **two** fields, deliberately. One combined enum
 * cannot express "paid but not yet packed" and "shipped, payment still
 * pending" (which is exactly what COD is) without multiplying out into a dozen
 * states nobody can remember. Shopify splits them for the same reason.
 */

/* ------------------------------------------------------------------ */

export const ORDER_STATUS = [
  "pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned",
] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

/** Where each state may legally go. Empty array = terminal. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export const PAYMENT_STATUS = [
  "pending", "authorized", "paid", "failed", "refunded", "partially_refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

const label = (s: string) => s.replace(/_/g, " ");

/* ------------------------------------------------------------------ */

const opsWrite = hasRole("admin", "ops");

/** Frozen once money has moved. A paid invoice is not an editable document. */
const invoiceLocked = (doc: { paymentStatus?: string } | undefined) =>
  doc?.paymentStatus === "paid" || doc?.paymentStatus === "partially_refunded";

export const Orders: CollectionConfig = {
  slug: "orders",
  admin: {
    useAsTitle: "number",
    defaultColumns: ["number", "placedAt", "customerName", "status", "paymentStatus", "grandTotal"],
    group: "Orders",
    description: "Placed by checkout. Lines and totals are frozen once payment succeeds.",
  },
  access: {
    read: ({ req: { user } }) => Boolean(user && user.collection === "users"),
    create: opsWrite,
    update: opsWrite,
    // Orders are never deleted. A cancelled order is a cancelled order — it
    // still has to be countable at the end of the financial year.
    delete: () => false,
  },

  indexes: [
    { fields: ["status", "placedAt"] },
    { fields: ["paymentStatus", "placedAt"] },
  ],

  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (operation === "create") {
          data.number ??= await nextOrderNumber(req);
          data.placedAt ??= new Date().toISOString();
          return data;
        }

        /* ---------- the state machine ---------- */
        const from = originalDoc?.status as OrderStatus | undefined;
        const to = data.status as OrderStatus | undefined;

        if (from && to && from !== to) {
          const legal = ORDER_TRANSITIONS[from] ?? [];
          if (!legal.includes(to)) {
            throw new Error(
              legal.length === 0
                ? `${label(from)} is final — this order cannot be moved to ${label(to)}.`
                : `${label(from)} can only become ${legal.map(label).join(" or ")}, not ${label(to)}.`,
            );
          }
        }

        /* ---------- issuing the tax invoice ---------- */
        /*
          Nothing assigned this field, so every order stayed a proforma for
          ever — `invoiceNumber` is `readOnly` in the panel and no hook filled
          it in. It belongs here rather than in whatever changed the payment
          status, because there are three such callers already (the CMS panel,
          the ops console, and the gateway webhook when it lands) and an
          invoice number that only some of them issue is worse than none.

          Under GST the number is issued when the supply is paid for, never at
          placement, and it must be gapless within the financial year.
        */
        if (
          data.paymentStatus === "paid" &&
          originalDoc?.paymentStatus !== "paid" &&
          !originalDoc?.invoiceNumber
        ) {
          data.invoiceNumber = await nextInvoiceNumber(req);
          data.invoiceDate = new Date().toISOString();
        }

        /* ---------- the frozen invoice ---------- */
        if (invoiceLocked(originalDoc)) {
          for (const field of ["lines", "subtotal", "shipping", "taxable", "cgst", "sgst", "igst", "grandTotal", "placeOfSupply", "gstin"] as const) {
            if (data[field] === undefined) continue;
            if (JSON.stringify(data[field]) !== JSON.stringify(originalDoc?.[field])) {
              throw new Error(
                `This invoice is paid — ${field} cannot change. Raise a credit note or a refund instead.`,
              );
            }
          }
        }

        return data;
      },
    ],
  },

  fields: [
    {
      type: "row",
      fields: [
        {
          name: "number",
          type: "text",
          unique: true,
          index: true,
          admin: { width: "34%", readOnly: true, description: "Assigned on create. OP-<FY>-<seq>." },
        },
        {
          name: "placedAt",
          type: "date",
          index: true,
          admin: { width: "33%", readOnly: true, date: { pickerAppearance: "dayAndTime" } },
        },
        {
          name: "channel",
          type: "select",
          defaultValue: "web",
          admin: { width: "33%" },
          options: [
            { label: "Storefront", value: "web" },
            { label: "Phone / WhatsApp", value: "manual" },
            { label: "Quote accepted", value: "rfq" },
          ],
        },
      ],
    },

    {
      type: "row",
      fields: [
        {
          name: "status",
          type: "select",
          required: true,
          defaultValue: "pending",
          index: true,
          admin: { width: "50%", description: "Fulfilment. Transitions are enforced on save." },
          options: ORDER_STATUS.map((v) => ({ label: label(v).replace(/^./, (c) => c.toUpperCase()), value: v })),
        },
        {
          name: "paymentStatus",
          type: "select",
          required: true,
          defaultValue: "pending",
          index: true,
          admin: { width: "50%", description: "Separate from fulfilment — COD ships before it is paid." },
          options: PAYMENT_STATUS.map((v) => ({ label: label(v).replace(/^./, (c) => c.toUpperCase()), value: v })),
        },
      ],
    },

    /* ---------------- who ---------------- */
    {
      type: "collapsible",
      label: "Buyer",
      admin: { initCollapsed: false },
      fields: [
        {
          name: "customer",
          type: "relationship",
          relationTo: "customers",
          index: true,
          admin: { description: "Linked by phone number, including for guest checkout." },
        },
        {
          type: "row",
          fields: [
            /*
              Snapshotted alongside the relationship, not instead of it. The
              customer record is the living version — they may correct their
              name next week — and this is who the order was actually placed
              by, which is what belongs on the invoice.
            */
            { name: "customerName", type: "text", required: true, admin: { width: "34%" } },
            { name: "customerPhone", type: "text", required: true, index: true, admin: { width: "33%" } },
            { name: "customerEmail", type: "email", admin: { width: "33%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "gstin", type: "text", admin: { width: "50%", description: "B2B only. Snapshot." } },
            {
              name: "placeOfSupply",
              type: "text",
              required: true,
              admin: {
                width: "50%",
                description: "Two-digit state code of the delivery address. Decides IGST versus CGST+SGST.",
              },
              validate: (v: unknown) => /^\d{2}$/.test(String(v ?? "")) || "Two digits, e.g. 29.",
            },
          ],
        },
      ],
    },

    /* ---------------- where ---------------- */
    {
      type: "collapsible",
      label: "Delivery address",
      fields: [
        {
          name: "shipTo",
          type: "group",
          fields: [
            {
              type: "row",
              fields: [
                { name: "name", type: "text", required: true, admin: { width: "50%" } },
                { name: "phone", type: "text", required: true, admin: { width: "50%" } },
              ],
            },
            { name: "line1", type: "text", required: true },
            { name: "line2", type: "text" },
            {
              type: "row",
              fields: [
                { name: "city", type: "text", required: true, admin: { width: "34%" } },
                { name: "stateCode", type: "text", required: true, admin: { width: "33%" } },
                { name: "pincode", type: "text", required: true, admin: { width: "33%" } },
              ],
            },
          ],
        },
      ],
    },

    /* ---------------- what ---------------- */
    {
      name: "lines",
      type: "array",
      required: true,
      minRows: 1,
      labels: { singular: "Line", plural: "Lines" },
      admin: {
        description:
          "Snapshots. Editing a variant's price or title later must never change what this invoice says.",
      },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "variant",
              type: "relationship",
              relationTo: "variants",
              index: true,
              admin: { width: "50%", description: "For reporting. May be null if the SKU is later retired." },
            },
            { name: "sku", type: "text", required: true, admin: { width: "50%" } },
          ],
        },
        { name: "title", type: "text", required: true },
        {
          type: "row",
          fields: [
            { name: "qty", type: "number", required: true, min: 1, admin: { width: "25%" } },
            { name: "unitPrice", type: "number", required: true, min: 0, admin: { width: "25%", description: "Paise, GST-inclusive, after price breaks." } },
            { name: "lineTotal", type: "number", required: true, min: 0, admin: { width: "25%", description: "Paise." } },
            { name: "hsnCode", type: "text", required: true, admin: { width: "25%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "gstRate", type: "number", required: true, admin: { width: "20%", description: "Percent, e.g. 18." } },
            { name: "taxable", type: "number", required: true, admin: { width: "20%", description: "Paise, ex-GST." } },
            { name: "cgst", type: "number", defaultValue: 0, admin: { width: "20%" } },
            { name: "sgst", type: "number", defaultValue: 0, admin: { width: "20%" } },
            { name: "igst", type: "number", defaultValue: 0, admin: { width: "20%" } },
          ],
        },
      ],
    },

    /* ---------------- how much ---------------- */
    {
      type: "collapsible",
      label: "Totals",
      admin: { initCollapsed: false },
      fields: [
        {
          type: "row",
          fields: [
            { name: "subtotal", type: "number", required: true, admin: { width: "25%", description: "Paise, inclusive." } },
            { name: "shipping", type: "number", required: true, defaultValue: 0, admin: { width: "25%", description: "Paise, inclusive." } },
            { name: "taxable", type: "number", required: true, admin: { width: "25%", description: "Paise, ex-GST." } },
            { name: "grandTotal", type: "number", required: true, admin: { width: "25%", description: "Paise. What was charged." } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "cgst", type: "number", defaultValue: 0, admin: { width: "34%" } },
            { name: "sgst", type: "number", defaultValue: 0, admin: { width: "33%" } },
            { name: "igst", type: "number", defaultValue: 0, admin: { width: "33%" } },
          ],
        },
      ],
    },

    /* ---------------- paperwork ---------------- */
    {
      type: "collapsible",
      label: "Invoice & payment",
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "invoiceNumber",
              type: "text",
              unique: true,
              index: true,
              admin: { width: "50%", readOnly: true, description: "Issued when payment succeeds, never before." },
            },
            { name: "invoiceDate", type: "date", admin: { width: "50%", readOnly: true } },
          ],
        },
        {
          type: "row",
          fields: [
            {
              name: "paymentMethod",
              type: "select",
              admin: { width: "50%" },
              options: [
                { label: "UPI", value: "upi" },
                { label: "Card", value: "card" },
                { label: "Netbanking", value: "netbanking" },
                { label: "Cash on delivery", value: "cod" },
                { label: "Bank transfer", value: "neft" },
              ],
            },
            {
              name: "gatewayOrderId",
              type: "text",
              index: true,
              admin: { width: "50%", description: "Razorpay order id. The webhook matches on this." },
            },
          ],
        },
        {
          name: "gatewayPaymentId",
          type: "text",
          index: true,
          admin: { description: "Set by the verified webhook, never by the browser." },
        },
      ],
    },

    /* ---------------- what happened ---------------- */
    {
      name: "events",
      type: "array",
      labels: { singular: "Event", plural: "Timeline" },
      admin: {
        description:
          "Append-only. Every status change, payment and staff note lands here — this is the answer to 'who did this and when'.",
      },
      fields: [
        {
          type: "row",
          fields: [
            { name: "at", type: "date", required: true, admin: { width: "34%", date: { pickerAppearance: "dayAndTime" } } },
            { name: "kind", type: "text", required: true, admin: { width: "33%", description: "status, payment, note, shipment" } },
            { name: "actor", type: "text", admin: { width: "33%", description: "Staff email, 'customer', or 'system'." } },
          ],
        },
        { name: "detail", type: "text", required: true },
      ],
    },

    {
      name: "staffNotes",
      type: "textarea",
      admin: { description: "Internal. Never rendered to the buyer." },
    },
  ],
};

/* ------------------------------------------------------------------ */

/**
 * The next order number, `OP-2627-000148`.
 *
 * Sequence restarts each Indian financial year (April–March), which is the
 * period GST returns are filed against. Derived by reading the highest number
 * in the current year rather than from a counter row, so there is nothing to
 * drift out of sync with reality — and `number` is unique, so if two checkouts
 * race, the loser fails its insert and retries rather than silently reusing a
 * number. Two orders sharing an invoice number is the one failure mode here
 * that is genuinely expensive.
 */
export async function nextOrderNumber(req: PayloadRequest): Promise<string> {
  return nextInSeries(req, "number", "OP");
}

/**
 * The next tax invoice number, `INV-2627-000148`.
 *
 * A separate series from the order number on purpose. Order numbers are issued
 * at placement and orders get cancelled; invoice numbers are issued on payment
 * and must be **gapless** within the financial year, because a missing number
 * in a GST return is a question you have to answer. Sharing one counter would
 * put a hole in the invoice series every time somebody abandoned a checkout.
 */
export async function nextInvoiceNumber(req: PayloadRequest): Promise<string> {
  return nextInSeries(req, "invoiceNumber", "INV");
}

/**
 * Derived by reading the highest number in the current financial year rather
 * than from a counter row, so there is nothing to drift out of sync with
 * reality — and both fields are `unique`, so if two writes race, the loser
 * fails its insert and retries rather than silently reusing a number. Two
 * documents sharing an invoice number is the one failure here that is
 * genuinely expensive.
 */
async function nextInSeries(
  req: PayloadRequest,
  field: "number" | "invoiceNumber",
  prefixLetters: string,
): Promise<string> {
  const now = new Date();
  // The Indian financial year runs April–March, which is the period GST
  // returns are filed against.
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fy = `${String(startYear).slice(2)}${String(startYear + 1).slice(2)}`;
  const prefix = `${prefixLetters}-${fy}-`;

  const latest = await req.payload.find({
    collection: "orders",
    where: { [field]: { like: prefix } },
    sort: `-${field}`,
    limit: 1,
    depth: 0,
    req,
    overrideAccess: true,
  });

  const last = latest.docs[0]?.[field] as string | undefined;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(6, "0")}`;
}
