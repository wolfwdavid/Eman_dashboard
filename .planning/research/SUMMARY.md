# Project Research Summary

**Project:** Eman_dashboard — premium 3D grant/funding "command center"
**Domain:** Build-time-baked static 3D dashboard SPA (SvelteKit + Threlte Crystarium, GitHub Pages)
**Researched:** 2026-07-04
**Confidence:** HIGH

## Executive Summary

This is a **build-time-baked static SPA-with-prerender**: 28 messy CSV rows of grant/funder data are transformed into a typed JSON module by purpose-built Node tools at build time, and a SvelteKit app renders them as an FFXIII-Crystarium sphere grid — a glowing 3D constellation where each funder is a crystal node whose ring (status), size (amount), and pulse (deadline urgency) make the whole pipeline legible before a single click. There is no server, no database, and no runtime fetch. Experts build this class of app by baking data into the bundle, prerendering the 2D dashboard chrome to real HTML, and deferring only the WebGL canvas to the client. The stack is prescriptive and version-locked: SvelteKit 2.69 + Svelte 5 (runes) + Threlte 8 for the 3D layer, postprocessing 6.39 for bloom, GSAP for timelines, a Node tools/ pipeline (papaparse tokenizing + hand-rolled normalizers + zod build gate) for ingest, LayerChart for conventional charts, Tailwind v4 for layout, and adapter-static for GitHub Pages.

The recommended approach is **dependency-ordered and deploy-first**: (1) ship a walking-skeleton deploy to Pages before any real work, (2) build the data pipeline + custom tools that produce the typed dataset, (3) build the 3D Crystarium scene against that data, (4) layer the HUD/overlay UI, then (5) polish. The ingest/normalizer tool is the **foundation gate** — no node can be sized, colored, or pulsed until Amount/Deadline/Status are normalized, and every UI feature (grid, detail view, filters, HUD totals, charts, 2D fallback) binds to its output. The 3D scene precedes the HUD because selection/hover events originate in the scene and the HUD consumes them via a single shared runes state module (crystarium.svelte.js).

The two load-bearing failure points are **(A) SSR-safe WebGL** — Three.js must never execute during the prerender pass (window is not defined fails the build), solved by keeping ssr=true + prerender=true and gating only the Canvas behind the browser flag / onMount (Threlte inits WebGL in onMount, so it is SSR-safe by design); never fix it with ssr=false, which discards the prerendered chrome — and **(B) GitHub Pages base-path** — the site serves from /Eman_dashboard/, so every asset, link, and especially every imperatively-loaded Three.js texture must route through base or 404 to a blank screen. Both fail invisibly (green on localhost, broken on deploy), which is exactly why the roadmap must deploy a real skeleton in Phase 1 so these regressions surface immediately, not atop a huge 3D codebase. Secondary risks cluster in CSV parsing: the free-text Amount/Deadline columns silently corrupt the headline funding totals unless parsed into typed structs with a zod build gate and unit-tested against all 28 literal strings.

## Key Findings

### Recommended Stack

The stack is fully version-verified against the npm registry on the research date (HIGH confidence) and is tightly coupled around Svelte 5 runes + Threlte 8. The single tightest constraint is postprocessing@6.39.2 requiring three >=0.168 <0.186 — **pin three@0.185.1**; do not bump past 0.185 without checking a newer postprocessing release. Vite 8 requires Node 20.19+/22.12+ (pin Node 22 LTS via .nvmrc). Use **pnpm exclusively** — sibling projects were bitten by npm-vs-pnpm lockfile/hoisting mismatches. See STACK.md for the full install manifest.

**Core technologies:**
- **SvelteKit 2.69.1 + adapter-static 3.0.10**: static SSG for GitHub Pages — first-class prerender, auto-writes .nojekyll, emits pure HTML/JS/CSS.
- **Svelte 5.56.4 (runes)**: current idiom (state/derived/props/effect runes); Threlte 8 targets it exclusively.
- **@threlte/core 8.5.16 + @threlte/extras 9.21.0 + three 0.185.1**: declarative Three.js — wraps the scene graph as Svelte components and inits WebGL inside onMount, making it **SSR/prerender-safe by design**. Recommended over raw Three.js.
- **postprocessing 6.39.2**: bloom/SelectiveBloom for the glowing-crystal look — the tightest peer constraint (three <0.186).
- **GSAP 3.15.0**: node unlock/activation timelines + camera moves; preferred over Theatre.js (a keyframe editor, overkill for procedural data-driven motion).
- **papaparse 5.5.4 + zod + custom normalizers**: papaparse tokenizes quoted/comma-in-field rows; hand-rolled logic owns semantics; zod fails the build on bad data. Emit grants.generated.json + .d.ts from a standalone Node script.
- **qrcode 1.5.4 (build-time SVG)**, **LayerChart 2.0.1** (SVG, SSR-safe charts), **Tailwind v4** (CSS-first theme block, no config file), **@fontsource-variable/** self-hosted fonts (Orbitron + Inter).

**What NOT to use:** ssr=false globally, Chart.js (canvas, fights glassmorphism), hotlinked Google Fonts, Theatre.js, three@>=0.186, runtime canvas QR, npm, hand-rolled comma-split CSV parsing.

### Expected Features

Every feature is grounded in the actual 28-row data/grants.csv (HIGH confidence). The dataset emotional core: **$20,000 secured (1 funder, NY Community Trust)** vs. **~$300K-$400K+ latent potential** across ~11 quantifiable funders — a small-secured, large-latent shape the dashboard should dramatize. Eight distinct statuses (17 To-research dominate the outer frontier; 1 Active at the gold center), a real 501(c)(3) gate axis (org is 501c3-*pending*, so the 12 pursuable-today No funders is high-value), and messy Amount/Deadline strings the parser must normalize.

**Must have (table stakes):**
- **CSV ingest + normalizer tool** — foundational; every other feature depends on parsed Amount/Deadline/Status.
- **Crystarium grid, data-bound** (ring=status, scale=amount, hue=status, glow=deadline) — the product itself.
- **Select to detail view** — all 9 CSV fields shaped, Next Action as the loud primary CTA, external Link out.
- **Camera orbit + focus-on-node**, **HUD (secured vs potential + status legend)**, **filters (status + 501c3 gate)**.
- **QR panel** (2 config-driven URLs) + QR-gen build tool.
- **Non-WebGL 2D fallback list** reading the same JSON — prevents black-screen failure (replaces full a11y, explicitly out of scope, served by sibling diversityincludesdisability_* projects).

**Should have (differentiators — the reason the project exists):**
- **Status to activation level, amount to scale, deadline to glow/pulse** encodings; **unlock/activation + intro animation**; **connecting paths + fiscal-sponsor beam** (NY Community Trust to the 5 gated funders it could unlock — turns a data footnote into a visual strategy story).
- **Analytics charts panel** (5 concrete charts with real numbers), **sound cues** (mute-by-default), **particle/bloom atmosphere**, **RPG-styled glassmorphic HUD**.

**Defer (v2+):** particle atmosphere/advanced bloom (after perf proven), top-down analyst camera, per-node activation replay cinematic, deep-link URLs to a node.

**Anti-features (deliberately NOT built):** in-app CRUD editing, auth/login, backend/database, real-time collab, full WCAG retrofit, light-mode/theme variants, node drag/rearrange, runtime CSV upload, treating 37 Angels equity as grant money.

### Architecture Approach

Three subsystems bridged by one state module: (1) a **build-time tools/ pipeline** owning CSV to JSON, validation-as-build-gate, and QR generation; (2) a **3D scene subsystem** (Threlte) owning the Crystarium grid, camera, and bloom; (3) a **2D HUD subsystem** (plain Svelte 5) layered over the canvas owning detail/overview/QR/legend panels. The single hard boundary is the **SSR/WebGL seam** — HUD + data prerender; the Canvas is browser-only. layout.js is a pure function returning plain x,y,z coords (no Three.js import) so it is unit-testable and outside the WebGL boundary. Data is imported (not fetched) so it is inlined, typed, and tree-shaken. Deploy via GitHub Actions (not the gh-pages package) so the validator runs in CI and bad data blocks deploy automatically.

**Major components:**
1. **tools/ (ingest + normalize + validate + qr)** — Node ESM, build-time only, outside src/; zod schema.mjs is the single source of truth, emitting both the validator and grants.d.ts.
2. **crystarium/ (layout.js + CrystariumScene + CrystalNode + CrystalPath + CameraRig + postprocessing)** — Threlte scene; layout.js is pure/Three-free.
3. **state/crystarium.svelte.js** — the only shared mutable state (runes: selected/hovered/filter/cameraFocus); the bridge across the SSR/WebGL seam (preferred over context because the Canvas is conditionally mounted).
4. **hud/ panels** (DetailPanel, PipelineOverview, QrPanel, Legend/filters) — plain Svelte 5, prerendered.

**Chosen layout algorithm (MEDIUM confidence, needs visual iteration):** status-sectored radial branches wrapped onto a shallow dome — hub core = DID/NY Community Trust, ring order follows pipeline flow, node size = log-scaled amount, deterministic (no RNG) so the constellation is stable across builds. Preferred over a Fibonacci sphere because sectoring preserves pipeline-as-shape.

### Critical Pitfalls

1. **WebGL runs during prerender** (window is not defined fails the CI build) — gate the Canvas behind the browser flag / onMount; isolate all Three imports to a client-only Scene; keep ssr=true (never ssr=false as the fix). Green on vite dev, dies on pnpm build.
2. **GitHub Pages base-path hell (the #1 killer)** — every asset/link/texture must route through base from the paths module; /Eman_dashboard (leading slash, no trailing, exact case). Most-missed case: Three.js loader URLs (textures/env maps) bypass base-rewriting — prepend base or Vite-import the asset. Grep the build output for root-absolute /assets or href to root.
3. **Missing .nojekyll** — Jekyll drops _app/ to a blank styled shell. Empty .nojekyll in /static, confirm it lands in build/.
4. **CSV Amount/Deadline parsing silently corrupts totals** — free-text columns (dollar-with-received, tilde-range, passed-dates, rolling-monthly, TBD, equity/fellowship). Build typed parseAmount/parseDeadline structs (never bare numbers or new Date on the whole string); route received to secured, TBD to null (not $0), passed/rolling to neutral glow; unit-test against all 28 literal strings.
5. **Totals partition errors** — do not double-count received into potential, do not sum 37 Angels equity into grant money, do not count declined/ineligible as potential. Secured must equal exactly $20,000. Partition by rule in the transform, not the view.
6. **Scope trap: over-investing in Crystarium fidelity before deploy skeleton + pipeline exist** — enforce deploy-first sequencing so base-path/prerender bugs surface early, not atop a huge 3D codebase.

Also load-bearing: SPA 404.html fallback + entries() enumerating 28 slugs for deep links (Pitfalls 5-6); Threlte v8/Svelte 5 runes vs. stale tutorials (useTask not useFrame; no export-let in runes mode); bloom/postprocessing tanks mobile GPUs (cap pixel ratio <=2, half-res/selective bloom, render-on-demand, code-split Three); QR targets are **absolute external URLs — never prefixed with base**; pnpm/Node-pin/Linux-CI-case-parity. See PITFALLS.md for the full 15 + the Looks-Done-But-Isnt checklist.

## Implications for Roadmap

Both ARCHITECTURE.md and PITFALLS.md independently converge on the same **deploy-first, data-as-contract** sequence. This is the strongest signal in the research — treat it as the spine of the roadmap.

### Phase 1: Deploy Skeleton + Toolchain
**Rationale:** The two highest-risk unknowns (base-path 404s, .nojekyll, prerender/SSR split, Linux-CI case parity) fail invisibly and only on the real Pages URL. Proving the pipeline end-to-end with a trivial page de-risks everything before real work exists. Both research files name this Phase 1.
**Delivers:** A blank styled SvelteKit page live on the github.io/Eman_dashboard/ URL — adapter-static, base-path-from-env, +layout.js (prerender=true + ssr=true), static/.nojekyll, 404.html fallback, GitHub Actions deploy.yml, pnpm + Node 22 pinned, and one imported asset **plus one imperatively-loaded texture** proven to load under the base path.
**Addresses:** Static build to GH Pages (FEATURES MVP).
**Avoids:** Pitfalls 2 (base-path), 4 (.nojekyll), 5 (SPA fallback), 15 (pnpm/CI parity).

### Phase 2: Data Pipeline + Custom Tools (THE FOUNDATION GATE)
**Rationale:** Every UI feature binds to normalized data — no node can be sized/colored/pulsed until Amount/Deadline/Status are parsed. This is the contract the entire app compiles against. The QR tool ships here too (shares tools/ + prebuild infra, fully parallel to grant data).
**Delivers:** schema.mjs (zod, single source of truth), ingest + amount/deadline/status normalizers, validator build gate, build-data.mjs emitting grants.generated.json + grants.d.ts, QR-gen tool + config/sites.js, prebuild wiring, and unit tests against all 28 literal strings. pnpm build produces validated typed data; bad CSV fails the build.
**Uses:** papaparse, zod, qrcode, vitest (STACK.md).
**Implements:** the tools/ subsystem + normalized Grant schema (ARCHITECTURE.md).
**Avoids:** Pitfalls 8 (amount parsing), 9 (deadline parsing), 10 (totals partition), 11 (CSV structural traps), 13 (QR URL config).

### Phase 3: 3D Crystarium Scene
**Rationale:** The 3D scene must exist before the HUD because selection/hover events originate in the scene and the HUD consumes them. Depends on Phase 2 typed data + schema.
**Delivers:** Threlte Canvas behind the browser guard, pure layout.js, CrystalNode/CrystalPath/CameraRig, status/amount/deadline visual encodings, orbit + focus-on-node camera, bloom postprocessing. The navigable sphere grid rendering all 28 nodes.
**Uses:** @threlte/core + extras, three 0.185.1, postprocessing, GSAP (STACK.md).
**Avoids:** Pitfalls 1 (WebGL prerender), 3 (heavy first paint — prerendered chrome + deferred canvas), 7 (Threlte v8/runes), 14 (bloom perf — cap pixel ratio, code-split).

### Phase 4: HUD / Overlay UI + Fallback
**Rationale:** Consumes both Phase 2 data (panels) and Phase 3 scene (selection state) via the shared runes module. The 2D fallback reads the same JSON.
**Delivers:** crystarium.svelte.js runes state, DetailPanel (Next Action CTA + Link), PipelineOverview (secured-vs-potential + status legend + timeline), filters (status + 501c3 gate) recomputing HUD totals, QrPanel, non-WebGL 2D fallback list, click-to-select-to-camera-focus wiring.
**Addresses:** detail view, HUD, filters, QR panel, fallback (FEATURES MVP).
**Avoids:** Pitfall 10 (totals in view layer — keep partition in transform), UX pitfalls (declined nodes not urgent).

### Phase 5: Polish / Animation / Perf
**Rationale:** Last by definition; depends on all prior. This is where the premium feel lands.
**Delivers:** unlock/activation + intro animation, connecting paths + fiscal-sponsor beam, deadline-urgency pulse tuning, sound cues (mute-by-default), analytics charts panel (LayerChart, 5 charts), glow/bloom tuning, layout-constant iteration, render-on-demand, mobile perf pass, responsive HUD.
**Uses:** GSAP, LayerChart, postprocessing tuning.
**Avoids:** Pitfall 14 (mobile GPU meltdown — the polish that must not tank perf).

### Phase Ordering Rationale

- **Deploy-first (Phase 1)** kills the highest-risk, invisibly-failing unknowns (base-path, .nojekyll, SSR split, CI case parity) before any 3D code exists — enforced by both the ARCHITECTURE.md build order and the PITFALLS.md scope trap (Pitfall 12).
- **Data-as-contract (Phase 2)** must precede all UI because the ingest tool is the foundation gate everything binds to (FEATURES dependency graph). Its parsers are the highest-leverage tests in the project.
- **Scene before HUD (Phase 3 to 4)** because selection/hover state flows from the Canvas to the panels through one shared runes module.
- **Polish last (Phase 5)** because animation/bloom/charts are enhancements over a correct-but-simple grid, and bloom perf must be tuned against proven mobile behavior.
- Every phase re-deploys, so base-path/prerender regressions are caught continuously.

### Research Flags

Phases likely needing deeper research (research-phase) during planning:
- **Phase 3 (3D Crystarium):** the Crystarium layout algorithm is an **original design (MEDIUM confidence)**, not a cited pattern — tunable constants (R0, TIER_STEP, DOME_CURVE, SPREAD) and the status-sector-vs-dome mapping need visual iteration. Also confirm exact Threlte v8 minor APIs (useTask, postprocessing wiring via the useThrelte hook) at implementation time.
- **Phase 5 (Polish/Perf):** bloom/SelectiveBloom tuning + render-on-demand + mobile GPU capability paths are performance-empirical and need on-device testing, not just doc research.

Phases with standard/well-documented patterns (skip research-phase):
- **Phase 1 (Deploy Skeleton):** exhaustively documented in STACK.md + PITFALLS.md + official SvelteKit adapter-static docs — the exact svelte.config.js, +layout.js, and workflow are already specified.
- **Phase 2 (Data Pipeline):** parsing rules for all 28 rows are enumerated in the ARCHITECTURE.md schema + PITFALLS.md 8-11; the transform is custom but the patterns are fully specified.
- **Phase 4 (HUD):** plain Svelte 5 + runes state module; conventional.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm registry 2026-07-04; core patterns verified against official SvelteKit + Threlte docs; peer-dependency constraints (three <0.186) confirmed. |
| Features | HIGH | Every feature grounded in the actual 28-row grants.csv; distributions tabulated. Crystarium visual mappings are a design proposal (MEDIUM on exact choices). |
| Architecture | HIGH | Stack + deploy verified against current docs + SvelteKit issue #14471; the Crystarium layout algorithm is original design (MEDIUM). |
| Pitfalls | HIGH | Base-path, adapter-static, Svelte 5/Threlte v8, and CSV traps verified against official docs + the real CSV; a11y deliberately out of scope. |

**Overall confidence:** HIGH

### Gaps to Address

- **Crystarium visual/layout design (MEDIUM):** the status-sector-dome mapping and tunable constants are original, not cited — plan explicit visual iteration in Phase 5; the deterministic algorithm is sound but the aesthetic needs eyes-on tuning.
- **Two QR URLs not finalized:** ship absolute placeholder https URLs in config/sites.js; the config-driven design means swapping in real URLs + rebuild requires zero code change. Validate at build that each starts with http (never prefix base).
- **Sensitive-field exposure:** confirm every displayed field (especially private Next Action strategy notes) is intended to be public on a public Pages site before shipping; never commit the upstream Notion source or any plaintext creds — only the sanitized grants.csv is public-safe.
- **Mobile GPU headroom:** bloom cost scales with screen pixels, not node count — must be validated on a real mid-range phone during Phase 5, with a reduced-effects fallback path.

## Sources

### Primary (HIGH confidence)
- npm registry latest tag (verified 2026-07-04) — all pinned versions + peerDependency ranges (STACK.md).
- SvelteKit official docs — adapter-static / single-page-apps / page-options: ssr=true required for real prerender, fallback/404.html, paths.base for project sites. https://svelte.dev/docs/kit/adapter-static
- SvelteKit issues #14471 (ssr=true needed or empty shell), #4528, #10358 (base-path 404 on subfolder deploy).
- Threlte 8 (Svelte 5 runes, useTask) — https://threlte.xyz/blog/threlte-8/ ; Threlte core npm/peer metadata (WebGL init is onMount-scoped, SSR-safe).
- Three.js releases (~r185) — https://github.com/mrdoob/three.js/releases
- data/grants.csv (28 rows) — primary dataset; all amount/deadline/501c3/status strings quoted directly.
- .planning/PROJECT.md — scope, constraints, out-of-scope, key decisions.

### Secondary (MEDIUM confidence)
- Okupter / Khromov — SvelteKit to GitHub Pages base-path + adapter-static guides.
- FFXIII Crystarium mechanics — game-design knowledge; the metaphor to CSV-field mapping is a design proposal, not a spec.

### Tertiary (LOW confidence)
- Crystarium sphere-grid layout algorithm — original design decision; needs visual iteration during polish.

---
*Research completed: 2026-07-04*
*Ready for roadmap: yes*
