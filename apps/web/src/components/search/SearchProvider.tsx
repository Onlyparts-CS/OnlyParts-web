"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SUGGESTIONS } from "@/lib/search";
import { type SkuSearchResult } from "@/lib/searchSkus";
import { instantSearch } from "@/app/(frontend)/search/actions";
import { CATEGORIES, inr, skuCountLabel, COMING_SOON } from "@/lib/catalog";
import { Glyph } from "@/components/Glyph";
import { SearchIcon, FolderIcon } from "@/components/Icons";

type Ctx = { open: (seed?: string) => void };
const SearchCtx = createContext<Ctx>({ open: () => {} });
export const useSearch = () => useContext(SearchCtx);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const open = useCallback((seed?: string) => {
    lastFocus.current = document.activeElement as HTMLElement;
    setQ(seed ?? "");
    setSel(0);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    lastFocus.current?.focus();
  }, []);

  // global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      const typing = tag === "input" || tag === "textarea";
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
      else if (e.key === "/" && !typing && !isOpen) { e.preventDefault(); open(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isOpen]);

  // lock scroll + focus the field
  useEffect(() => {
    if (!isOpen) { document.body.style.overflow = ""; return; }
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => { clearTimeout(t); document.body.style.overflow = ""; };
  }, [isOpen]);

  /*
    Same search source as /search — one parser, one catalogue, now over
    Postgres. It used to run `searchSkus` synchronously here, which was only
    possible because the whole catalogue was a JavaScript array shipped to
    every visitor. It cannot be at fifty thousand SKUs, so the overlay asks the
    server instead.

    Debounced at 140ms and guarded by a sequence number: keystrokes are faster
    than round trips, and without the guard a slow response for "m3" can land
    after a fast one for "m3x10" and overwrite it with stale rows.
  */
  const [fetched, setFetched] = useState<{ q: string; data: SkuSearchResult | null } | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (!query) return;

    const mine = ++seq.current;
    const t = setTimeout(() => {
      instantSearch(query)
        .then((data) => { if (mine === seq.current) setFetched({ q: query, data }); })
        .catch(() => { if (mine === seq.current) setFetched({ q: query, data: null }); });
    }, 140);

    return () => clearTimeout(t);
  }, [q]);

  /*
    Derived, not cleared in the effect.

    Two reasons. React 19 flags a synchronous `setState` in an effect body as a
    cascading render, and — more usefully — tagging the result with the query
    it answered means a response for "m3" can never be shown under "m3x10".
    Between keystroke and response the overlay shows suggestions rather than
    the previous query's rows.
  */
  const result = fetched && fetched.q === q.trim() ? fetched.data : null;

  const rows = useMemo(() => {
    if (!result) return SUGGESTIONS.map((s) => ({ kind: "suggest" as const, label: s }));
    return [
      ...result.results.map((p) => ({ kind: "product" as const, label: p.title, p })),
      ...result.categories.map((c) => ({ kind: "cat" as const, label: c.full, c })),
    ];
  }, [result]);

  const submit = useCallback((query: string) => {
    if (!query.trim()) return;
    setIsOpen(false);
    document.body.style.overflow = "";
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }, [router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[sel];
      if (row?.kind === "suggest") { setQ(row.label); setSel(0); return; }
      if (row?.kind === "product") { setIsOpen(false); document.body.style.overflow = ""; router.push(`/p/${row.p.slug}`); return; }
      if (row?.kind === "cat") { setIsOpen(false); document.body.style.overflow = ""; router.push(`/c/${row.c.path.join("/")}`); return; }
      submit(q);
    }
  };

  return (
    <SearchCtx.Provider value={{ open }}>
      {children}

      {isOpen && (
        <div
          className="fixed inset-0 z-200 bg-ink-950/40 backdrop-blur-[6px]"
          style={{ animation: "fadeIn 240ms var(--ease-out)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div
            role="dialog" aria-modal="true" aria-label="Search products"
            className="mx-auto mt-0 h-dvh w-full overflow-hidden bg-surface shadow-e3 sm:mt-[8vh] sm:h-auto sm:max-w-3xl sm:rounded-lg sm:border sm:border-line-strong"
            style={{ animation: "panelIn 240ms var(--ease-out)" }}
          >
            {/* input */}
            <div className="flex items-center gap-4 border-b border-line px-5 py-4">
              <SearchIcon className="size-5 shrink-0 text-spot-600" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setSel(0); }}
                onKeyDown={onKeyDown}
                placeholder="M3x10 SS304 socket head…"
                className="min-w-0 flex-1 bg-transparent font-mono text-[1.0625rem] text-heading outline-none placeholder:text-disabled"
                role="combobox" aria-expanded aria-controls="search-results" aria-autocomplete="list"
                autoComplete="off" enterKeyHint="search"
              />
              <button onClick={close} className="kbd shrink-0">esc</button>
            </div>

            {/* parsed tokens */}
            {result && result.tokens.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
                <span className="text-xs text-faint">understood:</span>
                {result.tokens.map((t) => (
                  <span key={t.key + t.value} className="token-chip in">
                    {t.label}<span className="opacity-55 font-bold">×</span>
                  </span>
                ))}
              </div>
            )}

            {/* results */}
            <div id="search-results" className="max-h-[calc(100dvh-190px)] overflow-y-auto sm:max-h-[min(56vh,520px)]">
              {!result && (
                <>
                  <Group title="Try one of these">
                    {SUGGESTIONS.map((s, i) => (
                      <Row key={s} selected={i === sel} onClick={() => { setQ(s); setSel(0); inputRef.current?.focus(); }}>
                        <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-line bg-sunken text-spot-600">
                          <SearchIcon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 font-mono text-sm text-body">{s}</span>
                      </Row>
                    ))}
                  </Group>
                  <Group title="Browse categories">
                    {CATEGORIES.slice(0, 4).map((c) => (
                      <Row key={c.slug} selected={false}>
                        <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-line bg-spot-50 text-spot-600">
                          <Glyph name={c.glyph} className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-heading">{c.name}</span>
                          <span className="block truncate font-mono text-[0.6875rem] text-faint">
                            {skuCountLabel(c.count) ?? COMING_SOON}
                          </span>
                        </span>
                      </Row>
                    ))}
                  </Group>
                </>
              )}

              {result?.relaxed && (
                <div className="px-5 pt-4">
                  <span className="inline-flex items-center gap-2 rounded-sm border border-spot-200 bg-spot-50 px-3 py-1.5 font-mono text-xs text-spot-800">
                    nothing at {result.relaxed.label} — relaxed to nearest: {result.relaxed.values.join(", ")} mm
                  </span>
                </div>
              )}

              {result && result.results.length > 0 && (
                <Group title="Products">
                  {result.results.map((p, i) => (
                    <Row
                      key={p.sku}
                      selected={i === sel}
                      onClick={() => { setIsOpen(false); document.body.style.overflow = ""; router.push(`/p/${p.slug}`); }}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-line bg-spot-50 text-spot-600">
                        <Glyph name={p.glyph} className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-heading">{p.title}</span>
                        <span className="block truncate font-mono text-[0.6875rem] text-faint">⌗ {p.sku}</span>
                      </span>
                      <span className="shrink-0 font-mono text-sm tnum text-heading">{inr(p.price)}</span>
                      <span
                        className={`size-[7px] shrink-0 rounded-full ${p.stock > 0 ? "bg-success" : "bg-info"}`}
                        title={p.stock > 0 ? "In stock" : "Made to order"}
                      />
                    </Row>
                  ))}
                </Group>
              )}

              {result && result.categories.length > 0 && (
                <Group title="Categories">
                  {result.categories.map((c, i) => (
                    <Row
                      key={c.path.join("/")}
                      selected={result.results.length + i === sel}
                      onClick={() => { setIsOpen(false); document.body.style.overflow = ""; router.push(`/c/${c.path.join("/")}`); }}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-line bg-sunken text-faint">
                        <FolderIcon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-heading">{c.full}</span>
                        <span className="block font-mono text-[0.6875rem] text-faint">{c.count} matching</span>
                      </span>
                    </Row>
                  ))}
                </Group>
              )}

              {result && (result.results.length > 0 || result.categories.length > 0) && (
                <button
                  onClick={() => submit(q)}
                  className="flex w-full items-center gap-2 border-t border-line px-5 py-3 text-left text-[0.8125rem] font-medium text-spot-700 transition-colors hover:bg-spot-50"
                >
                  See all results for <span className="font-mono">“{q}”</span>
                  <span aria-hidden className="ml-auto">→</span>
                </button>
              )}

              {result && result.results.length === 0 && result.categories.length === 0 && (
                <div className="px-6 py-10 text-center">
                  <h4 className="mb-2 text-base">Nothing in the catalogue matches “{q}”.</h4>
                  <p className="mx-auto mb-5 max-w-sm text-sm text-muted">
                    We don&apos;t leave you at a dead end. If we don&apos;t stock it, we can make it.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {/* closes the palette on the way out — a bare <a> here cost a full page load */}
                    <Link href="/make/rfq" onClick={close} className="btn btn-primary btn-sm">
                      Get it made on demand →
                    </Link>
                    <button onClick={() => submit(q)} className="btn btn-secondary btn-sm">Search everything</button>
                  </div>
                </div>
              )}
            </div>

            {/* footer */}
            <div className="flex items-center gap-5 border-t border-line px-5 py-3 text-[0.6875rem] text-faint">
              <span className="hidden items-center gap-1.5 sm:flex"><span className="kbd">↑↓</span>navigate</span>
              <span className="hidden items-center gap-1.5 sm:flex"><span className="kbd">↵</span>open</span>
              <span className="flex items-center gap-1.5"><span className="kbd">esc</span>close</span>
              <span className="ml-auto font-mono">
                {result ? `${result.total.toLocaleString("en-IN")} results` : `${CATEGORIES.length} categories`}
              </span>
            </div>
          </div>
        </div>
      )}
    </SearchCtx.Provider>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <div className="px-5 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-faint">{title}</div>
      {children}
    </div>
  );
}

function Row({
  children, selected, onClick,
}: { children: React.ReactNode; selected: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-4 border-l-2 px-5 py-3 transition-colors ${
        selected ? "border-spot-600 bg-spot-50" : "border-transparent hover:bg-sunken"
      }`}
    >
      {children}
    </div>
  );
}
