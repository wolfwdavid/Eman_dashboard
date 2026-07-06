---
phase: 04-hud-overlay-ui-fallback
plan: 04
type: execute
wave: 3
depends_on: [02, 03]
files_modified:
  - src/routes/+page.svelte
  - src/lib/hud/FallbackList.svelte
autonomous: true
requirements: [DETL-01, PIPE-05, QRUI-01, QRUI-02]
must_haves:
  truths:
    - "The overlay (DetailPanel + PipelineDrawer + QrPanel) mounts over the fixed canvas via the pointer-events layer model"
    - "There is NO full-viewport catch layer — empty overlay space passes clicks through to the canvas raycast"
    - "Clicking the scene background deselects; the ambient Phase-3 HUD stays pointer-events:none"
    - "pnpm build (BASE_PATH) prerenders cleanly; verify-build 6/6; <title> keeps 'Eman_dashboard'; no ssr=false"
    - "PipelineReadout figures come from the aggregates selector (single source of truth)"
  artifacts:
    - path: "src/routes/+page.svelte"
      provides: "mount point composing scene + ambient HUD + Phase-4 overlay panels"
      contains: "DetailPanel"
  key_links:
    - from: "src/routes/+page.svelte"
      to: "src/lib/hud/DetailPanel.svelte"
      via: "mounts the detail rail (z-30) alongside PipelineDrawer + QrPanel"
      pattern: "DetailPanel|PipelineDrawer|QrPanel"
    - from: "src/routes/+page.svelte"
      to: "src/lib/data/aggregates.ts"
      via: "PipelineReadout secured/potential from selectors"
      pattern: "securedTotal|potentialTotal"
---

<objective>
Mount the Phase-4 overlay into `src/routes/+page.svelte` over the existing scene + ambient HUD using the strict pointer-events/z-index layer model (NO full-viewport catch layer), swap the hardcoded PipelineReadout props to the aggregates selector, OPTIONALLY add a minimal WebGL-probe 2D fallback, and gate the whole phase on a clean base-path build + verify-build.

Purpose: This is the wiring plan — it composes the independently-built panels and proves the deploy invariants (base path, prerender, SSR-safe WebGL, title) still hold. The build gate is the phase's hard completion signal.
Output: updated `+page.svelte`; optional `FallbackList.svelte`; green `pnpm build` + `verify-build`.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/04-hud-overlay-ui-fallback/04-CONTEXT.md
@.planning/phases/04-hud-overlay-ui-fallback/04-UI-SPEC.md
@.planning/phases/04-hud-overlay-ui-fallback/04-RESEARCH.md
@.planning/phases/04-hud-overlay-ui-fallback/04-VALIDATION.md

# Contracts (read — do NOT re-explore):
@src/routes/+page.svelte
@src/lib/hud/PipelineReadout.svelte
@tools/verify-build.mjs

<interfaces>
<!-- Current +page.svelte mounts: SceneTitle, PipelineReadout(secured={20000} potential={296500}), Legend,
     and the browser+mounted-gated dynamic Canvas import. KEEP the <title> "Eman_dashboard — DID Grant Crystarium". -->
<!-- Phase-4 components to mount (built in 04-02 / 04-03): -->
$lib/hud/DetailPanel.svelte      // z-30 right rail, reads ui.selected (self-contained)
$lib/hud/PipelineDrawer.svelte   // z-20 bottom-center, collapsed by default (hosts FilterBar + charts)
$lib/hud/QrPanel.svelte          // z-30 bottom-right toggle
import { securedTotal, potentialTotal } from '$lib/data/aggregates';
import { grants } from '$lib/data';
import { deselect } from '$lib/state/crystarium.svelte.js';

<!-- Layer model (04-UI-SPEC): canvas 0 (raycast) / ambient HUD 10 (pointer-events:none) /
     controls 20 / Detail+QR 30. Interactive panels set pointer-events:auto on THEMSELVES only. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Mount the overlay with the pointer-events layer model + selector-driven readout</name>
  <files>src/routes/+page.svelte</files>
  <read_first>src/routes/+page.svelte (current mount), 04-UI-SPEC.md §Layout & Layer (z-index) Model + §Interaction & State Contract, 04-RESEARCH §Pitfall 2</read_first>
  <action>
    Extend `src/routes/+page.svelte` — do NOT remove the existing SceneTitle / PipelineReadout / Legend / browser+mounted Canvas guard. KEEP the `<title>Eman_dashboard — DID Grant Crystarium</title>` (verify-build check #6 greps it).
    1. Import and mount the three Phase-4 panels as discrete `position: fixed` elements (each owns its own fixed positioning + z-index + pointer-events from its own component styles):
       ```svelte
       import DetailPanel from '$lib/hud/DetailPanel.svelte';
       import PipelineDrawer from '$lib/hud/PipelineDrawer.svelte';
       import QrPanel from '$lib/hud/QrPanel.svelte';
       ```
       Render `<DetailPanel />`, `<PipelineDrawer />`, `<QrPanel />` at the top level (siblings of the ambient HUD).
    2. CRITICAL — NO full-viewport catch layer. Do NOT wrap the overlay in a full-screen `<div>` with default pointer-events; that eats the canvas raycast (Pitfall 2). Each panel sets `pointer-events: auto` on itself; empty space passes clicks through. Ambient HUD stays `pointer-events: none` (already true in PipelineReadout/SceneTitle/Legend).
    3. Swap the hardcoded readout props to the selector (single-source-of-truth hygiene): `<PipelineReadout secured={securedTotal(grants)} potential={potentialTotal(grants)} />` (imports from `$lib/data/aggregates`). Values remain 20000 / 296500 — now computed.
    4. Background-click deselect (close affordance): the canvas raycast miss should call `deselect()`. If the Phase-3 Canvas/Scene already emits a background-miss, wire it; otherwise the simplest safe route is a scene-level pointer-miss handler in the existing Canvas subtree — do NOT add a DOM catch layer to achieve this. Esc-to-close is already handled inside DetailPanel.
    Keep `ssr` true, keep `prerender` behavior; never add `export const ssr = false`.
  </action>
  <verify>
    <automated>grep -q "DetailPanel" src/routes/+page.svelte && grep -q "PipelineDrawer" src/routes/+page.svelte && grep -q "QrPanel" src/routes/+page.svelte && grep -q "securedTotal" src/routes/+page.svelte && grep -q "Eman_dashboard" src/routes/+page.svelte && ! grep -q "ssr = false" src/routes/+page.svelte && pnpm check</automated>
  </verify>
  <done>+page.svelte mounts DetailPanel + PipelineDrawer + QrPanel as discrete fixed panels (no catch layer); PipelineReadout fed by securedTotal/potentialTotal selectors; title + SSR-safe guard intact; `pnpm check` passes.</done>
</task>

<task type="auto">
  <name>Task 2: OPTIONAL — minimal WebGL-probe 2D fallback (never blocks the build gate)</name>
  <files>src/lib/hud/FallbackList.svelte, src/routes/+page.svelte</files>
  <read_first>04-UI-SPEC.md §Fallback (Minimal Graceful Degradation), 04-RESEARCH §Code Examples (WebGL-probe fallback), 04-CONTEXT §Fallback (OPTIONAL)</read_first>
  <action>
    OPTIONAL / LOWER PRIORITY (RESL-01 is a v2 requirement — implement ONLY if the mount + build gate are done and time permits; it must NEVER block DETL/PIPE/QRUI or the build gate). If skipping, note it in the SUMMARY and move on.
    If implementing:
    1. In `+page.svelte` `onMount`, probe WebGL and gate the Canvas:
       ```svelte
       let webgl = $state(true);
       onMount(() => { mounted = true; const c = document.createElement('canvas'); webgl = !!(c.getContext('webgl2') || c.getContext('webgl')); });
       ```
       ```svelte
       {#if browser && mounted && webgl}
         {#await import('$lib/crystarium/CrystariumCanvas.svelte') then { default: Canvas }}<Canvas />{/await}
       {:else if browser && mounted}
         {#await import('$lib/hud/FallbackList.svelte') then { default: FallbackList }}<FallbackList />{/await}
       {/if}
       ```
    2. `FallbackList.svelte` — a simple scrollable 2D list of all 28 `grants`; each row: funder name · status pill (hue) · human-readable amount (reuse `formatAmount`) · deadline chip (reuse `formatDeadline`) · `Open ↗` link (`target=_blank rel=noopener noreferrer`). Row click → `select(id)` so the SAME DetailPanel opens (no new detail UI). One-line notice at top: "3D view unavailable on this device — showing the grant list." No new tokens, no new state, no a11y work.
    Keep the page prerendering; the probe runs client-side only.
  </action>
  <verify>
    <automated>pnpm check && MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs</automated>
  </verify>
  <done>Either: FallbackList exists and the WebGL probe gates Canvas vs. list (rows call select(id), reuse format helpers), build stays green; OR the task is explicitly skipped as optional and noted in SUMMARY. Build + verify-build remain green regardless.</done>
</task>

<task type="auto">
  <name>Task 3: Phase build gate — base-path build + verify-build (avoid the chart-SVG-grep trap)</name>
  <files>src/routes/+page.svelte</files>
  <read_first>04-VALIDATION.md §Per-Task Verification Map (4-build-gate) + §Build-gate greps, 04-RESEARCH §Pitfall 1, tools/verify-build.mjs</read_first>
  <action>
    Run the phase gate and confirm the deploy invariants. This is the hard completion signal.
    1. Full unit suite: `pnpm exec vitest run` (existing crystarium/tools + new src/lib/data tests) must be green.
    2. Base-path build: `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` exits 0 (Windows base-path invocation).
    3. `node tools/verify-build.mjs` → all 6 checks PASS (index.html, 404.html, .nojekyll, zero root-absolute /_app/, ≥1 /Eman_dashboard/_app/ ref, `<title>` renders "Eman_dashboard").
    4. Assert NO `export const ssr = false` anywhere in src/ (grep). The page must keep prerendering; WebGL stays browser-gated.
    CRITICAL — the chart-SVG-grep TRAP: LayerChart marks are client-hydrated (ssr default false) and the drawer is collapsed by default, so chart values ($296,500, status bars) are NOT in build/index.html. Do NOT grep build/index.html for chart SVG/values and do NOT conclude the build is broken from their absence (Pitfall 1). Gate only on the prerenderable chrome the verify-build tool already checks, plus (optionally) the QR inline SVG which IS baked (`grep build/index.html` for `viewBox="0 0 31 31"` is a valid optional QR-presence assertion). Detail-panel selected-grant fields are also NOT baked (nothing selected at build) — that is expected.
  </action>
  <verify>
    <automated>! grep -rq "ssr = false" src/ && pnpm exec vitest run && MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs && grep -q "Eman_dashboard" build/index.html</automated>
  </verify>
  <done>Full unit suite green; base-path build exits 0; verify-build reports 6/6 PASS; no `ssr = false` in src/; title "Eman_dashboard" present; build NOT gated on client-hydrated chart SVG.</done>
</task>

</tasks>

<verification>
- `pnpm exec vitest run` full suite green.
- `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs` → 6/6.
- grep: overlay panels mounted, no catch layer, readout from selectors, no ssr=false, title intact.
- No build-gate assertion greps build/index.html for chart SVG (trap avoided).
</verification>

<success_criteria>
- Overlay mounts over the scene via the pointer-events/z-index layer model; canvas raycast still works in empty space.
- PipelineReadout figures computed from selectors.
- Optional fallback either shipped (probe → 2D list reusing DetailPanel) or explicitly deferred.
- Phase build gate green: base-path build + verify-build 6/6 + title + SSR-safe; chart-SVG-grep trap avoided.
</success_criteria>

<output>
After completion, create `.planning/phases/04-hud-overlay-ui-fallback/04-04-SUMMARY.md`
</output>
