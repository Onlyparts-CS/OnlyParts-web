import type { Metadata } from "next";
import { Archivo, Azeret_Mono } from "next/font/google";
import "../globals.css";

/*
  The console's own root.

  `/admin` used to live under `(frontend)`, which meant it inherited the shop's
  running head, drawer tabs, search field, wishlist, cart badge and MAKE button
  — and then hid all of it again with a client-side path check in
  `StorefrontOnly`. Hidden is not the same as absent: the console was still
  shipping nineteen of the storefront's twenty-one JavaScript chunks, including
  the search provider and a cart the operator cannot use, to render nothing.

  Next allows more than one root layout as long as the app directory has no
  layout of its own and each route group supplies `<html>` and `<body>`.
  `(payload)` already did this; this is the third. `DESIGN.md` listed the split
  as a known follow-up and this closes it.

  What is deliberately absent: Header, Footer, DemoBanner, SearchProvider. The
  console's chrome is `admin/layout.tsx`, which is gated on the staff session.
*/

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const azeret = Azeret_Mono({
  variable: "--font-azeret",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Admin — OnlyParts",
  /* Belt and braces: `admin/layout.tsx` says this too, and neither should be
     the only place that does. A staff console must never be indexed. */
  robots: { index: false, follow: false },
};

export default function ConsoleRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${azeret.variable} h-full`}>
      {/*
        No `.paper` texture here. The fibre tooth stops a large empty region of
        the shop reading as a blank div; a console is dense by definition and
        the texture only muddies a table.
      */}
      <body className="flex min-h-full flex-col bg-bg antialiased">
        {children}
      </body>
    </html>
  );
}
