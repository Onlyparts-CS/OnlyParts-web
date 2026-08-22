#!/usr/bin/env node
/**
 * Assertions for the wordmark probe in `watermark.mjs`.
 *
 * Run: `node tools/feeds/watermark.check.mjs` from the repo root.
 *
 * The fixtures are drawn here rather than committed, so the check needs no
 * binary files and no network. Rectangles stand in for the wordmark: the probe
 * only ever counts pixels of one colour inside one crop, so a rectangle in that
 * colour exercises exactly the logic a rendered word would, without depending
 * on a font being installed.
 *
 * The real validation was 24 photographs read by eye — 12 branded, 12 clean,
 * separated with nothing between 0.00 and 9.30. That cannot live in a test.
 * What lives here are the three ways the probe was observed to go wrong.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { score, MARKS } from "./watermark.mjs";

const run = promisify(execFile);
const dir = mkdtempSync(join(tmpdir(), "wm-check-"));
const mark = MARKS.onlyscrews;
const at = (n) => join(dir, n);

const draw = (name, args) => run("convert", [...args, at(name)]).then(() => at(name));

try {
  // A wordmark-sized block of the exact violet, in the corner the mark lives in.
  const branded = await draw("branded.png", [
    "-size", "800x800", "xc:white",
    "-fill", mark.colour, "-draw", "rectangle 20,20 140,60",
  ]);

  // The same catalogue photograph without it.
  const clean = await draw("clean.png", [
    "-size", "800x800", "xc:white",
    "-fill", "gray40", "-draw", "circle 400,400 400,300",
  ]);

  /*
    The regression this file exists for.

    Before `-alpha remove`, a transparent PNG scored 500.00 — the mean was
    taken over a channel alpha had already flattened, so three unbranded
    product shots came back as the most confident hits in the run. A false
    positive that outranks every true one is worse than a missed detection,
    because it reads as proof the probe works.
  */
  const transparent = await draw("alpha.png", [
    "-size", "800x800", "xc:none",
    "-fill", "gray20", "-draw", "circle 400,400 400,300",
  ]);

  /*
    Saturated colour that is not *this* colour. `-fuzz 22%` is wide enough to
    survive PNG quantisation and must not be wide enough to swallow a blue
    LED, a purple PCB or a violet anodised spacer — all of which this
    catalogue sells.
  */
  const otherColours = await draw("other.png", [
    "-size", "800x800", "xc:white",
    "-fill", "#0033FF", "-draw", "rectangle 20,20 200,90",
    "-fill", "#FF0000", "-draw", "rectangle 220,20 400,90",
    "-fill", "#8000A0", "-draw", "rectangle 20,120 200,190",
  ]);

  const sBranded = await score(branded, mark);
  const sClean = await score(clean, mark);
  const sAlpha = await score(transparent, mark);
  const sOther = await score(otherColours, mark);

  assert.ok(sBranded >= mark.perMille, `wordmark must be detected, scored ${sBranded}`);
  assert.equal(sClean, 0, `plain product shot must score zero, scored ${sClean}`);
  assert.ok(sAlpha < mark.perMille, `transparent PNG must not read as branded, scored ${sAlpha}`);
  assert.ok(sOther < mark.perMille, `other saturated colours must not match, scored ${sOther}`);

  // The gap is the whole basis for a single fixed threshold. If a change
  // narrows it to nothing, the threshold stops being a decision.
  assert.ok(sBranded > sClean * 10 + 1, `branded ${sBranded} must stand clear of clean ${sClean}`);

  console.log(
    `watermark: ok  (branded ${sBranded.toFixed(2)}, clean ${sClean.toFixed(2)}, ` +
      `alpha ${sAlpha.toFixed(2)}, other-colours ${sOther.toFixed(2)}, threshold ${mark.perMille})`,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
