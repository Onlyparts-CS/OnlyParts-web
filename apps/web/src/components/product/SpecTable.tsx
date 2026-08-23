"use client";

import { useState } from "react";
import { SPEC_GROUPS, SPEC_LABELS, hsnFor } from "@/lib/product";
import { inr } from "@/lib/catalog";
import { originValue, packerLabel } from "@/lib/legal";
import type { Sku } from "@/lib/skus";
import { CheckIcon } from "@/components/Icons";

/**
 * Spec table — docs/03-DESIGN-SYSTEM.md §5.6.
 * Driven by the attribute schema, never free text. `Copy specs` yields
 * tab-separated rows that paste straight into Excel, which is what
 * procurement buyers actually do with this data.
 */
export function SpecTable({ sku }: { sku: Sku }) {
  const [copied, setCopied] = useState(false);
  const hsn = hsnFor(sku);

  const groups = SPEC_GROUPS.map((g) => ({
    title: g.title,
    rows: g.keys
      .filter((k) => sku.attrs[k] !== undefined)
      .map((k) => ({
        key: k,
        label: SPEC_LABELS[k]?.label ?? k,
        value: `${sku.attrs[k]}${SPEC_LABELS[k]?.unit ? ` ${SPEC_LABELS[k]!.unit}` : ""}`,
      })),
  })).filter((g) => g.rows.length);

  /*
    Compliance & tax.

    This block used to end with two constants: `RoHS: Compliant` and `Country of
    origin: India`, printed identically on every product in the catalogue. Both
    were placeholders that read as facts. The origin one is the serious half —
    it is a Legal Metrology Rule 6(1) declaration, most of this catalogue is
    imported, and declaring the wrong origin is the offence the rule exists to
    punish. RoHS went with it: nothing in this system has ever verified it.

    Now every row comes from the product. A declaration we do not hold is
    absent, which is the honest state and the one `Products` blocks going Active
    on. HSN and GST stay unconditional because the importer already refuses a
    product without them.
  */
  const legal = sku.legal;
  groups.push({
    title: "Compliance & tax",
    rows: [
      { key: "hsn", label: "HSN code", value: hsn.code },
      { key: "gst", label: "GST rate", value: `${hsn.rate}%` },
      /*
        Origin prints unconditionally, and says so when we do not hold it. The
        other rows stay conditional — an absent net quantity is a row worth
        omitting. Origin is not: it is the declaration a buyer looks for, and
        dropping the line on the 99.93% of rows lacking it reads as though the
        question was never asked. Wording lives in `lib/legal.ts`, which is
        checked; getting it wrong is an offence, not a rendering bug.
      */
      { key: "origin", label: "Country of origin", value: originValue(legal) },
      ...(legal?.netQuantity
        ? [{ key: "netqty", label: "Net quantity", value: legal.netQuantity }]
        : []),
      ...(legal?.mrp
        ? [{ key: "mrp", label: "MRP (incl. all taxes)", value: inr(legal.mrp) }]
        : []),
      ...(legal?.importerName
        ? [{
            key: "importer",
            label: packerLabel(legal.countryOfOrigin),
            value: [legal.importerName, legal.importerAddress].filter(Boolean).join(", "),
          }]
        : []),
    ],
  });

  const copy = async () => {
    const text = groups
      .flatMap((g) => g.rows.map((r) => `${r.label}\t${r.value}`))
      .concat(`SKU\t${sku.sku}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the table is still readable on screen */
    }
  };

  return (
    <section id="specs" className="scroll-mt-28">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">Specifications</h2>
        <div className="flex gap-2">
          <button onClick={copy} className="btn btn-secondary btn-sm">
            {copied ? <><CheckIcon className="size-3.5" /> Copied</> : "Copy specs"}
          </button>
        </div>
      </div>

      {/*
        One card per group rather than two long columns inside a single card.

        The old layout was a 2-column grid whose rows were sized by the taller
        cell, so a 1-row group ("Standards") sitting beside a 4-row group left
        the whole bottom-right quadrant empty — 170px of dead column on a
        1345px grid. Worse, each row was `justify-between` across the full
        column width, which put 541px of nothing between "Thread" and "M2.5".

        Independent cards on `items-start` are only as tall as their contents,
        so nothing is stranded, and a ~420px card keeps the label and its value
        close enough to read as a pair. `divide-y` gives real rules between rows
        and — unlike the old zebra stripe — leaves the last row closing on the
        card border instead of on bare white.
      */}
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title} className="overflow-hidden rounded-md border border-line bg-surface shadow-e1">
            <h3 className="border-b border-line bg-sunken px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">
              {g.title}
            </h3>
            <dl className="divide-y divide-line">
              {g.rows.map((r) => (
                <div key={r.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 px-4 py-2.5">
                  <dt className="text-[0.8125rem] text-muted">{r.label}</dt>
                  <dd className="text-right font-mono text-[0.8125rem] tnum text-heading">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
