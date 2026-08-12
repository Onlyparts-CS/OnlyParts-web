/**
 * Make-on-Demand domain — docs/06-BACKEND-ARCHITECTURE.md §8.3.
 *
 * v1 is a human quoting pipeline, not an instant-quote engine. The data shapes
 * here match the `rfqs` / `quotes` tables so the Phase-2 automated quoter fills
 * the same fields (docs/12-COMPETITIVE-RESEARCH.md §5).
 */

export type ProcessKey =
  | "cnc_machining" | "3d_printing_fdm" | "3d_printing_sla" | "3d_printing_sls"
  | "sheet_metal" | "injection_moulding" | "laser_cutting" | "pcb_assembly"
  | "wire_harness" | "custom_sourcing";

export type Process = {
  key: ProcessKey;
  name: string;
  blurb: string;
  leadDays: [number, number];
  minQty: number;
  materials: string[];
  finishes: string[];
};

export const PROCESSES: Process[] = [
  {
    key: "cnc_machining", name: "CNC machining",
    blurb: "3- and 4-axis milling and turning. Tightest tolerances, any metal.",
    leadDays: [7, 14], minQty: 1,
    materials: ["Aluminium 6061", "Aluminium 7075", "Mild steel", "Stainless 304", "Stainless 316", "Brass", "Delrin (POM)", "Nylon", "PEEK"],
    finishes: ["As machined", "Bead blasted", "Anodised — clear", "Anodised — black", "Powder coated", "Electropolished"],
  },
  {
    key: "3d_printing_fdm", name: "3D printing — FDM",
    blurb: "Fastest and cheapest for jigs, housings and low-volume parts.",
    leadDays: [2, 5], minQty: 1,
    materials: ["PLA", "PETG", "ABS", "ASA", "TPU 95A", "Nylon PA12", "PA-CF (carbon filled)"],
    finishes: ["As printed", "Support removed", "Vapour smoothed", "Sanded & primed"],
  },
  {
    key: "3d_printing_sla", name: "3D printing — SLA / MSLA",
    blurb: "Fine detail and smooth surfaces. Best for visual models and fits.",
    leadDays: [3, 6], minQty: 1,
    materials: ["Standard resin", "Tough resin (ABS-like)", "Flexible resin", "Castable resin", "High-temp resin"],
    finishes: ["As printed", "Washed & cured", "Sanded", "Painted"],
  },
  {
    key: "3d_printing_sls", name: "3D printing — SLS",
    blurb: "Strong isotropic nylon parts with no support marks.",
    leadDays: [5, 10], minQty: 1,
    materials: ["Nylon PA12", "PA12 glass filled", "TPU"],
    finishes: ["As sintered", "Bead blasted", "Dyed black"],
  },
  {
    key: "sheet_metal", name: "Sheet metal",
    blurb: "Laser cut, bent and welded panels, brackets and enclosures.",
    leadDays: [7, 12], minQty: 1,
    materials: ["Mild steel (CRCA)", "Stainless 304", "Aluminium 5052", "Galvanised steel"],
    finishes: ["Raw", "Powder coated", "Zinc plated", "Brushed"],
  },
  {
    key: "injection_moulding", name: "Injection moulding",
    blurb: "Unit economics win above ~1,000 pieces. Tooling is amortised separately.",
    leadDays: [25, 45], minQty: 500,
    materials: ["ABS", "PP", "PC", "Nylon 66", "POM", "TPU", "PC/ABS"],
    finishes: ["Standard (SPI-B)", "Textured", "Polished (SPI-A2)"],
  },
  {
    key: "laser_cutting", name: "Laser cutting",
    blurb: "Flat profiles in metal, acrylic, ply and composites.",
    leadDays: [3, 7], minQty: 1,
    materials: ["Mild steel", "Stainless 304", "Aluminium", "Acrylic", "Plywood", "Carbon fibre sheet"],
    finishes: ["As cut", "Deburred", "Powder coated"],
  },
  {
    key: "pcb_assembly", name: "PCB fabrication & assembly",
    blurb: "Bare boards or fully populated. Send Gerbers plus a BOM.",
    leadDays: [7, 15], minQty: 5,
    materials: ["FR-4 1.6mm", "FR-4 0.8mm", "Aluminium core", "Flex polyimide"],
    finishes: ["HASL", "ENIG", "Green mask", "Black mask", "Blue mask"],
  },
  {
    key: "wire_harness", name: "Wire harness",
    blurb: "Crimped, sleeved and tested looms to your pinout.",
    leadDays: [7, 14], minQty: 10,
    materials: ["PVC 24–10 AWG", "Silicone 22–8 AWG", "Teflon (PTFE)", "Shielded cable"],
    finishes: ["Heat shrink", "Braided sleeve", "Spiral wrap", "Loom tube"],
  },
  {
    key: "custom_sourcing", name: "Custom sourcing",
    blurb: "You know the part, we find and import it. Send a datasheet or a photo.",
    leadDays: [10, 30], minQty: 1,
    materials: ["As specified"],
    finishes: ["As specified"],
  },
];

export const processByKey = (k: ProcessKey) => PROCESSES.find((p) => p.key === k)!;

export const TOLERANCES = [
  { key: "standard", label: "Standard (±0.25 mm)", note: "Cheapest — fine for brackets, housings, jigs" },
  { key: "fine", label: "Fine (±0.1 mm)", note: "Typical machined-part tolerance" },
  { key: "tight", label: "Tight (±0.05 mm)", note: "Bearing fits, dowel holes" },
  { key: "precision", label: "Precision (±0.01 mm)", note: "Adds inspection cost — specify only where needed" },
];

/**
 * Accepted CAD and drawing formats — widened in v2 to match the Xometry set
 * after the competitive teardown (docs/12 §5). Our original list was narrower
 * than every competitor's, which silently loses RFQs from SolidWorks users.
 */
export const ACCEPTED = [
  "step", "stp", "stl", "iges", "igs", "sldprt", "sldasm", "ipt", "3dxml",
  "catpart", "sat", "dxf", "dwg", "pdf", "png", "jpg", "xlsx", "csv", "zip",
];
export const MAX_FILE_MB = 100;
export const MAX_FILES = 20;

/**
 * Rules-based process recommender — FR-29.
 *
 * Not an instant quote and not geometry analysis: it reads the answers the user
 * has already given and names the process a quoting engineer would pick. Cheap
 * to build, and it makes the form feel like it knows something.
 */
export function recommendProcess(input: {
  qty: number;
  material?: string;
  needsTightTolerance?: boolean;
  isFlat?: boolean;
  isElectronic?: boolean;
}): { key: ProcessKey; why: string } | null {
  const { qty, needsTightTolerance, isFlat, isElectronic } = input;

  if (isElectronic) return { key: "pcb_assembly", why: "You described an electronic assembly." };
  if (isFlat && qty <= 500) return { key: "laser_cutting", why: "Flat profiles are cheapest cut, not machined." };
  if (qty >= 1000 && !needsTightTolerance)
    return { key: "injection_moulding", why: `At ${qty.toLocaleString("en-IN")} pieces tooling pays for itself within the first run.` };
  if (needsTightTolerance)
    return { key: "cnc_machining", why: "Tolerances below ±0.1 mm need machining, not printing." };
  if (qty <= 25)
    return { key: "3d_printing_fdm", why: `At ${qty} pieces, printing beats machining on both cost and lead time.` };
  return { key: "cnc_machining", why: "Best balance of tolerance and unit cost at this quantity." };
}

/* ---------------- RFQ records ---------------- */

export type RfqStatus =
  | "submitted" | "under_review" | "quoted" | "accepted"
  | "in_production" | "qc" | "shipped" | "delivered" | "declined";

export const RFQ_STAGES: { key: RfqStatus; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under review" },
  { key: "quoted", label: "Quoted" },
  { key: "accepted", label: "Accepted" },
  { key: "in_production", label: "In production" },
  { key: "qc", label: "QC" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

export type RfqFile = { name: string; sizeBytes: number; kind: "cad" | "drawing" | "bom" | "reference" };

export type Rfq = {
  number: string;
  createdAt: string;
  status: RfqStatus;
  process: ProcessKey;
  material: string;
  finish: string;
  tolerance: string;
  quantities: number[];
  needBy?: string;
  targetPrice?: number;
  notes?: string;
  isNda: boolean;
  files: RfqFile[];
  contact: { name: string; company?: string; email: string; phone: string; gstin?: string; city?: string };
  /** first response SLA — 4 business hours from submission */
  slaDueAt: string;
};

export const rfqNumber = (seq: number) =>
  `MOD-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;

/** 4 business hours, skipping nights and Sundays. */
export function slaDeadline(from: Date): Date {
  const d = new Date(from);
  let left = 4;
  while (left > 0) {
    d.setHours(d.getHours() + 1);
    const hour = d.getHours();
    const day = d.getDay();
    if (day !== 0 && hour >= 9 && hour < 19) left--;
  }
  return d;
}

export const kindFor = (filename: string): RfqFile["kind"] => {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["step", "stp", "stl", "iges", "igs", "sldprt", "sldasm", "ipt", "3dxml", "catpart", "sat"].includes(ext)) return "cad";
  if (["dxf", "dwg", "pdf"].includes(ext)) return "drawing";
  if (["xlsx", "csv"].includes(ext)) return "bom";
  return "reference";
};

export const isAccepted = (filename: string) =>
  ACCEPTED.includes(filename.split(".").pop()?.toLowerCase() ?? "");
