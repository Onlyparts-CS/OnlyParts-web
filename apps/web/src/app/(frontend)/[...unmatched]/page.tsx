import { notFound } from "next/navigation";

/**
 * Unmatched URLs, routed deliberately into the storefront's 404.
 *
 * Splitting the app into two root layouts — `(frontend)` and `(payload)` —
 * leaves Next with no single root `not-found.tsx` to fall back on, so an
 * unknown URL rendered Next's own bare 404 instead of ours. Measured: the
 * response contained "404" and none of our markup.
 *
 * A catch-all that immediately calls `notFound()` puts the request inside
 * `(frontend)` first, so `(frontend)/not-found.tsx` renders with the paper
 * ground, the header and the category list on it. Real segments still win —
 * Next resolves static and specific dynamic segments ahead of a catch-all, so
 * `/cart`, `/c/fasteners`, `/cms` and `/api/*` are untouched.
 *
 * The alternative is `app/global-not-found.tsx`, which is experimental and
 * must hand-render a full HTML document including our fonts and theme.
 */
export default function Unmatched() {
  notFound();
}
