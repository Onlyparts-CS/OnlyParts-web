"use client";

import { useSyncExternalStore } from "react";
import type { Rfq } from "./mod";

/**
 * Client-side store for the things that are genuinely this browser's.
 *
 * Orders are **not** here any more. They are placed by `lib/orders.ts`, priced
 * server-side and written to Postgres — a total decided by the buyer's own
 * browser was the entire attack, and localStorage could not hold a legal
 * document anyway. What is left is intent and convenience: the cart, the
 * wishlist, and the address book.
 *
 * Read as an external store (not React state) so components stay SSR-safe and
 * no effect ever has to sync state in — the pattern the React compiler flags.
 *
 * No session lives here. Sign-in is a signed httpOnly cookie issued by the
 * Google callback and read server-side — see `customerSession.ts`. Reviews are
 * still local.
 */

/** The localStorage bucket everything below lives in. Not a credential — the
    name is versioned so a shape change can be detected rather than crash. */
const STORAGE_KEY = "onlyparts:v1";

export type CartLine = { sku: string; qty: number };

export type Address = {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  stateCode: string;
  pincode: string;
  isDefault?: boolean;
};

export type User = { name: string; email: string; phone?: string; company?: string; gstin?: string };

/** One review, keyed to the SKU it was left against. */
export type Review = {
  id: string;
  sku: string;
  rating: number;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  /** true when the reviewer has an order in this browser containing the SKU */
  verified: boolean;
};

type State = {
  cart: CartLine[];
  /** SKU codes, most recently added first */
  wishlist: string[];
  user: User | null;
  addresses: Address[];
  /**
   * SKU codes this browser has actually bought — the whole of what the review
   * form needs to know. Orders themselves live in Postgres now; this is not a
   * copy of them, it is the one fact that has to survive locally so a
   * "verified purchase" badge does not require a round trip.
   */
  purchased: string[];
  rfqs: Rfq[];
  reviews: Review[];
  rfqSeq: number;
};

const EMPTY: State = {
  cart: [], wishlist: [], user: null, addresses: [], purchased: [], rfqs: [], reviews: [],
  rfqSeq: 0,
};

let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load(): State {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;

    const stored = JSON.parse(raw) as Partial<State> & { orders?: { lines?: { sku: string }[] }[] };

    /*
      Orders used to live here in full — each one carrying a name, a phone
      number and a delivery address. They are in Postgres now, so anything
      still in this browser is a stale copy of somebody's personal data that
      nothing reads. Keep the only load-bearing part (which SKUs were bought,
      for the verified-purchase badge) and delete the rest on sight.
    */
    if (stored.orders) {
      const bought = stored.orders.flatMap((o) => (o.lines ?? []).map((l) => l.sku));
      stored.purchased = [...new Set([...(stored.purchased ?? []), ...bought])];
      delete stored.orders;

      const migrated = { ...EMPTY, ...stored };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch {
        /* private mode — the stale copy outlives the session, nothing else breaks */
      }
      return migrated;
    }

    return { ...EMPTY, ...stored };
  } catch {
    return EMPTY;
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — the session still works, it just won't survive a reload */
  }
}

function set(next: Partial<State>) {
  state = { ...state, ...next };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  if (!loaded) { state = load(); loaded = true; }
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    // keep multiple tabs in agreement about the cart
    if (e.key === STORAGE_KEY) { state = load(); listeners.forEach((l) => l()); }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => {
  if (!loaded && typeof window !== "undefined") { state = load(); loaded = true; }
  return state;
};
const getServerSnapshot = () => EMPTY;

export const useStore = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

/* ---------------- cart ---------------- */

export const addToCart = (sku: string, qty = 1) => addManyToCart([{ sku, qty }]);

/**
 * Add several lines in one commit.
 *
 * `set` writes localStorage *and* notifies every subscriber, so looping
 * `addToCart` over a six-part kit costs six serialisations and six renders of
 * the header, the cart drawer and whatever else is listening. Four call sites
 * were already doing exactly that. Adding a set at a time is the honest shape
 * of the operation anyway: the buyer pressed one button.
 */
export function addManyToCart(lines: { sku: string; qty?: number }[]) {
  if (!lines.length) return;
  const cart = [...state.cart];
  for (const { sku, qty = 1 } of lines) {
    if (qty <= 0) continue;
    const i = cart.findIndex((l) => l.sku === sku);
    if (i >= 0) cart[i] = { ...cart[i], qty: cart[i].qty + qty };
    else cart.push({ sku, qty });
  }
  set({ cart });
}

export function setQty(sku: string, qty: number) {
  if (qty <= 0) return removeLine(sku);
  set({ cart: state.cart.map((l) => (l.sku === sku ? { ...l, qty } : l)) });
}

export const removeLine = (sku: string) =>
  set({ cart: state.cart.filter((l) => l.sku !== sku) });

/**
 * Emptied by checkout once the server has confirmed the order — never before,
 * and never optimistically. A cart cleared against an order that turned out to
 * be out of stock is a cart the buyer has to rebuild from memory.
 */
export const clearCart = () => set({ cart: [] });

/** Remember what was bought, for the verified-purchase badge on reviews. */
export const recordPurchase = (skus: string[]) =>
  set({ purchased: [...new Set([...state.purchased, ...skus])] });

/* ---------------- wishlist ---------------- */

export function toggleWish(sku: string) {
  const has = state.wishlist.includes(sku);
  set({ wishlist: has ? state.wishlist.filter((s) => s !== sku) : [sku, ...state.wishlist] });
  return !has;
}

export const removeWish = (sku: string) =>
  set({ wishlist: state.wishlist.filter((s) => s !== sku) });

/* ---------------- reviews ---------------- */

/**
 * "Verified" means this browser has bought the SKU.
 *
 * ponytail: browser-local, so it does not follow the buyer to another device
 * and an unverified badge is not proof of anything. The authoritative version
 * is a join from the review's customer to `orders.lines.sku` — worth doing
 * when reviews are written server-side, not before.
 */
export function hasPurchased(sku: string) {
  return state.purchased.includes(sku);
}

export function addReview(r: Omit<Review, "id" | "createdAt" | "verified">) {
  const review: Review = {
    ...r,
    id: `rv_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    verified: hasPurchased(r.sku),
  };
  set({ reviews: [review, ...state.reviews] });
  return review;
}

export const reviewsFor = (reviews: Review[], sku: string) =>
  reviews.filter((r) => r.sku === sku);

/* ---------------- session ---------------- */

/*
  There is deliberately no `signIn` here any more.

  It used to be `export const signIn = (user: User) => set({ user })` — a
  client function that took whatever object it was handed and wrote it to
  localStorage, after which every screen behind "signed in" believed it. Two
  lines in a devtools console were a session. The identity now comes from a
  signed httpOnly cookie the browser cannot mint (`lib/customerSession.ts`),
  and screens receive it as a prop from a server component.

  `state.user` survives only as a *cache* of what the server already said, so
  client-side pieces can render a name without a round trip. Nothing may grant
  access on the strength of it.
*/

/** Clear the local cache. The real session is ended by `POST /api/auth/signout`. */
export const signOut = () => set({ user: null });

/** Mirror the server's answer into the local cache after a page load. */
export const setSessionUser = (user: User | null) => set({ user });

export const updateUser = (patch: Partial<User>) =>
  set({ user: state.user ? { ...state.user, ...patch } : null });

/* ---------------- addresses ---------------- */

export function saveAddress(a: Omit<Address, "id"> & { id?: string }) {
  // `||`, not `??`: callers pass `id: ""` for "this is a new one", and an empty
  // string is not nullish — so `??` kept it, and every address saved from
  // checkout collided on the same empty id and overwrote the last.
  const id = a.id || `addr_${Date.now().toString(36)}`;
  const next = state.addresses.filter((x) => x.id !== id);
  const addr: Address = { ...a, id };
  if (addr.isDefault) next.forEach((x) => (x.isDefault = false));
  set({ addresses: [...next, addr] });
  return addr;
}

export const removeAddress = (id: string) =>
  set({ addresses: state.addresses.filter((a) => a.id !== id) });

/* ---------------- RFQs ---------------- */

export function submitRfq(
  rfq: Omit<Rfq, "number" | "createdAt">,
  makeNumber: (seq: number) => string,
): Rfq {
  const rfqSeq = state.rfqSeq + 1;
  const full: Rfq = { ...rfq, number: makeNumber(rfqSeq), createdAt: new Date().toISOString() };
  set({ rfqs: [full, ...state.rfqs], rfqSeq });
  return full;
}
