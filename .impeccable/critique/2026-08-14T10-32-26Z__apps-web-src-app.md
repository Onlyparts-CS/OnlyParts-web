---
target: every page — storefront, admin console, cms
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-14T10-32-26Z
slug: apps-web-src-app
---
⚠️ DEGRADED: single-context (sub-agents disabled by standing session instruction; no browser — Postgres is not installed, so no route renders)

Scope: all 39 routes — 24 storefront, 14 admin console, 1 Payload CMS mount.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Visual pending states are good ("Placing order…", "Added 3 to cart"); 2 live regions in 102 components, so none of it is announced |
| 2 | Match System / Real World | 4 | Domain language is precise and non-marketing — "Made to order · 7 days", "Declared for", "Not declared" |
| 3 | User Control and Freedom | 3 | Cart, wishlist, facets all reversible; import has dry-run + revert. Checkout is one page with no step-back |
| 4 | Consistency and Standards | 3 | One token system, one `Field`, one `Frame`. Two visual worlds at the `/cms` boundary — deliberate and documented |
| 5 | Error Prevention | 4 | Import re-runs `dryRun` server-side rather than trusting the browser's diff; >50%-update guard rail; server-side pricing; `PLACEABLE_METHODS` |
| 6 | Recognition Rather Than Recall | 2 | 34 of 36 `<label>` elements have no `htmlFor` — every form field in the product is programmatically anonymous |
| 7 | Flexibility and Efficiency | 3 | Bulk import, `BulkBar`, work queues, multi-line cart add. No keyboard shortcuts anywhere |
| 8 | Aesthetic and Minimalist Design | 4 | Detector clean across 102 components; zero-radius discipline and a three-step spacing scale held without exception |
| 9 | Error Recovery | 4 | Failed import rows download as the original sheet plus an `_error` column; checkout errors render above the button, not below |
| 10 | Help and Documentation | 3 | FAQ, guides, policies, contact, bulk-orders all exist. No contextual help inside the console |
| **Total** | | **32/40** | **Good** |

## Design Specificity Verdict

**LLM assessment — authored, not category-interchangeable.** The steel-cabinet world is carried by structure rather than decoration: no radii, three spacing steps, one accent used as fill/rule/text at three weights. Nothing here would drop unchanged into another storefront. The strongest evidence is the copy layer — "Made to order · 7 days" instead of "Ships soon", "Not declared" instead of a fabricated origin, "Works with this part" instead of "Frequently bought together". That restraint is a design position, not an omission.

**Deterministic scan.** `detect.mjs` over `src/app` + `src/components` (102 components, 39 routes): **0 findings**, exit 0. Falsified against a planted purple-gradient component, which fired `ai-color-palette` — the scanner is live, the codebase is genuinely clean.

**Flow integrity.** Every literal internal `href` in the codebase resolves to a real route (39 routes, 26 static, 13 dynamic) — no dead links. No orphan routes: every static route has at least one inbound link.

**Visual overlays.** None. No database, so no route renders and no screenshot exists.

## Overall Impression

The engineering discipline is well ahead of the accessibility layer, and the gap is not subtle. Server-side re-validation of the import diff, `PLACEABLE_METHODS` declining a withdrawn payment method at a public endpoint, prices computed server-side — this is a codebase that assumes the client is hostile. It then ships a checkout where a screen reader announces "edit text, blank" seven times.

Single biggest opportunity: the form primitives. `Field` in checkout, `AuthShell`, `NewProductForm`, `BuildEditor`, `rfq` — they all repeat the same three omissions, so three additions to a handful of shared components fix 34 sites.

## What's Working

1. **The import error path.** Failed rows come back as the original sheet plus an `_error` column. The operator fixes them in the tool they already have and re-uploads. Most import screens hand back a modal of red text.
2. **Honesty as a design constraint, held under pressure.** `worksWith` renders "— not verified for this size" on rows it cannot prove, and origin renders "Not declared" rather than defaulting to India. Both were the harder choice.
3. **The focus ring.** A global `:focus-visible` with a 2px offset ring on `:where(a, button, input, textarea, select, [tabindex])` — correct token, correct shape, zero specificity so components can still override.

## Priority Issues

**[P1] Form labels are decorative, not programmatic**
34 of 36 `<label>` elements have no `htmlFor`, and the inputs have no `id`. Only `BuyBox`'s quantity and `WorksWith`'s checkboxes are associated.
*Why it matters:* a screen reader announces every checkout field as unlabelled. That is the money path, and it fails for Sam before the first keystroke. It also breaks click-to-focus on the label for everyone.
*Fix:* add `id`/`htmlFor` to the shared `Field` (checkout), `AuthShell`, `NewProductForm`, `BuildEditor`, `rfq`, `Reviews`, `MediaManager`, `VariantMatrix`, `GapRow`, `BulkBar`, `FacetRail`, `PlpControls`. Derive the id from the label where a stable one is absent.
*Suggested command:* `/impeccable harden`

**[P1] Nothing asynchronous is announced**
`aria-live` appears zero times; `role="status"` once (`BomActions`), `role="alert"` once (checkout). "Added 3 to cart", quantity changes, wishlist toggles, and the import commit result are all silent to assistive tech.
*Why it matters:* the visual feedback exists and is well-judged — it just has no non-visual channel. `WorksWith`'s button swapping to "Added 3 to cart" is exactly the case where a live region costs one attribute.
*Fix:* one `role="status" aria-live="polite"` region per surface that mutates state; announce the same string the button already shows.
*Suggested command:* `/impeccable harden`

**[P2] Validation errors are visually adjacent but not programmatically linked**
`aria-invalid` appears zero times. Checkout renders `{error && <p className="text-danger">}` next to the field with no `aria-describedby` and no `id`.
*Why it matters:* the error is read as loose body text far from the field it belongs to, if at all. Compounds P1.
*Fix:* `aria-invalid={!!error}` + `aria-describedby` pointing at an id'd error paragraph. Same components as P1, same pass.
*Suggested command:* `/impeccable harden`

**[P2] `outline-none` on inputs discards the global focus ring**
25 components set `outline-none`. In `Field` the replacement is `focus-within:border-spot-600` on the wrapper — a 1px colour change where the rest of the app uses a 2px ring.
*Why it matters:* keyboard users get a weaker focus cue on exactly the surface where it matters most, and it is inconsistent with every button and link on the same page.
*Fix:* move the ring to the wrapper with `focus-within:` and the same box-shadow token, or drop `outline-none` and let the global rule apply.
*Suggested command:* `/impeccable polish`

**[P3] Withdrawn-COD copy still reads present-tense**
`admin/orders/page.tsx:52` — "cash on delivery ships before it is paid"; `account/AccountClient.tsx:163` — same framing. Both explain why payment and fulfilment are separate columns, using a mode the storefront no longer offers.
*Why it matters:* an operator reading the console reasonably concludes COD is still live. The `Orders` collection already labels it "Cash on delivery (withdrawn)".
*Fix:* past-tense the two prose blocks. The separation of the two status columns is still correct and still worth explaining.
*Suggested command:* `/impeccable clarify`

## Persona Red Flags

**Sam (Accessibility-Dependent)** — fails at the first field. Seven unlabelled inputs in checkout, no `aria-invalid` when validation fires, no announcement when the order is placed, and a weaker focus ring inside form fields than on the buttons beside them. The one thing that works is the global focus ring on links and buttons, which is genuinely well built. Sam cannot complete a purchase unaided.

**Alex (Power User)** — served well on the console: bulk import with a dry run, `BulkBar` multi-select, work queues, and a cart that takes a whole kit in one commit. Zero keyboard shortcuts anywhere, though, and no `Esc` handling found. Alex will use the import CSV and ignore the UI.

**Riley (Stress Tester)** — the recently-fixed silent-drop bugs are exactly Riley's territory: the importer showed a diff containing `compatibility`, reported success, and wrote nothing. Both drops now have assertions. Remaining exposure: 20 of 39 routes have no visible empty/loading affordance, so a category with no stock or a build with no items likely renders a bare heading.

## Minor Observations

- `/cms` is Payload's own panel under its own stylesheet, by an explicit decision in `(payload)/layout.tsx`. Out of scope for this project's visual world; its accessibility is upstream's.
- `:where(...)` on the focus rule means any component-level `focus:` utility silently wins. That is the intended escape hatch, but it is also how the 25 `outline-none` sites got away with it.
- `alt=` appears in only 6 files, but images route through `<Frame>`, which takes `alt` — not a real gap.

## Questions to Consider

- The console has no contextual help, yet the domain rules it enforces (HSN, GST rate, Rule 6(1) fields) are the ones a new operator is most likely to get wrong. What would a one-line inline hint per field cost, against a mis-declared consignment?
- 20 routes have no empty state. Which of them can actually be empty in production, and what should each say instead of nothing?
- The product is fastidious about not overstating what it knows. Should that extend to the console — should `/admin/pim` show an operator how much of the catalogue has no typed attributes at all, rather than only listing gaps in the rows it can see?
