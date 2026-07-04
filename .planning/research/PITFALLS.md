# Pitfalls Research

**Domain:** Premium 3D grant/funding command-center dashboard — SvelteKit (adapter-static) + Threlte/Three.js Crystarium, build-time CSV ingest, GitHub Pages
**Researched:** 2026-07-04
**Confidence:** HIGH (base-path, adapter-static, Svelte 5/Threlte v8, and CSV traps verified against official SvelteKit docs + the actual `grants.csv`)

> Scope note: accessibility is deliberately out of scope for this build, so a11y pitfalls are intentionally omitted. Every pitfall below is specific to THIS stack and THIS dataset.

---

## Critical Pitfalls

### Pitfall 1: WebGL / Three.js runs during prerender (`window`/`document` is not defined)

**What goes wrong:**
`adapter-static` prerenders every route in Node at build time. Three.js touches `window`, `document`, `WebGLRenderingContext`, `navigator`, and `requestAnimationFrame` at module-eval or component-init time. During prerender none of those exist, so the build throws `ReferenceError: window is not defined` (or `document is not defined`) and the whole GitHub Pages build fails — often only after you've wired up the Crystarium, so it looks like the 3D code "broke the site."

**Why it happens:**
Threlte's `<Canvas>` and any `<T.*>` children are browser-only, but SvelteKit still evaluates the component module and runs top-level/`$effect`-free init on the server unless explicitly told not to. Importing Three.js at the top of a `+page.svelte` (or a shared module that a `+page`/`+layout` imports) pulls it into the server bundle. Tutorials written for Svelte 4 / Threlte v6-7 often show a bare `<Canvas>` with no guard because they were demoing `adapter-auto` on Vercel where SSR-at-request masks the problem.

**How to avoid:**
- Gate the Canvas behind a browser check. Two idiomatic options:
  1. `import { browser } from '$app/environment';` then `{#if browser}<Scene />{/if}` around the `<Canvas>`.
  2. Mount the Threlte tree only inside `onMount`/`$effect` (client-only lifecycle), or wrap the heavy scene in a `{#await import('./Scene.svelte')}` dynamic import so Three.js never enters the server graph.
- Keep `ssr = true` on the route (needed so the shell/DOM prerenders — see Pitfall 3) but ensure the WebGL subtree is client-only. Do NOT reach for `export const ssr = false` as the fix; that turns the page into an empty SPA shell and defeats prerendering.
- Never `import * as THREE from 'three'` at the top level of a module that a `+layout`/`+page` imports for non-3D reasons. Isolate all Three/Threlte imports inside the client-only `Scene.svelte`.

**Warning signs:**
`window is not defined` / `document is not defined` during `vite build` or `svelte-kit build`; build passes locally with `vite dev` (dev never prerenders) but fails in CI; a green dev server that dies the moment you run `pnpm build`.

**Phase to address:** 3D shell / Crystarium foundation phase (the first phase that introduces Threlte). Bake the client-only Canvas guard into the very first 3D commit.

---

### Pitfall 2: GitHub Pages base-path hell (the #1 killer for this stack)

**What goes wrong:**
The site deploys to `https://<user>.github.io/Eman_dashboard/`, not to domain root. Anything that assumes root — `/assets/x.png`, hardcoded `href="/grant/5"`, a texture loaded from `/textures/crystal.png`, fonts, the favicon — resolves to `https://<user>.github.io/x.png` and returns 404. The page often renders a blank dark screen (CSS/JS 404) or a Crystarium with no textures. It works perfectly on `localhost:5173` (served from root) and only breaks once deployed, which makes it maddening to debug.

**Why it happens:**
SvelteKit only rewrites `base` for links/assets it controls when you route them through `$app/paths`. Hand-written absolute paths, `fetch('/data.json')`, `new TextureLoader().load('/tex.png')`, and CSS `url(/...)` bypass that rewriting entirely. On top of that, `paths.base` MUST have a leading slash and NO trailing slash (`/Eman_dashboard`), and it must exactly match the repo name (case-sensitive).

**How to avoid (exhaustive checklist):**
- Set base conditionally in `svelte.config.js`:
  ```js
  paths: { base: process.env.NODE_ENV === 'production' ? '/Eman_dashboard' : '' }
  ```
  (Or drive it off a `BASE_PATH` env var in the Actions workflow so dev stays at root.)
- In markup, prefix EVERY internal link and asset with `base`:
  ```svelte
  import { base } from '$app/paths';
  <a href="{base}/grant/{id}">…</a>
  <img src="{base}/logo.png" />
  ```
- For anything loaded imperatively by Three.js (textures, GLTF, HDR/env maps, fonts for `TextGeometry`), prepend `base` to the URL too: `loader.load(`${base}/textures/crystal.png`)`. This is the most-missed case — asset helpers don't reach into your loader calls. Better: `import texture from '$lib/assets/crystal.png'` so Vite fingerprints and base-resolves it at build.
- Prefer importing static assets through Vite (`import url from '...'`) over putting them in `/static` with hardcoded paths — Vite handles base + hashing automatically.
- Add an empty **`.nojekyll`** file to `/static` (see Pitfall 4).
- Generate the SPA **`404.html`** fallback (see Pitfall 5).
- Never use bare root-absolute URLs in CSS `url()` — use relative or Vite-imported assets.
- After build, grep the `build/` output for `"/assets` / `href="/` / `src="/` that are NOT `/Eman_dashboard/...` — any hit is a future 404.

**Warning signs:**
Blank/black page on Pages but perfect on localhost; DevTools Network tab full of 404s all missing the `/Eman_dashboard/` segment; Crystalline geometry renders but is untextured/all-black; favicon missing; "MIME type text/html" errors for `.js`/`.css` (that's a 404 HTML page being served instead of the asset).

**Phase to address:** Deploy-skeleton phase (should be Phase 1, before heavy 3D — see Pitfall 12). Verify with a real Pages deploy of a trivial page + one imported asset + one imperatively-loaded texture BEFORE building the Crystarium.

---

### Pitfall 3: Prerendering a heavy 3D scene — broken/blank first paint

**What goes wrong:**
Either (a) the prerender tries to include the WebGL scene and fails/blanks, or (b) you disable SSR to dodge that, and now GitHub Pages serves an empty `<div>` that only fills in after a large JS download — users see a black screen for seconds, and if JS fails they see nothing. For a "command center" the first paint should show the dashboard chrome (totals, deadlines, panels) instantly, with the Crystalline canvas hydrating in.

**Why it happens:**
People treat the whole page as one unit: "it's a 3D app, so `ssr=false`." But the dashboard shell (stat cards, pipeline totals, deadline list, QR panel) is plain DOM that SHOULD prerender to static HTML. Only the `<Canvas>` subtree needs to be client-deferred.

**How to avoid:**
- Keep `prerender = true` and `ssr = true` on routes. Let the shell prerender to real HTML.
- Render the dashboard chrome server-side (stat cards, totals, deadline timeline, detail text) from the build-time JSON — this is static and cheap.
- Client-only-mount the Canvas (Pitfall 1) with a lightweight placeholder (a CSS gradient / low-res poster / skeleton ring) shown until `onMount` fires and the scene is ready. Fade the real Crystalline in.
- Lazy-load the Three-heavy chunk via dynamic `import()` so the shell's HTML/CSS paints before the ~150-600 KB of Three lands.
- Provide a static, HTML-based fallback navigation (a list of grants) so the app is usable even if WebGL is unavailable (older mobile GPU, blocked context).

**Warning signs:**
Long black screen before anything appears; Lighthouse "Largest Contentful Paint" dominated by JS; the page is blank with JS disabled; `view-source` on the deployed page shows an empty body (means SSR/prerender produced nothing useful).

**Phase to address:** 3D shell phase — establish the "prerendered chrome + deferred canvas" split as the architectural baseline before adding node logic.

---

### Pitfall 4: Missing `.nojekyll` — files/folders starting with `_` silently dropped

**What goes wrong:**
GitHub Pages runs Jekyll by default, which **ignores any file or directory beginning with an underscore**. SvelteKit emits its app into `_app/` (immutable JS/CSS chunks). Without `.nojekyll`, Pages serves the HTML but 404s the entire `_app/` directory — the site loads a blank shell with zero styling or interactivity, and the Crystarium never appears.

**Why it happens:**
Jekyll is on by default for Pages; the `_app` convention collides with Jekyll's underscore rule. Nothing in the SvelteKit build warns you.

**How to avoid:**
- Place an empty `.nojekyll` file in `/static` (it copies to build root). Confirm it lands in `build/.nojekyll`.
- If deploying via `actions/deploy-pages` + `upload-pages-artifact`, the underscore issue is bypassed by the artifact path, but keeping `.nojekyll` is belt-and-suspenders and required if you ever switch to the classic `gh-pages` branch deploy.

**Warning signs:**
Everything 404s under `/_app/`; page has content but no CSS/JS; works from a local `preview` server (no Jekyll) but not on Pages.

**Phase to address:** Deploy-skeleton phase (Phase 1).

---

### Pitfall 5: No SPA fallback (`404.html`) — deep links and refresh return GitHub's 404

**What goes wrong:**
Prerendered routes work, but if the grant-detail route is dynamic/param-based and NOT fully enumerated, refreshing `/Eman_dashboard/grant/ford-justfilms` or sharing that link returns GitHub's generic 404 page. Also, any client-side-only route breaks on direct hit.

**Why it happens:**
GitHub Pages is pure static hosting with no server rewrite. It only serves files that physically exist. SvelteKit's client router handles in-app navigation, but a cold load of a non-file URL needs a fallback.

**How to avoid:**
- Prefer fully prerendering every grant detail page: with only 28 rows, enumerate all node IDs so each `/grant/<id>` is a real `index.html`. This is the cleanest fix and gives static, shareable, indexable pages.
- If any route stays dynamic, set adapter `fallback: '404.html'` so GitHub serves it for unknown paths and the SPA router recovers.
- Decide `trailingSlash` deliberately (see Pitfall 6) — it changes whether routes emit `foo.html` or `foo/index.html`, which affects whether Pages finds them.

**Warning signs:**
In-app clicks work but F5/refresh or a pasted deep link shows GitHub's 404; only the homepage is reachable on cold load.

**Phase to address:** Deploy-skeleton phase (fallback config) + grant-detail phase (enumerate IDs for full prerender).

---

### Pitfall 6: `trailingSlash` / route-enumeration mismatch

**What goes wrong:**
With default `trailingSlash: 'never'`, a route emits `about.html`; some hosts and base-path combos expect `about/index.html`. Mismatch → 404 on some routes, or double-slash URLs (`//Eman_dashboard/`). Prerender may also skip routes it can't discover by crawling links.

**Why it happens:**
adapter-static discovers pages by crawling `<a>` links from entry points. Nodes reachable only via 3D click (no real `<a href>`) are never crawled, so their detail pages don't prerender.

**How to avoid:**
- Add `export const prerender = true` at the root and, for dynamic detail routes, provide an `entries()` function returning all 28 slugs so they prerender regardless of crawlability.
- Ensure every grant detail is reachable by a real `<a href="{base}/grant/{slug}">` somewhere (even a visually-hidden index or the fallback grant list) so the crawler finds it AND WebGL-less users can navigate.
- Set `trailingSlash` explicitly and consistently; test both `/grant/x` and `/grant/x/` on the deployed site.

**Warning signs:**
Build logs show fewer prerendered pages than expected (should be ~28 + shell); some detail URLs 404 on Pages; `$page.url.pathname` shows `//`.

**Phase to address:** Grant-detail phase, verified in deploy phase.

---

### Pitfall 7: Threlte v8 / Svelte 5 runes breaking changes vs older tutorials

**What goes wrong:**
You follow a 2023-era Threlte tutorial and nothing compiles or reacts: `export let` props, `$: reactive` blocks, old `useFrame`, or `<T.Mesh>` prop patterns behave differently. Threlte v8 targets Svelte 5 (runes: `$state`, `$derived`, `$props`, `$effect`); Svelte 4 store/reactivity idioms are deprecated or gone. Mixing a Svelte-4 tutorial component into a Svelte-5 runes project produces confusing reactivity failures (node scale/glow not updating when status changes).

**Why it happens:**
Most published Threlte content predates v8/Svelte 5. Package majors moved fast; APIs like `useFrame` → `useTask`, and prop reactivity now flows through runes.

**How to avoid:**
- Pin and confirm versions up front: Svelte 5.x, `@threlte/core` v8.x, `@threlte/extras` matching major, `three` current. Read the Threlte v8 migration/docs, not blog posts.
- Use runes consistently: `let { status } = $props()`, `const scale = $derived(...)`, `$effect(() => ...)` for imperative Three updates. Don't mix `export let` with runes in the same component (Svelte 5 forbids it).
- Use `useTask` (Threlte v8) for the render/animation loop, not the old `useFrame`.
- When copying a tutorial snippet, mentally port it to runes before pasting.

**Warning signs:**
"Cannot use `export let` in runes mode" compile errors; nodes render once but never update on data change; `useFrame is not exported`; reactive glow/scale frozen.

**Phase to address:** 3D shell phase — lock the toolchain versions and a runes-first component pattern in the first 3D task.

---

### Pitfall 8: CSV Amount parsing silently corrupts funding totals

**What goes wrong:**
The `Amount` column is free-text, not numbers. Naive `parseFloat` / regex-first-number extraction produces wrong totals and a misleading "funding secured vs. potential" headline — the entire value proposition of the dashboard. Real strings in `grants.csv` that break naive parsing:
- `"$20,000 (received 2025)"` — this is **secured/received**, not pipeline. Must set a `received` flag and route to "secured," not "potential."
- `"$5,000-$20,000 (avg $10,000)"` — a **range with an explicit avg**. Need `min=5000, max=20000, avg=10000`. `parseFloat` yields `5` (comma + `$` break it).
- `"Up to $30,000 (avg $20,000)"` / `"Up to $10,000"` — max-only ranges; `min` unknown.
- `"~$50,000-$200,000"`, `"$100,000+"`, `"Large"` — approx, open-ended, and qualitative. `"$100,000+"` has no upper bound; `"Large"` has no number at all.
- `"Micro (amount TBD)"`, `"$500 (micro)"`, `"$1,000"`, `"$2,000-$6,000"` — micro flags plus real numbers.
- `"TBD"`, `"TBD (includes AI access)"`, `"Fellowship support"`, `"Equity investment"` — **no dollar amount**; must be excluded from numeric totals, not coerced to 0 and counted as a $0 funder.
- Commas inside the number (`$20,000`) AND commas as CSV field context — must strip `,` only within a matched currency token, and the CSV parser must respect quoted fields.

**Why it happens:**
Developers assume "Amount" is numeric and write `Number(cell.replace('$',''))`. Thousands-separators, ranges, parentheticals, `~`, `+`, `TBD`, and "received" qualifiers all defeat that. Coercing failures to `0` silently understates or overstates totals with no error.

**How to avoid:**
- Build a dedicated `parseAmount(raw)` returning a typed struct: `{ min, max, avg, isRange, isTBD, isMicro, isReceived, isEquity, isQualitative, raw }`. Never return a bare number.
- Strip `$` and `,` only inside a matched `\$?[\d,]+` token; parse each side of a `-` range separately.
- Treat `TBD`, `Fellowship support`, `Equity investment`, `Large` as `amount = null` (unknown) — exclude from sums, surface as "amount unknown" count.
- Detect `received` / `avg` / `up to` / `~` / `+` / `micro` via explicit substring rules and set flags; keep `raw` for display.
- Unit-test the parser against ALL 28 literal strings and assert expected structs — this is the highest-leverage test in the project.

**Warning signs:**
"Total secured" shows `$5` or an absurd number; funders with `TBD` show as `$0`; the received NY Community Trust $20k appears in "potential" instead of "secured"; totals change if you reorder rows.

**Phase to address:** Data-ingest phase (Phase 1/2, before any UI binds to totals). This must be locked and tested before the dashboard displays a single number.

---

### Pitfall 9: CSV Deadline parsing mis-computes urgency (node glow) and shows dead deadlines as urgent

**What goes wrong:**
`Deadline` is free-text mixing ISO dates, cadences, and states. Node glow/urgency and the "upcoming deadlines" timeline depend on it. Real strings:
- `"2026-06-30 (decision by Oct 31)"` — real deadline + a note; naive `new Date(cell)` returns `Invalid Date` because of the trailing parenthetical.
- `"2025-12-30 (passed)"` and `"2027-02-18 (2026 cycle passed)"` — **past/expired**; must NOT glow as urgent. `"Hey Helen"` is `Declined` with a passed date.
- `"Rolling (monthly)"`, `"Rolling"`, `"Rolling (monthly review)"`, `"Ongoing (recheck 2026-03-01)"` — no fixed date; cadence = rolling, with an embedded recheck date to extract.
- `"Invitation only"`, `"Annual"`, `"Annual relationship"`, `"Open calls"`, `"Cycle open (2026)"`, `"Check 2026 cycle (awards Dec-Feb)"`, `"Opens ~Oct 31-Nov 30; awards Dec"`, `"Opens ~Oct 2026"`, `"Reapply Jan 2026"`, `"TBD"`, `"--"` — cadences/states with no parseable single date, some with fuzzy month hints.

**Why it happens:**
`new Date("2026-06-30 (decision by Oct 31)")` is `Invalid Date`; developers then either crash or default to `now`, making everything look due today. Passed deadlines get treated as "0 days left = maximum urgency," lighting up declined/dead nodes.

**How to avoid:**
- `parseDeadline(raw)` → `{ date | null, cadence: 'fixed'|'rolling'|'annual'|'invitation'|'open'|'tbd'|'none', isPassed, note, raw }`.
- Extract a leading `YYYY-MM-DD` with a regex FIRST, then classify the remainder as note/cadence; don't feed the whole string to `Date`.
- Compute urgency only for `cadence==='fixed'` with a future `date`; `isPassed` and non-fixed cadences must map to a neutral/low glow, never "critical."
- Cross-check status: a `Declined`/`Not eligible` node should never glow urgent regardless of date.
- Extract embedded recheck/reopen dates (`"recheck 2026-03-01"`, `"Reapply Jan 2026"`) into the note or a secondary date for the timeline.

**Warning signs:**
Every node glows red (defaulting to today); `Invalid Date` in the timeline; the declined Hey Helen node or passed Ben & Jerry's cycle shows as most-urgent; rolling grants sort as "overdue."

**Phase to address:** Data-ingest phase, verified when node-glow logic binds in the 3D/status phase.

---

### Pitfall 10: Funding-total logic double-counts, mixes equity, and counts ineligible funders as "potential"

**What goes wrong:**
The headline "secured vs. potential" is easy to get wrong in ways that mislead the org's owner:
- **Double-counting received:** `NY Community Trust $20,000 (received 2025)` is the only secured money. If summed into BOTH "secured" and "potential pipeline," potential is inflated by $20k.
- **Equity contamination:** `37 Angels` is `"Equity investment"` / `"Investment (not grant)"`. Summing it into grant totals conflates dilutive investment with grant funding — categorically wrong. Must be excluded from grant totals and shown separately (or omitted).
- **Counting dead/ineligible funders in potential:** `Declined` (Hey Helen), `Not eligible` (Truist), `Not eligible (yet)` (TD Bank, Just Thrive) should NOT inflate "potential funding." "Potential" should mean live pipeline (In progress / To research / Applied / Recurring / Active-renewal).
- **Range summation ambiguity:** summing `max` of every range overstates; summing `min` understates. Pick one basis (recommend: use `avg` when present, else midpoint of range, else `min` for a conservative floor) and label it.
- **TBD funders as $0:** 15+ rows are `TBD`/unknown amount. Counting them as $0 makes "potential" look artificially low and the pipeline look thin. Show an "N funders, amount TBD" count instead.

**Why it happens:**
Totals are computed with a naive `sum(amounts)` over all rows without partitioning by status, received-flag, or funding type.

**How to avoid:**
- Partition explicitly: `secured` = rows with `isReceived`; `potential` = rows with live status AND a known amount AND `type==='Grant'`; `unknownAmount` = live rows with `null` amount (count only); `excluded` = declined/ineligible/equity.
- Exclude `37 Angels` (equity) and `Declined`/`Not eligible*` from grant sums by rule, not by hand.
- State the summation basis in the UI ("potential based on average/midpoint estimates").
- Unit-test totals against a hand-computed expected value from the 28 rows.

**Warning signs:**
"Secured" ≠ exactly $20,000; "potential" includes Truist/TD/Hey Helen; grand total jumps when 37 Angels is included; totals feel implausibly high/low.

**Phase to address:** Data-ingest + pipeline-overview phase. Encode the partition rules in the transform, not the view layer.

---

### Pitfall 11: CSV structural traps — quoted commas, `--` placeholders, empty trailing row, encoding

**What goes wrong:**
- Many fields contain commas **inside quotes** (`"$5,000-$20,000 (avg $10,000)"`, long Fit/Eligibility sentences, `"Send grant success report; explore..."`). A hand-rolled `line.split(',')` shreds these rows, shifting every column right and corrupting the whole dataset.
- `"--"` appears as a Next Action / Deadline placeholder (Hey Helen, Truist, TD Bank) — means "none," not a literal value.
- A trailing empty line / final newline can produce a phantom 28th/29th empty record that becomes a ghost node or NaN total.
- Semicolons inside fields (`"Opens ~Oct 31-Nov 30; awards Dec"`) can trip naive splitters if someone "fixes" delimiters.
- Windows CRLF + BOM: reading on Windows/pnpm can prepend a BOM (U+FEFF) to the first header cell, so the key becomes "Funder / Program" (a leading U+FEFF) instead of "Funder / Program", breaking column lookup by name.

**Why it happens:**
CSV looks simple, so people split on `,` and `\n` manually. Quoted fields, placeholders, trailing newlines, and BOM are exactly the cases that break naive parsing.

**How to avoid:**
- Use a real RFC-4180 CSV parser (e.g. `papaparse` or `csv-parse`) with `header: true`, `skipEmptyLines: true`. Even though "custom tooling" is requested, custom means the transform/normalization layer — not re-implementing CSV quoting.
- Strip BOM on read; normalize `--` and empty strings to `null` in the transform.
- Assert row count === 28 data rows after parse; fail the build if not (catches the ghost-row and shredded-row cases).
- Trim whitespace on every field.

**Warning signs:**
A grant's Status shows a fragment of its Amount (columns shifted); 29 nodes render; a blank node with no funder name; header key lookups return `undefined` for the first column.

**Phase to address:** Data-ingest phase (Phase 1/2). Row-count and column-integrity assertions in the build tool.

---

### Pitfall 12: Scope trap — over-investing in Crystarium fidelity before the pipeline + deploy skeleton work

**What goes wrong:**
The Crystarium is the fun part, so it eats the schedule. Weeks go into faithful FFXIII node geometry, unlock animations, and bloom while the data pipeline is still guessing at totals and the site has never actually deployed to Pages. Then base-path/prerender/`.nojekyll` issues (Pitfalls 1-6) surface at the end, on top of a huge 3D codebase, making them far harder to isolate.

**Why it happens:**
Visual work is rewarding and demoable; plumbing (CSV normalization, base path, prerender split) is invisible until it breaks. High "visual investment is the point" framing amplifies the temptation.

**How to avoid:**
- Sequence: **(1) deploy skeleton** (trivial SvelteKit page live on Pages with correct base, `.nojekyll`, 404 fallback, one imported asset AND one imperatively-loaded texture proven to load) → **(2) data pipeline** (parser + typed JSON + tested totals/urgency + assertions) → **(3) prerendered dashboard chrome** (stat cards, totals, deadline list, grant detail pages, QR) → **(4) Crystarium 3D** layered on top → **(5) polish/postprocessing**.
- Ship a walking skeleton to Pages in Phase 1. Every later phase re-deploys, so base-path/prerender regressions are caught immediately, not at the end.
- Timebox Crystalline fidelity; a correct-but-simple grid that reads status/amount/urgency beats a gorgeous grid over wrong data.

**Warning signs:**
No successful Pages deploy after multiple phases; totals still hardcoded/placeholder while node animations are polished; "we'll wire up the real data later."

**Phase to address:** Roadmap sequencing itself — enforce deploy-skeleton and data-pipeline phases BEFORE the 3D phase.

---

### Pitfall 13: QR codes baked with wrong/base-relative URLs

**What goes wrong:**
The two QR targets are external site URLs, but a developer generates them by concatenating with `base` (`${base}/...`) or app-relative paths, so the QR encodes `https://<user>.github.io/Eman_dashboard/...` or a bare path instead of the intended external destination. Scanning leads nowhere useful. Or the URLs are hardcoded in a component, violating the "swappable config" constraint and requiring a code change when the real URLs arrive.

**Why it happens:**
Base-path muscle memory (Pitfall 2) is correct for internal assets but WRONG for QR targets — those are absolute external URLs and must bypass `base` entirely. And placeholders get hardcoded "temporarily."

**How to avoid:**
- Store both QR targets in a single config (e.g. `src/lib/config/qr.ts` or a small JSON) as **absolute `https://` URLs**; never prefix with `base`.
- Generate QR at build time from config (deterministic, no runtime lib in the bundle) OR runtime from the same config — either is fine, but read from the ONE config source.
- Validate at build that each QR target is an absolute URL (starts with `http`), failing loudly on a relative value.
- Use placeholder absolute URLs now; swapping config later must need zero code changes (the constraint).

**Warning signs:**
Scanning a QR opens the dashboard itself or a 404; QR target contains `/Eman_dashboard/`; changing the URL requires editing a `.svelte` file.

**Phase to address:** QR-panel phase; config schema defined in data/config phase.

---

### Pitfall 14: Postprocessing/bloom and Three.js bundle weight tank mobile GPUs

**What goes wrong:**
28 nodes + edges is trivially few draw calls, so geometry is not the risk — **bloom/postprocessing is.** A full-screen `UnrealBloomPass`/`EffectComposer` at high resolution with multiple mip passes can drop mobile GPUs to single-digit FPS and heat the device, even with a tiny scene. Separately, Three.js + Threlte + postprocessing can add 300-700 KB to the bundle, hurting first load on mobile.

**Why it happens:**
"Only 28 nodes, performance is fine" ignores that bloom cost scales with screen pixels, not object count. Emissive glow everywhere + high pixel ratio compounds it.

**How to avoid:**
- Cap `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`; render bloom at half-res.
- Prefer cheap glow (emissive materials, additive sprites/halos, a soft radial texture) over full postprocessing where possible; if using bloom, use a single tuned selective-bloom pass, not a stack.
- Pause the render loop when the tab is hidden and when the camera/scene is idle (render-on-demand) — `useTask` can gate on a `needsRender` flag. Saves battery and heat.
- Code-split Three/postprocessing (dynamic import) so it doesn't block first paint (ties to Pitfall 3).
- Test on a real mid-range phone, not just desktop. Provide a reduced-effects path for low-power GPUs.
- Dispose geometries/materials/textures on unmount to avoid GPU memory leaks during SvelteKit client navigation.

**Warning signs:**
Fan spins / phone gets hot; FPS tanks on mobile while desktop is smooth; bundle analyzer shows Three as the dominant chunk; battery drains fast on the dashboard.

**Phase to address:** Crystarium 3D phase (render loop + glow strategy); polish phase (bloom tuning, render-on-demand).

---

### Pitfall 15: Windows / pnpm toolchain gotchas (seen in sibling projects)

**What goes wrong:**
- Using `npm`/`npx` instead of `pnpm` in a pnpm project creates a competing `package-lock.json` and phantom-dependency resolution differences (pnpm's strict `node_modules` hides undeclared deps that npm would flat-hoist) — the "works with npm, breaks with pnpm" class of bugs the sibling michelle_ngo projects hit.
- Node version drift: Vite 5/6 + SvelteKit want Node 18/20+; an older global Node causes cryptic build failures.
- Windows path/case issues: importing `'$lib/Node.svelte'` when the file is `node.svelte` works on Windows (case-insensitive FS) but 404s in Linux CI/Pages build (case-sensitive). Base path `/Eman_dashboard` casing must match the repo exactly.
- CRLF/LF churn on generated data files.
- Long-path / `three` deep-import issues are rare but possible on Windows.

**Why it happens:**
Mixed package managers, no pinned Node, and a case-insensitive dev FS masking case-sensitive prod behavior.

**How to avoid:**
- Commit `pnpm-lock.yaml`; add a `.nvmrc`/`engines` field pinning Node 20+; use `pnpm` exclusively (document it in README).
- Match import casing to filenames exactly; adopt a consistent lower-case filename convention and verify against a Linux CI build (the GitHub Actions Pages build IS Linux — it will catch case bugs).
- Set `.gitattributes` for consistent LF on `.ts`/`.json`/`.csv`.

**Warning signs:**
Local build passes but GitHub Actions build fails on `Cannot find module` with a case difference; `package-lock.json` appears next to `pnpm-lock.yaml`; different behavior between two machines.

**Phase to address:** Deploy-skeleton phase (Phase 1) — lock package manager, Node version, CI parity.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hand-rolled `split(',')` CSV parser | No dependency | Shreds every quoted-comma row (10+ rows here); silent corruption | Never — use a real CSV parser + custom normalization on top |
| `export const ssr = false` to dodge WebGL prerender errors | Build passes fast | Blank first paint, no prerendered chrome, dead SEO | Never as the fix; only if the WHOLE route is truly client-only (not the case here) |
| Hardcoding the two QR URLs in a component | Ships now | Violates swappable-config constraint; code change to update | Never — one config source from day one |
| Coercing unparseable amounts to `0` | Totals "just work" | Silently wrong headline numbers | Never — use `null` + unknown-count |
| Full-screen bloom at native pixel ratio | Looks gorgeous on dev desktop | Mobile GPU meltdown | Only behind a capability check + reduced path |
| Skipping the deploy skeleton, building 3D first | More fun early | Base-path/prerender bugs surface late atop huge codebase | Never — deploy skeleton is Phase 1 |
| Not enumerating detail-page `entries()` | Less config | Deep links 404, no prerendered detail pages | Only if using a fully client-side detail modal with 404 fallback |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Pages base path | Hardcoded `/asset` root URLs; base with trailing slash; case mismatch | `base` from `$app/paths` on every link/asset; `/Eman_dashboard` (leading slash, no trailing), exact case |
| GitHub Pages Jekyll | Missing `.nojekyll` → `_app/` 404s | Empty `.nojekyll` in `/static`, confirm in `build/` |
| Three.js asset loading | Loader URLs bypass `base` → texture 404 | Prepend `base` or (better) Vite-`import` assets so they're fingerprinted + base-resolved |
| adapter-static prerender | `ssr=false` blanks the shell | Keep `ssr=true`+`prerender=true`; client-only-mount just the Canvas |
| QR code targets | Prefixed with `base` / app-relative | Absolute external `https://` URLs from config, bypass `base`, validate `startsWith('http')` |
| SvelteKit client nav + Three | Not disposing GPU resources on unmount | Dispose geometry/material/texture in `onDestroy`/`$effect` cleanup |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full-screen bloom / EffectComposer | Mobile FPS single digits, device heat | Half-res bloom, cap pixel ratio ≤2, selective bloom or emissive-only | Any mid/low mobile GPU, immediately |
| Always-on render loop | Battery drain, fan on idle dashboard | Render-on-demand; pause on hidden tab / idle camera | Continuous, worse on mobile |
| Three.js in the initial bundle | Slow first paint, LCP dominated by JS | Dynamic-import the 3D chunk; prerender chrome first | Slow/mobile networks |
| Undisposed GPU resources on nav | Memory climbs, eventual context loss | Dispose on unmount | After several in-app navigations |
| Summing `max` of all ranges | Overstated "potential" | Choose avg/midpoint basis, label it | Immediately (wrong number on screen) |

## Security / Data-Integrity Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Committing raw Notion export with plaintext creds | Credential leak (flagged in PROJECT.md) | Only the sanitized `grants.csv` is public-safe; never commit the upstream Notion source or any creds |
| Trusting CSV row count implicitly | Ghost node / NaN totals from trailing empty row | Assert exactly 28 data rows at build; fail build otherwise |
| Displaying internal "Next Action" notes publicly | Leaks org's private strategy on a public Pages site | Confirm every displayed field is intended to be public before shipping; consider omitting/gating sensitive Next-Action text |
| No build-time validation of parsed data | Silent corruption reaches production | Schema-validate the transformed JSON (types, non-null keys, URL format) and fail the build on violation |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Every node glows "urgent" (bad deadline parse) | Urgency signal becomes noise; can't triage | Only fixed future deadlines glow; passed/rolling/declined stay neutral |
| Declined/ineligible funders look like live pipeline | Owner misreads real opportunity set | Distinct visual state for Declined/Not-eligible; exclude from "potential" totals |
| Long black screen before Crystarium loads | Feels broken | Prerender chrome + skeleton/poster, fade 3D in |
| No non-3D way to reach a grant | Unusable if WebGL fails/mobile | Provide an HTML grant list / fallback nav |
| Qualitative amounts ("Large", "TBD") shown as $0 | Pipeline looks empty/misleading | Show "amount TBD" badge + a TBD-count, exclude from sums |

## "Looks Done But Isn't" Checklist

- [ ] **Pages deploy:** Works on `localhost` but verify on the REAL `github.io/Eman_dashboard/` URL — base-path 404s only appear there.
- [ ] **Textures/GLTF:** Crystarium renders on localhost — verify textures/env maps load on deployed Pages (they use `base`, not root).
- [ ] **`.nojekyll`:** Present in `build/` — verify `_app/` assets 200 on Pages, not 404.
- [ ] **Deep links:** Refresh a `/grant/<slug>` URL on Pages — verify it isn't GitHub's 404 (fallback or full prerender).
- [ ] **Totals:** "Secured" equals exactly $20,000 (only NY Community Trust received); 37 Angels excluded; declined/ineligible excluded from potential.
- [ ] **Amount parser:** Tested against all 28 literal strings — verify TBD→null, received→secured, ranges→min/max/avg.
- [ ] **Deadline parser:** `"2025-12-30 (passed)"` and `"2027-02-18 (2026 cycle passed)"` render as NOT urgent.
- [ ] **QR codes:** Scan both on a phone — verify they open the external targets, not the dashboard/404.
- [ ] **Row count:** Exactly 28 nodes render (no ghost row from trailing newline).
- [ ] **Linux CI parity:** GitHub Actions (Linux) build passes — verify no case-sensitive import bug hidden by Windows.
- [ ] **Mobile GPU:** Loads and holds acceptable FPS on a real mid-range phone with bloom on.
- [ ] **No-JS/first paint:** `view-source` on deployed page shows real dashboard chrome HTML, not an empty body.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Base-path 404s discovered post-deploy | LOW-MEDIUM | Route all links/assets through `base`, Vite-import loader assets, redeploy; grep build output for root-absolute URLs |
| `window is not defined` build failure | LOW | Wrap Canvas in `{#if browser}` / dynamic import; isolate Three imports to client-only Scene |
| Wrong funding totals shipped | LOW-MEDIUM | Fix `parseAmount`/partition rules, add tests vs 28 rows, rebuild (data is build-time so no migration) |
| Missing `.nojekyll` | LOW | Add empty `.nojekyll` to `/static`, redeploy |
| Deep-link 404s | LOW-MEDIUM | Add `fallback: '404.html'` and/or `entries()` enumerating 28 slugs |
| Over-invested in 3D before pipeline works | HIGH | Painful reprioritization; avoid by enforcing Phase-1 deploy skeleton + Phase-2 data pipeline |
| Mobile bloom meltdown | MEDIUM | Cap pixel ratio, half-res/selective bloom, render-on-demand, add reduced path |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WebGL during prerender (Pitfall 1) | 3D shell phase | `pnpm build` passes with no `window/document` error |
| Base-path hell (Pitfall 2) | Phase 1 deploy skeleton | Real Pages URL loads all assets (Network tab: no root-absolute 404s) |
| Prerender heavy scene / first paint (Pitfall 3) | 3D shell phase | `view-source` shows chrome HTML; skeleton before canvas |
| Missing `.nojekyll` (Pitfall 4) | Phase 1 deploy skeleton | `_app/` assets return 200 on Pages |
| SPA fallback 404 (Pitfall 5) | Phase 1 + grant-detail phase | Refreshing a deep link works on Pages |
| trailingSlash/enumeration (Pitfall 6) | Grant-detail phase | ~28 detail pages prerendered; both slash forms tested |
| Threlte v8 / Svelte 5 runes (Pitfall 7) | 3D shell phase | Pinned versions; nodes react to data via runes |
| Amount parsing (Pitfall 8) | Data-ingest phase | Unit tests vs all 28 amount strings pass |
| Deadline parsing (Pitfall 9) | Data-ingest phase | Passed/rolling deadlines not urgent |
| Totals partition (Pitfall 10) | Data-ingest + overview phase | Secured=$20k; equity/declined excluded (tested) |
| CSV structural traps (Pitfall 11) | Data-ingest phase | Real CSV parser; row count===28 asserted |
| Scope trap (Pitfall 12) | Roadmap sequencing | Deploy skeleton + data pipeline precede 3D |
| QR URL config (Pitfall 13) | QR-panel phase | Scanned QRs hit external URLs; config-swappable |
| Bloom/bundle perf (Pitfall 14) | 3D + polish phase | Acceptable FPS on real mobile; Three code-split |
| pnpm/Windows/CI parity (Pitfall 15) | Phase 1 deploy skeleton | Linux CI build passes; pnpm-only; Node pinned |

## Sources

- SvelteKit official docs — Static site generation / adapter-static (base path, `.nojekyll`, `fallback`, `ssr`/`prerender`, GitHub Pages): https://svelte.dev/docs/kit/adapter-static — HIGH
- sveltejs/kit #4528 — `paths.base` + adapter-static 404 behavior: https://github.com/sveltejs/kit/issues/4528 — HIGH
- sveltejs/kit #10358 — assets 404 when deploying to a subfolder with base path: https://github.com/sveltejs/kit/issues/10358 — HIGH
- sveltejs/kit #14471 — `ssr=true` required for prerendering in adapter-static: https://github.com/sveltejs/kit/issues/14471 — HIGH
- Okupter — Deploy a SvelteKit website to GitHub Pages (base, `.nojekyll`, 404): https://www.okupter.com/blog/deploy-sveltekit-website-to-github-pages — MEDIUM
- Khromov — The missing guide to understanding adapter-static: https://khromov.se/the-missing-guide-to-understanding-adapter-static-in-sveltekit/ — MEDIUM
- Threlte v8 (Svelte 5 runes, `useTask` vs `useFrame`) — official Threlte docs — MEDIUM (version-pinned; confirm exact minors at implementation time)
- Primary dataset: `data/grants.csv` (28 rows) — all amount/deadline/501c3/status example strings quoted directly — HIGH
- Project constraints: `.planning/PROJECT.md` — HIGH

---
*Pitfalls research for: premium 3D grant/funding dashboard — SvelteKit + Threlte on GitHub Pages*
*Researched: 2026-07-04*
