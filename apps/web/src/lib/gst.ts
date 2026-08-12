/**
 * Indian GST engine — docs/06-BACKEND-ARCHITECTURE.md §8.2.
 *
 * Two rules decide everything here:
 *
 *  1. **Tax is computed per line, never on the order total.** Lines can carry
 *     different HSN codes and rates, and the invoice has to show each one.
 *  2. **Catalogue prices are GST-inclusive** (Indian retail convention), so the
 *     taxable value is back-computed from the inclusive price. Getting this
 *     backwards inflates every invoice by the tax amount.
 *
 * Intra-state supply splits into CGST + SGST at half the rate each.
 * Inter-state supply is a single IGST at the full rate.
 */

export type StateInfo = { code: string; name: string };

/** GST state codes. Place of supply is the delivery state. */
export const STATES: StateInfo[] = [
  { code: "01", name: "Jammu & Kashmir" }, { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" }, { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" }, { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" }, { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" }, { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" }, { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" }, { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" }, { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" }, { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" }, { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" }, { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" }, { code: "24", name: "Gujarat" },
  { code: "27", name: "Maharashtra" }, { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" }, { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" }, { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" }, { code: "35", name: "Andaman & Nicobar" },
  { code: "36", name: "Telangana" }, { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

/** Warehouse of supply. Karnataka — see docs/10-INFRA-DEVOPS.md open questions. */
export const SELLER_STATE = "29";
export const SELLER_GSTIN = "29AABCO1234M1Z5";

export type LineTax = {
  /** ex-GST value, paise */
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** total tax, paise */
  tax: number;
  /** inclusive line total, paise */
  total: number;
};

/**
 * @param inclusiveTotal GST-inclusive line total in paise
 * @param rate           GST percentage (5 / 12 / 18 / 28)
 * @param placeOfSupply  delivery state code
 */
export function taxOnInclusive(inclusiveTotal: number, rate: number, placeOfSupply: string): LineTax {
  const taxable = Math.round((inclusiveTotal * 100) / (100 + rate));
  const tax = inclusiveTotal - taxable;
  const intra = placeOfSupply === SELLER_STATE;
  // half rounds up on CGST so the two halves always sum back to `tax` exactly
  const cgst = intra ? Math.ceil(tax / 2) : 0;
  const sgst = intra ? tax - cgst : 0;
  return { taxable, cgst, sgst, igst: intra ? 0 : tax, tax, total: inclusiveTotal };
}

export type InvoiceLine = {
  sku: string;
  title: string;
  hsn: string;
  rate: number;
  qty: number;
  unitPrice: number;   // inclusive, paise
  lineTotal: number;   // inclusive, paise
  tax: LineTax;
};

export type Totals = {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  shipping: number;
  shippingTax: LineTax;
  grand: number;
  intraState: boolean;
};

export const FREE_SHIPPING_THRESHOLD = 99900;   // ₹999
const SHIPPING_FLAT = 7900;                     // ₹79
const SHIPPING_GST_RATE = 18;

export function shippingFor(subtotalInclusive: number) {
  return subtotalInclusive >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
}

export function totalsFor(lines: InvoiceLine[], placeOfSupply: string): Totals {
  const subtotal = lines.reduce((n, l) => n + l.lineTotal, 0);
  const shipping = shippingFor(subtotal);
  const shippingTax = taxOnInclusive(shipping, SHIPPING_GST_RATE, placeOfSupply);

  const t = lines.reduce(
    (a, l) => ({
      taxable: a.taxable + l.tax.taxable,
      cgst: a.cgst + l.tax.cgst,
      sgst: a.sgst + l.tax.sgst,
      igst: a.igst + l.tax.igst,
      tax: a.tax + l.tax.tax,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 },
  );

  return {
    taxable: t.taxable + shippingTax.taxable,
    cgst: t.cgst + shippingTax.cgst,
    sgst: t.sgst + shippingTax.sgst,
    igst: t.igst + shippingTax.igst,
    tax: t.tax + shippingTax.tax,
    shipping,
    shippingTax,
    grand: subtotal + shipping,
    intraState: placeOfSupply === SELLER_STATE,
  };
}

/** GSTIN: 2-digit state code, 10-char PAN, entity digit, 'Z', checksum. */
export function isValidGstin(g: string): boolean {
  const v = g.trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v)) return false;
  return STATES.some((s) => s.code === v.slice(0, 2));
}

export const stateFromGstin = (g: string) => g.trim().slice(0, 2);

/*
  Order and invoice numbering used to live here, counting a `seq` kept in
  localStorage. It is gone: `nextOrderNumber` in `collections/Orders.ts` issues
  numbers from the database instead, which is the only place a gapless sequence
  can actually be kept — two browsers cannot agree on what the next number is,
  and under GST a duplicated invoice number is a filing problem, not a bug.
*/

/** Very rough pincode → state, enough to prefill the form. */
export function stateFromPincode(pin: string): string | null {
  const p = Number(pin.slice(0, 3));
  if (!Number.isFinite(p)) return null;
  const ranges: [number, number, string][] = [
    [110, 110, "07"], [111, 136, "06"], [140, 160, "03"], [160, 160, "04"],
    [171, 177, "02"], [180, 194, "01"], [201, 285, "09"], [301, 345, "08"],
    [360, 396, "24"], [400, 445, "27"], [450, 488, "23"], [490, 497, "22"],
    [500, 509, "36"], [515, 535, "37"], [560, 591, "29"], [600, 643, "33"],
    [670, 695, "32"], [700, 743, "19"], [751, 770, "21"], [781, 788, "18"],
    [800, 855, "10"], [814, 835, "20"], [248, 263, "05"], [605, 605, "34"],
    [403, 403, "30"],
  ];
  for (const [lo, hi, code] of ranges) if (p >= lo && p <= hi) return code;
  return null;
}
