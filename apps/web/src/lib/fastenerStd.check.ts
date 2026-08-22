import assert from "node:assert/strict";
import { fastener } from "./fastenerStd.ts";

/**
 * Run: `npx tsx src/lib/fastenerStd.check.ts` from `apps/web`.
 *
 * Every title below is copied verbatim out of `tools/feeds/out/*.json`. That
 * matters more here than in most check files: this module's whole job is to
 * decide which real listings are safe to draw, so a fixture invented to match
 * the parser proves only that the parser matches itself. The refusal cases in
 * particular are all rows that a looser version of this code accepted, and
 * each one would have put a wrong figure on a sheet a buyer machines to.
 */

const must = (title: string, category?: string) => {
  const f = fastener(title, category);
  assert.ok(f, `expected a fastener for: ${title}`);
  return f;
};

const mustNot = (title: string, why: string, category?: string) => {
  assert.equal(fastener(title, category), null, `should have refused (${why}): ${title}`);
};

/* ---- the four head/drive pairs that carry most of the catalogue ---- */

const button = must("M4 X 8mm Hex (Allen) Button Head SS 304 Screw (Dia. 4mm, Length 8mm)");
assert.equal(button.standard, "ISO 7380");
assert.equal(button.thread, "M4");
assert.equal(button.length, 8);
assert.equal(button.head, "button");
assert.equal(button.drive, "hex");
assert.equal(button.headDia, 7.6);
assert.equal(button.headHeight, 2.2);
assert.equal(button.headInLength, false);

const cskHex = must(
  "M5 X 35mm Hex (Allen) CSK High Tensile(10.9) Black Oxide Screw (Dia. 5mm, Length 35mm)",
);
assert.equal(cskHex.standard, "ISO 10642");
assert.equal(cskHex.headDia, 11.2);
assert.equal(cskHex.length, 35);
// A countersunk head sits inside its own length; the drawing depends on this.
assert.equal(cskHex.headInLength, true);

const cskCross = must("M3 X 8mm Phillips CSK Mild Steel with Nickel Plating Screw (Dia. 3mm, Length 8mm)");
assert.equal(cskCross.standard, "ISO 7046");
assert.equal(cskCross.headDia, 5.6);

/*
  The pair the existing demo table gets wrong.

  `skus.ts:102` carries one head diameter per thread and reuses it across four
  head styles. At M3 that single figure is 5.5 — correct for a socket head cap,
  and wrong for both countersunk screws above and for the button head below.
  If this assertion ever collapses to one value, the standards split has been
  undone and every countersunk drawing in the catalogue is understating its
  head by up to 20%.
*/
const socketM3 = must("M3 X 12mm Hex Socket Head Cap Screw SS304 (Dia. 3mm, Length 12mm)");
assert.equal(socketM3.standard, "ISO 4762");
assert.equal(socketM3.headDia, 5.5);
const cskM3 = must("M3 X 12mm Hex (Allen) CSK Screw SS304 (Dia. 3mm, Length 12mm)");
const buttonM3 = must("M3 X 12mm Hex (Allen) Button Head SS304 Screw (Dia. 3mm, Length 12mm)");
assert.equal(new Set([socketM3.headDia, cskM3.headDia, buttonM3.headDia]).size, 3);

/*
  The head in the reference sheet: slotted cheese head, ISO 1207.

  Worth recording what the standard actually says, because the competitor sheet
  this was modelled on prints 5 mm across the head and 1 mm of head height for
  an M3 slotted cheese head. ISO 1207 and DIN 84 both give 5.5 and 2.0. Ours is
  the figure in the standard.
*/
const cheese = must("M3 X 20mm Slotted CHHD SS 304 Screw (Dia. 3mm, Length 20mm)");
assert.equal(cheese.standard, "ISO 1207");
assert.equal(cheese.headDia, 5.5);
assert.equal(cheese.headHeight, 2.0);
assert.equal(cheese.drive, "slotted");

/* ---- word priority ---- */

/*
  "Socket Button Head Cap" carries both head words. The part is a button head
  driven by a hex socket, so "socket" is describing the drive and must not win
  the head. Accepted with `socket` as the head, this row draws a cap screw
  head 5.5 across where the real part is 5.7 and a third of the height.
*/
const socketButton = must(
  "M3 X 12mm Socket Button Head Cap Allen SS 304 Screw  (Dia. 3mm, Length 12mm) Black -10 Pcs",
);
assert.equal(socketButton.head, "button");
assert.equal(socketButton.standard, "ISO 7380");

/* ---- the category tree is a check, never a source ---- */

const agreeing = fastener(
  "M4 X 8mm Hex (Allen) Button Head SS 304 Screw (Dia. 4mm, Length 8mm)",
  "fasteners.screws-by-head.button-head",
);
assert.ok(agreeing, "a category that agrees with the title must not block the draw");

assert.equal(
  fastener(
    "M4 X 8mm Hex (Allen) Button Head SS 304 Screw (Dia. 4mm, Length 8mm)",
    "fasteners.screws-by-head.countersunk-csk",
  ),
  null,
  "title says button, tree says countersunk — one of them is wrong and we cannot tell which",
);

// No category at all is the normal case and must behave exactly as before.
assert.deepEqual(
  fastener("M4 X 8mm Hex (Allen) Button Head SS 304 Screw (Dia. 4mm, Length 8mm)"),
  agreeing,
);

/* ---- refusals, every one a real row ---- */

mustNot("Almost Engineered a Near-Perfect M3 & M4 3D Printing Kit", "two threads in one title");
mustNot("M4 Phillips head Assorted Fastening Kit from 6mm to 25mm - 180Pcs", "assorted, no single length");
mustNot("Yankee Print Washer with Hypo-eliminator Hose for 20x24 Prints", "a darkroom appliance in fasteners.washers");
mustNot(
  "M4.8 #10 Philips Countersunk CSK Stainless Steel Self-Tapping Screws — M4.8 #10x75mm / Pack of 100",
  "self-tapping, and imperial gauge",
);
mustNot("4mm X 50mm Phillips Bugle head Gypsum Drywall Screw with Nickel plating", "drywall screw, not an ISO machine screw");
mustNot("M8 X 6mm Grub Screw SS304 (Dia. 8mm, Length 6mm)", "grub screws have no head to draw");
mustNot("M8 Wing Nut SS304 (Dia. 8mm)", "a nut: no length, no head table");
mustNot("Nylon Hex Standoff Spacer Black (Pack of 10) — M-F / M5 / 25mm", "a standoff, no head word");
mustNot("M4 Nyloc Nuts Mild Steel with Zinc Plating DIN985 (Dia. 4mm)", "a nut");

/* ---- the option-suffix dialect: thread with pitch, then length ---- */

/*
  1,547 fastener rows across makerbazar and thinkrobotics use this shape and
  nothing else. The hazard it carries is that the figure next to the thread is
  a pitch — reading "M5X0.8" as a 0.8 mm screw would draw a part 40× short.
*/
const suffix = must("Stainless Steel Socket Head Screws (pack of 10) — M5X0.8 / 30mm");
assert.equal(suffix.standard, "ISO 4762");
assert.equal(suffix.thread, "M5");
assert.equal(suffix.length, 30, "0.8 is the pitch; 30 is the length");
assert.equal(suffix.headDia, 8.5);

const noPitch = must("Nylon Socket Head Hex Screws (Pack of 10) — M2 / 4mm");
assert.equal(noPitch.thread, "M2");
assert.equal(noPitch.length, 4);

const buttonSuffix = must(
  "Metric Alloy Steel Button Head Hex Drive Screws - Class 10.9 Alloy Steel (Pack of 10) — M6X1.0 / 80mm",
);
assert.equal(buttonSuffix.standard, "ISO 7380");
assert.equal(buttonSuffix.length, 80);

/* ---- head variants that borrow a tabulated head's word ---- */

mustNot(
  "Stainless Steel Flanged Button Head Screws (Pack of 10) — M8X1.25 / 40mm",
  "ISO 7380-2 flange is 17.4mm across, not 7380-1's 14mm",
);
mustNot(
  "Phillips Round Washer Head Machine Screw — M3 / 15mm / Packet of 1000",
  "a washer head is not an ISO 7045 pan head",
);
mustNot(
  "Aluminium Spacers - No threads (Pack of 10) — Black / M6 X 10mm / 4mm",
  "an unthreaded spacer: no head, and two figures that are not a length",
);

/*
  Head/drive pairs with no table.

  A slotted pan head is ISO 1580 and a slotted countersunk is ISO 2009. Both
  are real parts and neither table is in this file, so both must refuse rather
  than borrow the cross-recessed figures — ISO 7045 and ISO 1580 do not agree.
*/
mustNot("M4 X 10mm Slotted Pan Head Screw SS304 (Dia. 4mm, Length 10mm)", "ISO 1580 is not tabulated here");
mustNot("M4 X 10mm Slotted CSK Screw SS304 (Dia. 4mm, Length 10mm)", "ISO 2009 is not tabulated here");

/* ---- self-disagreeing rows ---- */

mustNot(
  "M4 X 12mm Hex (Allen) Button Head Screw (Dia. 4mm, Length 16mm)",
  "states 12 mm and 16 mm in the same title",
);
mustNot(
  "M4 X 12mm Hex (Allen) Button Head Screw (Dia. 6mm, Length 12mm)",
  "states a diameter that is not its own thread",
);

/* ---- threads a standard does not tabulate ---- */

mustNot("M1.2 X 6mm Phillips Pan Head Screw (Dia. 1.2mm, Length 6mm)", "ISO 7045 starts at M2");
mustNot("M2 X 6mm Hex (Allen) Button Head Screw (Dia. 2mm, Length 6mm)", "ISO 7380 is not defined below M3");

/* ---- every tabulated figure is a positive number ---- */

for (const t of [
  "M3 X 10mm Hex Socket Head Cap Screw (Dia. 3mm, Length 10mm)",
  "M6 X 20mm Hex (Allen) Button Head Screw (Dia. 6mm, Length 20mm)",
  "M8 X 30mm Phillips CSK Screw (Dia. 8mm, Length 30mm)",
  "M5 X 16mm Phillips Pan Head Screw (Dia. 5mm, Length 16mm)",
  "M6 X 25mm Slotted Cheese Head Screw (Dia. 6mm, Length 25mm)",
]) {
  const f = must(t);
  assert.ok(f.headDia > f.threadDia, `head must be wider than the thread: ${t}`);
  assert.ok(f.headHeight > 0, `head height must be positive: ${t}`);
  assert.ok(f.length > 0);
}

console.log("fastenerStd.check.ts — all assertions passed");
