#!/usr/bin/env node
/*
  Build a local triage page for the image-family groupings.

    node tools/feeds/family-review.mjs [--top=5000]

  Deliberately a file:// page and not a published artifact: it displays
  suppliers' photographs, and publishing it would be distributing them. It also
  needs `<a download>` and localStorage, both of which work locally and neither
  of which survives the artifact sandbox.

  The saving is a long tail — the top 5,000 families hold only 36% of it — so
  this is built to be worked down over several sittings rather than read once.
  Decisions persist in localStorage and export as JSON, which is the file the
  scrape list is built from.

  Approving a family means "one photograph is honest for all of these", not
  "these are the same part". A 0603 and an 0805 resistor are different parts and
  the same picture; that is the whole point, and the drawing carries the size.
*/
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const TOP = Number((process.argv.find((a) => a.startsWith("--top=")) ?? "").split("=")[1] || 5000);
const DIR = "tools/feeds/out";

/* Re-read the feeds so every URL in a family is available, not just the first. */
const feeds = readdirSync(DIR).filter(
  (f) => f.endsWith(".json") && !/state|mpn|comparison|purged|watermark|families|^_/.test(f),
);

const csv = readFileSync(path.join(DIR, "image-families.csv"), "utf8").trim().split("\n").slice(1);
const parse = (l) => {
  const m = l.match(/^(\d+),(\d+),"([^"]*)","((?:[^"]|"")*)","((?:[^"]|"")*)","((?:[^"]|"")*)"$/);
  return m && { skus: +m[1], urls: +m[2], srcs: m[3], key: m[4].replace(/""/g, '"'),
                ex: m[5].replace(/""/g, '"'), first: m[6].replace(/""/g, '"') };
};
const fams = csv.map(parse).filter(Boolean)
  .map((f) => ({ ...f, save: Math.max(0, f.urls - 1) }))
  .filter((f) => f.save > 0)
  .sort((a, b) => b.save - a.save)
  .slice(0, TOP);

const wanted = new Map(fams.map((f) => [f.key, f]));

/* Ask the grouper for every url per family; it owns the key derivation. */
const byKey = new Map();
{
  const { execSync } = await import("node:child_process");
  execSync("node tools/feeds/image-families.mjs --dump-urls > tools/feeds/out/.family-urls.jsonl", { stdio: ["ignore", "ignore", "inherit"] });
  for (const line of readFileSync(path.join(DIR, ".family-urls.jsonl"), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (wanted.has(r.key)) byKey.set(r.key, r);
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MAX_IMG = 8;

const data = fams.map((f, i) => {
  const r = byKey.get(f.key) ?? { urls: [f.first], titles: [f.ex] };
  return {
    i, key: f.key, ex: f.ex, skus: f.skus, urls: f.urls, save: f.save, srcs: f.srcs,
    show: r.urls.slice(0, MAX_IMG), titles: (r.titles ?? [f.ex]).slice(0, 3),
  };
});

const totalSave = fams.reduce((a, f) => a + f.save, 0);
writeFileSync(path.join(DIR, "family-review.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Image family review</title>
<style>
 :root{--paper:#EFECE6;--card:#fff;--ink:#191612;--body:#3F3A32;--mid:#6E6656;--rule:#D8D2C7;
       --ok:#2F682A;--no:#8A3324;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
 *{box-sizing:border-box} body{margin:0;background:var(--paper);color:var(--body);
   font:15px/1.55 ui-sans-serif,system-ui,sans-serif}
 header{position:sticky;top:0;z-index:9;background:var(--paper);border-bottom:2px solid var(--ink);padding:14px 22px}
 h1{margin:0 0 6px;font-size:19px;color:var(--ink);letter-spacing:-.01em}
 .stats{display:flex;gap:22px;flex-wrap:wrap;font:12px/1 var(--mono);color:var(--mid)}
 .stats b{color:var(--ink)}
 .bar{height:5px;background:var(--rule);margin-top:10px;border-radius:3px;overflow:hidden}
 .bar i{display:block;height:100%;background:var(--ok);width:0}
 main{padding:20px 22px 120px;max-width:1500px;margin:0 auto}
 .fam{background:var(--card);border:1px solid var(--rule);border-radius:3px;margin:0 0 14px;overflow:hidden}
 .fam.approved{border-color:var(--ok);box-shadow:inset 4px 0 0 var(--ok)}
 .fam.rejected{border-color:var(--no);box-shadow:inset 4px 0 0 var(--no);opacity:.55}
 .head{display:flex;justify-content:space-between;gap:16px;padding:11px 14px;border-bottom:1px solid var(--rule);align-items:flex-start}
 .ttl{font-weight:500;color:var(--ink)} .key{font:11px/1.4 var(--mono);color:var(--mid);margin-top:3px;word-break:break-all}
 .nums{font:12px/1.5 var(--mono);color:var(--mid);text-align:right;white-space:nowrap}
 .nums b{color:var(--ink);font-size:15px}
 .strip{display:flex;gap:8px;padding:12px 14px;overflow-x:auto}
 .strip figure{margin:0;flex:0 0 130px}
 .strip img{width:130px;height:130px;object-fit:contain;background:#fff;border:1px solid var(--rule);display:block}
 .strip figcaption{font:10px/1.3 var(--mono);color:var(--mid);margin-top:4px;text-align:center}
 .acts{display:flex;gap:8px;padding:0 14px 12px}
 button{font:12px/1 var(--mono);padding:7px 13px;border:1px solid var(--rule);background:#fff;
        color:var(--body);border-radius:3px;cursor:pointer}
 button:hover{border-color:var(--ink);color:var(--ink)}
 button.y{border-color:var(--ok);color:var(--ok)} button.n{border-color:var(--no);color:var(--no)}
 button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
 footer{position:fixed;bottom:0;left:0;right:0;background:var(--card);border-top:1px solid var(--rule);
        padding:11px 22px;display:flex;gap:14px;align-items:center;font:12px/1 var(--mono)}
 .grow{flex:1}
 @media (prefers-color-scheme:dark){:root{--paper:#15130F;--card:#1E1B16;--ink:#F2EFE9;--body:#C3BCB0;
   --mid:#948B7C;--rule:#332F28;--ok:#7BB776;--no:#D08A55} .strip img{background:#fff}}
</style></head><body>
<header>
  <h1>Image family review — one photograph per family</h1>
  <div class="stats">
    <span><b>${fams.length.toLocaleString()}</b> families shown (top by saving)</span>
    <span><b>${totalSave.toLocaleString()}</b> fetches avoidable here</span>
    <span>reviewed <b id="done">0</b></span>
    <span>approved <b id="yes">0</b></span>
    <span>rejected <b id="no">0</b></span>
  </div>
  <div class="bar"><i id="prog"></i></div>
</header>
<main id="list"></main>
<footer>
  <span class="grow">Keys: <b>a</b> approve · <b>r</b> reject · <b>u</b> undo · <b>j/k</b> move</span>
  <button id="exp">Export decisions</button>
  <button id="clr">Clear all</button>
</footer>
<script>
const DATA = ${JSON.stringify(data)};
const KEY = "onlyparts.family-review.v1";
let state = {};
try { state = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { state = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const list = document.getElementById("list");
let cursor = 0;

function card(f) {
  const st = state[f.key];
  return \`<section class="fam \${st === "y" ? "approved" : st === "n" ? "rejected" : ""}" data-k="\${esc(f.key)}" id="f\${f.i}">
    <div class="head">
      <div><div class="ttl">\${esc(f.titles[0] || f.ex)}</div><div class="key">\${esc(f.key)}</div></div>
      <div class="nums"><b>\${f.skus.toLocaleString()}</b> skus<br>\${f.urls} images<br>saves \${f.save}</div>
    </div>
    <div class="strip">\${f.show.map(u =>
      \`<figure><img loading="lazy" referrerpolicy="no-referrer" src="\${esc(u)}" alt=""><figcaption>\${esc(new URL(u).hostname.replace(/^cdn\\./,"").split(".")[0])}</figcaption></figure>\`
    ).join("")}\${f.urls > f.show.length ? \`<figure><div style="width:130px;height:130px;display:grid;place-items:center;border:1px dashed var(--rule);font:11px var(--mono);color:var(--mid)">+\${f.urls - f.show.length}<br>more</div></figure>\` : ""}</div>
    <div class="acts">
      <button class="y" data-a="y">Approve — one photo</button>
      <button class="n" data-a="n">Reject — different products</button>
    </div>
  </section>\`;
}

// Render in slices so 5,000 families with images do not block the first paint.
let rendered = 0;
function more(n = 40) {
  const chunk = DATA.slice(rendered, rendered + n);
  if (!chunk.length) return;
  list.insertAdjacentHTML("beforeend", chunk.map(card).join(""));
  rendered += chunk.length;
}
more(60);
addEventListener("scroll", () => {
  if (innerHeight + scrollY > document.body.offsetHeight - 900) more();
});

function tally() {
  const v = Object.values(state);
  const y = v.filter(x => x === "y").length, n = v.filter(x => x === "n").length;
  document.getElementById("done").textContent = (y + n).toLocaleString();
  document.getElementById("yes").textContent = y.toLocaleString();
  document.getElementById("no").textContent = n.toLocaleString();
  document.getElementById("prog").style.width = (100 * (y + n) / DATA.length).toFixed(2) + "%";
}
tally();

function mark(el, a) {
  const k = el.dataset.k;
  if (a === null) delete state[k]; else state[k] = a;
  el.classList.toggle("approved", a === "y");
  el.classList.toggle("rejected", a === "n");
  save(); tally();
}
list.addEventListener("click", e => {
  const b = e.target.closest("button[data-a]");
  if (b) mark(b.closest(".fam"), b.dataset.a);
});
addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT") return;
  const cards = [...document.querySelectorAll(".fam")];
  if (e.key === "j") { cursor = Math.min(cursor + 1, cards.length - 1); cards[cursor]?.scrollIntoView({block:"center"}); }
  if (e.key === "k") { cursor = Math.max(cursor - 1, 0); cards[cursor]?.scrollIntoView({block:"center"}); }
  if ("arn".includes(e.key) && cards[cursor]) {
    mark(cards[cursor], e.key === "a" ? "y" : e.key === "r" ? "n" : null);
    if (e.key !== "u") { cursor = Math.min(cursor + 1, cards.length - 1); cards[cursor]?.scrollIntoView({block:"center"}); }
  }
  if (e.key === "u" && cards[cursor]) mark(cards[cursor], null);
});
document.getElementById("exp").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "family-decisions.json"; a.click();
};
document.getElementById("clr").onclick = () => {
  if (confirm("Clear every decision?")) { state = {}; save(); location.reload(); }
};
</script></body></html>`);

console.log(`family-review.html — ${fams.length.toLocaleString()} families, ${totalSave.toLocaleString()} avoidable fetches`);
