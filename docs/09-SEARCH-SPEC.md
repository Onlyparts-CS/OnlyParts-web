# OnlyParts — Search Specification

**Version:** 1.0
**Engine:** Meilisearch 1.x (self-hosted)

> Search is the product thesis. Everything else on this site can be average and OnlyParts still wins if a buyer can type `m3x10 ss304 socket` and get the right screw in under 120 ms. If search is mediocre, nothing else saves it.

---

## 1. Why competitor search fails

Diagnosis of the actual failure modes on Robu, OnlyScrews and similar Indian parts stores:

| Failure | Cause | Our fix |
|---|---|---|
| `m3x10` → 0 results | Title is `M3 X 10mm …`; `LIKE '%m3x10%'` misses the spaces and case | Tokenise and parse the query into typed attributes before searching |
| `bering` → 0 results | No typo tolerance | Meilisearch prefix + typo tolerance, tuned by word length |
| `allen screw` → misses everything titled "Hex Socket" | No synonyms | Curated synonym sets, seeded from real industry vocabulary |
| `10mm` matches length, diameter and head size indiscriminately | Numbers live in one text blob | Typed attributes with units; numbers are bound to a specific attribute |
| 400 unranked results for `screw` | No ranking signals beyond text match | Multi-signal ranking: text → exactness → availability → popularity → boost |
| Facets don't change per category | One global filter set | Facets are generated from the category's attribute schema |
| Searching a SKU fails | SKU not in the searchable set, or tokenised on hyphens | SKU indexed whole *and* split, highest ranking weight |

## 2. Query pipeline

```
raw:  "m3x10 ss304 sockte head 100pcs"
 │
 ├─ 1 normalise      lowercase, NFKC, collapse whitespace, strip
 │                   Indian-format commas, unify ×/x/X → 'x'
 ├─ 2 tokenise       ["m3x10","ss304","sockte","head","100pcs"]
 ├─ 3 pattern match  dimension  M3x10   → thread=M3, length_mm=10
 │                   bearing    608zz   → bearing_code=608, seal=ZZ
 │                   cell       18650   → cell_format=18650
 │                   kv         2200kv  → kv_rating=2200
 │                   package    0805    → package=0805
 │                   value      10k 100nF 4.7uF → value + unit
 │                   material   ss304 / a2-70 / 12.9 → material
 │                   sku        FS-SHC-M3-010 → exact variant lookup, short-circuit
 │                   qty        100pcs  → pack hint (does not filter; hints sort)
 ├─ 4 synonyms       sockte → socket (typo) ; socket head → hex socket cap (synonym)
 ├─ 5 unit normalise 1cm → 10mm ; 0.5" → 12.7mm ; 1.5V ; 3Ah → 3000mAh
 ├─ 6 residual       "socket head"  → the free-text q
 └─ 7 build request  q = residual
                     filter = thread = "M3" AND length_mm = 10 AND material = "ss304"
                     facets = <category schema>
```

The parser lives in `packages/search/parser.ts` and is used by the browser, the API and the BOM matcher — one implementation, so all three always agree.

### Token confidence and the chips
Every parsed token carries a confidence. Above 0.85 it becomes a **hard filter** shown as a removable turquoise chip. Between 0.6 and 0.85 it becomes a **soft boost** and is offered as a suggestion chip ("did you mean length 10 mm? [apply]"). Below 0.6 it falls through to free text. **The user can always remove a token** — an incorrect parse must never be a trap.

---

## 3. Index design

Two primary indexes, both keyed on the **variant**, because the variant is what a buyer actually searches for and buys.

### `products` document

```json
{
  "id": "variant-uuid",
  "productId": "product-uuid",
  "sku": "FS-SHC-M3-010-SS304",
  "skuTokens": ["FS","SHC","M3","010","SS304","FS-SHC-M3-010-SS304"],
  "title": "M3 × 10mm Hex Socket Head Cap Screw, SS304",
  "searchText": "M3 10mm hex socket head cap screw allen SS304 stainless DIN912 ISO4762",
  "brand": "OnlyParts",
  "mpn": null,

  "categoryPaths": [
    "fasteners","fasteners.screws-by-head","fasteners.screws-by-head.socket-head-cap-screws",
    "3d-printers-parts","3d-printers-parts.printer-hardware",
    "drones-parts","drones-parts.drone-hardware"
  ],
  "primaryCategoryPath": "fasteners.screws-by-head.socket-head-cap-screws",
  "categoryNames": ["Fasteners","Socket Head Cap Screws","3D Printers & Parts","Drones & Parts"],
  "collections": ["build-a-drone","build-a-3d-printer"],

  "attrs": {
    "thread":"M3", "length_mm":10, "pitch_mm":0.5,
    "material":"ss304", "head_type":"socket-head-cap", "drive_type":"hex",
    "finish":"plain", "grade":"a2-70", "head_dia_mm":5.5, "standard":"DIN 912"
  },

  "price": 420,
  "priceMin": 260,
  "inStock": true,
  "stockQty": 2480,
  "leadDays": 0,
  "isMadeToOrder": false,
  "packSize": 1,
  "moq": 1,

  "popularity": 0.87,
  "salesRank": 12,
  "ratingAvg": 4.8,
  "ratingCount": 142,
  "boost": 1.0,
  "createdAtTs": 1750000000,

  "image": "https://cdn…/400.avif",
  "url": "/p/m3-10mm-hex-socket-head-cap-screw-ss304"
}
```

`categoryPaths` holds **every ancestor of every assignment** — that is what makes filtering by an L1 category return products cross-listed three levels down without a join.

### Settings

```json
{
  "searchableAttributes": ["sku","skuTokens","title","searchText","categoryNames","brand","mpn"],
  "filterableAttributes": [
    "categoryPaths","primaryCategoryPath","collections","brand","inStock",
    "isMadeToOrder","price","attrs.thread","attrs.length_mm","attrs.material",
    "attrs.head_type","attrs.drive_type","attrs.finish","attrs.bore_id_mm",
    "attrs.outer_od_mm","attrs.width_mm","attrs.seal_type","attrs.kv_rating",
    "attrs.voltage_v","attrs.capacity_mah","attrs.c_rating","attrs.package",
    "attrs.grade","attrs.pull_force_kg","attrs.nema_size"
  ],
  "sortableAttributes": ["price","popularity","salesRank","createdAtTs",
                         "attrs.length_mm","attrs.thread_num","attrs.bore_id_mm"],
  "rankingRules": ["words","typo","proximity","attribute","exactness",
                   "inStock:desc","popularity:desc","boost:desc"],
  "typoTolerance": {
    "minWordSizeForTypos": { "oneTypo": 4, "twoTypos": 8 },
    "disableOnAttributes": ["sku","skuTokens"],
    "disableOnWords": ["m2","m3","m4","m5","m6","m8","ss304","ss316","608","6202",
                       "18650","21700","0805","0603","nema"]
  },
  "faceting": { "maxValuesPerFacet": 200 },
  "pagination": { "maxTotalHits": 5000 }
}
```

**`disableOnWords` is critical.** Without it, typo tolerance turns `M3` into `M4` and `608` into `609`, and the search confidently sells the wrong part. Every short, dense engineering token must be exact-match.

`inStock:desc` sits above popularity in the ranking rules: an out-of-stock bestseller is worth less to the buyer than an in-stock alternative.

### `categories` index
`{ id, path, name, fullPath, depth, productCount, iconKey, url }` — powers the "Categories" section of the overlay and the "your results span 4 categories" rail.

---

## 4. Synonyms

Seeded manually, then grown from the click log. Bidirectional unless noted.

| Group | Terms |
|---|---|
| Hex drive | allen, hex socket, inbus, hex key, hexagon socket |
| Countersunk | csk, countersunk, flat head, flush head |
| Pan head | pan, panhead, round head |
| Fastener | screw, bolt, fastener *(one-way: bolt → screw only in Fasteners)* |
| Stainless | ss, stainless, inox, a2, a4, ss304, ss316, 304, 316 |
| Nyloc | nyloc, nylock, nylon insert nut, self locking nut |
| Insert | heat set insert, threaded insert, brass insert, knurled insert |
| Jumper | dupont, jumper wire, breadboard wire, connecting wire |
| Bearing | bearing, brg, ball bearing |
| Seal codes | zz, 2z, shielded ⟷ rs, 2rs, sealed |
| Stepper | stepper, step motor, nema |
| LiPo | lipo, li-po, lithium polymer |
| Li-ion | li-ion, lithium ion, liion |
| Magnet | neodymium, ndfeb, neo, rare earth magnet |
| Extrusion | aluminium extrusion, aluminum extrusion, v-slot, t-slot, profile |
| Potentiometer | pot, potentiometer, variable resistor, trimpot |
| Multimeter | multimeter, dmm, avometer |
| Soldering | soldering iron, solder gun, soldering station |
| Prop | prop, propeller, blade |
| ESC | esc, speed controller, electronic speed controller |

Indian-market spelling variants are treated as first-class, not typos: `aluminium/aluminum`, `metre/meter`, `bearing/bering`, `screw/screw's`.

## 5. Facets

Facets are **generated from the category's attribute schema**, not hardcoded. Landing on `Bearings → Ball → Deep Groove` yields bore/OD/width/seal/material; landing on `Fasteners → Socket Head` yields thread/length/material/finish/grade.

| Attribute type | Widget | Behaviour |
|---|---|---|
| `enum` ≤ 8 values | Checkbox list | All shown |
| `enum` > 8 | Checkbox list + inline search | Top 6, "show N more" |
| `number` with unit | Dual-thumb slider **+ two mono text inputs** | Engineers type exact numbers; the slider alone is not enough |
| `boolean` | Toggle | |
| Thread size | Ordered chips (M1.6 → M24) | Sorted by numeric value, never alphabetically — `M10` must not sort between `M1` and `M2` |
| Price | Range + preset buckets | |
| Availability | Toggle, default on | "In stock only" defaults **on**, with a visible, one-click off |

Counts are live from Meilisearch's `facetDistribution`. Facets with a zero count are dimmed and disabled, not hidden — their presence tells the user what dimension exists.

Facet state lives in the URL: `?thread=M3&material=ss304&length=6-40`.

## 6. Instant search UX

| Behaviour | Spec |
|---|---|
| Trigger | Click, `/`, or `⌘K`/`Ctrl+K` |
| First query | On focus, prefetch trending + recent (0 network cost at keystroke 1) |
| Debounce | 120 ms; 0 ms when the query matches a SKU pattern |
| Min chars | 2 |
| Budget | p95 < 120 ms keystroke → paint |
| Sections | Parsed tokens · Products (6) · Categories (3) · Projects (2) |
| Keyboard | ↑↓ across all sections, ↵ open, ⇥ complete to the top suggestion, esc close |
| Recent | Last 5, stored locally, individually clearable |
| Prefetch | Next.js route prefetch on the highlighted result |
| Mobile | Full-screen sheet, keyboard-safe, `enterkeyhint="search"` |
| Empty state | Trending searches + the 13 categories |

### Zero-result recovery — a hard requirement

Never render "No results found." The cascade:

1. Drop the lowest-confidence token, retry, and say what was dropped.
2. Widen the tightest numeric constraint to the nearest available value: *"No M3×7. Nearest lengths: 6 mm (42), 8 mm (51)."*
3. Search the category tree — *"No products, but 'Torx' is a category with 88 items."*
4. Offer Make-on-Demand: *"We don't stock it. We can make it → [Start an RFQ]"* — this turns the worst moment in the funnel into a lead.
5. Always log to `search_queries` for the zero-result report.

Steps 2 and 4 are the differentiators. Step 4 is why the two businesses belong on one site.

## 7. Ranking and merchandising

Base order: text relevance → typo penalty → proximity → attribute weight → exactness → **in stock** → popularity → manual boost.

- `popularity` = normalised 30-day rolling blend of views (0.2), add-to-carts (0.3) and purchases (0.5), recomputed nightly.
- `boost` is a manual per-product lever in the admin for merchandising pushes.
- **Pinning:** a query→product map (`search_pins`) forces a result to position 1 for a specific query. Used sparingly, audited.
- **Category context:** searching from within a category applies a soft boost to that `categoryPath` rather than a hard filter, and the UI says "Searching in Bearings — [search everything instead]".

## 8. Operations

**Sync:** transactional outbox → BullMQ → indexer worker → batched Meilisearch update (2 s debounce, 1,000 docs max). Target lag < 30 s; alert at > 5 min.

**Reindex:** build into `products_v2`, verify document count within 0.5% and run a 40-query regression suite, then swap the alias atomically. Never mutate the live index.

**Fallback:** if Meilisearch is unreachable, the API falls back to a Postgres `pg_trgm` + attribute query. It is slower and dumber, and the UI says "Search is running in reduced mode" — but the site stays sellable. This fallback is exercised in staging monthly; an untested fallback is not a fallback.

**Monitoring:** p50/p95/p99 latency · zero-result rate (the single most important product-health metric) · click-through by position · index lag · queries with no click (a proxy for bad ranking).

**Search analytics → catalog backlog.** The zero-result report is ranked by monthly volume and reviewed weekly. Every entry is one of: a missing product (buy it), a missing synonym (add it), a parser gap (fix it), or genuine noise (ignore it). This loop is how the < 2% target is actually reached — not by tuning the engine, but by fixing the catalog it searches.

**Alternative engine:** Typesense is a drop-in-shaped substitute (similar facet and typo model, slightly better vector search, similar ops burden). The `packages/search` module hides the engine behind an interface so the swap is a day, not a quarter. Algolia is rejected on cost — our search-per-session ratio is deliberately high, which is exactly what Algolia's pricing punishes.

## 9. Test corpus

A fixed regression suite of 40 queries runs in CI against a seeded index. Every one must return the expected top result.

```
m3x10                    m3 x 10                  M3X10MM
608zz                    608 2rs                  6202rs
ss304 socket head        allen bolt m4            csk screw m3
nema17                   nema 17 stepper          17hs4401
18650                    18650 3000mah            lipo 4s 1500
0805 10k                 10k resistor smd         4.7uf 25v
2200kv motor             2205 2300kv              esc 30a
n52 15x3                 neodymium disc 15mm      magnet 10x2
mgn12                    mgn12h rail 300mm        lm8uu
2020 extrusion           v-slot 2020 1m           corner bracket 2020
FS-SHC-M3-010-SS304      fs shc m3                (SKU, partial SKU)
neodimium                bering 608               stepr motor      (typos)
```

Anything that regresses this suite does not ship.
