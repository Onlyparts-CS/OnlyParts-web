import { getPayload } from "payload";
import config from "@payload-config";
import type { PayloadRequest } from "payload";
import { taxOnInclusive, totalsFor, isValidGstin, type InvoiceLine } from "./gst";

/**
 * Placing an order, server side.
 *
 * **The browser sends SKUs and quantities. It does not send prices.** Every
 * figure on the order — unit price, price break, HSN code, GST rate, shipping,
 * every tax component — is re-derived here from the database. A checkout that
 * accepts a total from the client is a checkout where the total is whatever the
 * client says it is, and that is not a subtle bug: it is the entire attack.
 *
 * The old flow computed the invoice in `store.ts` and kept it in localStorage,
 * which meant the price a buyer paid was decided by their own browser. This
 * replaces that.
 *
 * Everything runs inside one database transaction. An order whose lines wrote
 * but whose stock allocation did not is worse than no order at all — it is a
 * sale nobody can fulfil, discovered a week later.
 */

export type CartInput = { sku: string; qty: number };

export type ContactInput = {
  name: string;
  phone: string;
  email?: string;
  gstin?: string;
};

export type AddressInput = {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  stateCode: string;
  pincode: string;
};

export type PlaceOrderInput = {
  cart: CartInput[];
  contact: ContactInput;
  shipTo: AddressInput;
  /**
   * `cod` and `neft` are still in the union because orders taken before the
   * switch to online-only payment carry them and this type reads those back.
   * Neither can be *placed* — see the accepted set below.
   */
  paymentMethod: "upi" | "card" | "netbanking" | "cod" | "neft";
};

/** What a buyer may choose today. Historic orders hold values outside this. */
const PLACEABLE_METHODS: PlaceOrderInput["paymentMethod"][] = ["upi", "card", "netbanking"];

export type PlaceOrderResult =
  | { ok: true; number: string; id: string | number; grandTotal: number }
  | { ok: false; errors: Record<string, string> };

/** Highest break whose `minQty` the buyer meets, else the base price. */
function priceFor(
  variant: { basePrice: number; priceTiers?: unknown },
  qty: number,
  tier: string,
): number {
  const breaks = ((variant.priceTiers ?? []) as {
    minQty: number; unitPrice: number; customerGroup?: string | null;
  }[])
    .filter((t) => !t.customerGroup || t.customerGroup === tier)
    .filter((t) => t.minQty <= qty)
    .sort((a, b) => a.minQty - b.minQty);

  return breaks.length ? breaks[breaks.length - 1].unitPrice : variant.basePrice;
}

/* ------------------------------------------------------------------ */

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const payload = await getPayload({ config });
  const errors: Record<string, string> = {};

  /* ---------- shape ---------- */
  const phone = input.contact.phone.replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = "A ten-digit Indian mobile number.";
  if (!input.contact.name.trim()) errors.name = "Who is this order for?";
  if (!/^\d{2}$/.test(input.shipTo.stateCode)) errors.stateCode = "Pick the delivery state.";
  if (!/^\d{6}$/.test(input.shipTo.pincode)) errors.pincode = "Six digits.";
  if (!input.shipTo.line1?.trim()) errors.line1 = "The street address is missing.";
  if (!input.shipTo.city?.trim()) errors.city = "Which city?";
  if (!input.cart.length) errors.cart = "The cart is empty.";
  // Public endpoint, client-supplied array: cap it before it becomes a 10,000
  // element `IN (…)` against the variants table.
  if (input.cart.length > 100) errors.cart = "Too many lines — split this into separate orders, or send it as an RFQ.";

  // Online payment only. The picker no longer offers cash on delivery, but
  // this is a public endpoint taking a client-supplied string, so removing the
  // radio button is not the same as declining the method.
  if (!PLACEABLE_METHODS.includes(input.paymentMethod)) {
    errors.paymentMethod = "Choose UPI, card or netbanking — we do not take cash on delivery.";
  }

  const gstin = input.contact.gstin?.trim().toUpperCase();
  if (gstin && !isValidGstin(gstin)) errors.gstin = "That is not a valid GSTIN.";

  if (Object.keys(errors).length) return { ok: false, errors };

  /* ---------- what the catalogue actually says ---------- */
  const skus = [...new Set(input.cart.map((l) => l.sku.trim().toUpperCase()))];
  const found = await payload.find({
    collection: "variants",
    where: { and: [{ sku: { in: skus } }, { isActive: { equals: true } }] },
    depth: 1, // product comes with it — HSN and GST rate live there
    limit: 200,
    overrideAccess: true,
  });

  const bySku = new Map(found.docs.map((v) => [String(v.sku).toUpperCase(), v]));
  const missing = skus.filter((s) => !bySku.has(s));
  if (missing.length) {
    return {
      ok: false,
      errors: { cart: `No longer available: ${missing.join(", ")}. Remove them and try again.` },
    };
  }

  /* ---------- price it here, not there ---------- */
  const placeOfSupply = input.shipTo.stateCode;
  const tier = "retail"; // customer tiers land with real identity (task #58)

  const invoiceLines: InvoiceLine[] = [];
  const orderLines: Record<string, unknown>[] = [];

  for (const line of input.cart) {
    const sku = line.sku.trim().toUpperCase();
    const variant = bySku.get(sku)!;
    const qty = Math.max(1, Math.floor(Number(line.qty) || 0));

    const product = typeof variant.product === "object" ? variant.product : null;
    if (!product) return { ok: false, errors: { cart: `${sku} is not attached to a product.` } };

    const moq = Number(variant.moq ?? 1);
    if (qty < moq) {
      return { ok: false, errors: { cart: `${sku} has a minimum order of ${moq}.` } };
    }

    const unitPrice = priceFor(variant as never, qty, tier);
    const lineTotal = unitPrice * qty;
    const rate = Number((product as { gstRate?: string | number }).gstRate ?? 18);
    const hsn = String((product as { hsnCode?: string }).hsnCode ?? "");
    const tax = taxOnInclusive(lineTotal, rate, placeOfSupply);

    const title = [product.title, variant.titleSuffix].filter(Boolean).join(" — ");

    invoiceLines.push({ sku, title, hsn, rate, qty, unitPrice, lineTotal, tax });
    orderLines.push({
      variant: variant.id,
      sku,
      title,
      qty,
      unitPrice,
      lineTotal,
      hsnCode: hsn,
      gstRate: rate,
      taxable: tax.taxable,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
    });
  }

  const totals = totalsFor(invoiceLines, placeOfSupply);
  const subtotal = invoiceLines.reduce((n, l) => n + l.lineTotal, 0);

  /* ---------- stock, before anything is promised ---------- */
  const warehouse = (
    await payload.find({
      collection: "warehouses",
      where: { isActive: { equals: true } },
      limit: 1, depth: 0, overrideAccess: true,
    })
  ).docs[0];
  if (!warehouse) return { ok: false, errors: { cart: "No warehouse is configured to ship from." } };

  const wanted = new Map<string, number>();
  for (const l of input.cart) {
    const id = String(bySku.get(l.sku.trim().toUpperCase())!.id);
    wanted.set(id, (wanted.get(id) ?? 0) + Math.max(1, Math.floor(Number(l.qty) || 0)));
  }

  const levels = await payload.find({
    collection: "inventory",
    where: {
      and: [
        { variant: { in: [...wanted.keys()] } },
        { warehouse: { equals: warehouse.id } },
      ],
    },
    limit: 500, depth: 0, overrideAccess: true,
  });
  const levelByVariant = new Map(
    levels.docs.map((l) => [String(typeof l.variant === "object" ? l.variant.id : l.variant), l]),
  );

  for (const [variantId, qty] of wanted) {
    const level = levelByVariant.get(variantId);
    const available =
      (level?.onHand ?? 0) - (level?.allocated ?? 0) - (level?.reserved ?? 0);
    if (available < qty) {
      const sku = found.docs.find((v) => String(v.id) === variantId)?.sku ?? variantId;
      return {
        ok: false,
        errors: {
          cart: `Only ${Math.max(0, available)} of ${sku} left — somebody bought the rest while you were checking out.`,
        },
      };
    }
  }

  /* ---------- write, all or nothing ---------- */
  const transactionID = await payload.db.beginTransaction();
  if (!transactionID) return { ok: false, errors: { _: "Could not open a database transaction." } };
  const req = { transactionID } as PayloadRequest;

  try {
    // The buyer is matched on phone, so a guest's second order joins the first.
    const existing = await payload.find({
      collection: "customers",
      where: { phone: { equals: phone } },
      limit: 1, depth: 0, req, overrideAccess: true,
    });

    const customer =
      existing.docs[0] ??
      (await payload.create({
        collection: "customers",
        req,
        overrideAccess: true,
        data: {
          phone,
          name: input.contact.name.trim(),
          email: input.contact.email?.trim() || undefined,
          gstin: gstin || undefined,
        } as never,
      }));

    const order = await payload.create({
      collection: "orders",
      req,
      overrideAccess: true,
      data: {
        status: "pending",
        // Every order now waits for the gateway; nothing ships unpaid.
        paymentStatus: "pending",
        channel: "web",
        customer: customer.id,
        customerName: input.contact.name.trim(),
        customerPhone: phone,
        customerEmail: input.contact.email?.trim() || undefined,
        gstin: gstin || undefined,
        placeOfSupply,
        shipTo: {
          name: input.shipTo.name.trim(),
          phone: input.shipTo.phone.replace(/\D/g, "").slice(-10),
          line1: input.shipTo.line1.trim(),
          line2: input.shipTo.line2?.trim() || undefined,
          city: input.shipTo.city.trim(),
          stateCode: input.shipTo.stateCode,
          pincode: input.shipTo.pincode,
        },
        lines: orderLines,
        subtotal,
        shipping: totals.shipping,
        taxable: totals.taxable,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        grandTotal: totals.grand,
        paymentMethod: input.paymentMethod,
        events: [
          {
            at: new Date().toISOString(),
            kind: "status",
            actor: "customer",
            detail: `Order placed — ${input.paymentMethod.toUpperCase()}, ₹${(totals.grand / 100).toFixed(2)}.`,
          },
        ],
      } as never,
    });

    /*
      Allocate, do not consume.

      `onHand` is what is physically on the shelf and does not move until the
      parcel does — that is a `sale` movement at dispatch. What a placed order
      takes is `allocated`, so the same last bearing cannot be sold twice while
      it waits to be packed. See the model in `collections/Inventory.ts`.
    */
    for (const [variantId, qty] of wanted) {
      const level = levelByVariant.get(variantId);
      if (level) {
        await payload.update({
          collection: "inventory",
          id: level.id,
          req,
          overrideAccess: true,
          data: { allocated: (level.allocated ?? 0) + qty },
        });
      } else {
        throw new Error(`No stock record for variant ${variantId}.`);
      }
    }

    await payload.update({
      collection: "customers",
      id: customer.id,
      req,
      overrideAccess: true,
      data: {
        orderCount: (customer.orderCount ?? 0) + 1,
        lifetimeValue: (customer.lifetimeValue ?? 0) + totals.grand,
      },
    });

    await payload.db.commitTransaction(transactionID);
    return { ok: true, number: String(order.number), id: order.id, grandTotal: totals.grand };
  } catch (e) {
    await payload.db.rollbackTransaction(transactionID);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, errors: { _: msg.slice(0, 200) } };
  }
}
