import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  /*
    Supplier photographs, hotlinked until they are mirrored.

    The optimiser proxies these through `/_next/image`, so the browser only
    ever sees a same-origin URL — which is what the halftone canvas needs, and
    why hotlinking works here at all without tainting it.

    Two hosts, exactly. `remotePatterns` is a server-side fetch allowlist, not
    a formality: without it, an `image` column in an uploaded CSV would decide
    what this server requests. `imageUrl()` in `lib/import.ts` rejects the same
    set on the way in, so it takes both to be wrong.
  */
  /*
    The sheet is the argument, so the action body has to hold a whole CSV.

    `commitImport` takes the CSV text rather than the browser's computed diff —
    deliberately, so the server re-runs the same dry run before writing a row.
    That makes the upload a Server Action body, and the default cap is 1 MB.
    Adding the `image` column pushed the 3,800-row demo sheet to 1.1 MB and
    every commit started failing with "Body exceeded 1 MB limit".

    4 MB, not unlimited: `pull.mjs` chunks its output at 2,000 rows for exactly
    this reason, and a limit that fits two of those chunks keeps the guard rail
    while leaving the documented workflow room.
  */
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "robu-prod-media.s3.ap-south-1.amazonaws.com" },
    ],
  },
  /*
    `experimental.viewTransition` is deliberately NOT on.

    The plan was a shared-element morph: the halftone plate on a catalogue tile
    growing into the plate on the product page. `docs/01-app/02-guides/view-transitions.md`
    describes it and says the App Router "uses React canary releases" so no
    extra install is needed — but this project is on stable **react 19.2.4**,
    which exports no `ViewTransition` at all (verified: no matching export, and
    `@types/react` only declares it behind an `@enableViewTransition` flag).

    Turning the flag on without a canary React gives a config that promises
    something the runtime cannot do. Revisit when React ships it stable, or
    when someone decides a canary React is an acceptable dependency.
  */

  /*
    The server announces its framework and version in every response. That is
    a free hint for anyone scanning for a known Next CVE, and it buys us
    nothing.
  */
  poweredByHeader: false,

  /*
    Security headers.

    There were none. Cloudflare can bolt most of these on with a Transform
    Rule, and that is the wrong place for them: the rule lives in a dashboard
    nobody reviews, it disappears if the origin is ever hit directly, and it
    cannot know which of our own scripts are legitimate. They belong with the
    app, in the repo, next to the code they describe.

    `source: "/:path*"` covers the storefront and the admin console alike.
  */
  headers() {
    const csp = [
      "default-src 'self'",
      // Next injects inline bootstrap scripts and, in dev, eval'd HMR code.
      // Nonces would be stricter but have to be minted per request in
      // middleware — worth doing, and not worth blocking the migration on.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      // Supplier photography is hotlinked from robu/robocraze/quartz today.
      // When images move to our own bucket this should shrink back to 'self'.
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      // The one that actually stops clickjacking; X-Frame-Options is the
      // legacy spelling and is kept below for older browsers.
      "frame-ancestors 'none'",
      "form-action 'self' https://accounts.google.com",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          /*
            Enforcing, not Report-Only.

            This was Report-Only pending evidence that the Payload admin does
            not load chunks the policy has never seen. That evidence was then
            gathered rather than waited for: every `src`/`href` in the rendered
            HTML of `/`, `/c/*`, `/checkout`, `/account`, `/track`, `/admin`,
            `/cms` and `/cms/login` resolves same-origin, there is no
            client-side `fetch` to an external host anywhere in `src/`, and
            supplier photography is hotlinked over `https:` which `img-src`
            already permits. There is nothing left for this policy to block.

            Report-Only is not a safer setting, it is an unenforced one: it
            costs a real header and buys nothing until somebody reads reports
            that were never being collected — no `report-uri` was ever set.

            Still worth doing later: per-request nonces in middleware, so
            `script-src` can drop `'unsafe-inline'`. That is the difference
            between a policy that documents intent and one that stops XSS.
          */
          { key: "Content-Security-Policy", value: csp },

          /*
            Two years, subdomains included. Preload is deliberately NOT
            asserted: getting on the browsers' preload list is close to
            irreversible, and it should wait until the domain has actually
            served HTTPS-only for a while.

            This is also why Cloudflare's SSL mode has to be Full (strict).
            On Flexible, Cloudflare talks plain HTTP to the origin, the origin
            never sees a secure request, and every `secure` cookie this app
            sets — sessions, order access, OAuth state — silently fails.
          */
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          /*
            Deny by default. We ask for none of these, and a compromised
            third-party script should not be able to either.
          */
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

/*
  `withPayload` is not optional dressing — it aliases `@payload-config`, marks
  the server-only packages external so Drizzle and sharp are never pulled into
  a client bundle, and routes the admin panel's SCSS through the Next pipeline.
*/
export default withPayload(nextConfig);
