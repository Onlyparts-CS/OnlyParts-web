export type GlyphKey =
  | "hex" | "rotor" | "chip" | "cell" | "nozzle" | "prop"
  | "wrench" | "bearing" | "magnet" | "endmill" | "contactor" | "hub" | "extrusion";

export type L3 = { name: string; count: number };
export type L2 = { name: string; children: L3[] };

export type Category = {
  slug: string;
  name: string;
  blurb: string;
  count: number;
  glyph: GlyphKey;
  /** bento weight — "wide" tiles span 2 columns and carry a photograph */
  weight: "wide" | "std";
  subs: L2[];
};

export type Product = {
  sku: string;
  title: string;
  /** paise */
  price: number;
  /** best price at the top break, paise */
  bulkPrice?: number;
  bulkQty?: number;
  cat: string;
  stock: number;
  dispatchHours: number;
  glyph: GlyphKey;
  attrs: Record<string, string | number>;
  text: string;
};

export type Project = {
  slug: string;
  name: string;
  parts: number;
  from: string;
  glyph: GlyphKey;
  spans: string[];
};

export type Token = {
  key: string;
  label: string;
  value: string | number;
  /** the word the user actually typed — lets a chip remove itself from the query */
  raw: string;
};
