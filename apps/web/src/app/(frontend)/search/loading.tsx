/**
 * Route-level skeleton, scoped to search on purpose.
 *
 * This file used to sit at the `(frontend)` root, where it covered every page —
 * and silently turned every 404 into a 200. A `loading.tsx` creates a Suspense
 * boundary, Next starts streaming the shell immediately, and the response
 * headers are gone before the page body runs. `notFound()` can then only swap
 * the markup; the status is already sent. Measured: `/p/does-not-exist`,
 * `/c/nope-not-real` and an unknown URL all answered 200. With this file moved
 * down, all three answer 404.
 *
 * Search is the right home for it: it is the slowest page in the storefront and
 * the only slow one that cannot 404 — a query with no hits is an empty result,
 * not a missing page. The eight routes that *can* 404 now stream nothing before
 * their lookup resolves.
 *
 * When the storefront starts reading Postgres, the pattern for those eight is a
 * `<Suspense>` *inside* the page, below the `notFound()` check — the status is
 * decided first, then the expensive half streams under this same skeleton.
 *
 * Shape matches a results page — header block, filter rail, product grid — so
 * hydration does not shift layout (CLS budget is 0.1, see docs/05 §8).
 */
export default function Loading() {
  return (
    <div className="container-page page-shell" aria-busy="true" aria-label="Loading">
      <span className="sr-only">Loading…</span>

      <div className="mb-6 h-3 w-56 animate-pulse rounded-xs bg-sunken" />
      <div className="mb-3 h-8 w-80 max-w-full animate-pulse rounded-sm bg-sunken" />
      <div className="mb-8 h-4 w-full max-w-xl animate-pulse rounded-xs bg-sunken" />

      <div className="grid gap-8 lg:grid-cols-[256px_1fr]">
        <div className="hidden gap-4 lg:grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="mb-2 h-3 w-24 animate-pulse rounded-xs bg-sunken" />
              <div className="grid gap-1.5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-3 animate-pulse rounded-xs bg-sunken/70"
                    style={{ width: `${60 + ((i * 7 + j * 11) % 35)}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-md border border-line bg-surface">
              <div className="aspect-square animate-pulse bg-sunken" />
              <div className="grid gap-2 p-3">
                <div className="h-3 animate-pulse rounded-xs bg-sunken" />
                <div className="h-3 w-2/3 animate-pulse rounded-xs bg-sunken/70" />
                <div className="mt-1 h-4 w-1/3 animate-pulse rounded-xs bg-sunken" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
