/**
 * Query parser + search — docs/09-SEARCH-SPEC.md §2–3.
 *
 * In production this module wraps Meilisearch: `parseQuery` builds the filter
 * expression, the residual becomes `q`. Here it runs over the in-memory demo
 * catalogue so the behaviour can be validated before the index exists.
 * The parser itself is production-shaped and is the piece meant to survive.
 */
import { CATEGORIES, PRODUCTS } from "./catalog";
import type { Product, Token } from "./types";

const TYPOS: Record<string, string> = {
  neodimium: "neodymium", neodynium: "neodymium", bering: "bearing", bearig: "bearing",
  stepr: "stepper", steper: "stepper", sockte: "socket", screwe: "screw",
  alumnium: "aluminium", aluminum: "aluminium", capasitor: "capacitor", resistore: "resistor",
};

/** Bearing seal shorthand → the canonical value used in the catalogue. */
const SEAL_ALIASES: Record<string, string> = {
  zz: "ZZ", "2z": "ZZ",
  rs: "2RS", "2rs": "2RS",
  open: "Open",
};

const SYNONYMS: Record<string, string> = {
  allen: "hex socket", inbus: "hex socket", csk: "countersunk", flathead: "countersunk",
  nylock: "nyloc", dupont: "jumper", ss: "stainless", inox: "stainless",
  pot: "potentiometer", dmm: "multimeter", brg: "bearing", "li-po": "lipo", prop: "propeller",
};

export function parseQuery(raw: string): { tokens: Token[]; residual: string } {
  const tokens: Token[] = [];
  const residual: string[] = [];
  const norm = raw.toLowerCase().replace(/[×✕]/g, "x").replace(/\s+/g, " ").trim();
  if (!norm) return { tokens, residual: "" };

  for (const original of norm.split(" ")) {
    const w = TYPOS[original] ?? original;
    // `raw` is what the user typed, so a chip can remove itself from the query
    const T = (key: string, label: string, value: string | number): Token =>
      ({ key, label, value, raw: original });
    let m: RegExpMatchArray | null;

    // SKU — short-circuits everything
    if (/^[a-z]{2}-[a-z0-9-]{3,}$/i.test(w)) { tokens.push(T("sku", w.toUpperCase(), w.toUpperCase())); continue; }
    // M3x10 / m3x10mm
    if ((m = w.match(/^m(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(?:mm)?$/))) {
      tokens.push(T("thread", "M" + m[1], "M" + m[1]));
      tokens.push(T("length_mm", m[2] + " mm", +m[2]));
      continue;
    }
    if ((m = w.match(/^m(\d+(?:\.\d+)?)$/))) { tokens.push(T("thread", "M" + m[1], "M" + m[1])); continue; }
    if ((m = w.match(/^nema(\d+)$/))) { tokens.push(T("nema_size", "NEMA " + m[1], +m[1])); continue; }
    if (w === "nema") { residual.push("nema"); continue; }
    if (/^\d{1,2}$/.test(w) && residual[residual.length - 1] === "nema") {
      residual.pop(); tokens.push(T("nema_size", "NEMA " + w, +w)); continue;
    }
    if (/^(18650|21700|26650|14500|10440)$/.test(w)) { tokens.push(T("cell_format", w, w)); continue; }
    if ((m = w.match(/^(\d{3,4})(zz|2rs|rs|2z|open)?$/))) {
      tokens.push(T("bearing_code", m[1], m[1]));
      // seal shorthand is a synonym set, not a literal: ZZ = 2Z = shielded,
      // RS = 2RS = sealed. `6202rs` must find the 2RS part.
      if (m[2]) {
        const seal = SEAL_ALIASES[m[2]];
        tokens.push(T("seal_type", seal, seal));
      }
      continue;
    }
    if ((m = w.match(/^(\d{3,5})kv$/))) { tokens.push(T("kv_rating", m[1] + " KV", +m[1])); continue; }
    if ((m = w.match(/^(\d{3,6})mah$/))) { tokens.push(T("capacity_mah", m[1] + " mAh", +m[1])); continue; }
    if ((m = w.match(/^(\d)s$/))) { tokens.push(T("cell_config", m[1] + "S", m[1] + "S")); continue; }
    if (/^(0201|0402|0603|0805|1206|1210|2010|2512)$/.test(w)) { tokens.push(T("package", w, w)); continue; }
    if ((m = w.match(/^(?:ss)?(304|316)$/))) { tokens.push(T("material", "SS " + m[1], "ss" + m[1])); continue; }
    if (/^(12\.9|10\.9|8\.8)$/.test(w)) { tokens.push(T("material", "Grade " + w, w)); continue; }
    if ((m = w.match(/^n(35|38|40|42|45|48|50|52)$/))) { tokens.push(T("grade", "N" + m[1], "N" + m[1])); continue; }
    // magnet 15x3
    if ((m = w.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/))) {
      tokens.push(T("dia_mm", "Ø" + m[1] + " mm", +m[1]));
      tokens.push(T("thickness_mm", m[2] + " mm thick", +m[2]));
      continue;
    }
    // plain dimension with unit — cm normalised to mm
    if ((m = w.match(/^(\d+(?:\.\d+)?)(mm|cm)$/))) {
      const v = m[2] === "cm" ? +m[1] * 10 : +m[1];
      tokens.push(T("length_mm", v + " mm", v));
      continue;
    }
    if (/^(2020|2040|3030|4040|4080)$/.test(w)) { tokens.push(T("profile_size", w, w)); continue; }
    if (/^(\d+(?:\.\d+)?)(k|m|n|u|p)$/.test(w)) { tokens.push(T("value", w, w)); continue; }

    residual.push(SYNONYMS[w] ?? w);
  }

  const seen = new Set<string>();
  return {
    tokens: tokens.filter((t) => {
      const k = t.key + t.value;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }),
    residual: residual.join(" "),
  };
}

export type Relaxed = { key: string; label: string; values: (string | number)[] };
export type CatHit = { path: string; n: number; slug: string };
export type SearchResult = {
  tokens: Token[];
  residual: string;
  results: Product[];
  relaxed: Relaxed | null;
  cats: CatHit[];
};

export function search(raw: string, limit = 6): SearchResult {
  const { tokens, residual } = parseQuery(raw);
  const words = residual.split(" ").filter(Boolean);

  const scored = PRODUCTS.map((p) => {
    let score = 0;
    for (const t of tokens) {
      if (t.key === "sku") {
        if (!p.sku.toUpperCase().includes(String(t.value))) return null;
        score += 200;
        continue;
      }
      const v = p.attrs[t.key];
      if (v === undefined) return null;
      if (String(v).toLowerCase() !== String(t.value).toLowerCase()) return null;
      score += 40;
    }
    const hay = `${p.title} ${p.text} ${p.cat} ${p.sku}`.toLowerCase();
    for (const w of words) {
      if (hay.includes(w)) score += 12;
      else if (w.length > 3 && hay.includes(w.slice(0, -1))) score += 6;
      else score -= 14;
    }
    if (!tokens.length && !words.length) score = 1;
    if (p.stock > 0) score += 3;
    return score > 0 ? { p, score } : null;
  }).filter((x): x is { p: Product; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);

  // zero-result recovery — relax the tightest numeric constraint
  if (!scored.length && tokens.length) {
    const numeric = tokens.filter((t) => typeof t.value === "number");
    if (numeric.length) {
      const drop = numeric[numeric.length - 1];
      const rest = tokens.filter((t) => t !== drop);
      const near = PRODUCTS
        .filter((p) => rest.every((t) => String(p.attrs[t.key] ?? "").toLowerCase() === String(t.value).toLowerCase()))
        .filter((p) => p.attrs[drop.key] !== undefined)
        .sort((a, b) =>
          Math.abs(Number(a.attrs[drop.key]) - Number(drop.value)) -
          Math.abs(Number(b.attrs[drop.key]) - Number(drop.value)));
      if (near.length) {
        return {
          tokens, residual,
          results: near.slice(0, limit),
          relaxed: {
            key: drop.key,
            label: drop.label,
            values: [...new Set(near.slice(0, 4).map((p) => p.attrs[drop.key]))],
          },
          cats: matchCats(raw),
        };
      }
    }
  }

  return { tokens, residual, results: scored.slice(0, limit).map((s) => s.p), relaxed: null, cats: matchCats(raw) };
}

export function matchCats(raw: string): CatHit[] {
  const q = raw.toLowerCase().trim();
  if (q.length < 2) return [];
  const out: CatHit[] = [];
  for (const c of CATEGORIES) {
    if (c.name.toLowerCase().includes(q)) out.push({ path: c.name, n: c.count, slug: c.slug });
    for (const sub of c.subs) {
      for (const leaf of sub.children) {
        const ln = leaf.name.toLowerCase();
        if (ln.includes(q) || q.split(" ").some((w) => w.length > 3 && ln.includes(w))) {
          out.push({ path: `${c.name} › ${sub.name} › ${leaf.name}`, n: leaf.count, slug: c.slug });
        }
      }
    }
  }
  return out.slice(0, 3);
}

export const SUGGESTIONS = [
  "M3x10 SS304 socket head",
  "608ZZ",
  "NEMA 17 stepper",
  "18650 3000mAh",
  "N52 15x3",
  "2020 extrusion",
  "0805 10k",
];
