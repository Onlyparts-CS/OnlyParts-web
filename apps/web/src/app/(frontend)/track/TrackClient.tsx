"use client";

import Link from "next/link";
import { useState } from "react";
import { trackOrder, type TrackResult } from "./actions";
import { inr } from "@/lib/catalog";
import { PageHeader } from "@/components/PageHeader";
import { TruckIcon, CheckIcon, SearchIcon } from "@/components/Icons";

/**
 * The happy path, in order. `cancelled` and `returned` leave it entirely and
 * are rendered as their own state rather than as a stalled step — a cancelled
 * order is not "stuck at packed".
 */
const STAGES = [
  { key: "pending", label: "Order confirmed" },
  { key: "confirmed", label: "Preparing" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
] as const;

export function TrackClient() {
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<TrackResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSearch = number.trim().length > 0 && phone.length === 10;

  const search = async () => {
    if (!canSearch || busy) return;
    setBusy(true);
    setFound(await trackOrder(number, phone));
    setSearched(true);
    setBusy(false);
  };

  const reached = found ? STAGES.findIndex((s) => s.key === found.status) : -1;
  const offPath = found?.status === "cancelled" || found?.status === "returned";

  return (
    <>
      <PageHeader
        title="Track an order"
        lead="Your order number and the mobile you ordered with. Works from any device — you don't need the browser you bought from."
      />

      <div className="container-page page-shell">
        <div className="mx-auto max-w-xl">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_auto]">
            <div className="flex h-11 items-center gap-2.5 rounded-sm border border-line bg-surface px-3 focus-within:border-spot-600">
              <SearchIcon className="size-4 shrink-0 text-spot-600" />
              <input
                value={number}
                onChange={(e) => { setNumber(e.target.value); setSearched(false); }}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="OP-2627-000001"
                className="h-full w-full bg-transparent font-mono text-[0.9375rem] text-heading outline-none placeholder:text-disabled"
                aria-label="Order number"
              />
            </div>

            <div className="flex h-11 items-center rounded-sm border border-line bg-surface focus-within:border-spot-600">
              <span className="pl-3 font-mono text-[0.8125rem] text-disabled">+91</span>
              <input
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setSearched(false); }}
                onKeyDown={(e) => e.key === "Enter" && search()}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="9876543210"
                className="h-full w-full bg-transparent px-2 font-mono text-[0.9375rem] text-heading outline-none placeholder:text-disabled"
                aria-label="Mobile number used for the order"
              />
            </div>

            <button onClick={search} disabled={!canSearch || busy}
              className="btn btn-primary disabled:opacity-50">
              {busy ? "Checking…" : "Track"}
            </button>
          </div>

          {searched && !found && (
            <div className="mt-6 rounded-md border border-line bg-surface px-6 py-10 text-center">
              <h2 className="text-base">No order matches that</h2>
              <p className="mx-auto mt-2 max-w-sm text-[0.875rem] text-muted">
                Check the number against your confirmation, and that the mobile is the
                one you ordered with. Order numbers look like{" "}
                <span className="font-mono">OP-2627-000001</span>.
              </p>
              <Link href="/contact" className="btn btn-secondary btn-sm mt-5">Contact support</Link>
            </div>
          )}

          {found && (
            <div className="mt-6 rounded-md border border-line bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
                <div>
                  <p className="font-mono text-[0.9375rem] text-heading">{found.number}</p>
                  <p className="mt-0.5 text-[0.75rem] text-faint">
                    {new Date(found.placedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    {" · "}{found.itemCount} {found.itemCount === 1 ? "item" : "items"}
                    {found.paymentStatus !== "paid" && found.paymentMethod === "cod" && " · pay on delivery"}
                  </p>
                </div>
                <span className="font-display text-lg font-bold tnum text-heading">{inr(found.grand)}</span>
              </div>

              {offPath ? (
                <p className="p-5 text-[0.875rem] text-muted">
                  This order was{" "}
                  <span className="font-medium text-heading">
                    {found.status === "cancelled" ? "cancelled" : "returned"}
                  </span>
                  . If a refund is due it goes back to the original payment method.
                </p>
              ) : (
                <ol className="p-5">
                  {STAGES.map((s, i) => {
                    const done = i < reached;
                    const active = i === reached;
                    return (
                      <li key={s.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[0.625rem] font-bold ${
                            done ? "bg-success text-white" : active ? "bg-spot-600 text-on-accent" : "border border-line bg-surface text-disabled"
                          }`}>
                            {done ? <CheckIcon className="size-3" /> : i + 1}
                          </span>
                          {i < STAGES.length - 1 && (
                            <span className={`w-px flex-1 ${done ? "bg-success" : "bg-line"}`} style={{ minHeight: 20 }} />
                          )}
                        </div>
                        <span className={`pb-4 text-[0.875rem] ${active ? "font-medium text-heading" : done ? "text-body" : "text-disabled"}`}>
                          {s.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}

              <div className="flex flex-wrap gap-2 border-t border-line p-4">
                <Link href={`/orders/${found.number}`} className="btn btn-secondary btn-sm">View order &amp; invoice</Link>
                <Link href="/contact" className="btn btn-ghost btn-sm">Something wrong?</Link>
              </div>
              <p className="px-4 pb-4 text-[0.6875rem] text-faint">
                The full invoice opens only in the browser the order was placed from.
              </p>
            </div>
          )}

          <div className="mt-8 flex items-start gap-3 rounded-md border border-line bg-surface p-4">
            <TruckIcon className="mt-0.5 size-5 shrink-0 text-spot-600" />
            <p className="text-[0.8125rem] leading-relaxed text-muted">
              If a line in your order is going to be late, we tell you on the day we
              know — by email and WhatsApp, with a new date. You should never have to
              come here to find that out.
            </p>
          </div>

          <p className="mt-6 text-center text-[0.875rem] text-muted">
            Ordered from this browser? <Link href="/account" className="text-spot-700 hover:underline">Your orders are here</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
