import { allSkus, type Sku } from "./skus";
import { resolve, allPaths, type Node } from "./taxonomy";
import { PROJECTS } from "./catalog";
import type { GlyphKey } from "./types";

/* ============================================================
   Variant axes — docs/04-WIREFRAMES.md §5
   A product is the merchandising unit; a variant is what you buy.
   These are the attributes that vary *within* one product family.
   ============================================================ */
export const VARIANT_AXES: Record<string, string[]> = {
  "socket-head-cap": ["thread", "length_mm", "material"],
  "button-head":     ["thread", "length_mm", "material"],
  "countersunk-csk": ["thread", "length_mm", "material"],
  "pan-head":        ["thread", "length_mm", "material"],
  "deep-groove":     ["bearing_code", "seal_type", "material"],
  disc:              ["grade", "dia_mm", "thickness_mm"],
  "nema-17":         ["body_length_mm", "shaft_dia_mm"],
};

const AXIS_LABELS: Record<string, { label: string; unit?: string }> = {
  thread: { label: "Thread" },
  length_mm: { label: "Length", unit: "mm" },
  material: { label: "Material" },
  bearing_code: { label: "Bearing code" },
  seal_type: { label: "Seal" },
  grade: { label: "Grade" },
  dia_mm: { label: "Diameter", unit: "mm" },
  thickness_mm: { label: "Thickness", unit: "mm" },
  body_length_mm: { label: "Body length", unit: "mm" },
  shaft_dia_mm: { label: "Shaft", unit: "mm" },
};

const THREAD_ORDER = ["M1.6", "M2", "M2.5", "M3", "M4", "M5", "M6", "M8", "M10", "M12"];

/* ============================================================
   Spec table grouping — docs/03-DESIGN-SYSTEM.md §5.6
   ============================================================ */
export const SPEC_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Dimensions", keys: ["thread", "pitch_mm", "length_mm", "head_dia_mm", "bore_id_mm", "outer_od_mm", "width_mm", "dia_mm", "thickness_mm", "body_length_mm", "shaft_dia_mm"] },
  { title: "Material & finish", keys: ["material", "finish", "grade", "coating"] },
  { title: "Mechanical & electrical", keys: ["drive_type", "head_type", "seal_type", "max_rpm", "pull_force_kg", "max_temp_c", "torque_ncm", "step_angle", "voltage_v", "current_a", "phases", "shape"] },
  { title: "Standards", keys: ["standard", "precision_class", "nema_size"] },
  // Supplier-declared, and the same field `worksWith` pairs on — so what the
  // spec table states and what the shelf below it claims cannot disagree.
  { title: "Compatibility", keys: ["compatibility"] },
];

export const SPEC_LABELS: Record<string, { label: string; unit?: string }> = {
  thread: { label: "Thread" },
  pitch_mm: { label: "Pitch", unit: "mm" },
  length_mm: { label: "Length", unit: "mm" },
  head_dia_mm: { label: "Head diameter", unit: "mm" },
  bore_id_mm: { label: "Bore (ID)", unit: "mm" },
  outer_od_mm: { label: "Outer (OD)", unit: "mm" },
  width_mm: { label: "Width", unit: "mm" },
  dia_mm: { label: "Diameter", unit: "mm" },
  thickness_mm: { label: "Thickness", unit: "mm" },
  body_length_mm: { label: "Body length", unit: "mm" },
  shaft_dia_mm: { label: "Shaft diameter", unit: "mm" },
  material: { label: "Material" },
  finish: { label: "Finish" },
  grade: { label: "Grade" },
  coating: { label: "Coating" },
  drive_type: { label: "Drive" },
  head_type: { label: "Head type" },
  seal_type: { label: "Seal" },
  max_rpm: { label: "Max speed", unit: "rpm" },
  precision_class: { label: "Precision class" },
  pull_force_kg: { label: "Pull force", unit: "kg" },
  max_temp_c: { label: "Max operating temp", unit: "°C" },
  torque_ncm: { label: "Holding torque", unit: "Ncm" },
  step_angle: { label: "Step angle", unit: "°" },
  voltage_v: { label: "Rated voltage", unit: "V" },
  current_a: { label: "Rated current", unit: "A" },
  phases: { label: "Phases" },
  shape: { label: "Shape" },
  standard: { label: "Standard" },
  nema_size: { label: "Frame size", unit: "NEMA" },
  bearing_code: { label: "Bearing code" },
  compatibility: { label: "Declared for" },
};

/** GST HSN codes by top-level category — required on every invoice. */
const HSN: Record<string, { code: string; rate: number }> = {
  fasteners:               { code: "73181500", rate: 18 },
  bearings:                { code: "84821011", rate: 18 },
  magnets:                 { code: "85051190", rate: 18 },
  motors:                  { code: "85013119", rate: 18 },
  "electronic-components": { code: "85411000", rate: 18 },
  "batteries-power":       { code: "85065000", rate: 18 },
  "3d-printers":          { code: "84779000", rate: 18 },
  "3d-printing":          { code: "84771000", rate: 18 },
  "drones-parts":          { code: "88062400", rate: 18 },
  tools:                   { code: "82055900", rate: 18 },
  "cnc-machines-parts":    { code: "84592900", rate: 18 },
  "industrial-electricals":{ code: "85363000", rate: 18 },
  "ev-parts":              { code: "87089900", rate: 18 },
  hardware:                { code: "76041000", rate: 18 },
};

export const hsnFor = (sku: Sku) => HSN[sku.categories[0][0]] ?? { code: "—", rate: 18 };

/* ============================================================
   Lookups
   ============================================================ */
/** By URL slug — used by the product route. */
export const findSku = (slug: string): Sku | undefined =>
  allSkus().find((s) => s.slug === slug);

/**
 * By SKU code — used by the cart, BOM import and reorder.
 *
 * These are deliberately separate lookups: the slug is a URL concern and can be
 * changed with a redirect, while the SKU is the business identifier a customer
 * types, pastes and puts on a purchase order. Cart lines key on the SKU.
 */
export const findBySku = (sku: string): Sku | undefined => {
  const needle = sku.trim().toUpperCase();
  return allSkus().find((s) => s.sku.toUpperCase() === needle);
};

export type AxisOption = {
  value: string;
  label: string;
  /** a variant exists for this value given the other axes' current selections */
  available: boolean;
  /** the variant to navigate to, if one exists */
  slug?: string;
  /** why it isn't available, when it isn't */
  reason?: string;
};

export type Axis = { key: string; label: string; unit?: string; options: AxisOption[] };

/**
 * Build the variant matrix.
 *
 * Rule from the wireframes: dim, don't hide. A buyer who can't see that M3×10
 * exists in 12.9 alloy assumes we don't sell it. Showing it greyed with a
 * reason is the difference between "unavailable" and "invisible".
 */
export function buildMatrix(current: Sku, pool: Sku[]): { axes: Axis[]; family: Sku[] } {
  const leaf = current.categories[0].at(-1)!;
  const keys = VARIANT_AXES[leaf];
  const family = pool.filter((s) =>
    // same family = same non-axis identity (e.g. same head type)
    s.categories[0].join("/") === current.categories[0].join("/")
  );
  if (!keys) return { axes: [], family };

  const axes: Axis[] = keys.map((key) => {
    const values = [...new Set(family.map((s) => String(s.attrs[key])))];
    values.sort(byEngineeringOrder(key));

    const options: AxisOption[] = values.map((value) => {
      // hold the other axes fixed, vary this one — that's what the buyer means
      const target = family.find((s) =>
        String(s.attrs[key]) === value &&
        keys.every((k) => k === key || String(s.attrs[k]) === String(current.attrs[k]))
      );
      if (target) {
        return { value, label: fmtAxis(key, value), available: true, slug: target.slug };
      }
      // exists somewhere in the family, just not with this combination
      const anywhere = family.find((s) => String(s.attrs[key]) === value);
      return {
        value,
        label: fmtAxis(key, value),
        available: false,
        reason: anywhere
          ? "Not made in this combination — available on request, 7–10 days"
          : "Not stocked",
      };
    });

    const meta = AXIS_LABELS[key] ?? { label: key };
    return { key, label: meta.label, unit: meta.unit, options };
  });

  return { axes, family };
}

const fmtAxis = (key: string, value: string) => {
  const unit = AXIS_LABELS[key]?.unit;
  return unit ? `${value} ${unit}` : value;
};

function byEngineeringOrder(key: string) {
  return (a: string, b: string) => {
    if (key === "thread") return THREAD_ORDER.indexOf(a) - THREAD_ORDER.indexOf(b);
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  };
}

/** Resolve the price-break tier that applies at a given quantity. */
export const tierFor = (sku: Sku, qty: number) =>
  [...sku.breaks].reverse().find((b) => qty >= b.qty) ?? sku.breaks[0];

/** Every category this SKU is listed in, resolved to nodes. Primary first. */
export function listings(sku: Sku): { trail: Node[]; primary: boolean }[] {
  return sku.categories
    .map((path, i) => {
      const hit = resolve(path);
      return hit ? { trail: hit.trail, primary: i === 0 } : null;
    })
    .filter((x): x is { trail: Node[]; primary: boolean } => x !== null);
}

/**
 * Substitutes — FR-25, the DigiKey pattern. When a part is out of stock the
 * buyer's question is "what else fits?", and the attribute schema can answer it:
 * same dimensions, different material or finish.
 */
export function substitutes(sku: Sku, pool: Sku[], limit = 4): Sku[] {
  const leaf = sku.categories[0].at(-1)!;
  const keys = VARIANT_AXES[leaf] ?? [];
  const dimensional = keys.filter((k) => k !== "material" && k !== "finish" && k !== "coating");
  return pool
    .filter((s) => s.sku !== sku.sku && s.stock > 0)
    .filter((s) => dimensional.every((k) => String(s.attrs[k]) === String(sku.attrs[k])))
    .sort((a, b) => b.stock - a.stock)
    .slice(0, limit);
}

/* ============================================================
   Complements — "Works with this part"

   This replaces `boughtWith`, which could not express a complement. Every one
   of its branches filtered for a *matching* attribute — same thread, same bore
   — and its fallback was "anything in stock in the same L1 drawer". So a NEMA
   17 motor's pairings were other motors, never the driver it needs. It also
   ran under the heading "Frequently bought with", which claims a purchase
   pattern that nothing here has measured.

   What replaces it is a claim we can stand behind: these parts fit together,
   and the page says on what. Three sources, strongest first:

     1. Fit  — a complementary leaf where the dimension that has to agree
               actually agrees (an M4 bolt and an M4 nyloc nut).
     2. Compatibility — both parts declare the same platform token. This is a
               supplier-stated fact carried through from the feed, not a guess.
     3. Pairing — the complementary leaf with no dimension to check (a LiPo
               pack and a balance charger).

   Nothing here is derived from traffic or orders, because there is neither.
   ============================================================ */

/**
 * Leaf → the leaves that complete it, each with the reason shown on the card,
 * and the attribute that must agree for the pair to actually fit (if any).
 *
 * Keyed on the leaf slug, which is the last segment of the primary category
 * path. Entries are engineering facts, so they are hand-written and stay that
 * way — deriving them from the tree is what put "Build a Drone" on an M2.5
 * screw, and the same mistake is available here.
 */
type Pairing = { leaf: string; why: string; fit?: string };

const COMPLEMENTS: Record<string, Pairing[]> = {
  /* fasteners — the dimension that must agree is the thread */
  "socket-head-cap":  [{ leaf: "nyloc-nuts", why: "Locks this bolt", fit: "thread" }, { leaf: "hex-nuts", why: "Takes this thread", fit: "thread" }, { leaf: "flat-plain", why: "Spreads the load", fit: "thread" }, { leaf: "brass-heat-set", why: "Threads to match", fit: "thread" }],
  "button-head":      [{ leaf: "nyloc-nuts", why: "Locks this bolt", fit: "thread" }, { leaf: "hex-nuts", why: "Takes this thread", fit: "thread" }, { leaf: "flat-plain", why: "Spreads the load", fit: "thread" }],
  "countersunk-csk":  [{ leaf: "hex-nuts", why: "Takes this thread", fit: "thread" }, { leaf: "brass-heat-set", why: "Threads to match", fit: "thread" }],
  "pan-head":         [{ leaf: "hex-nuts", why: "Takes this thread", fit: "thread" }, { leaf: "flat-plain", why: "Spreads the load", fit: "thread" }],
  "cheese-head":      [{ leaf: "hex-nuts", why: "Takes this thread", fit: "thread" }, { leaf: "flat-plain", why: "Spreads the load", fit: "thread" }],
  "hex-bolts":        [{ leaf: "hex-nuts", why: "Takes this thread", fit: "thread" }, { leaf: "flange-nuts", why: "Takes this thread", fit: "thread" }, { leaf: "flat-plain", why: "Spreads the load", fit: "thread" }],
  "hex-nuts":         [{ leaf: "hex-bolts", why: "Takes this nut", fit: "thread" }, { leaf: "socket-head-cap", why: "Takes this nut", fit: "thread" }, { leaf: "flat-plain", why: "Spreads the load", fit: "thread" }],
  "nyloc-nuts":       [{ leaf: "socket-head-cap", why: "Takes this nut", fit: "thread" }, { leaf: "hex-bolts", why: "Takes this nut", fit: "thread" }],
  "brass-standoffs":  [{ leaf: "pan-head", why: "Screws into this", fit: "thread" }, { leaf: "hex-nuts", why: "Takes this thread", fit: "thread" }],
  "pcb-spacers":      [{ leaf: "pan-head", why: "Passes through this", fit: "thread" }],
  "brass-heat-set":   [{ leaf: "socket-head-cap", why: "Threads into this", fit: "thread" }, { leaf: "button-head", why: "Threads into this", fit: "thread" }],

  /* bearings — the dimension that must agree is the bore */
  "deep-groove":      [{ leaf: "circlips", why: "Retains this bearing", fit: "bore_id_mm" }, { leaf: "pillow-blocks", why: "Houses this bore", fit: "bore_id_mm" }, { leaf: "shaft-couplers", why: "Fits this bore", fit: "bore_id_mm" }],
  "linear-ball-bearings": [{ leaf: "linear-rails-mgn", why: "Runs on this", fit: "bore_id_mm" }, { leaf: "circlips", why: "Retains this bearing", fit: "bore_id_mm" }],
  "pillow-blocks":    [{ leaf: "deep-groove", why: "Fits this housing", fit: "bore_id_mm" }],

  /* motors — a motor's complement is what drives it and what couples to it */
  "nema-17":          [{ leaf: "dc-motor-drivers", why: "Drives this motor" }, { leaf: "stepper-drivers", why: "Drives this motor" }, { leaf: "mounts-brackets", why: "Mounts this motor" }, { leaf: "shaft-couplers", why: "Couples this shaft", fit: "shaft_dia_mm" }, { leaf: "smps-modules", why: "Powers this motor" }],
  "brushed-dc":       [{ leaf: "dc-motor-drivers", why: "Drives this motor" }, { leaf: "encoders", why: "Reads this shaft" }, { leaf: "shaft-couplers", why: "Couples this shaft", fit: "shaft_dia_mm" }],
  "geared-dc-bo-tt":  [{ leaf: "dc-motor-drivers", why: "Drives this motor" }, { leaf: "mounts-brackets", why: "Mounts this motor" }, { leaf: "encoders", why: "Reads this shaft" }],
  "planetary-gear":   [{ leaf: "dc-motor-drivers", why: "Drives this motor" }, { leaf: "shaft-couplers", why: "Couples this shaft", fit: "shaft_dia_mm" }, { leaf: "mounts-brackets", why: "Mounts this motor" }],
  "standard-hobby":   [{ leaf: "mounts-brackets", why: "Mounts this servo" }, { leaf: "arduino-compatible", why: "Commands this servo" }, { leaf: "smps-modules", why: "Powers this servo" }],
  "outrunner":        [{ leaf: "single-escs", why: "Drives this motor" }, { leaf: "lipo-packs-rc", why: "Powers this motor" }, { leaf: "xt-bullet", why: "Terminates this motor" }],
  "gimbal":           [{ leaf: "single-escs", why: "Drives this motor" }, { leaf: "fc-boards", why: "Commands this gimbal" }],
  "dc-motor-drivers": [{ leaf: "nema-17", why: "Driven by this board" }, { leaf: "brushed-dc", why: "Driven by this board" }, { leaf: "heat-sinks", why: "Cools this board" }, { leaf: "smps-modules", why: "Powers this board" }],
  "linear-actuators": [{ leaf: "dc-motor-drivers", why: "Drives this actuator" }, { leaf: "smps-modules", why: "Powers this actuator" }],
  "solenoid-valves":  [{ leaf: "mosfets", why: "Switches this valve" }, { leaf: "smps-modules", why: "Powers this valve" }],
  "water-air-pumps":  [{ leaf: "dc-motor-drivers", why: "Drives this pump" }, { leaf: "smps-modules", why: "Powers this pump" }],

  /* drones — the stack the user named: motor + ESC, ESC + flight controller */
  "2004-2306":        [{ leaf: "single-escs", why: "Drives this motor" }, { leaf: "4-5", why: "Turns on this motor" }, { leaf: "freestyle", why: "Mounts this motor" }, { leaf: "lipo-packs-rc", why: "Powers this build" }],
  "heavy-lift":       [{ leaf: "single-escs", why: "Drives this motor" }, { leaf: "4-5", why: "Turns on this motor" }, { leaf: "lipo-packs-rc", why: "Powers this build" }],
  "single-escs":      [{ leaf: "fc-boards", why: "Commands this ESC" }, { leaf: "2004-2306", why: "Driven by this ESC" }, { leaf: "xt-bullet", why: "Terminates this ESC" }, { leaf: "lipo-packs-rc", why: "Powers this ESC" }],
  "fc-boards":        [{ leaf: "single-escs", why: "Commanded by this board" }, { leaf: "rc-receivers", why: "Feeds this board" }, { leaf: "fpv-cameras", why: "Wires to this board" }, { leaf: "standoffs", why: "Stacks this board" }],
  "stack-combos":     [{ leaf: "2004-2306", why: "Driven by this stack" }, { leaf: "rc-receivers", why: "Feeds this stack" }, { leaf: "freestyle", why: "Houses this stack" }],
  freestyle:          [{ leaf: "2004-2306", why: "Mounts on this frame" }, { leaf: "standoffs", why: "Builds this frame" }, { leaf: "drone-screws", why: "Assembles this frame" }],
  "rc-receivers":     [{ leaf: "rc-transmitters", why: "Binds to this receiver" }, { leaf: "fc-boards", why: "Reads this receiver" }],
  "rc-transmitters":  [{ leaf: "rc-receivers", why: "Binds to this radio" }],
  "fpv-cameras":      [{ leaf: "goggles-rx", why: "Receives this camera" }, { leaf: "antennas", why: "Transmits this camera" }],
  "goggles-rx":       [{ leaf: "fpv-cameras", why: "Seen in these goggles" }, { leaf: "antennas", why: "Feeds these goggles" }],
  "4-5":              [{ leaf: "2004-2306", why: "Turns these props" }, { leaf: "drone-screws", why: "Fixes these props" }],
  "2-3":              [{ leaf: "2004-2306", why: "Turns these props" }],

  /* power — a cell is not a pack until it has a holder, a strip and a BMS */
  "lipo-packs-rc":    [{ leaf: "lipo-balance", why: "Charges this pack" }, { leaf: "xt-bullet", why: "Terminates this pack" }, { leaf: "monitors", why: "Watches this pack" }],
  "li-ion-packs":     [{ leaf: "li-ion", why: "Charges this pack" }, { leaf: "bms-boards", why: "Protects this pack" }],
  "18650":            [{ leaf: "cell-holders", why: "Holds these cells" }, { leaf: "nickel-strip", why: "Welds these cells" }, { leaf: "bms-boards", why: "Protects these cells" }, { leaf: "li-ion", why: "Charges these cells" }],
  "bms-boards":       [{ leaf: "18650", why: "Protected by this board" }, { leaf: "nickel-strip", why: "Wires to this board" }],
  "cell-holders":     [{ leaf: "18650", why: "Fits this holder" }, { leaf: "nickel-strip", why: "Joins in this holder" }],

  /* electronics — the pairings an assembled board actually needs */
  "arduino-compatible": [{ leaf: "dupont-jumper", why: "Wires this board" }, { leaf: "headers", why: "Terminates this board" }, { leaf: "lcd-character", why: "Displays from this board" }, { leaf: "ac-dc-adapters", why: "Powers this board" }],
  "esp32-esp8266":    [{ leaf: "dupont-jumper", why: "Wires this board" }, { leaf: "headers", why: "Terminates this board" }, { leaf: "antennas", why: "Extends this board" }],
  "raspberry-pi-hats": [{ leaf: "ac-dc-adapters", why: "Powers this board" }, { leaf: "heat-sinks", why: "Cools this board" }, { leaf: "headers", why: "Stacks on this board" }],
  "stm32-arm":        [{ leaf: "dupont-jumper", why: "Wires this board" }, { leaf: "headers", why: "Terminates this board" }],
  leds:               [{ leaf: "resistors-tht", why: "Limits this LED" }],
  mosfets:            [{ leaf: "heat-sinks", why: "Cools this device" }, { leaf: "resistors-tht", why: "Gates this device" }],
  regulators:         [{ leaf: "electrolytic-caps", why: "Decouples this regulator" }, { leaf: "heat-sinks", why: "Cools this regulator" }],
  microcontrollers:   [{ leaf: "crystals", why: "Clocks this device" }, { leaf: "ceramic-capacitors", why: "Decouples this device" }, { leaf: "headers", why: "Terminates this device" }],
  "buck-converters":  [{ leaf: "electrolytic-caps", why: "Smooths this converter" }, { leaf: "heat-sinks", why: "Cools this converter" }],

  /* 3d printing */
  "control-boards":   [{ leaf: "stepper-drivers", why: "Plugs into this board" }, { leaf: "heat-sinks", why: "Cools this board" }],
  "stepper-drivers":  [{ leaf: "nema-17", why: "Driven by this driver" }, { leaf: "control-boards", why: "Takes this driver" }, { leaf: "heat-sinks", why: "Cools this driver" }],
  "hotend-assemblies": [{ leaf: "nozzles", why: "Fits this hotend" }, { leaf: "pla", why: "Prints through this" }],
  nozzles:            [{ leaf: "hotend-assemblies", why: "Takes this nozzle" }],
  "linear-rails-mgn": [{ leaf: "socket-head-cap", why: "Bolts this rail", fit: "thread" }, { leaf: "linear-ball-bearings", why: "Runs on this rail" }],
  "lead-screws":      [{ leaf: "nema-17", why: "Turns this screw" }, { leaf: "shaft-couplers", why: "Couples this screw", fit: "shaft_dia_mm" }],
  pla:                [{ leaf: "nozzles", why: "Prints this filament" }, { leaf: "heated-beds", why: "Sticks to this bed" }],
  petg:               [{ leaf: "nozzles", why: "Prints this filament" }, { leaf: "heated-beds", why: "Sticks to this bed" }],
  abs:                [{ leaf: "nozzles", why: "Prints this filament" }, { leaf: "heated-beds", why: "Sticks to this bed" }],
};

/**
 * The L1 drawers `worksWith` will reach into for this part, so the page can
 * load them before calling it.
 *
 * Most complements are in the part's own drawer — a drone motor and its ESC
 * are both `drones-parts` — so this usually returns that one drawer and the
 * page does no extra reads. A LiPo pack under `batteries-power` is the case
 * that makes the lookup worth doing at all.
 */
export function complementDrawers(sku: Sku): string[] {
  const leaves = new Set((COMPLEMENTS[sku.categories[0].at(-1) ?? ""] ?? []).map((p) => p.leaf));
  if (!leaves.size) return [];
  const out = new Set<string>();
  for (const path of allPaths()) {
    if (leaves.has(path.at(-1) ?? "")) out.add(path[0]);
  }
  return [...out];
}

/**
 * Platform tokens the supplier declared for this part — `NEMA17`, `Raspberry Pi
 * Zero`, `R9 series`. Stored pipe-separated on the `compatibility` attribute
 * because it is one more typed attribute, which is the mechanism the whole
 * catalogue already rests on, rather than a relationship table nobody fills in.
 */
export const compatTokens = (sku: Sku): string[] =>
  String(sku.attrs.compatibility ?? "")
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean);

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");

export type Complement = {
  sku: Sku;
  why: string;
  /**
   * True when a dimension or a supplier-declared token was actually checked
   * for this pair. False when the pairing is category-level only.
   *
   * The distinction is not cosmetic. "Fits this holder" is provable for a
   * bearing and a circlip, because the bore agrees. It is not provable for a
   * cell holder and a cell, because nothing in the data records which cell a
   * holder takes — and a coin-cell holder under an 18650 is exactly what that
   * gap produces. The page states the weaker claim weakly rather than
   * asserting a fit nobody verified.
   */
  proven: boolean;
};

/**
 * Parts that complete this one. Never alternatives to it — that is
 * `substitutes`, and having both under near-identical headings was the older
 * page's worst habit.
 */
export function worksWith(sku: Sku, pool: Sku[], limit = 6): Complement[] {
  const leaf = sku.categories[0].at(-1) ?? "";
  const pairings = COMPLEMENTS[leaf] ?? [];
  const mine = new Set(compatTokens(sku).map(norm));

  const candidates = pool.filter((s) => s.sku !== sku.sku && s.stock > 0);
  const picked = new Map<string, Complement>();

  const take = (s: Sku, why: string, proven: boolean) => {
    if (!picked.has(s.sku) && picked.size < limit) picked.set(s.sku, { sku: s, why, proven });
  };

  // 1. A complementary leaf where the dimension that has to agree, agrees.
  for (const p of pairings) {
    const key = p.fit;
    if (!key) continue;
    // Unknown on either side is not a match. A part with no thread recorded
    // must not pair with every nut in the drawer on the strength of both
    // being blank.
    const want = sku.attrs[key];
    if (want === undefined || want === "") continue;
    for (const s of candidates) {
      if (s.categories[0].at(-1) !== p.leaf) continue;
      if (String(s.attrs[key] ?? "") !== String(want)) continue;
      take(s, p.why, true);
    }
  }

  // 2. A part the supplier declared for the same platform.
  if (mine.size) {
    for (const s of candidates) {
      const shared = compatTokens(s).find((t) => mine.has(norm(t)));
      if (shared) take(s, `Listed for ${shared}`, true);
    }
  }

  /*
    3. The complementary leaf, with nothing dimensional to check.

    Runs last, which is the whole guard it needs: `take` fills slots in rule
    order, so a match we can prove has already claimed its place before any of
    these are considered. What these rows do not get is the accent — see
    `proven` on the return type.

    One from each leaf before a second from any, because the shelf is a kit and
    a kit spans the build. Draining each leaf in turn instead put seven motor
    drivers under a NEMA 17 and no coupler, no bracket and no power supply —
    `dc-motor-drivers` simply had enough stock to fill every slot before
    `shaft-couplers` was reached. Breadth is the whole point of the shelf; a
    seventh driver is a substitute wearing a complement's heading.
  */
  const queues = pairings.map((p) => ({
    why: p.why,
    rest: candidates.filter((s) => s.categories[0].at(-1) === p.leaf),
  }));
  for (let round = 0; picked.size < limit && queues.some((q) => q.rest.length > round); round++) {
    for (const q of queues) {
      const s = q.rest[round];
      if (s) take(s, q.why, false);
    }
  }

  return [...picked.values()].slice(0, limit);
}

/**
 * Project collections this SKU has been curated into.
 *
 * This used to derive membership from L1 category overlap, which meant every
 * fastener in the catalogue advertised "Build a Drone" and "Build a Repair
 * Bench" — a drone contains fasteners, therefore an M2.5 pan-head screw is a
 * drone part. That is a claim on a product page, and it was not true.
 *
 * Membership is now an explicit per-SKU field (`Sku.projects`), set on upload
 * via the CSV importer or the admin. Unknown slugs are dropped rather than
 * rendered, so a typo in a spreadsheet cannot invent a collection.
 */
export function projectsFor(sku: Sku): { name: string; slug: string; glyph: GlyphKey }[] {
  if (!sku.projects?.length) return [];
  const bySlug = new Map(PROJECTS.map((p) => [p.slug, p]));
  return sku.projects
    .map((slug) => bySlug.get(slug))
    .filter((p): p is (typeof PROJECTS)[number] => Boolean(p))
    .map((p) => ({ slug: p.slug, name: p.name, glyph: p.glyph }));
}

