import Link from "next/link";

/**
 * Shared header for content pages, so they can't drift apart visually.
 *
 * Two layouts, because the pages underneath differ:
 *
 * - `split` (default) — headline left, lead right on lg. Used where the content
 *   below runs the full container width. The old single stacked column left the
 *   headline ending at 808px and the lead at 712px on a 1425px page, so more
 *   than half the header was empty on one side while the cards under it went
 *   edge to edge. Two columns use the width the page already committed to.
 *
 * - `editorial` — everything inside the same 6xl column the article body uses,
 *   so the header and the first paragraph share a left edge.
 */
export function PageHeader({
  title, lead, meta, breadcrumb, variant = "split",
}: {
  title: string;
  lead?: string;
  meta?: string;
  breadcrumb?: { label: string; href: string }[];
  variant?: "split" | "editorial";
}) {
  const editorial = variant === "editorial";
  const split = !editorial && Boolean(lead);

  return (
    <header className="border-b border-line bg-surface">
      <div className="container-page page-shell">
        <div className={editorial ? "mx-auto max-w-[62rem]" : undefined}>
          {breadcrumb && (
            <nav aria-label="Breadcrumb" className="mb-4">
              <ol className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-faint">
                <li><Link href="/" className="hover:text-spot-700">Home</Link></li>
                {breadcrumb.map((b) => (
                  <li key={b.href} className="flex items-center gap-1.5">
                    <span aria-hidden className="text-disabled">›</span>
                    <Link href={b.href} className="hover:text-spot-700">{b.label}</Link>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className={split ? "grid gap-x-12 gap-y-4 lg:grid-cols-[1.15fr_1fr] lg:items-end" : undefined}>
            <div>
              {/* The eyebrow is gone and does not come back. It restated the
                  breadcrumb one line lower in smaller type, and the heading
                  carries its own weight. */}
              <h1 className={`monumental text-[clamp(2rem,4.4vw,3.5rem)] ${split ? "" : "max-w-3xl"}`}>
                {title}
              </h1>
            </div>

            {lead && (
              <div className={split ? "lg:pb-1.5" : ""}>
                <p className={`text-pretty text-[1.0625rem] text-muted ${split ? "lg:border-l-2 lg:border-spot-200 lg:pl-5" : "mt-4 max-w-2xl"}`}>
                  {lead}
                </p>
              </div>
            )}
          </div>

          {meta && <p className="mt-5 font-mono text-[0.75rem] text-disabled">{meta}</p>}
        </div>
      </div>
    </header>
  );
}

/**
 * Long-form body copy.
 *
 * The measure stays at ~672px — 65–75 characters is the readable target and
 * widening it would be worse, not better. What was wrong is that it had no
 * `mx-auto`, so on a 1425px container the column sat hard against the left edge
 * and left 713px of dead space on one side. All of the emptiness on one flank
 * is what reads as broken; the same emptiness split in two reads as margin.
 *
 * `aside` opts into the editorial layout: body centred within a wider column,
 * with a sticky rail alongside it on xl. Without one, the measure is simply
 * centred.
 */
export function Prose({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  if (!aside) {
    return (
      <div className="container-page page-shell">
        <div className="mx-auto max-w-2xl [&>*+*]:mt-6">{children}</div>
      </div>
    );
  }

  return (
    <div className="container-page page-shell">
      {/* 42rem body + 4rem gutter + 16rem rail = 62rem, so the block centres
          exactly and shares a left edge with the editorial page header above */}
      <div className="mx-auto grid max-w-[62rem] gap-10 xl:grid-cols-[minmax(0,42rem)_minmax(0,16rem)] xl:gap-16">
        <div className="mx-auto w-full max-w-2xl [&>*+*]:mt-6">{children}</div>
        <aside className="xl:sticky xl:top-[calc(var(--header-h)+2rem)] xl:self-start">{aside}</aside>
      </div>
    </div>
  );
}
