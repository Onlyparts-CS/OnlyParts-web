import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import type { Where } from "payload";
import config from "@payload-config";
import type { Customer, Order } from "@/payload-types";

/**
 * The ops desk's reads — orders and the people who placed them.
 *
 * Deliberately not part of `orderRead.ts`. That module answers "may this
 * browser see the order it just placed?" and reaches *past* Payload's access
 * control with `overrideAccess: true` to do it, because `orders.access.read`
 * is staff-only and would otherwise lock out the guest who has just paid.
 *
 * This module is the other side of the same collection, so it does the
 * opposite: it hands Payload the signed-in staff user and lets
 * `orders.access.read` be the gate. There is no override here and there must
 * never be one. The pages above also call `guard("admin", "ops")`, but that
 * guard decides which screen to render — it is not what keeps one customer's
 * invoice away from another. This is. A mistake in a filter should return
 * nothing, not somebody else's paperwork.
 */

async function staffPayload() {
  const payload = await getPayload({ config });
  try {
    const { user } = await payload.auth({ headers: await nextHeaders() });
    return { payload, user: user?.collection === "users" ? user : null };
  } catch {
    return { payload, user: null };
  }
}

/* ------------------------------------------------------------------ */

export const PER_PAGE = 40;

export type OrderFilters = {
  status?: string;
  payment?: string;
  q?: string;
  page?: number;
};

export type OrderRow = {
  number: string;
  placedAt: string;
  status: Order["status"];
  paymentStatus: Order["paymentStatus"];
  channel: NonNullable<Order["channel"]>;
  customerName: string;
  customerPhone: string;
  placeOfSupply: string;
  lineCount: number;
  units: number;
  grandTotal: number;
  invoiceNumber: string | null;
};

export type OrderPage = {
  rows: OrderRow[];
  total: number;
  page: number;
  pages: number;
};

function toRow(o: Order): OrderRow {
  return {
    // `number` is nullable in the generated type because the hook assigns it on
    // create rather than the schema. By the time a row can be read it is set.
    number: o.number ?? String(o.id),
    placedAt: o.placedAt ?? o.createdAt,
    status: o.status,
    paymentStatus: o.paymentStatus,
    channel: o.channel ?? "web",
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    placeOfSupply: o.placeOfSupply,
    lineCount: o.lines.length,
    units: o.lines.reduce((n, l) => n + l.qty, 0),
    grandTotal: o.grandTotal,
    invoiceNumber: o.invoiceNumber ?? null,
  };
}

/**
 * The ledger, newest first.
 *
 * Filtering and paging happen in Postgres rather than in the browser — the
 * opposite of `/admin/products`, and for the opposite reason. The catalogue is
 * a fixed few thousand rows whose whole value is instant filtering; orders
 * grow without limit and nobody needs keystroke-latency on last March.
 */
export async function listOrders(f: OrderFilters = {}): Promise<OrderPage> {
  const { payload, user } = await staffPayload();
  const page = Math.max(1, f.page ?? 1);
  if (!user) return { rows: [], total: 0, page, pages: 0 };

  const and: Where[] = [];
  if (f.status) and.push({ status: { equals: f.status } });
  if (f.payment) and.push({ paymentStatus: { equals: f.payment } });

  const q = f.q?.trim();
  if (q) {
    // Three fields because staff arrive holding one of three things: the number
    // off an email, the phone number of whoever is on the line, or a name.
    and.push({
      or: [
        { number: { contains: q } },
        { customerPhone: { contains: q } },
        { customerName: { contains: q } },
      ],
    });
  }

  const res = await payload.find({
    collection: "orders",
    where: and.length ? { and } : {},
    sort: "-placedAt",
    limit: PER_PAGE,
    page,
    depth: 0,
    user,
    overrideAccess: false,
  });

  return {
    rows: res.docs.map(toRow),
    total: res.totalDocs,
    page: res.page ?? page,
    pages: res.totalPages,
  };
}

/** One order, whole, including the timeline and staff notes. */
export async function getOrderAdmin(number: string): Promise<Order | null> {
  const { payload, user } = await staffPayload();
  if (!user) return null;

  const { docs } = await payload.find({
    collection: "orders",
    where: { number: { equals: number } },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  });

  return docs[0] ?? null;
}

/* ------------------------------------------------------------------ */

export type CustomerRow = {
  id: number;
  name: string;
  /**
   * Null for a buyer who signed in with Google and has not checked out yet —
   * Google gives us a verified email and no phone. The admin customer list has
   * to render that rather than assume every row has one.
   */
  phone: string | null;
  email: string | null;
  company: string | null;
  gstin: string | null;
  tier: NonNullable<Customer["tier"]>;
  orderCount: number;
  lifetimeValue: number;
};

export type CustomerPage = {
  rows: CustomerRow[];
  total: number;
  page: number;
  pages: number;
};

/**
 * Buyers, by spend.
 *
 * `orderCount` and `lifetimeValue` are maintained by checkout and read
 * straight off the row — no aggregate over `orders`. That is a denormalisation
 * and it is the right one here: the alternative is a group-by across every
 * order ever placed to render a list page.
 */
export async function listCustomers(f: { q?: string; page?: number } = {}): Promise<CustomerPage> {
  const { payload, user } = await staffPayload();
  const page = Math.max(1, f.page ?? 1);
  if (!user) return { rows: [], total: 0, page, pages: 0 };

  const q = f.q?.trim();
  const where: Where = q
    ? {
        or: [
          { phone: { contains: q } },
          { name: { contains: q } },
          { company: { contains: q } },
          { gstin: { contains: q } },
        ],
      }
    : {};

  const res = await payload.find({
    collection: "customers",
    where,
    sort: "-lifetimeValue",
    limit: PER_PAGE,
    page,
    depth: 0,
    user,
    overrideAccess: false,
  });

  return {
    rows: res.docs.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? null,
      email: c.email ?? null,
      company: c.company ?? null,
      gstin: c.gstin ?? null,
      tier: c.tier ?? "retail",
      orderCount: c.orderCount ?? 0,
      lifetimeValue: c.lifetimeValue ?? 0,
    })),
    total: res.totalDocs,
    page: res.page ?? page,
    pages: res.totalPages,
  };
}

/* ------------------------------------------------------------------ */

/*
  Dates are formatted on the server, in Asia/Kolkata, which is a deliberate
  departure from the storefront rule of shipping UTC and letting the browser
  decide. The rule exists so a buyer in Chennai and a buyer in Berlin each see
  their own clock. This console is one desk in one warehouse in Peenya, where
  "when did this arrive" always means IST — so naming the zone once here is
  both correct and one fewer client component in a tree that has none.
*/
const STAMP = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DAY = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export const ist = (iso: string) => STAMP.format(new Date(iso));
export const istDay = (iso: string) => DAY.format(new Date(iso));
