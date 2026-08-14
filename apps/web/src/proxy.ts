import { NextResponse, type NextRequest } from "next/server";

/**
 * The edge fence: nonces where they buy something, and a first gate on staff.
 *
 * Called `proxy.ts`, not `middleware.ts` — Next 16 renamed the convention and
 * the export. `docs/01-app/02-guides/content-security-policy.md` in the
 * installed package is the authority, not any older tutorial.
 *
 * ## Why the strict policy is scoped, not global
 *
 * Nonces only work on dynamically rendered pages. Next injects them during SSR
 * by reading the request's own CSP header, and a statically generated page was
 * built when no request existed — so it has no nonce to carry. 22 of this
 * app's 50 routes are static or SSG. Shipping a global `script-src` without
 * `'unsafe-inline'` would therefore not harden them, it would blank them.
 *
 * The alternative — forcing every route dynamic — trades a measured 0.15s
 * static home page for a database round trip on every visit, to protect pages
 * that render no user input and carry no session.
 *
 * So the strict policy covers where XSS actually cashes out: a session to
 * steal, money to move, or attacker-influenced text on the page. That is the
 * console, the CMS, and the buyer's own authenticated surfaces. Everything
 * else keeps the policy in `next.config.ts`, which is still enforcing.
 *
 * ## The staff gate is a fence, not authentication
 *
 * The edge has no database, so this cannot verify a session — it only checks
 * that a Payload session cookie is *present*. Forging one gets you past this
 * and straight into `guard()` / `actionStaff()`, which do the real check
 * against Postgres and are unchanged. What this buys is that an anonymous
 * scanner gets 401 instead of 200-and-a-sign-in-wall, so `/admin` stops
 * confirming its own existence to anyone who asks.
 */

/** Payload's session cookie. Default prefix, set in `payload.config.ts`. */
const SESSION_COOKIE = "payload-token";

/**
 * Where a stolen session or an injected script would cost something — *and*
 * where the page is dynamically rendered, so a nonce can actually be injected.
 *
 * Both halves are load-bearing. Measured on this build: `/cms` renders 26
 * script tags and Next nonces all 26. `/checkout` and `/cart` render 25 and
 * Next nonces **none of them**, because both are `○ static` — the strict
 * header would have reached the browser with nothing to satisfy it and
 * blocked every script on the payment page. HTTP 200 the whole way; only
 * counting nonces in the HTML shows it.
 *
 * `/checkout`, `/cart` and `/track` therefore stay on the `next.config.ts`
 * policy for now. They are `"use client"` pages, and route segment config is
 * not allowed in a client component, so opting them into dynamic rendering
 * means giving each a server shell first. That is the next piece of work
 * here — a payment page should not be a cached static shell regardless of CSP.
 */
const STRICT = [
  "/admin", "/cms",              // staff consoles
  "/account",                    // a buyer's own personal data
  "/orders", "/rfqs",            // a buyer's own records
];

const isStrict = (path: string) =>
  STRICT.some((p) => path === p || path.startsWith(`${p}/`));

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
    401, not a redirect and not a 404.

    A redirect to /cms/login would still confirm the console is here, and a
    404 would lie to a staff member whose session simply expired — they would
    be told the page does not exist rather than that they are signed out.
    401 with a WWW-Authenticate-free body is the honest answer: it exists, you
    are not carrying a session for it.
  */
  if ((pathname === "/admin" || pathname.startsWith("/admin/"))
    && !request.cookies.has(SESSION_COOKIE)) {
    return new NextResponse("Not signed in.", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" },
    });
  }

  if (!isStrict(pathname)) return NextResponse.next();

  const nonce = crypto.randomUUID().replaceAll("-", "");
  const dev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    /*
      `'strict-dynamic'` is what makes the nonce worth having: once a nonce'd
      script runs, the scripts *it* loads are trusted by provenance rather than
      by URL, so Next's chunk loading keeps working without an allowlist that
      an attacker could satisfy. Dev needs 'unsafe-eval' because React uses
      eval to rebuild server stack traces; production does not.
    */
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    /*
      Styles keep 'unsafe-inline'. Next and Payload both emit inline style
      attributes that carry no nonce, and unlike script-src this is not the
      XSS-execution boundary — a style injection cannot run code here, and
      pretending otherwise by breaking the console is a worse trade.
    */
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://accounts.google.com",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  // Next reads the nonce back off the *request* CSP header during SSR and
  // attaches it to every framework and page script itself, so nothing
  // downstream has to thread it through by hand.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  // Static assets and prefetches need no policy and no gate.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
