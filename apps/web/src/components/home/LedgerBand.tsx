import { CATALOGUE_EMPTY } from "@/lib/demo";

/* ============================================================
   The ledger band.
   ------------------------------------------------------------
   The page needs a rest between the cabinet and the builds, so
   this one is deliberately quiet: no display type, no counters
   rolling up, no metric tiles. It is a solid ink bar with the
   terms of trade set small — the running foot of a printed
   catalogue, which is exactly what these facts are.

   Every line here is true before the catalogue is seeded. The
   only figure that depends on stock is gated.
   ============================================================ */

const TERMS: [string, string][] = [
  ["No minimum order", "buy one piece or ten thousand"],
  ["Price breaks", "applied in the cart, not on request"],
  ["24 h dispatch target", "on anything held in stock"],
  ["GST invoice", "HSN per line, CGST/SGST or IGST"],
  ["BOM upload", "a spreadsheet becomes a cart"],
  ["Made to order", "quoted inside 24 hours"],
];

export function LedgerBand() {
  return (
    <section id="terms" className="scroll-mt-24 border-y border-ink-950 bg-ink-900 py-10 text-ink-100 lg:py-12">
      <div className="container-page">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-ink-700 pb-4">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-300">
            Terms of trade
          </p>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-400">
            {CATALOGUE_EMPTY ? "Pre-launch · catalogue seeding" : "Bengaluru · ships across India"}
          </p>
        </div>

        <dl className="grid gap-x-10 gap-y-6 pt-7 sm:grid-cols-2 lg:grid-cols-3">
          {TERMS.map(([term, detail]) => (
            <div key={term} className="flex gap-3">
              <span aria-hidden className="mt-[7px] h-px w-5 shrink-0 bg-spot-500" />
              <div className="min-w-0">
                <dt className="font-mono text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-ink-50">
                  {term}
                </dt>
                <dd className="mt-1 text-[0.8125rem] leading-relaxed text-ink-300">{detail}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
