import type { Metadata } from "next";
import { Archivo, Azeret_Mono } from "next/font/google";
import "../globals.css";
import { SearchProvider } from "@/components/search/SearchProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DemoBanner } from "@/components/DemoBanner";
import { PageViewBeacon } from "@/components/PageViewBeacon";

/*
  One grotesque, used at every width and size the page needs — the
  width axis is what makes a drawer-label plate possible, because the
  lettering spreads to fill a fixed slot rather than sitting in it.
  One squared mono for data, measurements and bin coordinates.
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
  title: "OnlyParts — Every part. One cart.",
  description:
    "Fasteners, motors, electronics, batteries, bearings, magnets and more. No minimum order, GST invoices, ships in 24 hours across India. Can't buy it? We'll make it.",
  metadataBase: new URL("https://onlyparts.in"),
  openGraph: {
    title: "OnlyParts — Every part. One cart.",
    description: "13 categories of hardware, mechanical and electronic parts. No MOQ. Plus manufacturing on demand.",
    type: "website",
    locale: "en_IN",
  },
};

/*
  The direction contract. React cannot emit a bare comment node, so it
  rides inside one hidden element — it survives the production build
  and stays greppable by its seed key, which is the point of it.

  It is the LAST child of <body>, not the first. React's streaming SSR
  uses HTML comments as its own control protocol for Suspense
  boundaries; an arbitrary comment sitting at the head of the body got
  interleaved with those markers and left the entire page stranded
  inside an unrevealed `<div hidden id="S:0">`. Trailing the body keeps
  the contract in the emitted markup and out of React's way.
*/
const CONTRACT = `<!--
OnlyParts — direction contract · seed 1a1935f1

THESIS: A parts store is a parts cabinet. The catalogue is the shopfront and
search is a drawer handle, not the window. Refuses both the dense blue
e-commerce grid and its airy white DTC opposite.

OWN-WORLD: Paper ground, warm-neutral ink, two plates only — red oxide is the
single accent and carries stock, action and presence on every page including
Make-on-Demand; turquoise survives in the wordmark alone. All imagery is
screened, drawings and photographs alike, at 45°/15° and held to one ink
limit — nothing is ever shown raw. Square corners, stamped states, bin
coordinates, millimetre rules. Archivo at plate width; Azeret Mono for every
datum.

STORY: This one place holds the parts I would otherwise buy from five vendors.
I see the breadth before anyone asks me to search. One cart, one box, one GST
invoice.

FIRST VIEWPORT: The closed cabinet face, full bleed. A monumental halftone
part-plate anchors the left; wordmark, inventory count and bin coordinates sit
tiny in the margins. The drawer grid starts at the fold and scroll pulls the
drawers open in sequence.

FORM: Card index / parts cabinet — candidate 6 of 7 on the grounded list.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${azeret.variable} h-full`}>
      {/*
        `suppressHydrationWarning` covers this element's own attributes only —
        not its children, so a genuine mismatch inside the page still shouts.

        It is here because browser extensions write to `<body>` before React
        hydrates: ColorZilla adds `cz-shortcut-listen="true"`, Grammarly adds
        `data-gr-ext-installed`, and React counts each as a server/client
        mismatch it "won't patch up". The server HTML contains neither. There is
        nothing to fix in the app and no way to stop an extension, so the
        warning is suppressed at exactly the element that receives them.
      */}
      <body className="paper flex min-h-full flex-col antialiased" suppressHydrationWarning>
        {/*
          Unconditional again. The chrome used to be wrapped in a client-side
          `StorefrontOnly` path check, because `/admin` was nested under this
          layout and inherited the whole shop. The console now has its own root
          layout in `(console)`, so nothing here needs to ask where it is.
        */}
        <SearchProvider>
          <DemoBanner />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </SearchProvider>
        <PageViewBeacon />
        <div hidden dangerouslySetInnerHTML={{ __html: CONTRACT }} />
      </body>
    </html>
  );
}
