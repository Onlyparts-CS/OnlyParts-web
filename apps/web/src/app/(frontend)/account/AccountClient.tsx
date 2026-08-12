"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useStore, signOut, updateUser, removeAddress, saveAddress, addToCart,
} from "@/lib/store";
import type { OrderView } from "@/lib/orderRead";
import { STATES, isValidGstin } from "@/lib/gst";
import { inr } from "@/lib/catalog";
import { UserIcon, BoxIcon, InvoiceIcon, ArrowRight, CheckIcon } from "@/components/Icons";
import { Shell } from "@/components/auth/AuthShell";
import { exportMyOrders } from "./actions";

type Tab = "orders" | "addresses" | "profile";

/** Fulfilment, in the buyer's words rather than the database's. */
const STATUS_LABEL: Record<OrderView["status"], string> = {
  pending: "Confirming",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

/**
 * What the server says about who is signed in.
 *
 * Passed down rather than read from the store: `state.user` is a localStorage
 * cache the browser owns, and this screen shows order history and a GSTIN. The
 * cache may lag or be edited; the prop cannot.
 */
export type SessionUser = {
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  company: string | null;
};

export function AccountClient({ orders, session }: { orders: OrderView[]; session: SessionUser | null }) {
  const [tab, setTab] = useState<Tab>("orders");
  const user = session;

  /*
    Signed out *and* nothing to show — only then is this a sign-in screen.

    Guest checkout is the common path, and those orders are real and readable
    (the signed cookie says this browser placed them). Gating them behind a
    prototype sign-in would send somebody who just paid to a login wall for
    their own receipt.
  */
  if (!user && !orders.length) {
    return (
      <Shell
        title="Sign in to your account"
        lead="Track orders, download GST invoices, save addresses and reorder a BOM in one click."
      >
        <ul className="grid gap-3">
          {[
            [<BoxIcon key="b" className="size-4" />, "Every order, with its dispatch and tracking"],
            [<InvoiceIcon key="i" className="size-4" />, "GST invoices to download whenever you need them"],
            [<UserIcon key="u" className="size-4" />, "Saved addresses and your GSTIN, applied automatically"],
          ].map(([icon, text], i) => (
            <li key={i} className="flex items-start gap-2.5 text-[0.875rem] leading-relaxed text-body">
              <span className="mt-0.5 shrink-0 text-spot-600">{icon}</span>
              {text}
            </li>
          ))}
        </ul>
        <div className="mt-6 grid gap-2 border-t border-line pt-5 sm:grid-cols-2">
          <Link href="/login?next=/account" className="btn btn-primary btn-sm">Sign in</Link>
          <Link href="/register" className="btn btn-secondary btn-sm">Create account</Link>
        </div>
      </Shell>
    );
  }

  return (
    <div className="container-page page-shell">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.5rem,3vw,2.25rem)]">{user ? user.name : "Your orders"}</h1>
          {user ? (
            <p className="mt-1 font-mono text-[0.8125rem] text-faint">
              {user.email}{user.phone && <> · +91 {user.phone}</>}
              {user.gstin && <> · GSTIN {user.gstin}</>}
            </p>
          ) : (
            <p className="mt-1 text-[0.8125rem] text-muted">
              Placed from this browser as a guest.{" "}
              <Link href="/login" className="text-spot-700 hover:underline">Sign in with Google</Link>{" "}
              to keep them anywhere you sign in.
            </p>
          )}
        </div>
        {/*
          A form, not an onClick. Ending the session means clearing an httpOnly
          cookie, which only the server can do — the old handler cleared a
          localStorage key and left any real session untouched. `signOut()`
          still runs, to drop the local cache in the same gesture.
        */}
        {user && (
          <form action="/api/auth/signout" method="post" onSubmit={() => signOut()}>
            <button type="submit" className="btn btn-secondary btn-sm">Sign out</button>
          </form>
        )}
      </header>

      <div className="mb-6 flex gap-1 border-b border-line">
        {([["orders", "Orders"], ["addresses", "Addresses"], ["profile", "Profile & GST"]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} aria-current={tab === k}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[0.875rem] font-medium transition-colors ${
              tab === k ? "border-spot-600 text-heading" : "border-transparent text-muted hover:text-heading"
            }`}>
            {label}
            {k === "orders" && orders.length > 0 && (
              <span className="ml-1.5 font-mono text-[0.6875rem] text-spot-700">{orders.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "orders" && <Orders orders={orders} />}
      {tab === "addresses" && <Addresses />}
      {tab === "profile" && <Profile />}
    </div>
  );
}

/* ---------------- orders ---------------- */

function Orders({ orders }: { orders: OrderView[] }) {
  if (!orders.length) {
    return (
      <Empty icon={<BoxIcon className="size-6" />} title="No orders yet"
        body="Your orders and GST invoices will appear here." cta="Browse categories" href="/c" />
    );
  }

  const reorder = (skus: { sku: string; qty: number }[]) =>
    skus.forEach((l) => addToCart(l.sku, l.qty));

  return (
    <div className="grid gap-4">
      {orders.map((o) => (
        <article key={o.number} className="rounded-md border border-line bg-surface">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-4">
            <div>
              <Link href={`/orders/${o.number}`} className="font-mono text-[0.9375rem] text-heading hover:text-spot-700">
                {o.number}
              </Link>
              <p className="mt-0.5 text-[0.75rem] text-faint">
                {new Date(o.placedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                {" · "}{o.lines.length} {o.lines.length === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/*
                Two chips, because fulfilment and payment are two facts and a
                COD parcel is shipped-and-unpaid at the same time. One combined
                badge has to lie about that.
              */}
              <span className="inline-flex items-center gap-1.5 rounded-xs bg-sunken px-2 py-1 text-[0.6875rem] font-medium text-body">
                {STATUS_LABEL[o.status]}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-xs px-2 py-1 text-[0.6875rem] font-medium ${
                o.paymentStatus === "paid" ? "bg-success-bg text-success" : "bg-warning-bg text-warning"
              }`}>
                {o.paymentStatus === "paid" && <CheckIcon className="size-3" />}
                {o.paymentStatus === "paid"
                  ? "Paid"
                  : o.paymentMethod === "cod" ? "Pay on delivery" : "Payment pending"}
              </span>
              <span className="font-display text-lg font-bold tnum text-heading">{inr(o.grand)}</span>
            </div>
          </header>

          <ul className="divide-y divide-line">
            {o.lines.slice(0, 3).map((l) => (
              <li key={l.sku} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[0.8125rem] text-body">{l.title}</span>
                  <span className="block font-mono text-[0.625rem] text-disabled">⌗ {l.sku} · HSN {l.hsn}</span>
                </span>
                <span className="shrink-0 font-mono text-[0.75rem] tnum text-faint">
                  {l.qty} × {inr(l.unitPrice)}
                </span>
              </li>
            ))}
            {o.lines.length > 3 && (
              <li className="px-4 py-2 font-mono text-[0.6875rem] text-faint">
                + {o.lines.length - 3} more
              </li>
            )}
          </ul>

          <footer className="flex flex-wrap gap-2 border-t border-line p-3">
            <Link href={`/orders/${o.number}`} className="btn btn-secondary btn-sm">
              <InvoiceIcon className="size-3.5" /> {o.invoiceNumber ? "GST invoice" : "View order"}
            </Link>
            <button onClick={() => reorder(o.lines.map((l) => ({ sku: l.sku, qty: l.qty })))}
              className="btn btn-secondary btn-sm">
              Reorder
            </button>
            {o.invoiceNumber && (
              <span className="ml-auto self-center font-mono text-[0.625rem] text-disabled">
                {o.invoiceNumber}
              </span>
            )}
          </footer>
        </article>
      ))}
    </div>
  );
}

/* ---------------- addresses ---------------- */

function Addresses() {
  const { addresses } = useStore();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ label: "Home", name: "", phone: "", line1: "", line2: "", city: "", pincode: "", stateCode: "" });

  const add = () => {
    if (!f.name || !f.line1 || !f.city || !/^\d{6}$/.test(f.pincode) || !f.stateCode) return;
    saveAddress({ ...f, isDefault: addresses.length === 0 });
    setAdding(false);
    setF({ label: "Home", name: "", phone: "", line1: "", line2: "", city: "", pincode: "", stateCode: "" });
  };

  return (
    <div>
      {addresses.length === 0 && !adding ? (
        <Empty icon={<BoxIcon className="size-6" />} title="No saved addresses"
          body="Addresses you use at checkout are saved here." cta="Add an address" onClick={() => setAdding(true)} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-md border border-line bg-surface p-4">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">{a.label}</span>
                {a.isDefault && <span className="rounded-xs bg-spot-50 px-1.5 py-0.5 text-[0.625rem] text-spot-800">Default</span>}
              </div>
              <p className="text-[0.875rem] leading-relaxed text-body">
                <span className="font-medium text-heading">{a.name}</span><br />
                {a.line1}{a.line2 && <>, {a.line2}</>}<br />
                {a.city} {a.pincode}<br />
                {STATES.find((s) => s.code === a.stateCode)?.name}
              </p>
              <button onClick={() => removeAddress(a.id)}
                className="mt-3 text-[0.75rem] text-faint hover:text-danger hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="mt-4 rounded-md border border-line bg-surface p-5">
          <h2 className="mb-4 text-base">New address</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <In label="Label" v={f.label} on={(v) => setF({ ...f, label: v })} />
            <In label="Name" v={f.name} on={(v) => setF({ ...f, name: v })} />
            <div className="sm:col-span-2"><In label="Address line 1" v={f.line1} on={(v) => setF({ ...f, line1: v })} /></div>
            <div className="sm:col-span-2"><In label="Address line 2" v={f.line2} on={(v) => setF({ ...f, line2: v })} /></div>
            <In label="City" v={f.city} on={(v) => setF({ ...f, city: v })} />
            <In label="PIN code" v={f.pincode} on={(v) => setF({ ...f, pincode: v.replace(/\D/g, "").slice(0, 6) })} />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">State</label>
              <select value={f.stateCode} onChange={(e) => setF({ ...f, stateCode: e.target.value })}
                className="h-11 w-full rounded-sm border border-line bg-surface px-3 text-[0.9375rem] text-heading outline-none focus:border-spot-600">
                <option value="">Select state…</option>
                {STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={add} className="btn btn-primary btn-sm">Save address</button>
            <button onClick={() => setAdding(false)} className="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      ) : addresses.length > 0 && (
        <button onClick={() => setAdding(true)} className="btn btn-secondary btn-sm mt-4">Add another address</button>
      )}
    </div>
  );
}

/* ---------------- profile ---------------- */

function Profile() {
  const { user } = useStore();
  const [company, setCompany] = useState(user?.company ?? "");
  const [gstin, setGstin] = useState(user?.gstin ?? "");
  const [saved, setSaved] = useState(false);
  const invalid = gstin.length > 0 && !isValidGstin(gstin);

  return (
    <div className="max-w-lg">
      <div className="rounded-md border border-line bg-surface p-5">
        <h2 className="mb-1 text-base">Business & GST</h2>
        <p className="mb-4 text-[0.8125rem] text-muted">
          Saved here once, applied to every invoice automatically — no re-typing at checkout.
        </p>
        <div className="grid gap-3">
          <In label="Company name" v={company} on={setCompany} />
          <div>
            <In label="GSTIN" v={gstin} on={(v) => { setGstin(v.toUpperCase().slice(0, 15)); setSaved(false); }} mono />
            {invalid && <p className="mt-1 text-[0.75rem] text-danger">That GSTIN doesn&apos;t look valid.</p>}
          </div>
        </div>
        <button
          onClick={() => { if (!invalid) { updateUser({ company, gstin: gstin || undefined }); setSaved(true); } }}
          disabled={invalid}
          className="btn btn-primary btn-sm mt-4 disabled:opacity-50">
          {saved ? <><CheckIcon className="size-3.5" /> Saved</> : "Save"}
        </button>
      </div>

      <DataSection />
    </div>
  );
}

/* ---------------- shared ---------------- */

function In({ label, v, on, mono }: { label: string; v: string; on: (s: string) => void; mono?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">{label}</label>
      <input value={v} onChange={(e) => on(e.target.value)}
        className={`h-11 w-full rounded-sm border border-line bg-surface px-3 text-[0.9375rem] text-heading outline-none focus:border-spot-600 ${mono ? "font-mono" : ""}`} />
    </div>
  );
}

function Empty({ icon, title, body, cta, href, onClick }: {
  icon: React.ReactNode; title: string; body: string; cta: string; href?: string; onClick?: () => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-spot-50 text-spot-600">{icon}</span>
      <h2 className="text-lg">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{body}</p>
      {href ? (
        <Link href={href} className="btn btn-primary btn-sm mt-5">{cta} <ArrowRight className="size-3.5" /></Link>
      ) : (
        <button onClick={onClick} className="btn btn-primary btn-sm mt-5">{cta}</button>
      )}
    </div>
  );
}

/**
 * DPDP export, and an honest account of why deletion is not beside it.
 *
 * The export merges two halves: the orders the server can prove this browser
 * placed, and everything the browser itself holds. Both are the person's data
 * and a file containing only one of them would be a partial answer to a legal
 * request.
 */
function DataSection() {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const exportAll = async () => {
    setBusy(true);
    setDone(false);
    try {
      const server = await exportMyOrders();
      const payload = {
        generatedAt: server.generatedAt,
        note:
          "Everything OnlyParts holds for this browser. Orders come from the server; " +
          "the rest is stored locally on this device and never left it.",
        orders: server.orders,
        local: {
          profile: store.user,
          addresses: store.addresses,
          cart: store.cart,
          wishlist: store.wishlist,
          reviews: store.reviews,
          rfqs: store.rfqs,
        },
      };
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      );
      a.download = `onlyparts-my-data-${server.generatedAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-md border border-line bg-surface p-5">
      <h2 className="mb-1 text-base">Your data</h2>
      <p className="mb-4 text-[0.8125rem] leading-relaxed text-muted">
        Under the DPDP Act you can export everything we hold. That is an obligation,
        not a feature.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={exportAll} disabled={busy} className="btn btn-secondary btn-sm disabled:opacity-50">
          {busy ? "Gathering…" : "Export my data"}
        </button>
        {done && <span className="font-mono text-[0.75rem] text-success">Downloaded</span>}
      </div>

      {/*
        No delete button. Two reasons, and neither is that it was forgotten —
        saying so is more use than a control that would fail.
      */}
      <p className="mt-4 border-t border-line pt-3 text-[0.75rem] leading-relaxed text-faint">
        Deletion is handled by request rather than by a button, for two reasons. A tax
        invoice must be kept for six years under GST, so an order can be anonymised but
        never removed. And sign-in here is still a prototype that accepts any six
        digits, which is not an identity anyone should be allowed to erase an account
        against. Email{" "}
        <a href="mailto:privacy@onlyparts.in" className="text-spot-700 hover:underline">
          privacy@onlyparts.in
        </a>{" "}
        and it is done by hand, with the invoice record retained as the law requires.
      </p>
    </div>
  );
}
