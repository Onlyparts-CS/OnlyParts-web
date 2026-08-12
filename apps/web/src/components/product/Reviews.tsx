"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore, reviewsFor, hasPurchased, addReview } from "@/lib/store";
import { StarIcon, CheckIcon } from "@/components/Icons";

/**
 * Reviews for one SKU.
 *
 * The PDP already showed an aggregate rating with nothing behind it — a number
 * and a review count that led nowhere. This is what it now leads to.
 *
 * The verified badge is earned, not claimed: it is awarded only when an order in
 * this session contains the SKU. On the server that becomes a join against
 * `orders`; the rule and the meaning of the badge stay identical, so this
 * component does not change when the API arrives.
 */
export function Reviews({ sku, title, rating, ratingCount }: {
  sku: string; title: string; rating: number; ratingCount: number;
}) {
  const store = useStore();
  const mine = reviewsFor(store.reviews, sku);
  const purchased = hasPurchased(sku);
  const [open, setOpen] = useState(false);

  return (
    <section id="reviews" className="scroll-mt-28">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl">Reviews</h2>
          {/*
            No reviews is not a zero score. "0.0 from 0 buyers" beside five
            empty stars reads as a part everybody hated, when what it means is
            that nobody has bought one yet — so an unreviewed part says so and
            shows no stars at all.
          */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {ratingCount > 0 ? (
              <>
                <Stars value={rating} />
                <span className="font-mono text-[0.8125rem] text-faint">
                  {rating.toFixed(1)} from {ratingCount.toLocaleString("en-IN")} buyers
                </span>
              </>
            ) : (
              <span className="font-mono text-[0.8125rem] text-faint">
                No reviews yet — be the first to say whether it fits.
              </span>
            )}
          </div>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="btn btn-secondary btn-sm">Write a review</button>
        )}
      </div>

      {open && <Form sku={sku} title={title} purchased={purchased} onDone={() => setOpen(false)} />}

      {mine.length > 0 ? (
        <ul className="mt-4 grid gap-3">
          {mine.map((r) => (
            <li key={r.id} className="rounded-md border border-line bg-surface p-4 shadow-e1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={r.rating} />
                <h3 className="text-[0.9375rem]">{r.title}</h3>
                {r.verified && (
                  <span className="inline-flex items-center gap-1 rounded-xs bg-success-bg px-1.5 py-0.5 text-[0.625rem] font-medium text-success">
                    <CheckIcon className="size-3" /> Verified purchase
                  </span>
                )}
              </div>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-body">{r.body}</p>
              <p className="mt-2 font-mono text-[0.6875rem] text-faint">
                {r.author} · {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        !open && (
          <div className="mt-4 rounded-md border border-dashed border-line-strong bg-surface px-5 py-8 text-center">
            <p className="text-[0.9375rem] text-muted">
              No written reviews for this part yet.
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-[0.8125rem] leading-relaxed text-faint">
              If you have used it, the useful thing to say is what you fitted it to and
              whether the dimensions matched the spec.
            </p>
          </div>
        )
      )}
    </section>
  );
}

function Form({ sku, title, purchased, onDone }: {
  sku: string; title: string; purchased: boolean; onDone: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const ok = headline.trim().length > 2 && body.trim().length > 9 && author.trim().length > 1;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        addReview({ sku, rating, title: headline.trim(), body: body.trim(), author: author.trim() });
        onDone();
      }}
      className="rounded-md border border-spot-200 bg-spot-50/60 p-5"
    >
      <h3 className="text-base text-spot-900">Review {title}</h3>

      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
        <fieldset>
          <legend className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">Rating</legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)}
                aria-label={`${n} star${n === 1 ? "" : "s"}`} aria-pressed={rating === n}
                className="rounded-xs p-0.5">
                <StarIcon className={`size-6 ${n <= rating ? "text-warning" : "text-disabled opacity-40"}`} />
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">Your name</span>
          <input value={author} onChange={(e) => setAuthor(e.target.value)}
            className="h-10 w-full rounded-sm border border-line bg-surface px-3 text-[0.875rem] text-heading outline-none focus:border-spot-600" />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">Headline</span>
        <input value={headline} onChange={(e) => setHeadline(e.target.value)}
          placeholder="Dimensions matched the drawing"
          className="h-10 w-full rounded-sm border border-line bg-surface px-3 text-[0.875rem] text-heading outline-none placeholder:text-disabled focus:border-spot-600" />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">What did you fit it to?</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
          placeholder="Used these on a 3D printer hotend mount. Thread pitch was exact and the heads seated flush."
          className="w-full rounded-sm border border-line bg-surface p-3 text-[0.875rem] leading-relaxed text-heading outline-none placeholder:text-disabled focus:border-spot-600" />
      </label>

      <p className="mt-3 text-[0.75rem] leading-relaxed text-muted">
        {purchased
          ? "We can see an order for this part, so your review will be marked as a verified purchase."
          : "No order for this part in this session, so it will publish without a verified badge. We do not award the badge on request."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={!ok} className="btn btn-primary btn-sm disabled:opacity-40">Publish review</button>
        <button type="button" onClick={onDone} className="btn btn-ghost btn-sm">Cancel</button>
      </div>

      <p className="mt-3 border-t border-spot-200 pt-3 text-[0.75rem] text-faint">
        Reviews stay in this browser until the API is live — see{" "}
        <Link href="/policies/privacy" className="underline underline-offset-2">how we handle your data</Link>.
      </p>
    </form>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5 text-warning" aria-label={`${value.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon key={i} className={`size-3.5 ${i < Math.round(value) ? "" : "opacity-25"}`} />
      ))}
    </span>
  );
}
