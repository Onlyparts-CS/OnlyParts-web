"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, skuCountLabel, COMING_SOON } from "@/lib/catalog";
import { tree, type Node } from "@/lib/taxonomy";
import { useSearch } from "@/components/search/SearchProvider";
import { useStore } from "@/lib/store";
import { Logo } from "@/components/Logo";
import { Halftone } from "@/components/Halftone";
import { PLATE_FOR_CATEGORY } from "@/lib/plates";
import {
  SearchIcon, HeartIcon, UserIcon, CartIcon, MenuIcon, ChevronRight,
} from "@/components/Icons";

/* ============================================================
   The cabinet rail.
   ------------------------------------------------------------
   Three tiers, each doing one job:

     rail   the running head of a printed catalogue — who, where,
            and the terms, set small and dark.
     row    the plate, the tools, the cart.
     tabs   the drawer tabs standing up out of the cabinet. This
            is the navigation, and it is the largest thing here
            because the catalogue is the shopfront.

   Search is a tab, not a field. A 640px input across the middle
   of the rail makes the search the product; the parts are the
   product. It stays one keystroke away and takes the width it
   deserves — which is the width of its own label.
   ============================================================ */
export function Header() {
  const { open } = useSearch();
  const { cart, user, wishlist } = useStore();
  /*
    Counted from what the browser holds, not from the catalogue.

    These used to resolve every line against the generated catalogue so a
    delisted SKU would not be counted. Resolving now means a server round trip,
    and a round trip on every page load to decide a badge number is not a trade
    worth making: the badge would arrive late on every navigation to spare a
    rare case the cart page already handles by dropping the line.
  */
  const count = cart.reduce((n, l) => n + l.qty, 0);
  const wishCount = wishlist.length;

  const [mega, setMega] = useState<number | null>(null);
  const [subIdx, setSubIdx] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMega(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const show = (i: number) => {
    window.clearTimeout(closeTimer.current);
    setMega(i); setSubIdx(0);
  };
  const scheduleClose = () => {
    closeTimer.current = window.setTimeout(() => setMega(null), 160);
  };

  const active = mega !== null ? CATEGORIES[mega] : null;

  /*
    The panel navigates off the *taxonomy* tree, not off `CATEGORIES`.

    `CATEGORIES` is display data — shelves and types carry a name and a count
    but no slug, so every leaf in this panel used to link to `/c/${active.slug}`
    and dropped you back on the top-level drawer. Clicking "Encoders" under
    Motors → Motor Accessories landed on /c/motors. `tree()` resolves the same
    taxonomy with `path` on every node, so a link here is the real URL.
  */
  const activeTree: Node | null = active
    ? (tree().find((n) => n.slug === active.slug) ?? null)
    : null;
  const shelves = activeTree?.children ?? [];
  const shelf = shelves[Math.min(subIdx, Math.max(0, shelves.length - 1))] ?? null;

  return (
    <header className="print-hide sticky top-0 z-100 border-b border-ink-900 bg-bg">
      {/* ---------- running head ---------- */}
      <div className="bg-ink-950 text-ink-200">
        <div className="container-page flex min-h-[30px] flex-wrap items-center justify-between gap-x-6 py-1">
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em]">
            OnlyParts · Bengaluru
          </span>
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-ink-400">
            No minimum order
            <span className="hidden sm:inline"> · GST invoice · 24 h dispatch target</span>
          </span>
        </div>
      </div>

      {/* ---------- row ---------- */}
      <div className="container-page flex h-[58px] items-center gap-3 lg:gap-5">
        <button
          className="btn-ghost -ml-2 grid size-9 shrink-0 place-items-center lg:hidden"
          aria-label="Open menu"
          aria-expanded={mobileNav}
          onClick={() => setMobileNav((v) => !v)}
        >
          <MenuIcon className="size-5" />
        </button>

        <Logo />

        <span aria-hidden className="tick my-3 hidden shrink-0 lg:block" />

        {/* the index tab — small, findable, not the shopfront */}
        <button
          onClick={() => open()}
          className="group ml-auto flex h-8 shrink-0 items-center gap-2 border border-ink-900 px-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ink-900 hover:text-bg lg:ml-0"
        >
          <SearchIcon className="size-3.5" />
          <span className="hidden sm:inline">Find a part</span>
          <span className="kbd ml-1 hidden transition-colors group-hover:border-ink-600 group-hover:bg-ink-800 group-hover:text-ink-200 lg:inline">
            Ctrl K
          </span>
        </button>

        <span className="hidden shrink-0 lg:block">
          <span className="bin">spec · SKU · MPN · dimension</span>
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Link href="/wishlist" className="btn-ghost relative hidden size-9 place-items-center sm:grid"
            aria-label={wishCount ? `Saved parts, ${wishCount} saved` : "Saved parts, empty"}>
            <HeartIcon className={`size-[18px] ${wishCount ? "fill-spot-200 text-spot-700" : ""}`} />
            {wishCount > 0 && (
              <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center bg-ink-900 px-1 font-mono text-[0.5625rem] font-bold text-bg tnum">
                {wishCount > 99 ? "99+" : wishCount}
              </span>
            )}
          </Link>
          <Link href="/account" className="btn-ghost hidden size-9 place-items-center sm:grid"
            aria-label={user ? `Account — ${user.name}` : "Sign in"}>
            <span className="relative">
              <UserIcon className="size-[18px]" />
              {user && <span className="absolute -right-0.5 -top-0.5 size-2 bg-success ring-2 ring-bg" />}
            </span>
          </Link>
          <Link href="/cart" className="btn-ghost relative grid size-9 place-items-center"
            aria-label={count ? `Cart, ${count} items` : "Cart, empty"}>
            <CartIcon className="size-[18px]" />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center bg-spot-700 px-1 font-mono text-[0.5625rem] font-bold text-on-accent tnum">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>

          <Link
            href="/make"
            className="notch ml-2 hidden shrink-0 bg-spot-600 px-3.5 py-1.5 font-mono text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-on-accent transition-colors hover:bg-spot-700 sm:block"
            style={{ ["--notch" as string]: "7px" }}
          >
            Make ⟶
          </Link>
        </div>
      </div>

      {/* ---------- drawer tabs ---------- */}
      <nav aria-label="Categories" className="hidden border-t border-line lg:block" onMouseLeave={scheduleClose}>
        <div className="container-page no-bar flex h-10 items-end gap-0.5 overflow-x-auto">
          {CATEGORIES.slice(0, 8).map((c, i) => (
            <button
              key={c.slug}
              onMouseEnter={() => show(i)}
              onFocus={() => show(i)}
              onClick={() => show(i)}
              aria-expanded={mega === i}
              className={`filetab h-[30px] shrink-0 px-4 pt-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.1em] transition-colors ${
                mega === i ? "bg-ink-900 text-bg" : "bg-sunken text-muted hover:bg-ink-200 hover:text-heading"
              }`}
            >
              {c.name}
            </button>
          ))}
          <button
            onMouseEnter={() => show(8)} onFocus={() => show(8)} onClick={() => show(8)}
            aria-expanded={mega !== null && mega >= 8}
            className={`filetab h-[30px] shrink-0 px-4 pt-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.1em] transition-colors ${
              mega !== null && mega >= 8 ? "bg-ink-900 text-bg" : "bg-sunken text-muted hover:bg-ink-200 hover:text-heading"
            }`}
          >
            More +5
          </button>
        </div>

        {/* ---------- the open drawer ---------- */}
        {active && (
          <div
            className="absolute inset-x-0 top-full border-y border-ink-900 bg-surface shadow-e3"
            style={{ animation: "panelIn 200ms var(--ease-out)" }}
            onMouseEnter={() => window.clearTimeout(closeTimer.current)}
            onMouseLeave={scheduleClose}
          >
            <div className="container-page grid grid-cols-[minmax(0,240px)_minmax(0,1fr)_minmax(0,220px)] gap-8 py-7">
              <div className="border-r border-line pr-5">
                <p className="overline mb-3">{active.name} · shelves</p>
                {/*
                  Links, not buttons. These were hover targets that only swapped
                  the panel on the right, so a shelf — the level most people
                  actually want — could not be opened from the navigation at all.
                  Hovering still swaps the panel; clicking now goes there.
                */}
                {shelves.map((s, i) => (
                  <Link
                    key={s.slug}
                    href={`/c/${s.path.join("/")}`}
                    onMouseEnter={() => setSubIdx(i)}
                    onFocus={() => setSubIdx(i)}
                    onClick={() => setMega(null)}
                    className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[0.8125rem] transition-colors ${
                      i === subIdx ? "bg-ink-900 text-bg" : "text-muted hover:bg-sunken hover:text-heading"
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    <ChevronRight className="size-3.5 shrink-0 opacity-60" />
                  </Link>
                ))}
              </div>

              <div className="grid grid-cols-3 content-start gap-x-5 gap-y-px">
                <p className="col-span-3 mb-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-heading">
                  {shelf?.name}
                </p>
                {shelf?.children.map((leaf) => (
                  <Link
                    key={leaf.slug}
                    href={`/c/${leaf.path.join("/")}`}
                    onClick={() => setMega(null)}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 text-[0.8125rem] text-body transition-colors hover:bg-spot-50 hover:text-spot-700"
                  >
                    <span className="truncate">{leaf.name}</span>
                    <span className="bin shrink-0">{leaf.count}</span>
                  </Link>
                ))}
                <div className="col-span-3 mt-5 flex flex-wrap gap-2">
                  {shelf && (
                    <Link
                      href={`/c/${shelf.path.join("/")}`}
                      onClick={() => setMega(null)}
                      className="btn btn-primary btn-sm"
                    >
                      All {shelf.name}
                    </Link>
                  )}
                  <Link
                    href={`/c/${active.slug}`}
                    onClick={() => setMega(null)}
                    className="btn btn-secondary btn-sm"
                  >
                    All {active.name}
                  </Link>
                </div>
              </div>

              {/* the drawer's own plate — no invented price, no invented kit */}
              <div className="border-l border-line pl-6">
                <p className="overline mb-3">Drawer {String(CATEGORIES.indexOf(active) + 1).padStart(2, "0")}</p>
                <div className="border border-line bg-bg">
                  <Halftone plate={PLATE_FOR_CATEGORY[active.slug] ?? "screw"} cell={6} className="aspect-[4/3] w-full" />
                </div>
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">{active.blurb}</p>
                <p className="bin mt-3">
                  {active.subs.length} shelves · {skuCountLabel(active.count) ?? COMING_SOON}
                </p>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ---------- mobile drawer list ---------- */}
      {mobileNav && (
        <div className="border-t border-line bg-surface lg:hidden">
          <div className="container-page max-h-[70dvh] overflow-y-auto py-2">
            {CATEGORIES.map((c, i) => (
              <Link
                key={c.slug} href={`/c/${c.slug}`} onClick={() => setMobileNav(false)}
                className="flex items-center gap-3 border-b border-line py-2.5 last:border-0"
              >
                <span className="bin w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="monumental block text-[0.9375rem] text-heading">{c.name}</span>
                  <span className="bin mt-0.5 block">{c.subs.length} shelves · {skuCountLabel(c.count) ?? COMING_SOON}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-disabled" />
              </Link>
            ))}
            {/* wishlist and account drop out of the row below sm, so they have
                to exist somewhere — this is somewhere */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
              <Link href="/wishlist" onClick={() => setMobileNav(false)} className="btn btn-secondary btn-sm">
                Saved parts
              </Link>
              <Link href="/account" onClick={() => setMobileNav(false)} className="btn btn-secondary btn-sm">
                {user ? "Account" : "Sign in"}
              </Link>
            </div>
            <Link href="/make" onClick={() => setMobileNav(false)} className="btn btn-primary mt-2 w-full">
              Get a part made ⟶
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
