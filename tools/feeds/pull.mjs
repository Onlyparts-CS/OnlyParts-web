#!/usr/bin/env node
/**
 * Supplier catalogue puller — robu.in and onlyscrews.in into importer CSV.
 *
 * ## Why this is not the Major-project scraper
 *
 * That scraper drives Selenium through a stealth Chrome with randomised user
 * agents, human-like scroll and a review paginator, because Amazon and Flipkart
 * fight back. Neither of these two targets does:
 *
 *   - onlyscrews.in is Shopify, and every Shopify store serves
 *     `/products.json?limit=250&page=N` — the full catalogue as structured JSON,
 *     variants, SKUs, prices, grams and images included. No parsing, no browser.
 *   - robu.in is behind Cloudflare on `/wp-json/`, but its product pages return
 *     200 to a plain request and carry schema.org `Product` JSON-LD plus a
 *     `BreadcrumbList`. The sitemap enumerates every URL.
 *
 * So the browser, the anti-detection and the DistilBERT sentiment pass are all
 * cost with no return here. What survives from that project is its shape: one
 * agent per source, a shared normaliser, a rate limiter, and a retry with
 * backoff. Those are below, in about a page of code instead of 158KB.
 *
 * ## What this deliberately does not do
 *
 * It does not invent `hsn`, `weight_g` or `category`. Those three are required
 * by the importer for a create, no supplier publishes the first, and the third
 * is our taxonomy rather than theirs. `map.json` holds the mapping; anything
 * unmapped comes out with blank cells so that `/admin/import`'s dry run reports
 * it as an error. A puller that guesses a category is how every fastener ended
 * up in the drone build the last time something inferred instead of asking.
 *
 * Usage:
 *   node tools/feeds/pull.mjs --source=onlyscrews [--limit=500]
 *   node tools/feeds/pull.mjs --source=robu --limit=200 [--concurrency=4]
 *
 * Writes tools/feeds/out/<source>.json and <source>.csv.
 */

import { writeFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const MAP = JSON.parse(readFileSync(join(HERE, "map.json"), "utf8"));

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);

/* ------------------------------------------------------------------ *
 * Politeness: one shared limiter and one retry, both from the Major
 * project's RateLimiter / SmartRetryHandler. 110k product pages is enough
 * traffic to look like an attack if it arrives unthrottled.
 * ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
  A slot reservation, not a "has enough time passed" check.

  The first version of this read a shared `lastRequest`, computed how long to
  wait, slept, then wrote `lastRequest = Date.now()`. With one worker that is a
  correct rate limit. With eight it is not a rate limit at all: all eight read
  the same timestamp, all compute the same wait, all sleep the same duration
  and all fire together — a burst of eight every 350ms. Measured against
  robu.in it produced 7.6 requests/second while claiming to allow 2.9.

  Reserving the slot *synchronously* before any `await` fixes it. JavaScript
  runs this function body to its first await without interruption, so each
  caller takes a distinct slot and the spacing is real regardless of how many
  workers there are.
*/
let nextSlot = 0;
const MIN_GAP_MS = Number(args.gap ?? 200);

async function gate() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + MIN_GAP_MS;
  if (at > now) await sleep(at - now);
}

/*
  Cloudflare fingerprints the TLS handshake, not the User-Agent.

  robu.in sits behind it, and with byte-identical headers `curl` gets 200 while
  Node's `fetch` gets 403 — undici's ClientHello does not look like a browser's
  and no amount of header spoofing changes that. Shelling out to curl is the
  cheapest client that clears it. If they tighten further the next rungs are
  curl-impersonate, then a real browser, which is where the Major project's
  Selenium stack would finally earn its keep.
*/
async function curlGet(url) {
  /*
    Normalised through `URL` first, because robu's sitemap contains entries
    with literal spaces in the path — `/product/esun-elastic- tpe-83a-…/` — and
    curl refuses those outright with "URL rejected: Malformed input". `new
    URL().href` percent-encodes them and leaves already-valid URLs untouched,
    which a blanket `encodeURI` would not: that re-encodes existing `%` signs
    and breaks every URL that was already correct.
  */
  const safe = new URL(url).href;
  const { stdout } = await run(
    "curl",
    ["-sSL", "--compressed", "--max-time", "30", "-A", UA, "-H", "accept-language: en-IN,en;q=0.9", safe],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  if (!stdout) throw new Error("empty body");
  return stdout;
}

/*
  Surviving a dropped connection overnight.

  Without this, an outage is not an error — it is *progress*. Each URL fails
  its three attempts in about three seconds and the cursor moves on, so eight
  workers chew through roughly 9,600 products an hour of downtime. They are not
  lost (a failed URL is never written to the state file, so a later run
  refetches it) but this run skips them, and the log fills with one warning per
  product.

  So: after enough consecutive failures to rule out a bad page, everything
  stops and waits for the network to come back. One worker probes; the rest
  block on the same promise rather than each starting their own probe.
*/
const OUTAGE_AFTER = 15;
const PROBE_EVERY_MS = 30_000;

let consecutiveFailures = 0;
let recovering = null;

async function waitForNetwork() {
  if (recovering) return recovering;
  recovering = (async () => {
    console.warn(`\n  ⏸  ${OUTAGE_AFTER} failures in a row — pausing until the network returns.`);
    for (let n = 1; ; n++) {
      await sleep(PROBE_EVERY_MS);
      try {
        const res = await fetch("https://robu.in/robots.txt", {
          headers: { "user-agent": UA },
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok || res.status === 403) break; // 403 is Cloudflare answering — the link is up
      } catch {
        // Still down.
      }
      if (n % 10 === 0) console.warn(`  ⏸  still down after ${((n * PROBE_EVERY_MS) / 60000).toFixed(0)} min`);
    }
    console.warn("  ▶  network back, resuming.\n");
    consecutiveFailures = 0;
    recovering = null;
  })();
  return recovering;
}

async function get(url, { json = false, tries = 3, curl = false } = {}) {
  // A worker that arrives mid-outage waits with everyone else instead of
  // spending its URL on a request that cannot succeed.
  if (recovering) await recovering;

  for (let attempt = 1; attempt <= tries; attempt++) {
    await gate();
    try {
      let body;
      if (curl) {
        body = await curlGet(url);
      } else {
        const res = await fetch(url, {
          headers: { "user-agent": UA, accept: json ? "application/json" : "text/html" },
          signal: AbortSignal.timeout(30_000),
        });
        // 404 is an answer, not a failure — a delisted product should not be
        // retried three times on the way past, and it says nothing about the
        // network, so it does not count toward an outage either.
        if (res.status === 404) {
          consecutiveFailures = 0;
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        body = await res.text();
      }
      consecutiveFailures = 0;
      return json ? JSON.parse(body) : body;
    } catch (err) {
      if (attempt === tries) {
        // Only log the first few of a run of failures. During an outage the
        // per-URL warning is thousands of identical lines burying anything
        // that matters.
        if (++consecutiveFailures <= 3) console.warn(`  ✗ ${url} — ${err.message}`);
        if (consecutiveFailures >= OUTAGE_AFTER) await waitForNetwork();
        return null;
      }
      await sleep(500 * 2 ** attempt); // exponential backoff
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Mapping. Longest match wins so "linear rail" beats "rail" would-be
 * prefixes, and a short generic key cannot outrank a specific one.
 * ------------------------------------------------------------------ */

/*
  Whole words, not substrings.

  The first run of this filed a can of spray paint as a drone ESC, because
  "Fluorescent" contains "esc"; "Plastic Primer" became PLA filament for the
  same reason. A three-letter key inside a longer word is not a match, and a
  mapper that thinks it is will confidently mis-file a whole catalogue —
  complete with the wrong HSN code, which is a tax problem rather than a
  cosmetic one.
*/
/*
  Keys that outrank length.

  Longest-wins cannot say "this narrow token beats that broad noun". `rhcp` is
  four characters and `antenna` is seven, so every circularly-polarised FPV
  antenna in the catalogue went to the generic RF leaf — and the usual dodge,
  stretching the key until it happens to be longer, does not work here because
  the words are not adjacent in the title ("5.8Ghz LHCP RP-SMA 150MM FPV
  Albtross Antenna").

  The bar for this list is that the token is unambiguous on its own in every
  row it touches, measured rather than assumed. `rp-sma` looked like an
  obvious member and was rejected on exactly that test: 63 rows carry it and
  41 are ordinary LoRa and WiFi antennas that happen to use the connector.
*/
const PRIORITY = new Set(MAP.priorityKeys ?? []);

function compileKeys(table) {
  return Object.keys(table)
    // `_`-prefixed entries are notes for whoever edits the map, not rules. JSON
    // has no comments, and a note whose value is an array would otherwise be
    // matched against every title and then used as a category path.
    .filter((k) => !k.startsWith("_"))
    .sort(
      (a, b) =>
        (PRIORITY.has(b) ? 1 : 0) - (PRIORITY.has(a) ? 1 : 0) || b.length - a.length,
    )
    .map((k) => {
      const body = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
    /*
      Plural tolerance, because suppliers name categories in the plural: robu
      files 26 items under "Plastic Gears" and 70 under "Power Inductors", so a
      key of `gear` has to reach `Gears` or the boundary refuses it.

      The first version appended a bare `s?`, which quietly only handled regular
      plurals. `tactile switch` became `switchs?` — and the plural of switch is
      `switches`. 1,740 tactile switches, 184 slide switches and every other
      sibilant key silently matched nothing at all, which looks exactly like a
      missing key rather than a broken one: the fix you reach for is adding a
      key that is already there.

      `-y` is handled separately because its plural replaces the letter rather
      than following it: battery → batteries, not batterys. Only after a
      consonant, though — relay, key and assembly do not behave the same way,
      and treating them alike cost 600 relays, which read as a missing key for
      the second time in one afternoon.
    */
      const stem = /[^aeiou]y$/i.test(k) ? `${body.slice(0, -1)}(?:y|ies)` : `${body}(?:e?s)?`;
      return { key: k, re: new RegExp(`(?<![a-z0-9])${stem}(?![a-z0-9])`, "i") };
    });
}

const KEYS = compileKeys(MAP.categoryBySource);

/*
  Categories parked on purpose.

  These are products we are choosing not to sell yet rather than products with
  nowhere to file, and the two look identical once a row has no category — both
  just fail the importer for want of an HSN code. Without a marker, "we might
  add PC parts later" means someone re-deriving which 231 rows those were.

  So they are matched, tagged, and counted separately. The rows stay in the
  feed, complete with price, stock, images and specs. Turning them on later is
  a move from this table into `categoryBySource`, not another crawl.
*/
const DEFERRED = compileKeys(MAP.deferredCategories ?? {});

function deferralFor(...hints) {
  const hay = hints.filter(Boolean).join(" ");
  const hit = DEFERRED.find(({ re }) => re.test(hay));
  return hit ? MAP.deferredCategories[hit.key] : "";
}

/*
  Everything after "with" is what comes in the box, not what the thing is.

  "NEO-M8M GPS Module with Ceramic Active Antenna" was filing as an antenna,
  because `antenna` is a longer key than `gps` and the matcher takes the longest
  match anywhere in the string. The same shape put a stepper motor under motor
  drivers and an ESP32 board under displays.

  A product title names the product first and its accessories afterwards, so
  cutting the tail before matching removes a whole class of this rather than one
  case of it. Supplier category strings almost never contain "with", so this
  only bites on the title fallback — which is exactly where it is needed.
*/
const ACCESSORY_TAIL = /\s+(?:with|w\/|incl\.?|includes?|including)\b.*$/i;

function matchKey(...hints) {
  const hay = hints.filter(Boolean).join(" ");
  const head = hay.replace(ACCESSORY_TAIL, "");
  // Fall back to the full string: some titles are only an accessory clause.
  const hit = KEYS.find(({ re }) => re.test(head)) ?? KEYS.find(({ re }) => re.test(hay));
  return hit ? hit.key : "";
}

function mapCategory(...hints) {
  const key = matchKey(...hints);
  return key ? MAP.categoryBySource[key] : "";
}

/*
  Supplier categories that are a shelf, not an answer.

  "3D Printer Parts", "Drivers and Interfaces", "FPV and Telemetry" — these are
  drawers the supplier sweeps into, and they match a long key, so longest-wins
  hands them the row before the title is ever consulted. That put 0.4mm brass
  nozzles in `upgrade-kits` and brushed motor-driver ICs in `logic-ics`.

  A weak key still resolves the row; it just goes last, behind the title. The
  test is not "is this key vague" but "does this supplier put unlike things in
  it" — `relay` is broad and still strong, because everything in it is a relay.
*/
const WEAK = new Set(MAP.weakCategories ?? []);

/*
  Cross-build membership, longest prefix wins.

  `motors.stepper-motors` has to beat `motors` — a NEMA 17 belongs to the 3D
  printer and the CNC, and a bare `motors` entry claiming "robot" for all of
  them would be the every-fastener-builds-a-drone mistake in a new costume.
  There is no bare `motors` entry today; the sort is here so adding one later
  cannot silently outrank the specific rows beneath it.
*/
const PROJECT_PREFIXES = Object.entries(MAP.projectsByCategory ?? {}).sort(
  (a, b) => b[0].length - a[0].length,
);

/*
  Country of origin, from the spec table only.

  Scanning the description for "Made in X" was tried and thrown away: it
  returns `the`, `Processing`, `collaboration` and `accordance` as often as it
  returns a country, because the phrase appears mid-sentence in marketing copy
  ("made in collaboration with…"). A wrong origin is worse than a blank one —
  blank fails the importer loudly, wrong prints on a listing and is a Legal
  Metrology declaration. So: named spec keys, matched against the countries
  that actually appear in the data, and nothing clever.
*/
const ORIGIN_KEY = /^(?:country of (?:origin|manufacture)|(?:place|product) of origin|origin)$/i;
const COUNTRIES = {
  india: "India",
  china: "China",
  cn: "China", // "CN(Origin)" — AliExpress-style, and robu passes it straight through
  taiwan: "Taiwan",
  japan: "Japan",
  italy: "Italy",
  germany: "Germany",
  korea: "South Korea",
  vietnam: "Vietnam",
  malaysia: "Malaysia",
  usa: "United States",
};

/* ------------------------------------------------------------------ *
 * Typed spec columns
 *
 * `parseSpecs` deliberately keeps its output in the JSON and out of the
 * importer's typed columns, because "Material: SS 304" and `material=ss304`
 * are only the same thing if somebody has checked. This is that check, written
 * down: a supplier key only becomes a typed column when the value it carries
 * passes a validator strict enough that the mapping cannot be wrong.
 *
 * Everything that does not pass is dropped, not guessed. The harvest contains
 * `Thread: Hardened Steel` and `Length: 20meters`, and a lenient parser turns
 * both into numbers that look like specifications. A blank cell is a gap
 * somebody can fill; a wrong one is a spec table that lies.
 * ------------------------------------------------------------------ */

/** `12mm`, `12 mm`, `1.75±0.03 mm` -> 12 / 1.75. Rejects other units outright. */
function mm(v) {
  const s = String(v ?? "").replace(/&plusmn;|±/g, " ").trim();
  // A unit that is not a millimetre is a different measurement, not a
  // millimetre needing conversion — "20meters" of cable is not a 20mm part.
  if (/\b(m|cm|meter|metre|inch|in|ft|feet|mil)\b|meters|metres|inches/i.test(s)) return "";
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(?:mm)?\b/i);
  if (!m) return "";
  const n = Number(m[1]);
  return n > 0 && n < 10000 ? String(n) : "";
}

/** Metric or imperial thread designations only. `M6 × 1.0` keeps the M6. */
function thread(v) {
  const s = String(v ?? "").trim();
  const metric = s.match(/^M(\d+(?:\.\d+)?)\b/i);
  if (metric) return `M${metric[1]}`;
  const imperial = s.match(/^(\d+\/\d+)\s*(BSP|NPT|UNC|UNF|BSW)\b/i);
  if (imperial) return `${imperial[1]} ${imperial[2].toUpperCase()}`;
  return "";
}

/** A short free-text value, kept as the supplier wrote it. */
const words = (max) => (v) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s && s.length <= 60 && s.split(" ").length <= max ? s : "";
};

/** Fastener property class, magnet grade, solder alloy — never prose. */
function grade(v) {
  const s = String(v ?? "").trim();
  return /^(\d{1,2}\.\d|N\d{2}|\d{2}-\d{2})$/i.test(s) ? s.toUpperCase() : "";
}

/**
 * Platform tokens, pipe-separated.
 *
 * This is the one column `worksWith` pairs on, so it is the one where a loose
 * value does visible damage: a wrong token puts an unrelated part under "Works
 * with this part" with a reason line claiming the supplier said so. Only the
 * explicit `Compatibility` spec feeds it. Titles do not — "Compatible with
 * Arduino" in a sentence is marketing, not a declaration.
 */
function compatibility(v) {
  const parts = String(v ?? "")
    .split(/\s*(?:,|\/|\band\b|\|)\s*/i)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 2 && t.length <= 40 && /[A-Za-z0-9]/.test(t))
    // "compatible", "series" and friends are the sentence around the token.
    .filter((t) => !/^(compatible|compatible with|series|etc|others?|more)$/i.test(t));
  return [...new Set(parts)].slice(0, 6).join("|");
}

/**
 * Supplier spec key -> importer column, in priority order per column. The
 * first key present that also passes the validator wins.
 */
const SPEC_COLUMNS = [
  ["compatibility", ["Compatibility"], compatibility],
  ["material", ["Material", "Body Material", "Magnet Material"], words(4)],
  ["finish", ["Finish", "Plating", "Surface Finish"], words(4)],
  ["coating", ["Coating"], words(4)],
  ["grade", ["Grade", "Property Class", "Magnet Grade"], grade],
  ["thread", ["Thread Size", "Thread", "Screw Size"], thread],
  ["length_mm", ["Bolt Length", "Screw Length", "Length"], mm],
  ["dia_mm", ["Diameter", "Filament Diameter", "Outer Diameter"], mm],
  ["bore_id_mm", ["Bore", "Inner Diameter", "Bore Diameter", "Bore Size"], mm],
  ["outer_od_mm", ["Outer Diameter", "OD"], mm],
  ["width_mm", ["Width"], mm],
  ["thickness_mm", ["Thickness"], mm],
  ["shaft_dia_mm", ["Shaft Diameter", "Shaft Dia"], mm],
];

/** Case-insensitive exact key lookup — supplier casing is not consistent. */
function specValue(specs, key) {
  const want = key.toLowerCase();
  for (const [k, v] of Object.entries(specs ?? {})) {
    if (k.trim().toLowerCase() === want) return v;
  }
  return undefined;
}

/** The typed columns this row's harvested specs actually support. */
function typedSpecs(specs) {
  const out = {};
  for (const [column, keys, parse] of SPEC_COLUMNS) {
    for (const key of keys) {
      const parsed = parse(specValue(specs, key));
      if (parsed) { out[column] = parsed; break; }
    }
  }
  return out;
}

function originFrom(specs) {
  for (const [k, v] of Object.entries(specs ?? {})) {
    if (!ORIGIN_KEY.test(k.trim())) continue;
    const hit = Object.keys(COUNTRIES).find((c) =>
      new RegExp(`(?<![a-z])${c}(?![a-z])`, "i").test(String(v)),
    );
    if (hit) return COUNTRIES[hit];
  }
  return "";
}

/* ------------------------------------------------------------------ *
 * CSV — only the columns `IMPORT_FIELDS` understands. Everything else
 * (image, description, source URL) stays in the JSON, because the importer
 * warns on unknown columns and a warning per row is noise that hides the
 * warnings that matter.
 *
 * Declared up here rather than beside `writeOut`, because `selfCheck` runs at
 * module top level and a `const` is not hoisted — same reason `SPEC_COLUMNS`
 * sits above `originFrom`.
 * ------------------------------------------------------------------ */

// `country_of_origin` carries the ~90 rows a supplier happened to state and is
// never defaulted — an absent declaration is an omission, a wrong one is a
// misdeclaration, and Rule 6(1) punishes the second. The other four are ours to
// declare rather than the supplier's to publish; see `rule6Columns` below.
const CSV_COLS = [
  "sku", "title", "price", "stock", "hsn", "gst_rate", "weight_g", "category", "projects",
  "country_of_origin", "mrp", "net_quantity", "importer_name", "importer_address",
  // Typed spec columns, populated only where `typedSpecs` could prove the
  // mapping. Mostly blank across the whole feed, and that is the honest state:
  // no supplier publishes a structured attribute table.
  "compatibility", "material", "finish", "coating", "grade", "thread",
  "length_mm", "dia_mm", "bore_id_mm", "outer_od_mm", "width_mm", "thickness_mm", "shaft_dia_mm",
];

const cell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Who packs the goods. Ours to state, not something a supplier feed carries. */
const PACKER = { name: "OnlyParts", address: "Bengaluru, Karnataka, India" };

/**
 * "pack of 25" -> "25 pieces". A unit we cannot count -> blank, on purpose.
 *
 * A quantity printed in the supplier's own title is the supplier's declaration
 * and reading it is not inventing one. Defaulting everything to "1 piece"
 * would be: a listing titled "pack of 100" declared as a single piece is a
 * short-measure misdeclaration, which is the offence Rule 6(1) is about.
 *
 * Blank holds the row in Draft, which is the correct answer to "we do not know
 * how much is in the box".
 */
function netQuantity(title) {
  const t = String(title ?? "");
  const n = t.match(/\b(?:pack|set|lot|box|bag|kit)\s+of\s+(\d{1,4})\b/i)
    ?? t.match(/\b(\d{1,4})\s*(?:pcs|pieces|nos)\b/i);
  if (n) {
    const q = Number(n[1]);
    if (q > 0 && q <= 10000) return `${q} ${q === 1 ? "piece" : "pieces"}`;
  }
  // Sold by length, weight or volume — the number on the pack is not a count,
  // and guessing the unit is how a roll becomes a piece.
  if (/\b(metre|meter|mtr|\dm\b|roll|reel|spool|per\s*kg|\dkg\b|litre|liter|\dml\b|sheet|coil)\b/i.test(t)) return "";
  return "1 piece";
}

/**
 * Rule 6(1) declarations that gate going Active.
 *
 * MRP is the maximum *we* will retail at, and we are the packer — so declaring
 * it equal to our own list price is our declaration to make, and it is one we
 * cannot then breach. That is categorically different from `country_of_origin`,
 * which is a fact about the world that we would be guessing at.
 */
const rule6Columns = (row) => ({
  mrp: row.price || "",
  net_quantity: netQuantity(row.title),
  importer_name: PACKER.name,
  importer_address: PACKER.address,
});

function toCsv(rows) {
  return [CSV_COLS.join(","), ...rows.map((r) => CSV_COLS.map((c) => cell(r[c])).join(","))].join("\n");
}

/** Pipe-separated build slugs for the CSV's `projects` column. Usually empty. */
function projectsFor(category) {
  if (!category) return "";
  const hit = PROJECT_PREFIXES.find(
    ([p]) => category === p || category.startsWith(`${p}.`),
  );
  return hit ? hit[1].join("|") : "";
}

/**
 * Where a row shelves, in order of how much the source is worth trusting.
 *
 * 1. The supplier's own product type. One curated field, and the best signal
 *    there is — when it says something specific.
 * 2. The title. What the seller calls the thing on the page.
 * 3. Tags and breadcrumbs. Keyword soup: Shopify tags are a marketing bag, and
 *    robu's trail carries every ancestor. "eSun 1.75mm PLA Filament" is tagged
 *    `3D Printers/Pens`, and that tag was filing 83 spools of plastic as
 *    machines — a different HSN drawer, so a tax error and not a shelving one.
 */
function resolve(row) {
  const type = row.sourceType ?? row.sourceCategory ?? "";
  const strong = matchKey(type);
  const fromType = strong && !WEAK.has(strong) ? MAP.categoryBySource[strong] : "";
  const fromTitle = mapCategory(row.title);
  const fromWeak = strong ? MAP.categoryBySource[strong] : "";
  const fromTags = row.sourceType ? mapCategory(row.sourceCategory) : "";
  const category = fromType || fromTitle || fromWeak || fromTags;
  return { category, fromTitle: Boolean(category) && category === fromTitle && !fromType };
}

/** `node tools/feeds/pull.mjs --check` — the mis-filing regressions, as asserts. */
function selfCheck() {
  const cases = [
    /*
      The two originals. They asserted "unmapped" only because there was no
      paint shelf when they were written — the claim was always "not an ESC"
      and "not PLA", and now that a real answer exists they assert that
      instead. Getting these wrong once filed spray paint under HSN 8806.
    */
    ["Kobe F2 Fluorescent Red Acrylic Lacquer Spray Paint", "tools.paints-coatings.spray-paint", "Fluorescent is not an ESC"],
    ["KOBE 263 Plastic Primer Spray Adhesion Promoter", "tools.paints-coatings.primers-undercoats", "Plastic is not PLA"],
    ["1kg PLA Filament 1.75mm Black", "3d-printing.filament.pla", "real PLA still maps"],
    ["30A Brushless ESC for Quadcopter", "drones-parts.escs.single-escs", "real ESC still maps"],
    ["LM10UU Linear Bearing for 10mm Shaft", "bearings.linear-motion.linear-ball-bearings", "hyphen/space tolerant"],
    ["M3 Socket Head Cap Screw 10mm SS304", "fasteners.screws-by-head.socket-head-cap", "multi-word key"],

    /*
      The robu keys are broader than the originals — "connector", "relay",
      "transistor" — and broad keys are exactly what mis-filed a can of spray
      paint the first time. These pin the boundaries that matter, in both
      directions: the specific key must beat the generic one, and the generic
      one must not swallow a title that merely mentions the word.
    */
    ["Omron Limit Switch SPDT Roller Lever", "industrial-electricals.industrial-sensors.limit-switches", "limit switch beats generic switch"],
    ["USB to TTL Serial Adapter CP2102", "", "adapter alone is not an AC-DC supply"],
    ["12V 2A Power Adapter SMPS Wall Mount", "electronic-components.power-supplies.ac-dc-adapters", "power adapter is"],
    ["3.5 inch TFT LCD Touch Display Module", "electronic-components.displays.tft-graphic", "tft lcd beats bare lcd"],
    // Was asserted unmapped while the only antenna leaf sat under drones-parts
    // (HSN 8806). It now has an RF home, so it must land there and not there.
    ["433MHz Helical Antenna for GSM Module", "electronic-components.wireless-rf.antennas", "antennas are RF, not aircraft parts"],
    ["2N2222 NPN Bipolar Transistor TO-92", "electronic-components.semiconductors.transistors-bjt", "bipolar transistor"],
    ["IRFZ44N N-Channel MOSFET 55V 49A", "electronic-components.semiconductors.mosfets", "mosfet not swept into transistor"],

    /*
      Longer key wins, and that is what mis-filed these: a brand name is longer
      than the material it is selling, "carbon fiber" is longer than
      "propellers", and "spacer" reached a battery holder first. Each of these
      crossed an HSN drawer, so they are tax errors rather than shelving ones.
    */
    ["Creality Hyper PLA Filament 1.75mm 1kg", "3d-printing.filament.pla", "material beats brand"],
    // Multi-word keys need the words adjacent, so "TPU 95A Filament" falls
    // through to the generic filament key — right drawer, wrong spool. The
    // supplier's own category is adjacent and resolves; that is the path that
    // matters, since a title match is flagged `categoryFromTitle` for review.
    ["Bambu Lab TPU Filaments", "3d-printing.filament.tpu-flexible", "TPU is not PLA"],
    ["Creality Ender-3 V3 3D Printer Parts Kit", "3d-printers.printer-kits-upgrades.upgrade-kits", "parts, not a printer"],
    ["Creality Ender-3 V3 SE 3D Printer", "3d-printers.fdm-printers.entry-level", "the machine itself"],
    ["5010 Carbon Fiber Propeller Pair CW CCW", "drones-parts.propellers.4-5", "a prop made of CF is a prop"],
    ["N20 12V 300RPM Metal Gear Motor", "motors.dc-motors.geared-dc-bo-tt", "geared motor is a motor"],
    ["18650 2-Cell Battery Holder with Wires", "batteries-power.pack-building.cell-holders", "holder is not a spacer"],

    /* -es and -y plurals, which a bare `s?` silently missed */
    ["Tactile Switches", "industrial-electricals.panel-components.push-buttons", "switch → switches"],
    ["Slide Switches", "industrial-electricals.panel-components.push-buttons", "switch → switches"],
    ["Limit Switches", "industrial-electricals.industrial-sensors.limit-switches", "specific key still wins in plural"],
    ["Plastic Gears", "hardware.power-transmission.gears", "regular plural still works"],
    ["Power Relays", "industrial-electricals.drives-automation.industrial-relays", "vowel+y takes -s, not -ies"],
    ["Signal Relays", "industrial-electricals.drives-automation.industrial-relays", "same"],
    ["Li-Ion Batteries", "batteries-power.battery-packs.li-ion-packs", "consonant+y does take -ies"],

    /* new leaves, and the two keys that reached past them */
    ["LEM LA 55-P/SP1 Current Transducer", "electronic-components.sensors.current-voltage", "a current transducer is not a speaker"],
    ["GSPK2805TN 8ohm 0.5W Speaker", "electronic-components.audio-sound.speakers", "an acoustic one is"],
    ["SIM800C GPRS/GSM Modem with Antenna", "electronic-components.wireless-rf.gsm-cellular", "cellular, not positioning"],
    ["NEO-M8N GPS Module with Antenna", "electronic-components.wireless-rf.gps-gnss", "positioning, not cellular"],
    ["TEC1-12706 Thermoelectric Peltier Cooler", "electronic-components.thermal-management.peltier-tec", "new thermal leaf"],
    ["12V DC Peristaltic Dosing Pump", "motors.actuators.water-air-pumps", "new actuator leaf"],
    ["RC Receivers for Drones and Bots", "drones-parts.radio-link.rc-receivers", "control link, not video downlink"],
    ["Stepper Motor 28BYJ-48 with ULN2003 Driver Board", "motors.stepper-motors.nema-17", "the motor, not the driver bundled with it"],
    ["gearbox mounting plate", "", "plural tolerance is not a substring match"],

    /* the combined supplier category, which needs a key longer than its first word */
    ["Optocoupler / Light-Coupled Relay Modules", "industrial-electricals.drives-automation.industrial-relays", "a relay board is not an optocoupler"],
    ["Optocoupler ICs", "electronic-components.semiconductors.optocouplers", "and a real optocoupler still is one"],
    ["Panel Indicator Lights", "industrial-electricals.panel-components.indicator-lamps", "a pilot lamp is not a meter"],
    ["Digital Voltage, Current and Frequency Meter", "industrial-electricals.panel-components.panel-meters", "and a meter still is one"],

    /* the IC shelves, which were all one shelf */
    ["Drivers and Interfaces IC", "electronic-components.integrated-circuits.interface-driver-ics", "a driver IC is not a logic gate"],
    ["Clock & Timing IC", "electronic-components.integrated-circuits.clock-timing", "nor is an RTC"],
    ["Buffers and Transceivers IC", "electronic-components.integrated-circuits.logic-ics", "but a bus transceiver still is"],

    /*
      Priority keys. Each is shorter than `antenna` and has to beat it anyway,
      and `rp-sma` has to keep losing — 41 of the 63 rows carrying it are
      ordinary LoRa and WiFi antennas, so promoting it would cross an HSN
      drawer for two thirds of its matches.
    */
    ["5.8Ghz LHCP RP-SMA 150MM FPV Albtross Antenna", "drones-parts.fpv-system.antennas", "polarisation beats the noun"],
    ["4 Leaf Clover RHCP RP-SMA Male Antenna", "drones-parts.fpv-system.antennas", "same"],
    ["868MHz LoRa RP-SMA Antenna 3dBi", "electronic-components.wireless-rf.antennas", "rp-sma alone is not an FPV part"],
  ];
  let failed = 0;
  for (const [title, want, why] of cases) {
    const got = mapCategory("", title);
    if (got !== want) {
      console.error(`  ✗ ${why}\n      "${title}"\n      want ${want || "(unmapped)"} · got ${got || "(unmapped)"}`);
      failed++;
    }
  }

  /*
    Parking is only allowed to claim rows that found no shelf. A deferral that
    outranks a real category silently stops selling something we do sell — the
    quiet direction of this failure, since a parked row looks the same as an
    unmapped one from outside.
  */
  const parkCases = [
    ["PC Accessories", "Logitech M170 Wireless Mouse", true, "PC accessories park"],
    ["Memory Cards and Flash Drives", "SanDisk Ultra 32GB micro SD", true, "consumer storage parks"],
    ["", "Micro SD Card Module for Arduino SPI", false, "a card module is a part we sell"],
    ["", "RC522 13.56MHz RFID Card Reader Module", false, "an RFID reader is not consumer storage"],
    ["", "4x4 Matrix 16 Keypad Keyboard Module", false, "a matrix keypad is not a PC keyboard"],
    ["Tactile Switches", "2 PIN WHITE TACT SWITCH", false, "a mapped row is never parked"],
  ];
  for (const [sourceCategory, title, shouldPark, why] of parkCases) {
    const { category } = resolve({ sourceCategory, title });
    const got = category ? "" : deferralFor(sourceCategory, title);
    if (Boolean(got) !== shouldPark) {
      console.error(`  ✗ ${why}\n      "${title}"\n      ${shouldPark ? "expected parked" : "expected NOT parked"} · got ${got || category || "(unmapped)"}`);
      failed++;
    }
  }

  /*
    Precedence, which is a different question from "does this key match".

    Every case here was a real row on disk. The Shopify ones are the expensive
    kind: `sourceCategory` glued product_type to the marketing tags, `3D
    Printers/Pens` is a longer key than `filament`, and 82 spools of plastic
    shelved as machines — HSN 3916 goods sitting in an 8477 drawer.
  */
  const resolveCases = [
    [
      { sourceType: "Filaments", sourceCategory: "Filaments 3D Printers/Pens eSun Filaments", title: "eSun 1.75mm PLA-Matte Filament 1kg Olive Green" },
      "3d-printing.filament.pla",
      "product_type beats a tag",
    ],
    [
      { sourceType: "Mechanical Accessories", sourceCategory: "Mechanical Accessories 3D Printers/Pens Bearing Mechanical Accessories", title: "LM10UU Linear Motion Bearing For 3D Printers" },
      "bearings.linear-motion.linear-ball-bearings",
      "a bearing tagged 3D-printer is still a bearing",
    ],
    [
      { sourceType: "", sourceCategory: "3D Printers/Pens", title: "Creality Ender-3 V3 SE 3D Printer" },
      "3d-printers.fdm-printers.entry-level",
      "no product_type: the title decides, and it is a machine",
    ],
    [
      { sourceType: "Sale Offer", sourceCategory: "Sale Offer Filaments", title: "" },
      "3d-printing.filament.pla",
      "an unmappable product_type falls through to the tags",
    ],
    /* weak buckets: the title outranks them, and they still catch the rest */
    [
      { sourceCategory: "Bambu Lab 3D Printer Parts", title: "Creality -0.4mm MK8 Brass Nozzle" },
      "3d-printing.hotends-extruders.nozzles",
      "a weak bucket loses to a specific title",
    ],
    [
      { sourceCategory: "Bambu Lab 3D Printer Parts", title: "Bambu Lab AMS Riser" },
      "3d-printers.printer-kits-upgrades.upgrade-kits",
      "and still catches what the title cannot name",
    ],
    /* strong buckets must NOT be overridden — the title is the weaker signal */
    [
      { sourceCategory: "Tactile Switches", title: "2 PIN WHITE TACT SWITCH LED Compatible" },
      "industrial-electricals.panel-components.push-buttons",
      "a strong supplier category still beats the title",
    ],
  ];
  for (const [row, want, why] of resolveCases) {
    const { category } = resolve(row);
    if (category !== want) {
      console.error(`  ✗ ${why}\n      ${JSON.stringify(row.title || row.sourceCategory)}\n      want ${want || "(unmapped)"} · got ${category || "(unmapped)"}`);
      failed++;
    }
  }

  /*
    Build membership. The negative cases matter more than the positive ones:
    the importer appends to `builds.items` and never removes, so an over-eager
    claim is a page someone has to go find and undo by hand.
  */
  const projectCases = [
    ["drones-parts.propellers.4-5", "drone", "the drawer is the build"],
    ["3d-printing.filament.pla", "3d-printer", "consumables count"],
    ["motors.stepper-motors.nema-17", "3d-printer|cnc", "one part, two builds"],
    ["motors.bldc-motors.outrunner", "drone|ev", "same"],
    ["fasteners.screws-by-head.socket-head-cap", "", "a screw does not build a drone"],
    ["electronic-components.semiconductors.leds", "", "nor does an LED"],
    ["bearings.ball-bearings.deep-groove", "", "only the linear ones are printer parts"],
    ["bearings.linear-motion.linear-ball-bearings", "3d-printer|cnc", "and those are"],
    ["", "", "no category, no claim"],
  ];
  for (const [category, want, why] of projectCases) {
    const got = projectsFor(category);
    if (got !== want) {
      console.error(`  ✗ ${why}\n      ${category || "(uncategorised)"}\n      want ${want || "(none)"} · got ${got || "(none)"}`);
      failed++;
    }
  }

  /* Origin. A wrong one is a false Rule 6(1) declaration, so blanks must stay blank. */
  const originCases = [
    [{ "Country of Origin": "Made In INDIA" }, "India", "the common robu spelling"],
    [{ Origin: "CN(Origin)" }, "China", "the AliExpress passthrough"],
    [{ "Country of Manufacture": "Guangdong, China" }, "China", "a province still names the country"],
    [{ "Country of origin": "India" }, "India", "key match is case-insensitive"],
    [{ Brand: "India Electronics" }, "", "a brand name is not an origin"],
    [{ "Motor Original Speed": "China" }, "", "`origin` must be the whole key, not a prefix"],
    [{}, "", "no specs, no claim"],
  ];
  for (const [specs, want, why] of originCases) {
    const got = originFrom(specs);
    if (got !== want) {
      console.error(`  ✗ ${why}\n      ${JSON.stringify(specs)}\n      want ${want || "(blank)"} · got ${got || "(blank)"}`);
      failed++;
    }
  }

  /*
    Typed spec columns. The harvest really contains `Thread: Hardened Steel`
    and `Length: 20meters`; both must come out blank, because a wrong spec is a
    dimension somebody orders against.
  */
  const specCases = [
    [{ "Thread Size": "M6" }, { thread: "M6" }, "a clean thread designation"],
    [{ Thread: "M6 × 1.0" }, { thread: "M6" }, "the pitch is dropped, the thread kept"],
    [{ "Thread Size": "3/8 BSP" }, { thread: "3/8 BSP" }, "imperial threads are real threads"],
    [{ Thread: "the metric positive thread" }, {}, "prose is not a thread"],
    [{ Thread: "Hardened Steel" }, {}, "nor is a material"],

    [{ "Bolt Length": "45mm" }, { length_mm: "45" }, "millimetres, unspaced"],
    [{ Length: "250 mm" }, { length_mm: "250" }, "millimetres, spaced"],
    [{ Length: "20meters" }, {}, "a different unit is a different measurement"],
    [{ Length: "4 inch" }, {}, "same"],
    [{ "Filament Diameter": "1.75 mm ± 0.03 mm" }, { dia_mm: "1.75" }, "a tolerance does not defeat it"],
    [{ "Filament Diameter": "1.75&plusmn;0.03mm" }, { dia_mm: "1.75" }, "nor does the entity"],
    [{ Diameter: "0mm" }, {}, "zero is not a dimension"],

    [{ Grade: "12.9" }, { grade: "12.9" }, "a fastener property class"],
    [{ Grade: "N52" }, { grade: "N52" }, "a magnet grade"],
    [{ Grade: "Solar Grade" }, {}, "a marketing grade is not a grade"],

    [{ Compatibility: "Hakko 900M series soldering irons" }, { compatibility: "Hakko 900M series soldering irons" }, "one token, kept whole"],
    [{ Compatibility: "Arduino UNO, Mega 2560" }, { compatibility: "Arduino UNO|Mega 2560" }, "a list becomes tokens"],
    [{ Compatibility: "ESP32 / ESP8266" }, { compatibility: "ESP32|ESP8266" }, "slashes separate too"],
    [{ Compatibility: "compatible" }, {}, "the sentence around the token is not the token"],
    [{}, {}, "no specs, no columns"],

    [{ Material: "Stainless Steel 304" }, { material: "Stainless Steel 304" }, "material as written"],
    [{ MATERIAL: "Brass" }, { material: "Brass" }, "supplier casing varies"],
    [{ Brand: "India Electronics" }, {}, "an unmapped key contributes nothing"],
  ];
  for (const [specs, want, why] of specCases) {
    const got = typedSpecs(specs);
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      console.error(`  ✗ ${why}\n      ${JSON.stringify(specs)}\n      want ${JSON.stringify(want)} · got ${JSON.stringify(got)}`);
      failed++;
    }
  }

  /*
    Every value `enrich` computes has to survive the trip into a CSV cell.

    It did not: `enrich` emitted `countryOfOrigin` while `CSV_COLS` reads
    `country_of_origin`, so `toCsv` looked up a key that was never there and
    wrote a blank. All 89 harvested origin declarations — the one Rule 6(1)
    field we had any data for at all — reached the importer empty, and nothing
    failed, because a blank cell is what 119,775 other rows legitimately have.

    So this asserts on the rendered line rather than on the object: read the
    header, find the column, and check the value is in it. A rename on either
    side breaks it.
  */
  /*
    Net quantity is a measured declaration, so a wrong one is short measure.
    "1 piece" is only safe where nothing in the title says otherwise.
  */
  const qtyCases = [
    ["M3 Hex Nut", "1 piece", "a loose part is one piece"],
    ["Neodymium Disc Magnet (pack of 10)", "10 pieces", "the supplier printed the count"],
    ["Jumper Wires Set of 40", "40 pieces", "set of, too"],
    ["Heat Shrink Tube 100 pcs", "100 pieces", "and the bare count"],
    ["Resistor Kit of 1", "1 piece", "singular stays singular"],
    ["PLA Filament 1.75mm 1kg Spool", "", "sold by weight on a spool — not a count"],
    ["Silicone Wire 5 metre roll", "", "sold by length"],
    ["Copper Sheet 200x300mm", "", "sold as sheet"],
    ["Solder Wire 100g reel", "", "reel"],
  ];
  for (const [title, want, why] of qtyCases) {
    const got = netQuantity(title);
    if (got !== want) {
      console.error(`  ✗ ${why}\n      ${title}\n      want ${want || "(blank)"} · got ${got || "(blank)"}`);
      failed++;
    }
  }

  const shapeCases = [
    ["country_of_origin", "India", { specs: { "Country of Origin": "India" } }],
    ["mrp", "199", { price: "199" }],
    ["importer_name", "OnlyParts", {}],
    ["net_quantity", "1 piece", {}],
    ["compatibility", "Arduino UNO", { specs: { Compatibility: "Arduino UNO" } }],
    ["thread", "M6", { specs: { "Thread Size": "M6" } }],
    ["hsn", "", { specs: {} }],
  ];
  // Splitting on "," would be the very bug this block exists to catch:
  // `importer_address` is quoted and contains two commas, so a naive split
  // shifts every column after it and reports the wrong cell as wrong.
  const cells = (line) => {
    const out = [];
    let f = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c !== '"') f += c;
        else if (line[i + 1] === '"') { f += '"'; i++; }
        else q = false;
      } else if (c === '"') q = true;
      else if (c === ",") { out.push(f); f = ""; }
      else f += c;
    }
    out.push(f);
    return out;
  };

  for (const [column, want, row] of shapeCases) {
    const [head, line] = toCsv([enrich({ sku: "X", title: "test part", ...row })]).split("\n");
    const at = cells(head).indexOf(column);
    const got = at < 0 ? "(no such column)" : (cells(line)[at] ?? "");
    // `hsn` carries no expectation beyond "the column exists" — an unmapped
    // row genuinely has none, and asserting a value would pin the map.
    if (at < 0 || (want && got !== want)) {
      console.error(`  ✗ ${column} does not reach its CSV cell\n      want ${want || "(a column)"} · got ${got || "(blank)"}`);
      failed++;
    }
  }

  const total =
    cases.length + parkCases.length + resolveCases.length + projectCases.length +
    originCases.length + specCases.length + qtyCases.length + shapeCases.length;
  console.log(failed ? `\n${failed}/${total} failed` : `${total}/${total} passed`);
  process.exit(failed ? 1 : 0);
}
if (args.check) selfCheck();

/**
 * Everything the importer needs that the supplier does not publish.
 *
 * Shelving is `resolve()`, and rows that fell through to the title are flagged.
 * Titles are genuinely unreliable here: an adhesion promoter whose blurb lists
 * "PP, PE, ABS" reads as ABS filament to any keyword matcher. Those rows want a
 * human — or a classifier — before they go anywhere near a GST invoice.
 */
function enrich(row) {
  const { category, fromTitle } = resolve(row);
  const drawer = category.split(".")[0];
  return {
    ...row,
    category,
    categoryFromTitle: fromTitle,
    /*
      The importer appends these to `builds.items` and never removes, so a
      wrong slug here is a claim on a build page that someone has to go find
      and undo. Sparse on purpose — see `projectsByCategory` in map.json.
    */
    projects: projectsFor(category),
    // Only meaningful when there is no category — a parked row is one we chose
    // not to shelve, not one we failed to.
    deferred: category ? "" : deferralFor(row.sourceCategory, row.title),
    hsn: MAP.hsnByDrawer[drawer] ?? "",
    gst_rate: MAP.gstByDrawer[drawer] ?? "",
    weight_g: row.grams || MAP.defaultWeightByDrawer[drawer] || "",
    weightEstimated: !row.grams,
    /*
      Harvested where a supplier happens to state it, which is 0.2% of rows.

      No supplier publishes it as a field. A handful put it in the spec table —
      "Country of Origin: India", "Origin: CN(Origin)" — and `originFrom` takes
      those. It is a mandatory Rule 6(1) declaration and since 1 July 2026
      imported goods must be filterable by it, so the ~90 rows that come free
      are worth taking; the other 119,700 still have to come off the import
      documents. The counter at the end of a run reports the gap out loud
      rather than the gap being discovered by an inspector.

      Named for the CSV column, like every other emitted field here. It was
      `countryOfOrigin` for one release and `CSV_COLS` reads `country_of_origin`,
      so all 89 harvested declarations were written as an empty cell and the
      only legally-required field we had any data for reached the importer
      blank. `csvShape()` in the self-check now fails if that drifts again.
    */
    country_of_origin: row.countryOfOrigin || originFrom(row.specs),
    ...rule6Columns(row),
    /*
      76% of harvested rows carry a spec block and the CSV used to emit none of
      it, so every imported part landed with an empty spec table. Only the
      values that survive `typedSpecs` are promoted — see the note there on why
      dropping beats guessing.
    */
    ...typedSpecs(row.specs),
  };
}

/**
 * SKUs are namespaced by source.
 *
 * Two suppliers will eventually both stock a part called "6000ZZ", and the
 * importer keys updates on `sku` — an un-namespaced collision would silently
 * overwrite one listing's price with the other's. The prefix also means a
 * re-pull updates the rows it created last time rather than duplicating them.
 */
function makeSku(prefix, raw, fallback) {
  const clean = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 28);
  const body = clean.length >= 3 ? clean : String(fallback).replace(/[^A-Za-z0-9]/g, "").slice(-10);
  return `${prefix}-${body}`.toUpperCase();
}

/* ------------------------------------------------------------------ *
 * Source kind: Shopify
 *
 * One adapter for every Shopify store, driven by `sources.json`. The platform
 * serves the same `/products.json` shape everywhere, so a new supplier is a
 * table entry rather than a function — which is the difference between adding
 * a source in a minute and adding one in an afternoon.
 * ------------------------------------------------------------------ */

async function pullShopify(limit, { host, prefix }) {
  const origin = `https://${host}`;
  const out = [];

  for (let page = 1; page <= 60 && out.length < limit; page++) {
    const data = await get(`${origin}/products.json?limit=250&page=${page}`, { json: true });
    const products = data?.products ?? [];
    if (!products.length) break;
    console.log(`  page ${page}: ${products.length} products`);

    for (const p of products) {
      for (const v of p.variants ?? []) {
        if (out.length >= limit) break;
        // A Shopify "Default Title" variant is the product itself, not an option.
        const suffix = v.title && v.title !== "Default Title" ? ` — ${v.title}` : "";
        out.push(
          enrich({
            sku: makeSku(prefix, v.sku, v.id),
            title: (p.title + suffix).slice(0, 200),
            price: Number(v.price) || 0,
            stock: v.available ? 1 : 0,
            grams: v.grams || 0,
            sourceSku: v.sku ?? "",
            /*
              product_type is one curated field; tags are whatever marketing
              added. Joining them lost that distinction, and the tags won —
              `3D Printers/Pens` is a longer key than `filament`, so eSun
              spools shelved as machines. Kept apart, matched in that order.
            */
            sourceType: p.product_type ?? "",
            sourceCategory: [p.product_type, ...(p.tags ?? [])].filter(Boolean).join(" "),
            sourceUrl: `${origin}/products/${p.handle}`,
            image: p.images?.[0]?.src ?? "",
            // Every shot, not just the hero. Scale photographs and drawings are
            // most of what makes a parts listing usable, and re-fetching the
            // catalogue later to get them is a second full crawl.
            images: (p.images ?? []).map((i) => i.src).filter(Boolean),
            specs: parseSpecs(p.body_html ?? ""),
            datasheets: findPdfs(p.body_html ?? "", origin),
            options: (p.options ?? []).map((o) => ({ name: o.name, values: o.values })),
            description: stripHtml(p.body_html ?? "").slice(0, 1000),
            vendor: p.vendor ?? "",
            source: host,
          }),
        );
      }
    }
  }
  return out;
}

const stripHtml = (s) =>
  s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/**
 * Dimensions and specs, out of prose.
 *
 * Neither supplier publishes a structured attribute table anywhere a scraper
 * can reach. robu renders its spec panel client-side from a GraphQL call, and
 * Shopify has no spec concept at all — so on both sites the real information
 * lives in the description as `Key: value` lines separated by `<br>` or
 * newlines:
 *
 *     Diameter: 4mm    Bolt Length: 90mm    Pitch: 0.7mm    Material: SS 304
 *
 * This pulls those out. It is a heuristic and it is treated as one: the result
 * goes in the JSON for a human to look at, never straight into the importer's
 * typed spec columns, because "Material: SS 304" and `material=ss304` are only
 * the same thing if somebody has checked.
 */
function parseSpecs(html) {
  const lines = String(html ?? "")
    // The line breaks are the record separators, so they have to survive
    // `stripHtml`, which would otherwise flatten everything into one string.
    .replace(/<br\s*\/?>|<\/(p|li|tr|div)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .split(/[\n\r]+/);

  const specs = {};
  for (const line of lines) {
    // One colon, a short label before it, something after it. The length caps
    // are what stop a prose sentence containing a colon becoming a "spec".
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9 ()/.'’-]{1,34}?)\s*:\s*(.{1,80}?)\s*$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = m[2].trim();
    if (!value || /[.!?]$/.test(value) || value.split(/\s+/).length > 8) continue;
    if (!specs[key]) specs[key] = value;
  }
  return specs;
}

/** Any datasheet or manual linked from the page. */
function findPdfs(html, base) {
  const out = new Set();
  for (const m of String(html ?? "").matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)) {
    try {
      out.add(new URL(m[1], base).href);
    } catch {
      // A malformed href is not worth failing the product for.
    }
  }
  return [...out];
}

/* ------------------------------------------------------------------ *
 * Source: robu.in — sitemap + JSON-LD
 * ------------------------------------------------------------------ */

/**
 * Product URLs, newest-changed first, skipping anything we already have at the
 * same `lastmod`.
 *
 * robu publishes ~110,000 products across 22 sitemaps. Re-fetching all of them
 * on every run is eleven hours of somebody else's bandwidth to discover that
 * almost nothing changed, and it is the difference between a feed that can run
 * nightly and one that runs once and is never repeated. The sitemap's `lastmod`
 * is the supplier telling us exactly which pages moved; `state.json` remembers
 * what we saw last time.
 *
 * `--full` ignores the state and walks everything, for the first run and for
 * when the mapping changes underneath us.
 */
function loadState(source) {
  try {
    return JSON.parse(readFileSync(join(OUT, `${source}.state.json`), "utf8"));
  } catch {
    return { seen: {} };
  }
}

/**
 * What a previous run already captured.
 *
 * An incremental run fetches only what changed, so its own results are a
 * *delta*. Writing that delta out on its own would replace a 3,000-product
 * catalogue with the 40 products that moved since yesterday — the state file
 * would still claim all 3,000 were seen, so the rest would never be fetched
 * again either. Resuming therefore has to start from what is already on disk.
 *
 * `--full` deliberately skips this: that flag means "start over".
 */
function loadRows(source, full) {
  if (full) return [];
  try {
    const rows = JSON.parse(readFileSync(join(OUT, `${source}.json`), "utf8"));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function robuUrls(limit, state, full) {
  const index = await get("https://robu.in/sitemap.xml", { curl: true });
  const maps = [...(index ?? "").matchAll(/<loc>([^<]*products-sitemap[^<]*)<\/loc>/g)].map((m) => m[1]);

  const urls = [];
  let skipped = 0;
  for (const m of maps) {
    if (urls.length >= limit) break;
    const xml = await get(m, { curl: true });
    // <url> blocks, so a <lastmod> stays attached to the <loc> it belongs to.
    for (const block of (xml ?? "").matchAll(/<url>([\s\S]*?)<\/url>/g)) {
      if (urls.length >= limit) break;
      const loc = block[1].match(/<loc>([^<]+)<\/loc>/)?.[1];
      if (!loc?.includes("/product/")) continue;
      const lastmod = block[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? "";
      if (!full && state.seen[loc] && state.seen[loc] === lastmod) {
        skipped++;
        continue;
      }
      urls.push({ url: loc, lastmod });
    }
  }
  if (skipped) console.log(`  ${skipped} unchanged since last run (--full to re-pull)`);
  return urls;
}

function jsonLd(html, type) {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      for (const node of Array.isArray(j) ? j : [j]) {
        if (node?.["@type"] === type) return node;
      }
    } catch {
      // A malformed block among eight good ones is not worth aborting the page for.
    }
  }
  return null;
}

async function pullRobu(limit, concurrency, state, full) {
  const urls = await robuUrls(limit, state, full);
  console.log(`  ${urls.length} product URLs to fetch`);

  /*
    Seeded with the previous run's output, so a resume appends rather than
    replaces. `bySourceUrl` is what makes a re-fetched product (one whose
    `lastmod` moved) update its row instead of appearing twice.
  */
  const out = loadRows("robu", full);
  const bySourceUrl = new Map(out.map((r, i) => [r.sourceUrl, i]));
  if (out.length) console.log(`  ${out.length} already on disk — appending`);

  let cursor = 0;
  const worker = async () => {
    while (cursor < urls.length) {
      const { url, lastmod } = urls[cursor++];
      const html = await get(url, { curl: true });
      if (!html) continue;
      // Recorded before parsing: a page that 200s but carries no JSON-LD is
      // still a page we have looked at, and re-fetching it nightly forever
      // would be the same waste the state file exists to avoid.
      state.seen[url] = lastmod;
      const p = jsonLd(html, "Product");
      if (!p) continue;

      const crumb = jsonLd(html, "BreadcrumbList");
      // Drop "Home", "Shop" and the trailing product name — what is left is the
      // supplier's own category, which is what `map.json` keys on.
      const trail = (crumb?.itemListElement ?? [])
        .map((i) => i.name)
        .filter((n) => n && !["home", "shop"].includes(n.toLowerCase()))
        .slice(0, -1)
        .join(" > ");

      const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
      const row = enrich({
          sku: makeSku("RB", p.sku, url),
          title: String(p.name ?? "").slice(0, 200),
          price: Number(offer?.price) || 0,
          stock: String(offer?.availability ?? "").includes("InStock") ? 1 : 0,
          grams: 0, // robu does not publish shipping weight anywhere in the markup
          sourceSku: p.sku ?? "",
          sourceCategory: trail,
          sourceUrl: url,
          image: Array.isArray(p.image) ? p.image[0] : (p.image ?? ""),
          images: Array.isArray(p.image) ? p.image.filter(Boolean) : [p.image].filter(Boolean),
          /*
            robu's spec panel is rendered client-side from its GraphQL API, so
            none of it is in this HTML. What *is* here is the JSON-LD
            description, and robu writes its dimensions into that as
            `Shaft Diameter: 5 mm` lines — which is where the numbers actually
            come from for this source.
          */
          specs: parseSpecs(String(p.description ?? "")),
          datasheets: findPdfs(html, url),
          description: stripHtml(String(p.description ?? "")).slice(0, 1000),
        vendor: "Robu.in",
        source: "robu.in",
      });

      // A product whose `lastmod` moved is an update, not a second copy.
      const at = bySourceUrl.get(url);
      if (at === undefined) {
        bySourceUrl.set(url, out.length);
        out.push(row);
      } else {
        out[at] = row;
      }

      if (out.length % 25 === 0) console.log(`  ${out.length} rows (${cursor}/${urls.length} fetched)`);

      /*
        Checkpoint.

        Everything used to be written once, after the last product. A crawl of
        110,000 pages runs for hours, and "interrupted at hour three" meant
        three hours of somebody else's bandwidth spent for an empty output
        directory — and, because the state file was written at the same moment,
        no memory of it either. Writing every 100 costs one file write per two
        minutes of crawling.
      */
      if (++sinceCheckpoint >= checkpointEvery(out.length)) {
        sinceCheckpoint = 0;
        writeOut(out, state);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

/**
 * Split, because the importer's dry run runs in the browser.
 *
 * `/admin/import` parses the whole file client-side to show the diff before
 * anything is written — which is the right design, and which also means a
 * 110,000-row CSV is a hung tab. Chunks are also the unit of recovery: if the
 * fourteenth batch is wrong you re-import the fourteenth batch.
 */
const CHUNK_ROWS = Number(args.chunk ?? 2000);

/**
 * Products between checkpoint writes, scaled to how much there is to write.
 *
 * A checkpoint rewrites the whole JSON and every CSV chunk. Fixed at 100 that
 * is fine for a 3,000-row crawl and quadratic for a 100,000-row one — 120MB
 * rewritten every seventy seconds, and the total bytes written growing as the
 * square of the catalogue. Scaling the interval keeps each checkpoint's cost
 * proportional: the window of work at risk grows to about twenty-five minutes
 * of crawling and then stops growing.
 */
const checkpointEvery = (n) => Math.min(2000, Math.max(100, Math.floor(n / 10)));

/**
 * Rows written since the last checkpoint.
 *
 * A counter, not `rows % interval === 0`. The modulo version looked equivalent
 * and was not: the interval is derived from the row count, so both sides move
 * together and the test fires at the wrong rate. Between 11,000 and 11,110
 * rows it matched every tenth row — a 13MB rewrite every two seconds, which is
 * worse than the fixed interval it replaced. A counter cannot drift like that.
 */
let sinceCheckpoint = 0;

/**
 * Write everything: the JSON, the state file and the CSV chunks.
 *
 * Called both at checkpoints and at the end, so an interrupted run leaves the
 * same shape of output as a finished one — just less of it.
 */
function writeOut(rows, state) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${source}.json`), JSON.stringify(rows, null, 1));
  writeFileSync(join(OUT, `${source}.state.json`), JSON.stringify(state));

  // Last run's CSVs go first. A run that produces three chunks where the
  // previous produced five leaves chunks four and five on disk, still looking
  // importable, full of a catalogue that no longer exists.
  for (const f of readdirSync(OUT)) {
    if (f.startsWith(`${source}.`) && f.endsWith(".csv")) rmSync(join(OUT, f));
  }

  const chunks = [];
  for (let i = 0; i < rows.length; i += CHUNK_ROWS) chunks.push(rows.slice(i, i + CHUNK_ROWS));
  chunks.forEach((c, n) => {
    const name = chunks.length <= 1 ? `${source}.csv` : `${source}.${String(n + 1).padStart(3, "0")}.csv`;
    writeFileSync(join(OUT, name), toCsv(c));
  });
  return chunks.length;
}

/* ------------------------------------------------------------------ *
 * robots.txt, checked rather than assumed.
 *
 * Both targets currently allow `/product/` paths to every agent, but "it was
 * allowed when I wrote this" is not a thing to hard-code into a job that will
 * run nightly for a year. If a Disallow appears over the product paths, this
 * stops instead of continuing to hammer them — which is the difference between
 * a feed and an incident.
 * ------------------------------------------------------------------ */

async function robotsAllows(origin, path, useCurl) {
  const txt = await get(`${origin}/robots.txt`, { curl: useCurl, tries: 1 });
  if (!txt) {
    console.warn("  ! robots.txt unreachable — refusing to crawl blind");
    return false;
  }
  // Only the `User-agent: *` group applies to us; we are not Googlebot.
  const star = txt.split(/^user-agent:/im).find((s) => s.trimStart().startsWith("*"));
  if (!star) return true;
  const rules = [...star.matchAll(/^\s*(allow|disallow):\s*(\S*)\s*$/gim)]
    .map((m) => ({ allow: m[1].toLowerCase() === "allow", path: m[2] }))
    .filter((r) => r.path && path.startsWith(r.path))
    .sort((a, b) => b.path.length - a.path.length); // longest match wins
  return rules.length === 0 || rules[0].allow;
}

/* ------------------------------------------------------------------ */

const source = args.source;
const limit = Number(args.limit ?? 500);
const concurrency = Number(args.concurrency ?? 4);
const full = Boolean(args.full);

const SOURCES = Object.fromEntries(
  Object.entries(JSON.parse(readFileSync(join(HERE, "sources.json"), "utf8"))).filter(
    ([k]) => !k.startsWith("_"),
  ),
);

const site = SOURCES[source];
if (!site) {
  console.error(
    `Usage: node tools/feeds/pull.mjs --source=<name> [--limit=500]\n` +
      `                                [--concurrency=4] [--chunk=2000] [--full] [--remap] [--check]\n\n` +
      `Known sources (edit tools/feeds/sources.json to add one):\n` +
      Object.entries(SOURCES)
        .map(([k, v]) => `  ${k.padEnd(18)} ${v.kind.padEnd(8)} ${v.host}`)
        .join("\n"),
  );
  process.exit(1);
}

const origin = `https://${site.host}`;
const probePath = site.kind === "robu" ? "/product/" : "/products.json";
const useCurl = site.kind === "robu";

/*
  `--remap` re-runs the mapping over rows already on disk, and touches no
  network at all.

  map.json changes far more often than a supplier's catalogue does. Adding
  forty category keys is not a reason to re-fetch a hundred thousand product
  pages from someone else's server, and treating it as one is how a polite
  crawler turns into an abusive one.
*/
if (!args.remap && !(await robotsAllows(origin, probePath, useCurl))) {
  console.error(`\n  ✗ ${origin}/robots.txt disallows ${probePath} for generic agents. Stopping.\n`);
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });
const state = loadState(source);

if (args.remap) console.log(`Re-mapping ${source} from disk (no network)…`);
else console.log(`Pulling ${source} (${site.host}, limit ${limit}${full ? ", full" : ", incremental"})…`);

const rows = args.remap
  ? loadRows(source, false).map(enrich)
  : site.kind === "shopify"
    ? await pullShopify(limit, site)
    : await pullRobu(limit, concurrency, state, full);

const chunkCount = writeOut(rows, state);

const parked = rows.filter((r) => !r.category && r.deferred);
const unmapped = rows.filter((r) => !r.category && !r.deferred);
const estimated = rows.filter((r) => r.category && r.weightEstimated);
const noPrice = rows.filter((r) => !r.price);
const noOrigin = rows.filter((r) => !r.country_of_origin);

console.log(`
  ${rows.length} rows → tools/feeds/out/${source}.json + ${chunkCount} CSV chunk(s) of ${CHUNK_ROWS}

  ready to import    ${rows.length - unmapped.length - parked.length - noPrice.length}
  no category/hsn    ${unmapped.length}   ← add to map.json, these will fail the dry run
  parked on purpose  ${parked.length}   ← held in the feed, not listed; see deferredCategories
  guessed from title ${rows.filter((r) => r.categoryFromTitle).length}   ← review these, keyword matching mis-files
  weight estimated   ${estimated.length}   ← from map.json defaults, decides shipping
  no price           ${noPrice.length}
  NO COUNTRY OF ORIGIN ${noOrigin.length}   ← legally required on the listing, see below
`);

if (noOrigin.length) {
  console.log(
    "  Neither supplier publishes country of origin, so it cannot be scraped. It is a\n" +
      "  mandatory Rule 6(1) declaration under the Legal Metrology (Packaged Commodities)\n" +
      "  Rules, and since 1 July 2026 imported goods must also be filterable by it. It has\n" +
      "  to come off the import/purchase documents, per part, before these rows go live.\n",
  );
}

if (parked.length) {
  const why = {};
  for (const r of parked) why[r.deferred] = (why[r.deferred] ?? 0) + 1;
  console.log("  Parked, kept in the feed for later:");
  for (const [k, n] of Object.entries(why).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(5)}  ${k}`);
  }
  console.log("");
}

if (unmapped.length) {
  const top = {};
  for (const r of unmapped) top[r.sourceCategory || "(none)"] = (top[r.sourceCategory || "(none)"] ?? 0) + 1;
  console.log("  Most common unmapped source categories:");
  for (const [k, n] of Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`    ${String(n).padStart(5)}  ${k}`);
  }
}
