/**
 * Demo-data gate.
 *
 * The generated catalogue in `skus.ts` exists so the UI can be evaluated before
 * a database exists. It must never reach a real deployment — a store that ships
 * with 1,172 invented SKUs, invented stock levels and invented prices is worse
 * than a store with none.
 *
 * One flag controls it, and it is **opt-in**: absent or unset means off. A
 * missing environment variable in production therefore fails safe.
 *
 *   .env.local      NEXT_PUBLIC_DEMO_DATA=on    → demo catalogue visible
 *   production      (unset)                     → empty catalogue, honest states
 *
 * `NEXT_PUBLIC_` is required because the value is read in Client Components
 * (cart, search overlay) as well as on the server. Next.js inlines it at build
 * time, so the same build cannot be flipped at runtime — which is what we want:
 * a production build physically cannot contain demo data.
 */
/*
  Restored to opt-in.

  This was flipped to `!== "off"` during the seeding phase so the storefront had
  something to render. That inverts the entire safety property the comment above
  describes: with `!== "off"`, a production build with no environment file ships
  1,172 invented SKUs at invented prices. The flag is the one thing standing
  between a demo and a store that lies about what it stocks, so it fails closed.

  When the storefront reads the seeded database instead of `skus.ts`, this flag
  stops mattering and should be deleted rather than defaulted on.
*/
export const DEMO_DATA = process.env.NEXT_PUBLIC_DEMO_DATA === "on";

/**
 * True when the storefront has no catalogue to show at all.
 * Set to false as the catalogue database is seeded and live.
 */
export const CATALOGUE_EMPTY = !DEMO_DATA;

/** Copy used wherever an empty catalogue needs explaining. */
export const EMPTY_COPY = {
  title: "Catalogue coming soon",
  body:
    "We're onboarding suppliers and seeding the catalogue now. Tell us what you " +
    "need and we'll source it, or send a drawing and we'll make it.",
} as const;
