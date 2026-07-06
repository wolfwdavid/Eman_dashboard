---
phase: 04-hud-overlay-ui-fallback
plan: 04
subsystem: ui
tags: [svelte5, runes, integration, pointer-events, threlte-interactivity, webgl-fallback, build-gate]

# Dependency graph
requires:
  - phase: 04-02-detail-panel
    provides: DetailPanel.svelte (z-30 right rail, reads ui.selected)
  - phase: 04-03-pipeline-charts-filters-qr
    provides: PipelineDrawer.svelte (z-20 collapsible) + QrPanel.svelte (z-30 toggle) + FilterBar + 4 charts
  - phase: 04-01-foundation-deps-pure-state-scenedim
    provides: aggregates.ts (securedTotal/potentialTotal), format.ts, widened ui.filter
  - phase: 03-3d-crystarium-scene
    provides: CrystariumScene + interactivity() + select/deselect bridge
provides:
  - "+page.svelte composes scene + ambient HUD + Phase-4 overlay via the pointer-events/z-index layer model (no catch layer)"
  - "PipelineReadout figures computed from securedTotal/potentialTotal selectors (single source of truth)"
  - "Background-click deselect wired via onpointermissed on the geometry-less scene Group (canvas raycast intact)"
  - "Minimal WebGL-probe 2D fallback (FallbackList.svelte) — RESL-01, client-gated, never blocks the build"
  - "Green phase build gate: vitest 159/159, base-path build exit 0, verify-build 6/6"
affects: [04-05-interactive-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Overlay panels mounted as discrete position:fixed siblings — each owns its own z-index + pointer-events:auto; ambient HUD stays pointer-events:none; NO full-viewport catch layer (04-RESEARCH Pitfall 2)"
    - "Background-click deselect via @threlte/extras interactivity onpointermissed on a geometry-less <T.Group>: never in initialHits so it fires on every click; pointermissed runs BEFORE the click dispatch → empty click deselects, node click net-selects (deselect then select in the same event)"
    - "WebGL support probe defaults true (SSR-safe) and only flips false client-side in onMount → 2D FallbackList swaps in for <Canvas>; page keeps prerendering"

key-files:
  created:
    - src/lib/hud/FallbackList.svelte
  modified:
    - src/routes/+page.svelte
    - src/lib/crystarium/CrystariumScene.svelte

key-decisions:
  - "Attached onpointermissed to the EXISTING geometry-less top-level scene Group rather than to nodes or a DOM/3D catch layer — verified against Threlte 9.21.0 setupInteractivity source: pointermissed fires on interactive objects NOT in initialHits, before the click dispatch loop, so a geometry-less group (never raycast-hit) reliably closes the rail on empty clicks while node clicks net-select"
  - "Implemented the OPTIONAL WebGL fallback (RESL-01) because it slotted in cleanly (client-only probe + reuse of format helpers + the existing DetailPanel) with zero build-gate risk"
  - "Did NOT grep build/index.html for chart SVG / $296,500 (04-RESEARCH Pitfall 1): LayerChart marks are client-hydrated and the drawer is collapsed by default, so they are legitimately absent from the prerendered HTML — gated only on the prerenderable chrome verify-build checks"

requirements-completed: [DETL-01, PIPE-05, QRUI-01, QRUI-02]

# Metrics
duration: 8min
completed: 2026-07-06
---

# Phase 4 Plan 04: Integration Mount + Build Gate Summary

**Composed the independently-built Phase-4 panels (DetailPanel + PipelineDrawer + QrPanel) into `+page.svelte` over the fixed Crystarium canvas using the strict pointer-events/z-index layer model — no full-viewport catch layer, so the canvas raycast stays fully live — swapped the PipelineReadout to selector-computed figures, wired background-click deselect through Threlte's `onpointermissed`, shipped the optional WebGL-probe 2D fallback, and proved the phase's deploy invariants with a green base-path build + verify-build 6/6.**

## Performance
- **Duration:** ~8 min
- **Tasks:** 3 (1 mount, 1 optional fallback, 1 build-gate verification)
- **Files:** 1 created, 2 modified

## Accomplishments
- **Overlay mounted (Task 1):** `<DetailPanel />`, `<PipelineDrawer />`, `<QrPanel />` render as discrete top-level `position:fixed` siblings of the ambient HUD. Each panel owns its own z-index + `pointer-events:auto`; there is NO catch layer, so empty overlay space passes clicks straight through to the z-0 canvas raycast (hover/click/orbit on crystals all still work).
- **Selector-driven readout:** `PipelineReadout` now receives `secured={securedTotal(grants)}` / `potential={potentialTotal(grants)}` — computed from the tested aggregates rather than the old hardcoded `20000` / `296500` literals. Values are identical, now single-sourced.
- **Background-click deselect:** added `onpointermissed={() => deselect()}` to the existing geometry-less `<T.Group>` in `CrystariumScene.svelte`. Because that group has no geometry it is never in `initialHits`, and Threlte fires `pointermissed` before the click-dispatch loop — so an empty-space click closes the detail rail while a crystal click transiently deselects then re-selects in the same event (net select). Esc-to-close remains handled inside DetailPanel.
- **WebGL fallback (Task 2, optional):** `onMount` probes `webgl2`/`webgl`; on failure the page renders `FallbackList.svelte` (a scrollable 2D list of all grants — status pill · funder · human-readable amount · deadline chip · `Open ↗` link) in place of `<Canvas>`. Rows call `select(id)` into the SAME DetailPanel; the list reuses `formatAmount`/`formatDeadline` and the status-hue tokens — no new tokens, no new state. Probe is client-only, so the page keeps prerendering.
- **Build gate (Task 3):** full unit suite 159/159 green; `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` exits 0; `node tools/verify-build.mjs` reports 6/6 PASS; no `ssr = false` anywhere in `src/`; `<title>` still renders "Eman_dashboard". `pnpm check` (svelte-check) is 0 errors / 0 warnings across 1762 files.

## Task Commits
1. **Task 1: Mount overlay (layer model) + selector readout + background-click deselect** — `bf9001d` (feat)
2. **Task 2: Minimal WebGL-probe 2D fallback (RESL-01, optional)** — `96accce` (feat)
3. **Task 3: Phase build gate** — verification-only, no code delta (gate green; documented above).

## Files Created/Modified
- `src/routes/+page.svelte` (modified) — mounts the three Phase-4 panels; feeds PipelineReadout from `securedTotal`/`potentialTotal`; adds the client-only WebGL probe gating `<Canvas>` vs. `<FallbackList>`; keeps `<title>` + the `browser && mounted` SSR guard.
- `src/lib/crystarium/CrystariumScene.svelte` (modified) — imports `deselect`; adds `onpointermissed` to the top-level `<T.Group>` for background-click deselect (no DOM catch layer).
- `src/lib/hud/FallbackList.svelte` (created) — 2D grant list fallback; rows `select(id)` into DetailPanel; reuses format helpers + status tokens.

## Decisions Made
- **`onpointermissed` on the geometry-less scene Group** (not on nodes, not on a DOM/3D catch layer). Verified against `node_modules/@threlte/extras/dist/interactivity/setupInteractivity.svelte.js`: `pointermissed` fires on every interactive object NOT in `initialHits`, and fires *before* the click dispatch loop. A group with no geometry is never raycast-hit → always "missed" → always calls `deselect()`; a crystal click then re-`select()`s in the same synchronous event (net select, no visible flash). This is the plan's sanctioned "scene-level pointer-miss handler in the existing Canvas subtree" with zero raycast cost.
- **Shipped the optional fallback** — it fit cleanly (client-only probe + reuse of DetailPanel and the tested format helpers) with no build-gate risk, so RESL-01 is satisfied a build early rather than deferred.
- **Avoided the chart-SVG-grep trap** — did not assert chart values against `build/index.html`. LayerChart marks are client-hydrated and PipelineDrawer/QrPanel are collapsed by default, so those SVGs are legitimately absent from prerendered HTML; the gate relies only on the prerenderable chrome that verify-build already checks.

## Deviations from Plan
None requiring auto-fix rules. One in-scope note: the plan's `files_modified` frontmatter listed only `+page.svelte` and `FallbackList.svelte`, but the plan's Task-1 *action* explicitly authorizes a "scene-level pointer-miss handler in the existing Canvas subtree" for background-click deselect — so the one-line `onpointermissed` addition to `CrystariumScene.svelte` is within the plan's stated scope, not a deviation.

## Known Stubs
None from this plan. (Pre-existing, documented-as-intentional stubs carried from Wave 2 are unchanged: the QR `support` tile URL is the `REPLACE-ME` config placeholder — config data, swapped in `sites.js`, not a code stub; Chart C urgent-ring / Chart D beam-tick remain deferred cosmetic embellishments per 04-03.)

## Issues Encountered
None. All gates passed on the first full run: svelte-check 0/0, vitest 159/159, build exit 0, verify-build 6/6.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- The full overlay is mounted and the phase build gate is green — Plan 04-05 (interactive UAT) can now drive the composed page: select a crystal → DetailPanel slides in; click empty space / Esc / × → deselect; filter chips dim non-matching nodes; drawer + QR toggles; optional fallback path.

## Self-Check: PASSED
- FOUND: src/routes/+page.svelte (mounts DetailPanel/PipelineDrawer/QrPanel, securedTotal)
- FOUND: src/lib/hud/FallbackList.svelte
- FOUND: src/lib/crystarium/CrystariumScene.svelte (onpointermissed → deselect)
- FOUND commits: bf9001d, 96accce
- verify-build: 6/6 PASS · vitest: 159/159 · build: exit 0 · svelte-check: 0/0

---
*Phase: 04-hud-overlay-ui-fallback*
*Completed: 2026-07-06*
