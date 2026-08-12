"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceOrder, markPayment, addOrderNote } from "../actions";
import type { Order } from "@/payload-types";

type Status = Order["status"];
type Payment = Order["paymentStatus"];

/**
 * The three things somebody does to an order at a desk.
 *
 * Laid out as one row of buttons rather than a form, because the fulfilment
 * step is the overwhelmingly common action and it should cost one click. The
 * note is shared: whatever is typed there is attached to whichever button is
 * pressed, so "shipped — Delhivery AWB 8829" is one action rather than two.
 *
 * The buttons only offer legal transitions, read from the same
 * `ORDER_TRANSITIONS` table the collection enforces on save. When a state is
 * terminal there are no buttons at all, which is the honest way to say a thing
 * cannot be done.
 */
export function OrderControls({ number, status, paymentStatus, next }: {
  number: string;
  status: Status;
  paymentStatus: Payment;
  next: readonly Status[];
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) { setError(res.error); return; }
      setError("");
      setNote("");
      router.refresh();
    });

  /*
    Payment states a person legitimately sets by hand. `authorized` and
    `failed` belong to the gateway and are deliberately absent — a human
    asserting "the gateway authorised this" is a claim nothing can check.
  */
  const payments: Payment[] = paymentStatus === "paid"
    ? ["refunded", "partially_refunded"]
    : ["paid"];

  return (
    <section className="section-gap border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <span className="bin shrink-0">Fulfilment</span>
        {next.length === 0 ? (
          <span className="text-[0.8125rem] text-faint">
            {status} is final — a correction is a credit note, not an edit.
          </span>
        ) : (
          next.map((s) => (
            <button
              key={s}
              disabled={pending}
              onClick={() => run(() => advanceOrder(number, s, note))}
              className={`btn btn-sm disabled:opacity-40 ${
                s === "cancelled" || s === "returned" ? "btn-secondary" : "btn-primary"
              }`}
            >
              Mark {s}
            </button>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <span className="bin shrink-0">Payment</span>
        {payments.map((p) => (
          <button
            key={p}
            disabled={pending}
            onClick={() => run(() => markPayment(number, p, note))}
            className="btn btn-secondary btn-sm disabled:opacity-40"
          >
            Mark {p.replace(/_/g, " ")}
          </button>
        ))}
        {paymentStatus !== "paid" && (
          <span className="text-[0.75rem] text-faint">
            Marking paid issues the tax invoice number and freezes the figures.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="AWB number, who called, why it was cancelled…"
          aria-label="Note for the timeline"
          className="h-9 min-w-64 flex-1 border border-line bg-bg px-2.5 text-[0.8125rem] text-heading outline-none placeholder:text-disabled focus:border-spot-600"
        />
        <button
          disabled={pending || !note.trim()}
          onClick={() => run(() => addOrderNote(number, note))}
          className="btn btn-ghost btn-sm disabled:opacity-40"
        >
          Add note only
        </button>
      </div>

      {error && (
        <p className="border-t border-danger/30 bg-danger-bg px-4 py-2.5 text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
