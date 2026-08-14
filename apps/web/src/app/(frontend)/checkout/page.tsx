"use client";

import Link from "next/link";
import { DeadEnd } from "@/components/DeadEnd";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { useStore, saveAddress, clearCart, recordPurchase } from "@/lib/store";
import { submitOrder } from "./actions";
import { useResolvedCart } from "@/lib/useCatalogue";
import { toInvoiceLines } from "@/lib/cartMath";
import {
  totalsFor, STATES, SELLER_STATE, isValidGstin, stateFromGstin, stateFromPincode,
} from "@/lib/gst";
import { inr } from "@/lib/catalog";
import { InvoiceIcon, TruckIcon } from "@/components/Icons";

type Method = "upi" | "card" | "netbanking";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, user } = useStore();
  const { lines: items } = useResolvedCart(cart);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [wantsGst, setWantsGst] = useState(Boolean(user?.gstin));
  const [gstin, setGstin] = useState(user?.gstin ?? "");
  const [company, setCompany] = useState(user?.company ?? "");
  const [method, setMethod] = useState<Method>("upi");
  const [placing, setPlacing] = useState(false);
  const [touched, setTouched] = useState(false);
  /*
    What the server rejected. Kept apart from the local `errors` because the
    two know different things: the browser can check that a PIN code is six
    digits, but only the server knows the last one just sold out.
  */
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  // Place of supply is the delivery state — that single value decides whether
  // this is CGST+SGST or IGST (docs/06 §8.2).
  const placeOfSupply = stateCode || SELLER_STATE;

  const { lines, totals } = useMemo(() => {
    const l = toInvoiceLines(items, placeOfSupply);
    return { lines: l, totals: totalsFor(l, placeOfSupply) };
  }, [items, placeOfSupply]);

  const gstinValid = !wantsGst || isValidGstin(gstin);
  const gstinStateMismatch = wantsGst && isValidGstin(gstin) && stateCode && stateFromGstin(gstin) !== stateCode;

  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = "Required";
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email";
  if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, ""))) errors.phone = "10-digit Indian mobile";
  if (!line1.trim()) errors.line1 = "Required";
  if (!city.trim()) errors.city = "Required";
  if (!/^\d{6}$/.test(pincode)) errors.pincode = "6-digit PIN";
  if (!stateCode) errors.stateCode = "Required";
  if (wantsGst && !gstinValid) errors.gstin = "Invalid GSTIN";
  const valid = Object.keys(errors).length === 0;

  const onPincode = (v: string) => {
    const p = v.replace(/\D/g, "").slice(0, 6);
    setPincode(p);
    if (p.length === 6 && !stateCode) {
      const guess = stateFromPincode(p);
      if (guess) setStateCode(guess);
    }
  };

  // `placing` holds this open across the redirect: the cart is emptied on
  // success, and without it the buyer would see "nothing to check out" flash
  // between the order being placed and the receipt arriving.
  if (!items.length && !placing) {
    return (
      <DeadEnd
        label="Checkout · empty"
        title="Nothing to check out"
        plate="screw"
        actions={<>
          <Link href="/c" className="btn btn-primary">Open the cabinet</Link>
          <Link href="/make/rfq" className="btn btn-secondary">Get a part made</Link>
        </>}
      >
        <p>
          The cart is empty, so there is no order to price. Nothing was lost — a cart
          lives in this browser and comes back the moment you add to it again.
        </p>
      </DeadEnd>
    );
  }

  /*
    The order is placed by the server, and the server prices it.

    What goes up is SKUs, quantities and where to send it — no prices, no tax,
    no total. Every figure on the invoice is re-derived in `lib/orders.ts`
    against the catalogue, so the summary on the right is a quote, not an
    instruction. The two can legitimately differ if a price moved while this
    page was open, and when they do the server's number is the real one.
  */
  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setPlacing(true);
    setServerErrors({});

    // The address book is a local convenience and stays local. It is not what
    // the order is built from.
    saveAddress({ label: "Delivery", name, phone, line1, line2, city, stateCode, pincode, isDefault: true });

    // `items`, not `cart` — anything delisted has already been dropped from
    // the rows the buyer is looking at, so sending the raw cart would fail the
    // whole order over a line they cannot see.
    const result = await submitOrder({
      cart: items.map(({ sku, qty }) => ({ sku: sku.sku, qty })),
      contact: { name, phone, email, gstin: wantsGst ? gstin.toUpperCase() : undefined },
      shipTo: { name, phone, line1, line2, city, stateCode, pincode },
      paymentMethod: method,
    });

    if (!result.ok) {
      setServerErrors(result.errors);
      setPlacing(false);
      return;
    }

    recordPurchase(items.map(({ sku }) => sku.sku));
    clearCart();
    router.push(`/orders/${result.number}`);
  };

  // A server rejection outranks a local one: it is the newer and better-informed
  // answer about the same field.
  const err = (k: string) => serverErrors[k] ?? (touched ? errors[k] : undefined);

  /** Rejections that belong to the order rather than to one field. */
  const orderError = serverErrors.cart ?? serverErrors._;

  return (
    <div className="container-page page-shell">
      <h1 className="mb-6 text-[clamp(1.5rem,3vw,2.25rem)]">Checkout</h1>

      {/*
        `minmax(0,1fr)`, not `1fr`.

        A bare `grid` column is `auto`, whose minimum track size is the
        min-content of its items — and at mobile this is a single column holding
        both the form and the order summary. A product title in the summary
        ("608ZZ Deep Groove Ball Bearing — ID 8 · OD 22 · W 7") has a min-content
        width of ~408px, so the column refused to go below 442px and the entire
        checkout scrolled sideways on a 390px phone: every field was 400px wide
        inside a 350px container. `minmax(0,…)` removes the min-content floor and
        lets the summary truncate as it was already told to.
      */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 grid gap-4">
          {/* 1 — contact */}
          <Block n={1} title="Contact">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" value={name} onChange={setName} error={err("name")} autoComplete="name" />
              <Field label="Mobile" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
                error={err("phone")} inputMode="numeric" prefix="+91" autoComplete="tel" />
              <div className="sm:col-span-2">
                <Field label="Email" value={email} onChange={setEmail} error={err("email")} type="email" autoComplete="email" />
              </div>
            </div>
            {!user && (
              <p className="mt-3 text-[0.75rem] text-faint">
                Checking out as a guest. <Link href="/login" className="text-spot-700 underline">Sign in</Link> to use saved addresses.
              </p>
            )}
          </Block>

          {/* 2 — delivery */}
          <Block n={2} title="Delivery address">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Address line 1" value={line1} onChange={setLine1} error={err("line1")} autoComplete="address-line1" />
              </div>
              <div className="sm:col-span-2">
                <Field label="Address line 2 (optional)" value={line2} onChange={setLine2} autoComplete="address-line2" />
              </div>
              <Field label="PIN code" value={pincode} onChange={onPincode} error={err("pincode")} inputMode="numeric" autoComplete="postal-code" />
              <Field label="City" value={city} onChange={setCity} error={err("city")} autoComplete="address-level2" />
              <div className="sm:col-span-2">
                <label htmlFor="checkout-state" className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
                  State <span className="font-normal normal-case tracking-normal text-disabled">— sets place of supply</span>
                </label>
                <select
                  id="checkout-state"
                  value={stateCode} onChange={(e) => setStateCode(e.target.value)}
                  aria-invalid={err("stateCode") ? true : undefined}
                  aria-describedby={err("stateCode") ? "checkout-state-error" : undefined}
                  className={`h-11 w-full rounded-sm border bg-surface px-3 text-[0.9375rem] text-heading outline-none focus:border-spot-600 ${err("stateCode") ? "border-danger" : "border-line"}`}
                >
                  <option value="">Select state…</option>
                  {STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
                {err("stateCode") && <p id="checkout-state-error" className="mt-1 text-[0.75rem] text-danger">{err("stateCode")}</p>}
              </div>
            </div>

            {stateCode && (
              <p className="mt-3 flex items-center gap-2 rounded-sm bg-sunken px-3 py-2 font-mono text-[0.6875rem] text-faint">
                <TruckIcon className="size-3.5 shrink-0" />
                Place of supply {stateCode} · {placeOfSupply === SELLER_STATE ? "intra-state → CGST + SGST" : "inter-state → IGST"}
              </p>
            )}
          </Block>

          {/* 3 — GST */}
          <Block n={3} title="GST details" optional>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={wantsGst} onChange={(e) => setWantsGst(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-spot-600" />
              <span>
                <span className="block text-[0.875rem] text-heading">I need a GST invoice for my business</span>
                <span className="block text-[0.75rem] text-faint">Adds your GSTIN to the invoice so it books against input credit.</span>
              </span>
            </label>

            {wantsGst && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Company name" value={company} onChange={setCompany} autoComplete="organization" />
                <Field label="GSTIN" value={gstin} onChange={(v) => setGstin(v.toUpperCase().slice(0, 15))}
                  error={err("gstin")} mono placeholder="29AABCO1234M1Z5" />
                {gstinStateMismatch && (
                  <p className="sm:col-span-2 rounded-sm border border-warning/30 bg-warning-bg px-3 py-2 text-[0.75rem] text-warning">
                    Your GSTIN is registered in state {stateFromGstin(gstin)} but delivery is to state {stateCode}.
                    Input credit is claimed against the place of supply — check this is intended.
                  </p>
                )}
              </div>
            )}
          </Block>

          {/* 4 — payment */}
          <Block n={4} title="Payment">
            <div className="grid gap-2">
              {([
                ["upi", "UPI", "GPay, PhonePe, Paytm, any UPI app"],
                ["card", "Card", "Visa, Mastercard, RuPay, Amex"],
                ["netbanking", "Netbanking", "All major Indian banks"],
              ] as [Method, string, string][]).map(([k, label, hint]) => (
                <label key={k}
                  className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3 transition-colors ${
                    method === k ? "border-spot-600 bg-spot-50" : "border-line hover:bg-sunken"
                  }`}>
                  <input type="radio" name="method" checked={method === k} onChange={() => setMethod(k)}
                    className="size-4 shrink-0 accent-spot-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.875rem] font-medium text-heading">{label}</span>
                    <span className="block text-[0.75rem] text-faint">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 font-mono text-[0.625rem] text-disabled">
              Prototype — no payment is taken and no card details are collected.
            </p>
          </Block>
        </div>

        {/* ---------- summary ---------- */}
        <aside className="min-w-0 lg:sticky lg:top-40 lg:self-start">
          <div className="rounded-md border border-line bg-surface p-5">
            <h2 className="mb-4 text-base">{items.length} {items.length === 1 ? "item" : "items"}</h2>

            {/* same minmax(0,…) rule one level down: the nowrap title inside
                each row would otherwise set this grid's column floor */}
            <ul className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-2.5 border-b border-line pb-4">
              {lines.map((l) => (
                <li key={l.sku} className="flex min-w-0 items-start justify-between gap-3 text-[0.8125rem]">
                  <span className="min-w-0">
                    <span className="block truncate text-body">{l.title}</span>
                    <span className="block font-mono text-[0.625rem] text-disabled">{l.qty} × {inr(l.unitPrice)}</span>
                  </span>
                  <span className="shrink-0 font-mono tnum text-heading">{inr(l.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <dl className="grid gap-2 text-[0.875rem]">
              <SumRow label="Taxable value" value={inr(totals.taxable)} muted />
              {totals.intraState ? (
                <>
                  <SumRow label="CGST" value={inr(totals.cgst)} muted />
                  <SumRow label="SGST" value={inr(totals.sgst)} muted />
                </>
              ) : (
                <SumRow label="IGST" value={inr(totals.igst)} muted />
              )}
              <SumRow label="Shipping" value={totals.shipping === 0 ? "Free" : inr(totals.shipping)} accent={totals.shipping === 0} />
              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-medium text-heading">Total payable</dt>
                <dd className="font-display text-2xl font-bold tnum text-heading">{inr(totals.grand)}</dd>
              </div>
            </dl>

            {/*
              Above the button, not below it. This is the one message that can
              mean the order did not happen — stock going while the page was
              open — and it has to be read before the button is pressed again.
            */}
            {orderError && (
              <p role="alert" className="mt-5 rounded-sm border border-danger/30 bg-danger-bg px-3 py-2.5 text-[0.8125rem] text-danger">
                {orderError}
              </p>
            )}

            <button onClick={submit} disabled={placing}
              className="btn btn-primary mt-5 w-full disabled:opacity-60">
              {placing ? "Placing order…" : `Pay ${inr(totals.grand)}`}
            </button>

            {touched && !valid && (
              <p className="mt-2 text-center text-[0.75rem] text-danger">
                Fix the highlighted fields above.
              </p>
            )}

            <p className="mt-4 flex items-start gap-2 border-t border-line pt-4 text-[0.75rem] text-faint">
              <InvoiceIcon className="mt-0.5 size-4 shrink-0 text-spot-600" />
              A GST invoice with HSN codes is generated automatically and attached to your order.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------- form primitives ---------- */

function Block({ n, title, optional, children }: { n: number; title: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-2.5 text-base">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-spot-600 font-mono text-[0.75rem] font-bold text-on-accent">{n}</span>
        {title}
        {optional && <span className="text-[0.6875rem] font-normal text-disabled">optional</span>}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label, value, onChange, error, type = "text", mono, prefix, placeholder, inputMode, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string;
  type?: string; mono?: boolean; prefix?: string; placeholder?: string;
  inputMode?: "text" | "numeric" | "email"; autoComplete?: string;
}) {
  /*
    The label used to be a bare <label> beside the input rather than around it
    or bound to it, so it named nothing: every field on the checkout form was
    announced as an unlabelled text box. The border also carried the error on
    its own, which is colour as the sole indicator.
  */
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">{label}</label>
      <div className={`flex h-11 items-center rounded-sm border bg-surface ${error ? "border-danger" : "border-line focus-within:border-spot-600"}`}>
        {prefix && <span className="pl-3 font-mono text-[0.8125rem] text-disabled">{prefix}</span>}
        <input
          id={id}
          type={type} value={value} placeholder={placeholder} inputMode={inputMode} autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`h-full w-full bg-transparent px-3 text-[0.9375rem] text-heading outline-none placeholder:text-disabled ${mono ? "font-mono" : ""}`}
        />
      </div>
      {error && <p id={errorId} className="mt-1 text-[0.75rem] text-danger">{error}</p>}
    </div>
  );
}

function SumRow({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? "text-faint" : "text-muted"}>{label}</dt>
      <dd className={`font-mono tnum ${accent ? "text-spot-700" : muted ? "text-faint" : "text-heading"}`}>{value}</dd>
    </div>
  );
}
