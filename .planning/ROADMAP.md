# Roadmap: Eman_dashboard

## Overview

The journey builds a premium 3D grant command-center in the exact dependency order the research prescribes: **deploy-first, data-as-contract**. Phase 1 ships a real walking-skeleton to GitHub Pages to kill the two invisibly-failing risks (base-path 404s and prerender/SSR split) before any 3D code exists. Phase 2 builds the custom Node toolchain that turns 28 messy CSV rows into a validated, typed dataset — the foundation gate every UI feature binds to. Phase 3 renders the FFXIII Crystarium sphere grid in 3D against that data. Phase 4 layers the 2D HUD (detail, pipeline overview, filters, QR panel, fallback) that consumes both the data and the scene's selection events. Phase 5 lands the premium game-UI feel: activation animations, glassmorphism HUD, and a mobile-safe performance pass. Every phase re-deploys, so base-path and prerender regressions are caught continuously.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Deploy Skeleton + Toolchain** - A styled SvelteKit page live on the real GitHub Pages URL, proving base-path/prerender/deploy end-to-end
- [ ] **Phase 2: Data Pipeline + Custom Tools** - Custom build tools turn the 28-row CSV into validated typed data (and QR assets); bad data fails the build
- [ ] **Phase 3: 3D Crystarium Scene** - The FFXIII Crystarium sphere grid renders all 28 funders as data-encoded crystal nodes
- [ ] **Phase 4: HUD / Overlay UI + Fallback** - Click-to-detail, pipeline overview, filters, QR panel, and a WebGL-less 2D fallback
- [ ] **Phase 5: Premium Polish / Animation / Perf** - Activation animations, glassmorphism RPG HUD, and a mobile-safe performance pass

## Phase Details

### Phase 1: Deploy Skeleton + Toolchain
**Goal**: A styled SvelteKit page is live on the real `github.io/Eman_dashboard/` URL, proving the base-path, prerender/SSR split, `.nojekyll`, and Actions deploy pipeline end-to-end before any 3D code exists.
**Depends on**: Nothing (first phase)
**Requirements**: DPLY-01, DPLY-02, DPLY-03
**Success Criteria** (what must be TRUE):
  1. Visiting `https://<user>.github.io/Eman_dashboard/` loads a fully styled page (not a blank/unstyled shell) — `.nojekyll` present and the base path resolving on the live URL.
  2. Every asset and link resolves through the base path — including one imperatively-loaded texture — with zero 404s in the deployed site's network tab (the #1 killer, caught on real Pages not localhost).
  3. Pushing to `main` triggers a GitHub Actions workflow that builds with `adapter-static` (ssr=true + prerender=true) and publishes to Pages automatically.
  4. An unknown/deep-link route falls back via `404.html` (SPA fallback) instead of a hard Pages 404.
**Plans**: 3 plans (waves 1 → 2 → 3)

Plans:
- [x] 01-01-PLAN.md — Scaffold SvelteKit 5 + Tailwind v4 (pnpm/Node 22), adapter-static + base-path-from-env config, and the Nyquist verification harness (`tools/verify-build.mjs`, `playwright.config.ts`, `tests/smoke.spec.ts`) [wave 1]
- [x] 01-02-PLAN.md — Styled dark landing shell (Orbitron title / DID grant command center), `+layout.ts` (prerender+ssr, WHY documented), self-hosted fonts, `.nojekyll`; turn the harness green on a `BASE_PATH` build [wave 2]
- [x] 01-03-PLAN.md — GitHub Actions `deploy.yml`, set Pages source, push to main, and confirm the live `github.io/Eman_dashboard/` URL serves the styled shell with zero 404s [wave 3, checkpoint]

### Phase 2: Data Pipeline + Custom Tools
**Goal**: Purpose-built Node tools turn the 28-row messy `grants.csv` into a validated, typed JSON dataset the app compiles against — and generate the QR assets — with a zod build gate that fails the build on bad data. This is the foundation contract every UI feature binds to.
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. Running the build ingests `grants.csv` and emits `grants.generated.json` + typed `Grant` interface with every amount/deadline/status/501c3 field normalized to a typed struct (never a bare number or raw string).
  2. Introducing a malformed row (bad enum, dead URL, unparseable date, duplicate id) fails the build with a clear row-level error; reverting it makes the build pass.
  3. Secured funding computes to exactly $20,000 and "potential" ($296,500) excludes declined, not-eligible, and 37 Angels equity rows — verified by unit tests against all 28 literal amount/deadline strings.
  4. The QR-generation tool produces scannable codes for the two URLs from a single `config/sites.js` module at build time, and swapping a URL + rebuilding regenerates them with zero code change.
**Plans**: 4 plans (waves 1 → 2 → 3)

Plans:
- [x] 02-01-deps-schema-amount-deadline-PLAN.md — deps (papaparse/zod4/qrcode) + `vitest.config.ts` + canonical `types.ts` + `schema.mjs` (zod) + `amount`/`deadline` normalizers with vitest tests over all 18/20 literal strings + bad-CSV fixture [wave 1] (DATA-02, DATA-03)
- [ ] 02-02-status-ingest-aggregates-PLAN.md — `status`/`501c3`/`slug` normalizers + `ingest-grants.mjs` (CSV → `grants.generated.json` + `index.ts` barrel) + `aggregates.mjs` selectors (secured=$20k, potential=$296.5k) [wave 2] (DATA-01, DATA-04)
- [ ] 02-03-qr-generator-PLAN.md — `config/sites.js` (two swappable absolute URLs, never base-prefixed) + `generate-qr.mjs` emitting inline-SVG `qr.generated.js` + tests [wave 2] (DATA-06)
- [ ] 02-04-build-gate-wiring-PLAN.md — `validate.test.mjs` (schema unit rejections + bad-CSV spawn → exit 1) + explicit `package.json` build chain (`build:data && build:qr && vite build`, no pnpm prebuild) proving bad data fails the build [wave 3] (DATA-05)

### Phase 3: 3D Crystarium Scene
**Goal**: The FFXIII Crystarium sphere grid renders in 3D as the navigable primary surface — all 28 funders as crystal nodes whose ring, scale, and glow make status, amount, and deadline urgency legible from shape before a single click.
**Depends on**: Phase 2
**Requirements**: CRYS-01, CRYS-02, CRYS-03, CRYS-04, CRYS-05, CRYS-06, CRYS-07, CRYS-08
**Success Criteria** (what must be TRUE):
  1. The Crystarium grid renders all 28 nodes in 3D on the deployed site, and `pnpm build` still prerenders cleanly — WebGL never runs during prerender (no "window is not defined"); the Canvas is browser-gated, `ssr` stays true.
  2. A node's ring/color reads its status, its scale reads its funding amount, and its glow/pulse reads deadline urgency — passed/rolling/declined nodes deliberately do NOT glow urgent.
  3. Connecting paths render the progression spine, funder-family bridges, and the NY Community Trust fiscal-sponsor beam to the 501(c)(3)-gated funders.
  4. The camera orbits the grid in overview and eases to focus on a node when selected; hover and selection states are visually distinct, enhanced by bloom postprocessing.
**Plans**: TBD (~3-4 plans)

Plans:
- [ ] 03-01: Pure `layout.js` (status-sectored radial dome, deterministic, no Three import) + browser-gated Threlte `<Canvas>` rendering all 28 `CrystalNode`s
- [ ] 03-02: Status/amount/deadline visual encodings on `CrystalNode` (ring, log-scaled size, urgency glow) + 501c3 halo
- [ ] 03-03: `CrystalPath` edges (spine, families, fiscal-sponsor beam), `CameraRig` orbit + focus-on-node, bloom/SelectiveBloom postprocessing + hover/select states

### Phase 4: HUD / Overlay UI + Fallback
**Goal**: The 2D dashboard layered over the canvas lets the user drill into any grant and read the entire pipeline at a glance — driven by scene selection through one shared runes state module — plus a 2D fallback so WebGL-less clients never see a black screen.
**Depends on**: Phase 2, Phase 3
**Requirements**: DETL-01, DETL-02, DETL-03, PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, QRUI-01, QRUI-02
**Success Criteria** (what must be TRUE):
  1. Clicking a node opens a detail panel showing all of that funder's fields, with normalized Amount/Deadline shown human-readable alongside the raw value, the Next Action as a loud primary CTA, and the Link opening the funder site in a new tab.
  2. The pipeline overview shows totals by status, funding secured vs. potential, an upcoming-deadline timeline ordered by urgency, and the 501(c)(3)-gated-vs-open split.
  3. Filtering/segmenting by status, by 501(c)(3) requirement, and by type dims/highlights the grid nodes and recomputes the HUD totals live (partition logic stays in the transform, not the view).
  4. A QR panel displays scannable QR codes for the two configured website URLs.
  5. On a WebGL-less client the same generated JSON renders as a 2D fallback list instead of a black screen.
**Plans**: TBD (~3 plans)

Plans:
- [ ] 04-01: `crystarium.svelte.js` runes state bridge + `DetailPanel` (all fields, raw+normalized, Next Action CTA, external Link) + click→select→camera-focus wiring
- [ ] 04-02: `PipelineOverview` (status totals, secured-vs-potential, deadline timeline, 501c3 split) + `Legend`/filters recomputing totals live
- [ ] 04-03: `QrPanel` (two config URLs) + non-WebGL 2D fallback list reading the same JSON

### Phase 5: Premium Polish / Animation / Perf
**Goal**: The dashboard gains its premium RPG game-UI feel — activation/intro animations, a dark glassmorphism HUD, tuned glow, and a performance pass that keeps it smooth on mid-range mobile.
**Depends on**: Phase 4
**Requirements**: AEST-01, AEST-02
**Success Criteria** (what must be TRUE):
  1. An intro/activation animation plays on load (and on status-advance) via GSAP, giving the grid a Crystarium-unlock game-UI feel.
  2. The overlay reads as a dark premium glassmorphism HUD/legend — an RPG-styled interface, not a plain dashboard.
  3. The scene holds a smooth frame rate on a mid-range phone (pixel ratio capped ≤2, selective/half-res bloom, render-on-demand) with no black-screen or GPU meltdown, and the Crystarium layout constants are visually tuned.
**Plans**: TBD (~2-3 plans)

Plans:
- [ ] 05-01: GSAP intro/activation animation (AEST-01) + glassmorphism RPG HUD/legend styling (AEST-02) + layout-constant visual tuning (R0/TIER_STEP/DOME_CURVE/SPREAD)
- [ ] 05-02: Deadline-urgency pulse tuning, glow/bloom tuning, render-on-demand, mobile GPU perf pass + reduced-effects fallback path

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Deploy Skeleton + Toolchain | 0/3 | Not started | - |
| 2. Data Pipeline + Custom Tools | 0/4 | Not started | - |
| 3. 3D Crystarium Scene | 0/3 | Not started | - |
| 4. HUD / Overlay UI + Fallback | 0/3 | Not started | - |
| 5. Premium Polish / Animation / Perf | 0/2 | Not started | - |
