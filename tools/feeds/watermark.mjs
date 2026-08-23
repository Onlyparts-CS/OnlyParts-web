#!/usr/bin/env node
/**
 * Find supplier wordmarks burned into catalogue photographs.
 *
 * ## Why this exists at all
 *
 * `catalogDb.ts` says of the imported rows: "1,108 are cdn.shopify.com — a
 * competitor's own storefront photography, their logo and an 'x 25pcs' overlay
 * burned into the frame, which also misstates the pack size we sell." That is
 * two separate problems wearing one coat, and only one of them is about
 * copyright:
 *
 *   - **Licence.** None of the harvested images is ours, watermarked or not.
 *     `ALLOW_HOTLINKED_IMAGES` gates that, and nothing here changes it. A
 *     photograph does not become usable by having no logo on it.
 *   - **Truth.** An image carrying another shop's name, or "x 25pcs" when we
 *     sell singles, is a wrong listing regardless of who owns the pixels. That
 *     one is ours to fix, and it is what this file finds.
 *
 * So: this marks images that can never be shown *even if* a grant arrives.
 *
 * ## Why a colour probe and not a classifier
 *
 * A survey of 78 images across all six sources found exactly one supplier that
 * stamps its own photography:
 *
 *     onlyscrews        24 sampled   12 branded    ~50%
 *     robu              24 sampled    0 branded
 *     thinkrobotics     18 sampled    0 branded
 *     rees52            18 sampled    0 branded
 *     robocraze          6 sampled    0 branded
 *     quartzcomponents   6 sampled    0 branded
 *
 * One supplier, one mark, always the same two words in the same corner in the
 * same violet — #7425FE, which is not a colour that occurs in a photograph of
 * a zinc-plated screw. Counting pixels of that exact hue in the top-left crop
 * separates the two sets with nothing in between: every branded image in the
 * validation set scores above 9 per mille, every clean one scores 0.00.
 *
 * A general watermark classifier would be the wrong rung. It costs a model, a
 * training set and a false-positive rate, to answer a question that one
 * supplier's brand guidelines already answer exactly.
 *
 * The consequence worth knowing: **this generalises to nothing.** A second
 * supplier that starts stamping needs a second entry in MARKS, found the same
 * way — sample it, look at it, read the colour off the histogram. The survey
 * above is the method, not a result to trust forever.
 *
 * ## What it hits hardest
 *
 * OnlyScrews stamps its *dimension drawings* — the M4x16 grub screw with
 * tolerances, the M8x60 countersunk with the 5mm Allen callout. Those are the
 * most useful images in the whole harvest and the most clearly that supplier's
 * own draughting work. Losing them is the correct outcome and an expensive one.
 * `specDrawing.ts` draws our own; that is the replacement, not this.
 *
 * Usage:
 *   node tools/feeds/watermark.mjs --source=onlyscrews [--concurrency=8]
 *   node tools/feeds/watermark.mjs --source=onlyscrews --apply
 *
 * Scores into out/<source>.watermark.json. `--apply` then rewrites
 * out/<source>.json, dropping branded URLs from `images[]` and re-picking
 * `image` from what is left. Follow it with `pull.mjs --source=X --remap` to
 * regenerate the CSVs from the cleaned JSON.
 */

import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);

/**
 * Every wordmark we know how to see, by the source that applies it.
 *
 * `colour` is read off the image, not off the brand's website: the value that
 * matters is what survived the supplier's own PNG export, and those differ.
 * `crop` is an ImageMagick geometry over the region the mark occupies.
 * `perMille` is the decision threshold in matching pixels per thousand.
 */
export const MARKS = {
  onlyscrews: {
    colour: "#7425FE",
    fuzz: "22%",
    crop: "40%x12%+0+0",
    // Validation set: 11 full-size marks scored 80.6, one shrunken mark on a
    // product-box photo scored 9.3, and all twelve clean images scored exactly
    // 0.00. Anywhere in that gap works; 1.0 is well clear of both edges.
    perMille: 1.0,
  },
};

/**
 * Fraction of the crop, per mille, that is the wordmark's colour.
 *
 * `-alpha remove` before anything else, and not for tidiness. A transparent
 * PNG reaching `-colorspace gray -format %[fx:mean]` returns 0.5 whatever the
 * pixels say, because the mean is taken over a channel the alpha has already
 * eaten. Three clean images in the validation set scored a confident 500.00
 * that way — a false positive that looks like a very strong true one.
 */
export async function score(file, mark) {
  const { stdout } = await run("convert", [
    file,
    "-background", "white", "-alpha", "remove", "-alpha", "off",
    "-crop", mark.crop, "+repage",
    "-fuzz", mark.fuzz,
    "-fill", "black", "+opaque", mark.colour,
    "-fill", "white", "-opaque", mark.colour,
    "-colorspace", "gray",
    "-format", "%[fx:mean*1000]", "info:",
  ]);
  return Number(stdout.trim());
}

async function fetchTo(url, file) {
  await run("curl", ["-sSL", "--max-time", "30", "-o", file, url], { maxBuffer: 1 << 20 });
}

/* ------------------------------------------------------------------ *
 * CLI. Behind a main-module guard so `watermark.check.mjs` can import the
 * scorer without the argument parsing firing and exiting on it.
 * ------------------------------------------------------------------ */

async function main() {
  const source = args.source;
  const mark = MARKS[source];
  if (!mark) {
    console.error(
      `Usage: node tools/feeds/watermark.mjs --source=<name> [--concurrency=8] [--apply]\n\n` +
        `Sources with a known wordmark: ${Object.keys(MARKS).join(", ")}\n\n` +
        `Every other source was surveyed and stamps nothing — see the header. To add\n` +
        `one, sample its images, look at them, and read the mark's colour off\n` +
        `  convert IMG -crop 40%x12%+0+0 +repage -colors 8 -format %c histogram:info:\n`,
    );
    process.exit(1);
  }

  const rows = JSON.parse(readFileSync(join(OUT, `${source}.json`), "utf8"));
  const urls = [...new Set(rows.flatMap((r) => r.images ?? []))];

  const scoresPath = join(OUT, `${source}.watermark.json`);
  /*
    Resuming, because this is thousands of round trips to someone else's CDN and
    an interrupted run should not mean fetching them all again.
  */
  let scores = {};
  try {
    scores = JSON.parse(readFileSync(scoresPath, "utf8")).scores ?? {};
  } catch {
    scores = {};
  }

  if (args.apply) {
    if (!Object.keys(scores).length) {
      console.error(`No scores yet — run without --apply first.`);
      process.exit(1);
    }
    const branded = new Set(Object.entries(scores).filter(([, v]) => v >= mark.perMille).map(([u]) => u));
    let dropped = 0;
    let blanked = 0;
    for (const r of rows) {
      const keep = (r.images ?? []).filter((u) => !branded.has(u));
      dropped += (r.images?.length ?? 0) - keep.length;
      r.images = keep;
      /*
        `image` is what the CSV's one image column carries and therefore what
        becomes `sourceImageUrl`. Re-point it at the first surviving shot rather
        than leaving it: a branded hero with clean gallery shots behind it is the
        common case, and clearing the field would throw those away too.
      */
      if (r.image && branded.has(r.image)) {
        r.image = keep[0] ?? "";
        if (!r.image) blanked++;
      }
    }
    writeFileSync(join(OUT, `${source}.json`), JSON.stringify(rows, null, 1));
    console.log(
      `\n  ${branded.size} branded images dropped from ${dropped} product slots.\n` +
        `  ${blanked} products now have no photograph at all — they fall back to the drawn plate.\n\n` +
        `  Next: node tools/feeds/pull.mjs --source=${source} --remap   (rewrites the CSVs)\n`,
    );
    process.exit(0);
  }

  const todo = urls.filter((u) => !(u in scores));
  const concurrency = Number(args.concurrency ?? 8);
  console.log(
    `Scoring ${source}: ${urls.length} distinct images, ${todo.length} not yet seen ` +
      `(concurrency ${concurrency})…`,
  );

  const tmp = join(tmpdir(), `wm-${source}-${process.pid}`);
  mkdirSync(tmp, { recursive: true });

  let done = 0;
  let failed = 0;
  async function worker(id) {
    const file = join(tmp, `w${id}`);
    for (let i = id; i < todo.length; i += concurrency) {
      const url = todo[i];
      try {
        await fetchTo(url, file);
        scores[url] = await score(file, mark);
      } catch {
        /*
          A dead URL is not a clean image. Recorded as -1 so a later run retries
          nothing silently and `--apply` treats it as unknown rather than safe.
        */
        scores[url] = -1;
        failed++;
      }
      done++;
      if (done % 200 === 0) {
        const hits = Object.values(scores).filter((v) => v >= mark.perMille).length;
        console.log(`  ${done}/${todo.length}  branded so far: ${hits}`);
        writeFileSync(scoresPath, JSON.stringify({ mark, scores }, null, 1));
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  writeFileSync(scoresPath, JSON.stringify({ mark, scores }, null, 1));
  rmSync(tmp, { recursive: true, force: true });

  const branded = Object.entries(scores).filter(([, v]) => v >= mark.perMille);
  const clean = Object.entries(scores).filter(([, v]) => v >= 0 && v < mark.perMille);
  console.log(`
    ${urls.length} distinct images

    branded    ${branded.length}   ← carry the ${source} wordmark, must never be shown
    clean      ${clean.length}   ← no wordmark; still unlicensed, see ALLOW_HOTLINKED_IMAGES
    unfetched  ${failed}

    Scores in tools/feeds/out/${source}.watermark.json
    Apply with: node tools/feeds/watermark.mjs --source=${source} --apply
  `);

}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) await main();
