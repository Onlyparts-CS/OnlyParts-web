import type { GlyphKey } from "./types";
import { DEMO_DATA } from "./demo";

/**
 * Generated demo catalogue.
 *
 * The curated list in `catalog.ts` exists to exercise the search parser. This
 * file generates a realistic *population* — every thread × length × material
 * combination — because a facet rail cannot be evaluated against 45 SKUs. Every
 * record carries typed attributes exactly as `07-DATA-MODEL.md` §2.4 specifies,
 * so swapping this for a Postgres query later changes the source, not the shape.
 */
export type PriceBreak = { qty: number; price: number };

export type Sku = {
  sku: string;
  slug: string;
  title: string;
  /**
   * The `products` row this variant belongs to.
   *
   * Optional because the generated fixtures in this file have no database ids —
   * only `catalogDb` fills it. The admin table needs it to link a row to the
   * product it edits: a listing is variants, but imagery, copy and shelves all
   * live on the product above them.
   */
  productId?: number;
  /**
   * The product's hero photograph, when one has been uploaded.
   *
   * Absent is the normal case and not a gap: every slot falls back to a drawn
   * halftone plate, which is a designed answer rather than a placeholder. When
   * this is present the photograph goes through the *same* screen, so the two
   * sit in one world instead of looking like a stock image dropped into a
   * drawing.
   */
  image?: { url: string; alt: string };
  /** Every uploaded image with its role, for the PDP gallery slots. */
  images?: { role: string; url: string; alt: string }[];
  price: number;                 // paise, unit price at qty 1
  breaks: PriceBreak[];
  stock: number;
  dispatchHours: number;
  leadDays?: number;
  glyph: GlyphKey;
  attrs: Record<string, string | number>;
  /** many-to-many; [0] is the primary assignment and drives the canonical URL */
  categories: string[][];
  /**
   * Curated project slugs (`PROJECTS` in catalog.ts). Set per SKU by whoever
   * uploads it — never derived. Deriving it from the category tree meant every
   * fastener in the catalogue claimed "Build a Drone" simply because drones
   * contain fasteners, which is a claim we cannot stand behind on a product page.
   * Empty is the correct and common answer.
   */
  projects?: string[];
  /**
   * Legal Metrology Rule 6(1) declarations, as stored on the product.
   *
   * All optional here and none of them defaulted, because a wrong declaration
   * is the offence and a placeholder is a wrong declaration. The PDP renders
   * the block only when there is something true to put in it, and `Products`
   * refuses to let a product go Active until there is.
   */
  legal?: {
    countryOfOrigin?: string;
    /** paise, inclusive of all taxes — a ceiling, not the selling price */
    mrp?: number;
    netQuantity?: string;
    importerName?: string;
    importerAddress?: string;
  };
  rating: number;
  ratingCount: number;
};

/* deterministic pseudo-random so SSR and client agree */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 10000) / 10000; };
}

const breaksFor = (unit: number): PriceBreak[] => [
  { qty: 1, price: unit },
  { qty: 10, price: Math.round(unit * 0.9) },
  { qty: 100, price: Math.round(unit * 0.74) },
  { qty: 1000, price: Math.round(unit * 0.62) },
];

function stockFor(seed: string) {
  const r = rng(seed);
  const roll = r();
  if (roll > 0.94) return 0;                       // out of stock
  if (roll > 0.86) return Math.round(2 + r() * 7);  // low
  return Math.round(120 + r() * 4200);
}

/* ============================================================
   Fasteners — screws
   ============================================================ */
const THREADS = [
  { t: "M2",   pitch: 0.4,  base: 180, d: 3.8 },
  { t: "M2.5", pitch: 0.45, base: 210, d: 4.5 },
  { t: "M3",   pitch: 0.5,  base: 240, d: 5.5 },
  { t: "M4",   pitch: 0.7,  base: 320, d: 7.0 },
  { t: "M5",   pitch: 0.8,  base: 430, d: 8.5 },
  { t: "M6",   pitch: 1.0,  base: 610, d: 10.0 },
  { t: "M8",   pitch: 1.25, base: 980, d: 13.0 },
];

const LENGTHS: Record<string, number[]> = {
  M2:   [4, 5, 6, 8, 10, 12, 16, 20],
  "M2.5": [4, 5, 6, 8, 10, 12, 16, 20, 25],
  M3:   [4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 35, 40],
  M4:   [5, 6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 50],
  M5:   [6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 50],
  M6:   [8, 10, 12, 16, 20, 25, 30, 35, 40, 50, 60],
  M8:   [10, 12, 16, 20, 25, 30, 35, 40, 50, 60],
};

const MATERIALS = [
  { key: "SS 304",      mult: 1.0,  finish: "Plain / Passivated", grade: "A2-70" },
  { key: "SS 316",      mult: 1.55, finish: "Plain / Passivated", grade: "A4-80" },
  { key: "Alloy 12.9",  mult: 0.78, finish: "Black Oxide",        grade: "12.9" },
  { key: "Brass",       mult: 1.32, finish: "Natural",            grade: "CZ121" },
];

const HEADS = [
  { slug: "socket-head-cap", name: "Hex Socket Head Cap", code: "SHC", drive: "Hex (Allen)",     std: "DIN 912 / ISO 4762", mult: 1.0 },
  { slug: "button-head",     name: "Hex Button Head",     code: "BTN", drive: "Hex (Allen)",     std: "ISO 7380",           mult: 1.08 },
  { slug: "countersunk-csk", name: "Hex Countersunk CSK", code: "CSK", drive: "Hex (Allen)",     std: "DIN 7991",           mult: 1.05 },
  { slug: "pan-head",        name: "Phillips Pan Head",   code: "PAN", drive: "Cross (Phillips)", std: "DIN 7985",          mult: 0.92 },
];

/**
 * Curation stands in for what an admin would tick on upload.
 * Deliberately narrow: a drone is held together with M2–M3 hardware, so an M8
 * cap screw is not a drone part and does not claim to be one.
 */
function screwProjects(thread: string, len: number): string[] {
  const small = ["M2", "M2.5", "M3"].includes(thread);
  const out: string[] = [];
  if (small && len <= 20) out.push("drone", "repair-bench");
  if (["M3", "M4", "M5"].includes(thread)) out.push("3d-printer");
  if (["M5", "M6", "M8"].includes(thread)) out.push("cnc");
  return out;
}

function screws(): Sku[] {
  const out: Sku[] = [];
  for (const head of HEADS) {
    // the full matrix only for socket head; the rest get the common threads
    const threads = head.slug === "socket-head-cap" ? THREADS : THREADS.filter((t) => ["M2.5", "M3", "M4", "M5", "M6"].includes(t.t));
    for (const th of threads) {
      for (const len of LENGTHS[th.t]) {
        for (const mat of MATERIALS) {
          if (mat.key === "Brass" && (th.t === "M8" || len > 40)) continue;
          if (mat.key === "SS 316" && len > 40) continue;
          const matCode = mat.key.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
          const sku = `FS-${head.code}-${th.t.replace(".", "")}-${String(len).padStart(3, "0")}-${matCode}`;
          const unit = Math.round((th.base + len * 6) * mat.mult * head.mult / 10) * 10;
          const seed = sku;
          const r = rng(seed + "x");
          const cats: string[][] = [["fasteners", "screws-by-head", head.slug]];
          // real cross-listing: micro fasteners are also drone hardware
          if (["M2", "M2.5", "M3"].includes(th.t) && head.slug !== "pan-head") {
            cats.push(["drones-parts", "drone-hardware", "drone-screws"]);
          }
          out.push({
            sku,
            slug: sku.toLowerCase(),
            title: `${th.t} × ${len}mm ${head.name} Screw, ${mat.key}`,
            price: unit,
            breaks: breaksFor(unit),
            stock: stockFor(seed),
            dispatchHours: 24,
            glyph: "hex",
            attrs: {
              thread: th.t,
              length_mm: len,
              pitch_mm: th.pitch,
              head_dia_mm: th.d,
              material: mat.key,
              finish: mat.finish,
              grade: mat.grade,
              drive_type: head.drive,
              standard: head.std,
              head_type: head.name,
            },
            categories: cats,
            projects: screwProjects(th.t, len),
            rating: 4.4 + Math.round(r() * 6) / 10,
            ratingCount: Math.round(4 + r() * 180),
          });
        }
      }
    }
  }
  return out;
}

/* ============================================================
   Bearings — deep groove ball
   ============================================================ */
const BEARINGS = [
  { code: "623", id: 3, od: 10, w: 4 },   { code: "624", id: 4, od: 13, w: 5 },
  { code: "625", id: 5, od: 16, w: 5 },   { code: "626", id: 6, od: 19, w: 6 },
  { code: "627", id: 7, od: 22, w: 7 },   { code: "608", id: 8, od: 22, w: 7 },
  { code: "629", id: 9, od: 26, w: 8 },   { code: "6000", id: 10, od: 26, w: 8 },
  { code: "6001", id: 12, od: 28, w: 8 }, { code: "6002", id: 15, od: 32, w: 9 },
  { code: "6003", id: 17, od: 35, w: 10 },{ code: "6004", id: 20, od: 42, w: 12 },
  { code: "6005", id: 25, od: 47, w: 12 },{ code: "6200", id: 10, od: 30, w: 9 },
  { code: "6201", id: 12, od: 32, w: 10 },{ code: "6202", id: 15, od: 35, w: 11 },
  { code: "6203", id: 17, od: 40, w: 12 },{ code: "6204", id: 20, od: 47, w: 14 },
  { code: "688",  id: 8, od: 16, w: 5 },  { code: "686", id: 6, od: 13, w: 5 },
];
const SEALS = [
  { key: "ZZ (metal shielded)", code: "ZZ", mult: 1.0 },
  { key: "2RS (rubber sealed)", code: "2RS", mult: 1.16 },
  { key: "Open", code: "OPEN", mult: 0.9 },
];
const BRG_MAT = [
  { key: "Chrome Steel (GCr15)", code: "CS", mult: 1.0 },
  { key: "Stainless (440C)", code: "SS", mult: 2.1 },
];

function bearings(): Sku[] {
  const out: Sku[] = [];
  for (const b of BEARINGS) {
    for (const s of SEALS) {
      for (const m of BRG_MAT) {
        if (m.code === "SS" && s.code === "OPEN") continue;
        const sku = `BR-${b.code}-${s.code}-${m.code}`;
        const unit = Math.round((900 + b.od * 42 + b.w * 30) * s.mult * m.mult / 10) * 10;
        const r = rng(sku + "y");
        out.push({
          sku, slug: sku.toLowerCase(),
          title: `${b.code}${s.code === "OPEN" ? "" : s.code} Deep Groove Ball Bearing — ID ${b.id} · OD ${b.od} · W ${b.w}${m.code === "SS" ? ", Stainless" : ""}`,
          price: unit, breaks: breaksFor(unit),
          stock: stockFor(sku), dispatchHours: 24, glyph: "bearing",
          attrs: {
            bearing_code: b.code, bore_id_mm: b.id, outer_od_mm: b.od, width_mm: b.w,
            seal_type: s.key, material: m.key, max_rpm: Math.round(30000 - b.od * 320),
            precision_class: "ABEC-1",
          },
          categories: [["bearings", "ball-bearings", "deep-groove"]],
          projects: b.id <= 8 ? ["3d-printer", "robot"] : ["cnc", "robot"],
          rating: 4.3 + Math.round(r() * 7) / 10,
          ratingCount: Math.round(3 + r() * 120),
        });
      }
    }
  }
  return out;
}

/* ============================================================
   Magnets — neodymium discs
   ============================================================ */
const DIAS = [3, 5, 6, 8, 10, 12, 15, 20, 25, 30];
const THICK = [1, 2, 3, 5, 8, 10];
const GRADES = [
  { g: "N35", mult: 1.0 }, { g: "N42", mult: 1.28 }, { g: "N52", mult: 1.62 },
];

function magnets(): Sku[] {
  const out: Sku[] = [];
  for (const d of DIAS) {
    for (const t of THICK) {
      if (t > d) continue;
      for (const gr of GRADES) {
        const sku = `MG-${gr.g}-${d}X${t}`;
        const unit = Math.round((600 + d * d * t * 1.6) * gr.mult / 10) * 10;
        const r = rng(sku + "z");
        const pull = +((d * d * t) / 340 * gr.mult).toFixed(2);
        out.push({
          sku, slug: sku.toLowerCase(),
          title: `${d} × ${t}mm Neodymium Disc Magnet ${gr.g} (pack of 10)`,
          price: unit, breaks: breaksFor(unit),
          stock: stockFor(sku), dispatchHours: 24, glyph: "magnet",
          attrs: {
            grade: gr.g, dia_mm: d, thickness_mm: t, pull_force_kg: pull,
            coating: "NiCuNi", max_temp_c: gr.g === "N52" ? 60 : 80, shape: "Disc",
          },
          categories: [["magnets", "neodymium-ndfeb", "disc"]],
          rating: 4.5 + Math.round(r() * 5) / 10,
          ratingCount: Math.round(2 + r() * 90),
        });
      }
    }
  }
  return out;
}

/* ============================================================
   Motors — NEMA 17 steppers
   ============================================================ */
function steppers(): Sku[] {
  const bodies = [
    { len: 20, ncm: 13 }, { len: 34, ncm: 26 }, { len: 40, ncm: 40 },
    { len: 48, ncm: 59 }, { len: 60, ncm: 65 },
  ];
  const shafts = [5, 8];
  const out: Sku[] = [];
  for (const b of bodies) {
    for (const sh of shafts) {
      if (sh === 8 && b.len < 40) continue;
      const sku = `MT-N17-${b.len}-${sh}MM`;
      const unit = 38000 + b.ncm * 620 + (sh === 8 ? 6000 : 0);
      const r = rng(sku + "w");
      out.push({
        sku, slug: sku.toLowerCase(),
        title: `NEMA 17 Stepper Motor 1.8° ${b.ncm}Ncm, ${b.len}mm body, ${sh}mm shaft`,
        price: unit, breaks: breaksFor(unit),
        stock: stockFor(sku), dispatchHours: 24, glyph: "rotor",
        attrs: {
          nema_size: 17, torque_ncm: b.ncm, body_length_mm: b.len, shaft_dia_mm: sh,
          step_angle: 1.8, voltage_v: 12, current_a: 1.5, phases: 2,
        },
        categories: [
          ["motors", "stepper-motors", "nema-17"],
          ["3d-printing", "electronics", "control-boards"],
          ["cnc-machines-parts", "control-electronics", "stepper-drivers"],
        ],
        projects: ["3d-printer", "cnc", "robot"],
        rating: 4.5 + Math.round(r() * 5) / 10,
        ratingCount: Math.round(6 + r() * 140),
      });
    }
  }
  return out;
}

let built: Sku[] | null = null;

/**
 * The catalogue.
 *
 * Gated on `DEMO_DATA` (see `lib/demo.ts`). With the flag off — which is the
 * default, and therefore what any deployment gets — this returns an empty array
 * and every surface downstream falls through to its empty state. Nothing here
 * can leak into production by forgetting to remove it.
 *
 * When the real backend lands this becomes a Payload query; the signature stays
 * the same so nothing that consumes it has to change.
 */
export function allSkus(): Sku[] {
  if (!DEMO_DATA) return [];
  if (!built) built = [...screws(), ...bearings(), ...magnets(), ...steppers()];
  return built;
}

/** Every SKU listed under a category path — includes descendants and cross-listings. */
export function skusInPath(path: string[]): Sku[] {
  return allSkus().filter((s) =>
    s.categories.some((c) => path.every((seg, i) => c[i] === seg))
  );
}
