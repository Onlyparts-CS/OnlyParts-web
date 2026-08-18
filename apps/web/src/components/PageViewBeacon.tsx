"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Tells the server which page is being read, and nothing else.
 *
 * It sends one field — the pathname — to a same-origin endpoint. No cookie, no
 * identifier, no third-party script, nothing that survives the request but a
 * number going up. That is the whole of the site's analytics, and it is why
 * there is no consent banner to dismiss: see `collections/PageViews.ts`.
 *
 * It runs on the client rather than in the pages themselves because half the
 * site is statically rendered — a server-side count on `/policies/returns` or
 * `/b/wurth` would record the build, once, and never a reader.
 *
 * `keepalive` rather than `sendBeacon`: both survive the navigation that
 * follows, and `fetch` is the one that sends a JSON body without dressing it
 * up as a Blob.
 */
export function PageViewBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    /*
      Deliberately fire-and-forget, including the failure. There is nothing a
      visitor could do about a analytics write that did not land, and an
      unhandled rejection would put a red line in their console for a request
      they never made.
    */
    void fetch("/api/pageview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
