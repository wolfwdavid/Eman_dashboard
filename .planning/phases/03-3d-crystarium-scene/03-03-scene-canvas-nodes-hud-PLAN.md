---
phase: 03-3d-crystarium-scene
plan: 03
type: execute
wave: 3
depends_on: ["03-02"]
files_modified:
  - src/lib/state/crystarium.svelte.js
  - src/lib/hud/SceneTitle.svelte
  - src/lib/hud/PipelineReadout.svelte
  - src/lib/hud/Legend.svelte
  - src/lib/crystarium/CrystariumCanvas.svelte
  - src/lib/crystarium/CrystariumScene.svelte
  - src/lib/crystarium/CrystalNode.svelte
  - src/routes/+page.svelte
autonomous: true
requirements: [CRYS-01, CRYS-03, CRYS-04]
must_haves:
  truths:
    - "pnpm build still prerenders cleanly — no 'window is not defined', ssr stays true"
    - "verify-build.mjs still passes all 6 checks; <title> still contains 'Eman_dashboard'"
    - "The glassmorphic HUD (title + secured/potential readout + legend) prerenders as real DOM content"
    - "On the client, a browser-gated Canvas renders all 28 crystal nodes; hover/click raise events into the runes state"
    - "Each node's colour reads its status and its size reads its funding amount"
  artifacts:
    - path: "src/lib/state/crystarium.svelte.js"
      provides: "runes singleton ui{selected,hovered,filter,cameraFocus} + select/deselect/hover — the Phase-4 bridge"
      exports: ["ui", "select", "deselect", "hover"]
    - path: "src/lib/crystarium/CrystariumCanvas.svelte"
      provides: "the <Canvas autoRender={false} dpr={[1,2]}> host, only imported client-side"
    - path: "src/lib/crystarium/CrystalNode.svelte"
      provides: "one funder crystal: faceted geometry + emissive MeshStandardMaterial (status hue), scale from layout, interactivity"
    - path: "src/routes/+page.svelte"
      provides: "prerendered HUD + browser-gated dynamic-import Canvas"
      contains: "browser"
  key_links:
    - from: "src/routes/+page.svelte"
      to: "CrystariumCanvas.svelte"
      via: "{#if browser && mounted} + dynamic import()"
      pattern: "browser && mounted"
    - from: "src/lib/crystarium/CrystalNode.svelte"
      to: "src/lib/state/crystarium.svelte.js"
      via: "onclick→select(id), onpointerenter→hover(id)"
      pattern: "select\\(|hover\\("
    - from: "src/lib/crystarium/CrystalNode.svelte"
      to: "tokens.statusHue + layout scale"
      via: "emissive + scale props"
      pattern: "statusHue|emissive"
---

<objective>
Stand up the SSR-safe scene: a runes state module (the Phase-3→Phase-4 bridge), the three prerendered glassmorphic HUD panels, and a browser-gated Threlte `<Canvas>` that renders all 28 crystal nodes from `computeLayout`, each coloured by status and sized by amount, with hover/click raising selection events. The build MUST still prerender and pass `verify-build.mjs` — this plan OWNS Pitfall #1 (SSR-safe WebGL).

Purpose: This is where the Crystarium becomes visible while keeping the deploy invariants green. The Canvas is client-only (dynamic import behind `{#if browser && mounted}`); the HUD is plain Svelte+Tailwind that prerenders so first paint and `verify-build` check #6 (`<title>` contains "Eman_dashboard") survive. Paths, camera, and bloom come in 03-04.
Output: runes state, 3 HUD components, CrystariumCanvas/Scene/Node, and a rewired `+page.svelte`.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-3d-crystarium-scene/03-RESEARCH.md
@.planning/phases/03-3d-crystarium-scene/03-UI-SPEC.md
@src/routes/+page.svelte
@src/routes/+layout.ts
@src/lib/crystarium/tokens.ts
@src/lib/crystarium/layout.js
@src/lib/data/index.ts

<interfaces>
<!-- Runes state shape (RESEARCH Pattern 2 / UI-SPEC Camera & Interaction) — Phase 3 WRITES, Phase 4 READS -->
```js
export const ui = $state({ selected: null, hovered: null, filter: 'all', cameraFocus: null });
export function select(id) { ui.selected = id; ui.cameraFocus = id; }
export function deselect() { ui.selected = null; ui.cameraFocus = null; }
export function hover(id) { ui.hovered = id; }
```

<!-- SSR/WebGL boundary (RESEARCH Pattern 1 / Code Example 1) — guard ONLY the Canvas, never the page -->
```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  let mounted = $state(false);
  onMount(() => (mounted = true));
</script>
<svelte:head><title>Eman_dashboard — DID Grant Crystarium</title></svelte:head>
<SceneTitle /> <PipelineReadout secured={20000} potential={296500} /> <Legend />
{#if browser && mounted}
  {#await import('$lib/crystarium/CrystariumCanvas.svelte') then { default: Canvas }}
    <Canvas />
  {/await}
{/if}
```

<!-- Interactivity (RESEARCH Code Example 2) — call interactivity() ONCE high in the tree -->
```svelte
import { T } from '@threlte/core';
import { interactivity } from '@threlte/extras';
import { select, hover } from '$lib/state/crystarium.svelte.js';
<T.Mesh
  onpointerenter={(e)=>{e.stopPropagation(); hover(grant.id);}}
  onpointerleave={()=>hover(null)}
  onclick={(e)=>{e.stopPropagation(); select(grant.id);}} >
```

<!-- Canvas perf config (RESEARCH Code Example 5) -->
```svelte
<Canvas autoRender={false} dpr={[1,2]} renderMode="always"> <CrystariumScene /> </Canvas>
```

<!-- HUD copy (UI-SPEC §HUD Layout) — EXACT strings -->
// eyebrow: DIVERSITY INCLUDES DISABILITY · title: GRANT CRYSTARIUM
// readout: SECURED $20,000 (--secured-gold) / POTENTIAL $296,500 (--text-hi) + footnote "avg/midpoint · live pipeline"
// legend: 8 rows funnel order — Active, In progress, Applied, Recurring, To research, Not eligible (yet), Not eligible, Declined
// tokens: --surface-glass rgba(18,26,48,0.55) + backdrop-filter blur(16px) + --surface-glass-border rgba(140,180,255,0.18)
// type: Orbitron 32/600 display, Inter 14/400 body, Inter 12/400 caption; tabular-nums on $ figures

<!-- computeLayout node fields available (from 03-02) -->
// { id, x, y, z, scale, ring, sector, status, isTBD, isEquity, pulse, beamTarget }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Runes state bridge + prerendered glassmorphic HUD (title/readout/legend)</name>
  <read_first>.planning/phases/03-3d-crystarium-scene/03-UI-SPEC.md (§HUD Layout + §Color System + §Typography), src/lib/crystarium/tokens.ts, src/routes/+layout.svelte (for @theme token names)</read_first>
  <files>src/lib/state/crystarium.svelte.js, src/lib/hud/SceneTitle.svelte, src/lib/hud/PipelineReadout.svelte, src/lib/hud/Legend.svelte</files>
  <action>
    1. `src/lib/state/crystarium.svelte.js` — the runes singleton exactly per `<interfaces>`: `export const ui = $state({ selected:null, hovered:null, filter:'all', cameraFocus:null })` + `select`/`deselect`/`hover`. Module import (not context) — survives the conditionally-mounted Canvas. Phase 3 WRITES; Phase 4 READS. Do NOT build any consumer here.
    2. Add the UI-SPEC HUD CSS tokens to the `@theme` block (or a scoped `:root`) so the panels can reference them: `--surface-glass: rgba(18,26,48,0.55)`, `--surface-glass-border: rgba(140,180,255,0.18)`, `--text-hi: #EAF1FF`, `--text-lo: #8A97B8`, `--secured-gold: #FFC24B`. (These mirror tokens.ts for the DOM side.)
    3. `SceneTitle.svelte` — top-left glass panel (inset 24px): eyebrow `DIVERSITY INCLUDES DISABILITY` (Inter 12/400, uppercase, +0.14em, --text-lo) + title `GRANT CRYSTARIUM` (Orbitron 32/600, --text-hi). Glass: `--surface-glass` + `backdrop-filter: blur(16px)` + 1px `--surface-glass-border`.
    4. `PipelineReadout.svelte` — top-right glass chip, props `{secured, potential}`. Two stacked figures, `font-variant-numeric: tabular-nums`: `SECURED` caption + `${secured.toLocaleString()}` in Orbitron 32/600 **--secured-gold**; `POTENTIAL` caption + `${potential.toLocaleString()}` in Orbitron 32/600 --text-hi; footnote `avg/midpoint · live pipeline` (Inter 12/400 --text-lo). Import the real numbers where mounted: `import { securedTotal, potentialTotal } from '$lib/data'` if exported, else accept the 20000/296500 props from +page.
    5. `Legend.svelte` — bottom-left glass panel, caption `STATUS` (Inter 12/400 uppercase --text-lo), 8 rows in funnel order (Active, In progress, Applied, Recurring, To research, Not eligible (yet), Not eligible, Declined), each a 12×12px crystal swatch coloured from the status hue + Inter 14/400 label. Drive swatch colours from a status→CSS-var map (mirror of tokens.statusHue) — no raw hex in the template.
    All three are plain Svelte 5 + Tailwind v4, NO Three import — they must prerender.
  </action>
  <verify>
    <automated>node -e "const s=require('fs').readFileSync('src/lib/state/crystarium.svelte.js','utf8'); if(!/export const ui = \$state/.test(s)||!/export function select/.test(s)||!/export function hover/.test(s)) throw new Error('runes state incomplete'); console.log('state ok')"</automated>
    <automated>grep -q "GRANT CRYSTARIUM" src/lib/hud/SceneTitle.svelte && grep -q "DIVERSITY INCLUDES DISABILITY" src/lib/hud/SceneTitle.svelte && grep -q "tabular-nums" src/lib/hud/PipelineReadout.svelte && grep -c "swatch\|status" src/lib/hud/Legend.svelte && echo "hud ok"</automated>
  </verify>
  <done>crystarium.svelte.js exports `ui/select/deselect/hover`; the 3 HUD components render the EXACT UI-SPEC strings with glass tokens + tabular numerals, contain no Three import, and are ready to prerender.</done>
</task>

<task type="auto">
  <name>Task 2: Browser-gated Canvas + Scene + CrystalNode; mount into +page.svelte (build stays green)</name>
  <read_first>src/routes/+page.svelte, .planning/phases/03-3d-crystarium-scene/03-RESEARCH.md (§Pattern 1, Code Examples 1/2/5, §Crystal node visual), src/lib/crystarium/tokens.ts, src/lib/crystarium/layout.js, tools/verify-build.mjs</read_first>
  <files>src/lib/crystarium/CrystariumCanvas.svelte, src/lib/crystarium/CrystariumScene.svelte, src/lib/crystarium/CrystalNode.svelte, src/routes/+page.svelte</files>
  <action>
    1. `CrystariumCanvas.svelte` — imports `{ Canvas }` from `@threlte/core` and `CrystariumScene`; renders `<Canvas autoRender={false} dpr={[1,2]} renderMode="always"><CrystariumScene /></Canvas>` (autoRender=false reserved for the 03-04 bloom composer; dpr clamp ≤2 per Pitfall F). This file is ONLY ever dynamically imported client-side.
    2. `CrystariumScene.svelte` — call `interactivity()` ONCE here (high in the tree). Compute `const { nodes, edges, center } = computeLayout(grants)` (import `grants` from `$lib/data`, `computeLayout` from `./layout.js`). Add low cool ambient light + a subtle key light + a small inner point light near the core (scene is emissive-driven, not lit-driven). Set the renderer clear colour to `tokens.bg`. Render one `<CrystalNode grant={g} node={n} />` per node (match node to its grant by id). Leave a placeholder slot/comment for `<CrystalPath>` and `<CameraRig>` (03-04) — but DO add a temporary `<T.PerspectiveCamera makeDefault position={[0,14,34]}>` so the scene is viewable before the CameraRig lands. Dispose geometries/materials on unmount (`$effect` cleanup / onDestroy).
    3. `CrystalNode.svelte` — props `{ grant, node }`. Render `<T.Mesh position={[node.x,node.y,node.z]} scale={node.scale}>` with faceted geometry (`<T.IcosahedronGeometry args={[1,0]}>` base; the core/active node may use a larger multi-shard look) + `<T.MeshStandardMaterial>` with `emissive={statusHue[grant.status]}`, `emissiveIntensity={activation[grant.status]}`, `color={statusHue[grant.status]}`, `roughness={grant.amount.isTBD ? 0.5 : 0.25}`, `metalness={0}` (import `statusHue, activation` from `./tokens`). Wire `onpointerenter`/`onpointerleave`/`onclick` to `hover(grant.id)`/`hover(null)`/`select(grant.id)` per `<interfaces>`, each with `e.stopPropagation()`. (Fresnel rim, pulse uniform, and hover/select bloom emphasis are 03-04 — leave the material simple but tokenised here.)
    4. Rewrite `src/routes/+page.svelte` per `<interfaces>`: keep `<svelte:head><title>` containing the literal `Eman_dashboard` (verify-build check #6), render `<SceneTitle/> <PipelineReadout secured={20000} potential={296500}/> <Legend/>` as prerendered DOM, and mount the Canvas ONLY behind `{#if browser && mounted}` via `{#await import('$lib/crystarium/CrystariumCanvas.svelte')}`. Position the canvas fixed/full-viewport behind the HUD (z-index). NEVER set `ssr=false`; do not touch `+layout.ts`.
  </action>
  <verify>
    <automated>MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build</automated>
    <automated>node tools/verify-build.mjs</automated>
    <automated>grep -q "browser && mounted" src/routes/+page.svelte && grep -q "Eman_dashboard" src/routes/+page.svelte && grep -q "statusHue" src/lib/crystarium/CrystalNode.svelte && grep -Eq "select\(|hover\(" src/lib/crystarium/CrystalNode.svelte && echo "wiring ok"</automated>
  </verify>
  <done>`pnpm build` prerenders with NO "window is not defined" (Canvas is browser-gated via dynamic import); `verify-build.mjs` passes all 6 checks incl. the "Eman_dashboard" title; `+page.svelte` shows the prerendered HUD + guarded Canvas; CrystalNode colours by `statusHue`, scales by `node.scale`, and raises select/hover. Manual: live scene shows 28 crystals coloured by status, sized by amount.</done>
</task>

</tasks>

<verification>
- `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs` — build prerenders, 6 checks pass, ssr stays true.
- `grep browser src/routes/+page.svelte` confirms the Canvas is guarded; no `ssr = false` anywhere.
- `pnpm exec vitest run src/lib/crystarium` still green (no regression from the new files).
- Manual (VALIDATION.md): open live scene — 28 crystal nodes render, gold active core vs dim to-research rim, size tracks amount, hover/click respond.
</verification>

<success_criteria>
The Crystarium is visible: a browser-gated Canvas renders all 28 status-coloured, amount-scaled crystal nodes and raises hover/select into the runes bridge, while the glassmorphic HUD prerenders and `pnpm build` + `verify-build.mjs` stay green (SSR-safe WebGL owned).
</success_criteria>

<output>
After completion, create `.planning/phases/03-3d-crystarium-scene/03-03-SUMMARY.md`.
</output>
