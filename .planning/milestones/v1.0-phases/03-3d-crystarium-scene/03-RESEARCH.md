# Phase 3: 3D Crystarium Scene - Research

**Researched:** 2026-07-04
**Domain:** Threlte v8 / Three.js r185 WebGL on SvelteKit adapter-static (GitHub Pages), postprocessing bloom, GSAP camera, deterministic pure layout math
**Confidence:** HIGH (stack + Threlte/postprocessing APIs verified against official docs + npm on research date; derived data-sets verified row-by-row against `grants.generated.json`; Crystarium layout constants are original design → MEDIUM, tune in polish)

---

<user_constraints>
## User Constraints (from 03-CONTEXT.md)

### Locked Decisions
- **Design contract is `03-UI-SPEC.md` — follow it.** Full color system, crystal node material/geometry, bloom tuning, camera/interaction states, and HUD layout are LOCKED there. Key tokens: `--bg #05060D`, glass HUD `rgba(18,26,48,0.55)` + blur(16px), 8 status hues (active/gold `#FFC24B`, in-progress/cyan `#33E1FF`, applied/violet `#A98BFF`, recurring/emerald `#4BE39B`, to-research/steel `#5B84C4`, not-eligible-yet/bronze `#B0894E`, not-eligible/ash `#565D75`, declined/ash-rust `#8A5560`), `--secured-gold #FFC24B` (ONLY the one active node + the $20,000 figure), `--urgent #FF5A3C` (deadline pulse), `--path #6FA8FF`, beam gradient gold→cyan.
- **Typography:** Orbitron display (titles, node labels, big numbers) + Inter body; tabular figures for `$` totals. Exactly 4 sizes (12/14/20/32), 2 weights (400/600).
- **Data-derived facts — COMPUTE, never hardcode:**
  - Fiscal-sponsor beam = exactly **4** targets where `requires501c3Raw === 'Yes - or fiscal sponsor'`. UI-SPEC corrected FEATURES.md's "5". Derive from data; ship 4; flag discrepancy.
  - Deadline pulse = only non-passed / non-rolling / non-declined / non-ineligible nodes with a real one-time deadline (currently **3**). Passed/rolling/declined never pulse.
  - Family links: two Ford nodes linked; two BofA-related nodes (Harry S. Black is BofA) linked.
  - Node scale = log-scaled representative amount; TBD/qualitative → fixed minimal "unformed raw-ore crystal."
  - Ring/tier = status funnel (center = active/secured → rim = to-research); angular sector = 501(c)(3) gate.
- **Load-bearing engineering constraints (this phase OWNS Pitfalls #1/#2):**
  - SSR-safe WebGL: `<Canvas>` MUST be browser-gated (`{#if browser}` + `onMount`) so WebGL never runs during prerender. Keep `ssr = true` + `prerender = true` globally — **NEVER** set `ssr = false`. `pnpm build` must still prerender the HUD shell cleanly.
  - All imperative Three.js loader URLs (textures/fonts, if any) route through `base` from `$app/paths`. `verify-build.mjs` deploy invariants must still pass.
  - Pin `three@0.185.1` (postprocessing 6.39 needs `three <0.186`). Use Threlte v8 runes APIs (`useTask`, NOT `useFrame`).
  - Layout math is a PURE module returning plain `{x,y,z}` — no Three.js coupling — unit-testable and deterministic.
  - Bloom is GPU-costly: selective/threshold bloom; cap pixel ratio; deadline pulse via material uniform, not per-frame object churn.

### Claude's Discretion
- Exact crystal facet geometry, shader/material specifics, precise UnrealBloom params (tune to UI-SPEC direction), auto-orbit speed, and the runes state module shape — within the UI-SPEC direction.

### Deferred Ideas (OUT OF SCOPE)
- Detail panel, filters, QR panel, and full analytics charts are **Phase 4** (this scene RAISES the selection events they will consume — do not build the consumers). Sound and heavy particle immersion are v2. Do NOT add `layerchart` this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRYS-01 | Threlte canvas as primary nav, browser-guarded (no SSR WebGL) | §Architecture Pattern 1 (SSR/WebGL boundary), §Code Example 1 (guarded Canvas), §Pitfall 1 |
| CRYS-02 | Deterministic pure layout module, status-sectored radial dome | §Deterministic Layout Algorithm (full signature + math), §Code Example 6, §Validation (layout unit tests) |
| CRYS-03 | Node visual state encodes grant status (activation levels) | §Crystal Node (status→emissiveIntensity), §Layout ring-by-status, UI-SPEC Color System |
| CRYS-04 | Node scale encodes funding amount (log-scaled; TBD→minimal) | §Deterministic Layout Algorithm (`scaleFor`), §Validation (scale tests) |
| CRYS-05 | Deadline glow/pulse; passed/rolling/declined excluded | §Deterministic Layout Algorithm (`isPulse`, exactly 3), §Pulse via uniform, §Open Question 1 (clock-free set) |
| CRYS-06 | Paths: spine + Ford/BofA families + fiscal-sponsor beam (4 targets) | §Deterministic Layout Algorithm (`isBeamTarget`, `deriveFamilies`), §Validation (edge tests) |
| CRYS-07 | Camera orbit + focus-on-node | §Code Example 4 (GSAP camera), §Architecture Pattern 4, §Interaction/State |
| CRYS-08 | Hover/select states + bloom | §Code Example 2 (interactivity), §Code Example 3 (postprocessing), §Interaction/State |
</phase_requirements>

---

## Summary

This phase is the single highest-risk surface in the project because it stacks four moving parts — Threlte v8 (Svelte 5 runes), SSR-safe WebGL on a prerendered static site, a `postprocessing` bloom pipeline pinned to `three@0.185`, and a GSAP camera — on top of a **pure, deterministic layout module** that must produce identical output across builds. The good news: every one of these has a current, verified pattern, and the data-derived sets (4 beam targets, 3 pulse nodes, 2 family pairs, 1 center node) are **provable from `grants.generated.json` today** — so the risky visual work sits on a foundation that is fully unit-testable before a single pixel renders.

The load-bearing engineering insight is a clean seam: `src/lib/crystarium/layout.js` is a pure function (`grants → {nodes, edges, center}`) with **no `three` import, no `Date.now()`, no RNG**. It computes positions, scale, ring/sector, and the three derived edge/node sets. Everything WebGL — `<Canvas>`, materials, bloom composer, GSAP, raycasting — lives inside a browser-guarded subtree that only mounts in `onMount`, while the glassmorphic HUD (title / pipeline readout / legend) stays plain Svelte+Tailwind and **prerenders** so `pnpm build` + `verify-build.mjs` stay green. Do not conflate the two: guard only the Canvas, never the page.

Two current-API corrections matter versus stale tutorials: the render loop is `useTask` (not `useFrame`), and the postprocessing composer requires `autoRender={false}` on `<Canvas>` plus `ssr: { noExternal: ['postprocessing'] }` in `vite.config.ts` — a SvelteKit-specific gotcha that otherwise breaks the build.

**Primary recommendation:** Build and fully unit-test `layout.js` (all derived sets) FIRST as a pure module, then layer the browser-guarded Threlte scene on top; wire postprocessing via the official `autoRender=false` + `EffectComposer` + `useTask({stage: renderStage, autoInvalidate: false})` pattern; drive the camera with GSAP tweening a plain target object. Pin `three@0.185.1`.

---

## Standard Stack

### Core (verified `npm view` on 2026-07-04)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@threlte/core` | `8.5.16` | Declarative Three.js as Svelte 5 components (`<T>`, `useTask`, `useThrelte`) | Inits WebGL inside `onMount` → SSR-safe by design; runes-native. |
| `three` | `0.185.1` **(PINNED)** | WebGL engine | `postprocessing` peer is `>=0.168 <0.186` (confirmed) — `0.186+` breaks bloom. Do NOT bump. |
| `@types/three` | `0.185.0` | Types matched to `three` minor | Keep aligned with `three`. |
| `@threlte/extras` | `9.21.0` | `interactivity()` raycasting, `<OrbitControls>`, `<Float>`, `<Billboard>`, `<HTML>`, `<Text>`, `<InstancedMesh>` | Peer `svelte >=5`, `three >=0.160` — satisfied. |
| `postprocessing` | `6.39.2` | `EffectComposer` + `BloomEffect`/`SelectiveBloom` | The signature glow. Peer `three >=0.168 <0.186` (the pin driver). |
| `gsap` | `3.15.0` | Camera focus tween, activation timelines | Framework-agnostic, precise easings; import client-side only. |

Already installed & reusable: `svelte@^5.56.1`, `@sveltejs/kit@^2.63`, `@sveltejs/adapter-static@^3.0.10`, `vite@^8`, `tailwindcss@^4.3`, `vitest@4.1.9`, `@fontsource-variable/{orbitron,inter}`, plus the Phase-2 typed dataset (`grants.generated.json`, `import { grants } from '$lib/data'`).

**Installation (this phase adds):**
```bash
pnpm add @threlte/core@8.5.16 @threlte/extras@9.21.0 three@0.185.1 postprocessing@6.39.2 gsap@3.15.0
pnpm add -D @types/three@0.185.0
```
Do **not** add `layerchart` (Phase 4).

**Version verification (2026-07-04):** `three@0.185.1`, `postprocessing@6.39.2` (peer `three >=0.168.0 <0.186.0`), `@threlte/core@8.5.16`, `@threlte/extras@9.21.0` (peer `svelte >=5`, `three >=0.160`), `gsap@3.15.0` — all current-latest as published; the `three` pin is a hard compatibility ceiling, not a preference.

### Required config changes (non-obvious, will break the build if missed)

| File | Change | Why |
|------|--------|-----|
| `vite.config.ts` | Add `ssr: { noExternal: ['postprocessing'] }` | `postprocessing` is ESM that SvelteKit externalizes for SSR and then fails to resolve during prerender. Official Threlte SvelteKit note. |
| `vitest.config.ts` | Extend `include` to cover `src/lib/crystarium/**/*.test.{js,ts}` | Current globs are `tools/**/*.test.mjs` + `src/lib/data/**/*.test.ts` — the layout tests would silently not run. |
| `src/app.d.ts` | `namespace Threlte { interface UserProps extends InteractivityProps {} }` | Type-safe `onclick`/`onpointerenter` handlers on `<T.Mesh>`. |
| `<Canvas>` | `autoRender={false}` when a postprocessing composer drives rendering | The composer's `useTask` becomes the render authority. |

---

## Architecture Patterns

### Recommended structure (extends ARCHITECTURE.md)
```
src/lib/
├── crystarium/
│   ├── layout.js              # PURE: grants → {nodes, edges, center}. NO three, NO Date, NO RNG.
│   ├── layout.test.ts         # Wave-0 unit tests (all derived sets)
│   ├── tokens.ts              # numeric hex mirror of --status-* for three materials
│   ├── CrystariumCanvas.svelte# the browser-guarded <Canvas> host
│   ├── CrystariumScene.svelte # assembles nodes+edges+lights+camera+bloom
│   ├── CrystalNode.svelte     # one funder crystal (<T.Mesh> + material + pulse)
│   ├── CrystalPath.svelte     # one edge (spine/family/beam)
│   ├── CameraRig.svelte       # OrbitControls autoRotate + GSAP focus
│   └── Effects.svelte         # postprocessing composer (autoRender=false)
├── state/
│   └── crystarium.svelte.js   # runes singleton: selected/hovered/filter/cameraFocus
└── hud/                        # plain Svelte+Tailwind, PRERENDERED (not guarded)
    ├── SceneTitle.svelte
    ├── PipelineReadout.svelte
    └── Legend.svelte
```

### Pattern 1: The SSR/WebGL boundary (the critical one — CRYS-01)
Guard ONLY the `<Canvas>` subtree; the HUD prerenders. Keep `ssr=true`+`prerender=true` in `+layout.ts` untouched.
```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import SceneTitle from '$lib/hud/SceneTitle.svelte';
  import PipelineReadout from '$lib/hud/PipelineReadout.svelte';
  import Legend from '$lib/hud/Legend.svelte';
  let mounted = $state(false);
  onMount(() => (mounted = true));
</script>

<svelte:head>
  <!-- KEEP "Eman_dashboard" in <title>: verify-build.mjs check #6 greps for it. -->
  <title>Eman_dashboard — DID Grant Crystarium</title>
</svelte:head>

<!-- Prerendered HUD (SSR-safe, real content for verify-build) -->
<SceneTitle />
<PipelineReadout secured={20000} potential={296500} />
<Legend />

{#if browser && mounted}
  {#await import('$lib/crystarium/CrystariumCanvas.svelte') then { default: Canvas }}
    <Canvas />   <!-- WebGL, client-only -->
  {/await}
{/if}
```
The dynamic `import()` also code-splits `three`/`postprocessing` (~300–600 KB) out of first paint (Pitfall 3/14).

### Pattern 2: Runes state module as the Phase-3→Phase-4 bridge (CRYS-07/08)
`src/lib/state/crystarium.svelte.js` — a module-level `$state` singleton. Phase 3 WRITES; Phase 4 READS.
```js
export const ui = $state({ selected: null, hovered: null, filter: 'all', cameraFocus: null });
export function select(id) { ui.selected = id; ui.cameraFocus = id; }
export function deselect() { ui.selected = null; ui.cameraFocus = null; }
export function hover(id) { ui.hovered = id; }
```
Module import (not Svelte context) is correct here because the Canvas is conditionally mounted — a plain import survives mount/unmount cleanly.

### Pattern 3: Pure layout, imperative render
`layout.js` returns plain numbers. `CrystalNode.svelte` turns `{x,y,z,scale}` into `<T.Mesh position={[x,y,z]} scale={scale}>`. Never return `THREE.Vector3` from layout.

### Pattern 4: GSAP tweens a plain object, not the camera directly
Tween a `{x,y,z}` proxy + a `target` proxy; in `onUpdate` copy into `camera.position` and `controls.target`, then `controls.update()`. Kill the previous tween on a new selection so focuses don't stack.

### Anti-patterns to avoid
- **`export const ssr = false` to dodge `window is not defined`** → emits an empty shell, kills the prerendered HUD + `verify-build`. Guard the Canvas instead.
- **`useFrame`** (Threlte v6/7 / R3F) → does not exist in v8. Use `useTask`.
- **`import * as THREE` at module top-level of anything a `+page`/`+layout` imports** → pulls three into the server graph → prerender crash. Isolate to client-only components.
- **`Date.now()` / `Math.random()` inside `layout.js`** → non-deterministic builds; also makes the pulse set untestable. Use the clock-independent `deadline.isPassed` flag (see Open Question 1).
- **Full-screen bloom at native DPR** → mobile GPU meltdown even with 28 nodes (bloom cost scales with pixels, not objects).

---

## Threlte v8 / Svelte 5 API — verified current snippets

### Code Example 1: `useTask` render/animation loop + `useThrelte`
```svelte
<!-- Source: https://threlte.xyz/docs/reference/core/use-task/ (verified 2026-07-04) -->
<script>
  import { useTask, useThrelte } from '@threlte/core';
  const { scene, renderer, camera, size, invalidate } = useThrelte();
  let mesh; // bound via bind:ref on <T.Mesh>
  useTask((delta) => {
    if (!mesh) return;
    mesh.rotation.y += delta * 0.4; // delta = seconds since last frame
  });
</script>
```

### Code Example 2: Raycast hover/click via `interactivity()` (CRYS-08)
```svelte
<!-- Source: https://threlte.xyz/docs/reference/extras/interactivity (verified 2026-07-04) -->
<script>
  import { T } from '@threlte/core';
  import { interactivity } from '@threlte/extras';
  import { select, hover } from '$lib/state/crystarium.svelte.js';
  interactivity();               // call ONCE, high in the scene tree
  let { grant } = $props();
</script>

<T.Mesh
  onpointerenter={(e) => { e.stopPropagation(); hover(grant.id); }}
  onpointerleave={() => hover(null)}
  onclick={(e) => { e.stopPropagation(); select(grant.id); }}
>
  <T.IcosahedronGeometry args={[1, 0]} />
  <T.MeshStandardMaterial />
</T.Mesh>
```
Event payload includes `object`, `point`, `distance`, `intersections`, `camera`, `stopPropagation()`. Add `interface UserProps extends InteractivityProps {}` in `app.d.ts` for typed handlers.

### Code Example 3: Postprocessing SelectiveBloom composer (CRYS-08) — the exact official pattern
```svelte
<!-- Effects.svelte — Source: https://threlte.xyz/docs/reference/core/use-task/ (verified 2026-07-04) -->
<script>
  import { useThrelte, useTask } from '@threlte/core';
  import { EffectComposer, EffectPass, RenderPass, BloomEffect, KernelSize } from 'postprocessing';

  const { scene, renderer, camera, size, renderStage, autoRender } = useThrelte();
  const composer = new EffectComposer(renderer);

  const setup = (cam) => {
    composer.removeAllPasses();
    composer.addPass(new RenderPass(scene, cam));
    composer.addPass(new EffectPass(cam, new BloomEffect({
      intensity: 1.0,            // UI-SPEC 0.8–1.2
      luminanceThreshold: 0.6,   // UI-SPEC 0.55–0.65: only bright cores/rims bloom
      luminanceSmoothing: 0.2,
      radius: 0.5,               // UI-SPEC 0.4–0.6 soft halo
      mipmapBlur: true,          // half-res, mobile-GPU budget
      kernelSize: KernelSize.MEDIUM
    })));
  };
  $effect(() => setup($camera));
  $effect(() => composer.setSize($size.width, $size.height));

  // Take over rendering from Threlte's auto-render:
  $effect(() => { const b = autoRender.current; autoRender.set(false); return () => autoRender.set(b); });
  useTask((delta) => composer.render(delta), { stage: renderStage, autoInvalidate: false });
</script>
```
**Two required companions:** `<Canvas autoRender={false}>` and `ssr: { noExternal: ['postprocessing'] }` in `vite.config.ts`.
**Selective bloom:** put emissive crystals/beam on a bloom layer and use `SelectiveBloom` (or a layer-masked `BloomEffect`) so the HUD/void never bloom. `BloomEffect` blooms by luminance — with `luminanceThreshold 0.6` the dim steel-blue `to-research` frontier stays crisp and only lit cores/rims glow, which is the cheaper and UI-SPEC-preferred route.

### Code Example 4: GSAP camera focus-on-node (CRYS-07)
```svelte
<!-- CameraRig.svelte -->
<script>
  import { T, useThrelte, useTask } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import { onMount } from 'svelte';
  import gsap from 'gsap';                       // client-only (component only mounts in browser)
  import { ui } from '$lib/state/crystarium.svelte.js';
  import { layout } from '...';                  // {nodes,...}

  let controls;                                  // bind:ref
  const { invalidate } = useThrelte();
  let tween;

  function focus(nodeId) {
    const n = layout.nodes.find((x) => x.id === nodeId);
    if (!n || !controls) return;
    tween?.kill();                               // interrupt any in-flight focus
    controls.autoRotate = false;
    const camPos = { x: n.x + 8, y: n.y + 6, z: n.z + 8 };
    tween = gsap.timeline({ onUpdate: invalidate })
      .to(controls.object.position, { ...camPos, duration: 0.6, ease: 'power3.out' }, 0)
      .to(controls.target,          { x: n.x, y: n.y, z: n.z, duration: 0.6, ease: 'power3.out' }, 0);
  }

  $effect(() => { if (ui.cameraFocus) focus(ui.cameraFocus); });     // reactive to selection
  useTask(() => controls?.update());                                  // damping needs per-frame update
</script>

<T.PerspectiveCamera makeDefault position={[0, 14, 34]}>
  <OrbitControls bind:ref={controls} enableDamping autoRotate autoRotateSpeed={0.4} target={[0,0,0]} />
</T.PerspectiveCamera>
```
Deselect: tween back to a default framing and re-enable `autoRotate` (exit ~250ms, faster than the ~600ms enter, per UI-SPEC). Always `tween?.kill()` before starting a new one; kill on unmount.

### Code Example 5: `<Canvas>` perf config (CRYS-01 perf)
```svelte
<!-- CrystariumCanvas.svelte -->
<script>
  import { Canvas } from '@threlte/core';
  import CrystariumScene from './CrystariumScene.svelte';
</script>
<Canvas
  autoRender={false}         {/* postprocessing composer renders */}
  dpr={[1, 2]}               {/* clamp pixel ratio ≤2 (Threlte accepts [min,max]) */}
  renderMode="always"        {/* scene auto-orbits + pulses continuously; see Perf note */}
>
  <CrystariumScene />
</Canvas>
```
`<Canvas>` v8 props confirmed: `renderMode` (`always|on-demand|manual`, default `on-demand`), `autoRender` (default true), `dpr` (`number | [min,max]`), `toneMapping` (default `AgXToneMapping`), `colorSpace` (default srgb), `shadows`.

---

## Deterministic Layout Algorithm (CRYS-02/04/05/06) — the pure, testable core

`src/lib/crystarium/layout.js` — **no `three`, no `Date`, no RNG.** Signature:
```js
export function computeLayout(grants) // → { nodes: Node[], edges: Edge[], center: string }
// Node: { id, x, y, z, scale, ring, sector, status, isTBD, isEquity, pulse, beamTarget }
// Edge: { from, to, kind: 'spine' | 'family' | 'beam' }
```

### Constants (world units — tune in polish)
```js
const RING_RADIUS = { active: 0, applied: 6, 'in-progress': 11, 'to-research': 17, recurring: 9, dim: 20 };
const DOME_CURVE = 0.35;   // elevation gain per unit radius
const SPREAD     = 0.12;   // deterministic angular fan (index-derived, NOT random)
const SCALE_MIN = 0.6, SCALE_MAX = 2.4, TBD_SCALE = 0.5;
const AMT_FLOOR = 500, AMT_CEIL = 200000;
```

### Ring by status funnel (radius = status; verified counts against data)
| Ring | Radius | Status | Count | Note |
|------|--------|--------|-------|------|
| 0 core | 0 | `active` | **1** | `ny-community-trust` = center, secured gold |
| 1 | 6 | `applied` | **1** | `brava-thrive-grant` |
| 2 | 11 | `in-progress` | **3** | harry-s-black, ben-jerry, nyc-office-prevention |
| 3 | 17 | `to-research` | **17** | incl. both Ford, both TBD-heavy frontier |
| orbit | 9 (inclined) | `recurring` | **2** | awesome-foundation, matriarch (loop-pulse) |
| dim arc | 20 (y pushed down) | `declined`+`not-eligible`+`not-eligible-yet` | **4** | hey-helen, truist, just-thrive, td-bank |

Sum = 1+1+3+17+2+4 = **28** ✓ (verified row-by-row).

### Angular sector by 501(c)(3) gate (angle within ring = `requires501c3` tri-state)
`no` → "open now" front arc (θ≈200–340°); `yes` → "gated" rear-left (θ≈20–140°); `unknown` → "unknown" side (θ≈140–200°). Within a sector: order by representative amount desc, tie-break `deadline.date` asc, then index-derived `±SPREAD` fan (deterministic, not random).

### Scale (CRYS-04)
```js
const rep = (g) => g.amount.avg ?? g.amount.max ?? g.amount.min;   // representative amount
function scaleFor(g) {
  if (g.amount.isTBD) return TBD_SCALE;                            // 0.5 "unformed raw-ore crystal"
  const a = Math.max(AMT_FLOOR, Math.min(AMT_CEIL, rep(g)));
  const t = (Math.log(a) - Math.log(AMT_FLOOR)) / (Math.log(AMT_CEIL) - Math.log(AMT_FLOOR));
  return SCALE_MIN + t * (SCALE_MAX - SCALE_MIN);
}
```
- `giving-joy-grants` avg 500 → 0.6 (floor). `ford-...-justfilms` avg 125000 → ≈2.26. `ford-...-nyc` (avg/max null, min 100000 → rep 100000) → ≈2.20.
- **16 nodes** have `amount.isTBD === true` → all forced to `0.5` (UI-SPEC said "~13"; the data has **16** — see Open Question 2). `37-angels` (`isEquity`) additionally gets the hollow/desaturated "not grant money" treatment.

### Dome wrap
`y = RING_RADIUS[ring] * DOME_CURVE + amountBump(node)` (larger crystals lift slightly). Core low-center; frontier curves up into a shallow sphere-cap bowl.

### Derived sets — the three that MUST come from data, not hardcoded

**1. Beam targets (CRYS-06) — exactly 4, verified:**
```js
const isBeamTarget = (g) => g.requires501c3Raw === 'Yes - or fiscal sponsor';
```
⚠️ **Use `requires501c3Raw`, NOT `requires501c3 === 'yes'`.** The tri-state `requires501c3 === 'yes'` yields **8** nodes (adds BofA-charitable/Wells-Fargo/SNF "Likely yes" + TD-Bank "Yes (required)"). Only the raw string `'Yes - or fiscal sponsor'` gives the correct 4:
| # | id |
|---|----|
| 1 | `harry-s-black-allon-fuller-fund-bank-of-america` |
| 2 | `ford-foundation-justfilms-documentary-production` |
| 3 | `ford-foundation-nyc-good-neighbor-committee` |
| 4 | `ben-jerry-s-foundation-jerry-greenfield-grassroots-organizing` |

Beam **source** = the center node `ny-community-trust` (its `requires501c3Raw` = `"No - they are 501(c)(3); potential fiscal sponsor"` — it is the sponsor, not a target). Emit 4 `{from:'ny-community-trust', to, kind:'beam'}` edges.

**2. Pulse set (CRYS-05) — exactly 3, clock-free:**
```js
const NEVER_PULSE = new Set(['declined', 'not-eligible', 'not-eligible-yet']);
const isPulse = (g) =>
  g.deadline.cadence === 'one-time' && !g.deadline.isPassed && !NEVER_PULSE.has(g.status);
```
Only three grants have `cadence === 'one-time'`: harry-s-black, ford-justfilms, ben-jerry — all `isPassed:false`, none in `NEVER_PULSE` → **exactly 3**. `hey-helen` has `cadence:'passed'` + `isPassed:true` + `status:'declined'` → excluded three ways. (Rolling/annual/invitation/unknown cadences never qualify.)

**3. Family links (CRYS-06) — 2 pairs, derived:**
```js
// Ford: exact funder match. BofA: parent-substring match ("Bank of America" appears in both funders).
const PARENTS = ['Ford Foundation', 'Bank of America'];
function deriveFamilies(grants) {
  const groups = new Map();
  for (const g of grants) {
    const parent = PARENTS.find((p) => g.funder.includes(p));
    if (parent) (groups.get(parent) ?? groups.set(parent, []).get(parent)).push(g.id);
  }
  const edges = [];
  for (const ids of groups.values())
    for (let i = 0; i < ids.length - 1; i++) edges.push({ from: ids[i], to: ids[i+1], kind: 'family' });
  return edges;
}
```
Yields the Ford pair (`justfilms ↔ nyc-good-neighbor`) and BofA pair (`harry-s-black ↔ bank-of-america-charitable-foundation`). Note the BofA pair's `funder` strings differ (`"Harry S. Black & Allon Fuller Fund (Bank of America)"` vs `"Bank of America Charitable Foundation"`) — both contain `"Bank of America"`, so substring matching (not equality) is required.

**Spine edges (CRYS-06):** `center → each ring's inward-most node`, and sequential `node[i]→node[i+1]` within a ring cluster, `kind:'spine'`.

### Crystal node visual (CRYS-03) — status → activation
Emissive intensity from status (UI-SPEC): to-research 0.15, recurring 0.20→0.40 loop, in-progress 0.40, applied 0.60, active 1.00 (+inner point light), not-eligible-yet 0.12 (+bronze locked halo), not-eligible 0.06, declined 0.06 (+cracked normal). `MeshStandardMaterial`, `emissive` = status hue token (from `tokens.ts`), `roughness ~0.25`, `metalness 0`, fresnel rim via `onBeforeCompile`. TBD/`isTBD` nodes → rougher (~0.5) "raw ore" variant at 0.5 scale.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Render loop / resize / disposal / SSR guard | Manual `requestAnimationFrame` + WebGLRenderer | Threlte `<Canvas>` + `useTask` | Threlte inits in `onMount` (SSR-safe), auto-handles resize + loop. |
| Raycasting hover/click | Custom `Raycaster` + pointer math | `@threlte/extras` `interactivity()` | Handles pointer projection, propagation, enter/leave correctly. |
| Bloom / glow | Hand-written shader passes | `postprocessing` `EffectComposer` + `BloomEffect` | Mipmap half-res bloom, selective layers, tuned kernels. |
| Camera focus easing | Manual lerp in the frame loop | GSAP timeline (kill/interrupt) | Correct easing, interruption, onUpdate invalidation. |
| Orbit / damping | Hand-rolled orbit math | `@threlte/extras` `<OrbitControls>` | Damping, autoRotate, target-tracking built in. |
| In-3D DOM labels | 3D `TextGeometry` + font atlas loader | `@threlte/extras` `<HTML>` or `<Billboard>` + DOM | Reuses self-hosted Orbitron/Inter; dodges base-path font-atlas loading (Pitfall 2). |

**Key insight:** the only thing you SHOULD hand-roll is `layout.js` (the pure math) and the crystal material feel — everything imperative-WebGL has a maintained wrapper that also solves the SSR seam for free.

---

## Common Pitfalls (phase-specific; full catalog in PITFALLS.md #1,#2,#3,#7,#14)

### Pitfall A: `window is not defined` at `pnpm build`
`three` touches `window`/`document` at init; adapter-static prerenders in Node. **Avoid:** guard only `<Canvas>` behind `{#if browser && mounted}` + dynamic `import()`; never top-level `import * as THREE`. **Sign:** green `vite dev`, dead `pnpm build`.

### Pitfall B: postprocessing SSR resolution failure
Without `ssr: { noExternal: ['postprocessing'] }`, prerender fails resolving the ESM. **Avoid:** add it to `vite.config.ts`. **Sign:** build error referencing `postprocessing` during prerender only.

### Pitfall C: bloom takes over but nothing renders
Setting up the composer without `<Canvas autoRender={false}>` double-renders or fights Threlte; with `renderMode="on-demand"` + `autoInvalidate:false` the composer task never runs. **Avoid:** `autoRender={false}` + either `renderMode="always"` (continuous orbit/pulse) or call `invalidate()` each animated frame.

### Pitfall D: pulse lights up dead nodes / non-deterministic set
Using a live `date > now` clock check makes the set depend on build date and breaks determinism — and on today's date (2026-07-04) `harry-s-black`'s 2026-06-30 deadline is already past, which would drop it and yield 2 not 3. **Avoid:** compute the pulse SET from `isPassed` + cadence + status (clock-free → exactly 3); use the live clock only for cosmetic amplitude/frequency in the scene (not in `layout.js`). See Open Question 1.

### Pitfall E: `verify-build.mjs` check #6 regresses
The verifier greps `build/index.html` `<title>`/`<h1>` for the literal `"Eman_dashboard"`. If the landing content is replaced and the string vanishes, check #6 fails. **Avoid:** keep `"Eman_dashboard"` in `<svelte:head><title>`; the HUD prerenders real content around the guarded Canvas.

### Pitfall F: mobile GPU bloom meltdown
Bloom cost scales with pixels, not the 28 objects. **Avoid:** `dpr={[1,2]}`, `mipmapBlur:true` (half-res), `luminanceThreshold ~0.6` (only cores bloom), pause loop on `document.hidden`, dispose geometries/materials on unmount.

---

## Interaction / State shape (Phase-4 contract)

`src/lib/state/crystarium.svelte.js` exports `ui = $state({ selected, hovered, filter, cameraFocus })` + `select/deselect/hover`. **This phase writes** `selected`/`hovered`/`cameraFocus` on raycast events; **Phase 4 reads** them (DetailPanel, filters). Hover is secondary (label + small bloom bump); selection is primary (one at a time: camera springs, selected bursts + blooms above siblings, siblings dim ×0.35). Do not build the DetailPanel/filters here.

---

## Perf

- **Pixel ratio:** `<Canvas dpr={[1, 2]}>` (Threlte clamps; equals `setPixelRatio(min(dpr,2))`).
- **Instancing vs 28 meshes:** 28 is trivially few draw calls — **do NOT instance for perf**; separate `CrystalNode` meshes keep per-node materials/pulse/raycast simple and are cheaper in developer complexity than instancing. (Instancing only pays off in the hundreds+.)
- **Pulse via uniform, not object churn:** animate `material.emissiveIntensity` (or a custom uniform) inside one `useTask`; do not create/destroy objects per frame.
- **Render-on-demand vs always:** the scene auto-orbits + pulses continuously, so `renderMode="always"` is honest and simplest; gate it off on `document.hidden` (visibilitychange) to save battery. The perf-purist alternative (`on-demand` + `invalidate()` from the animation task) only wins if idle motion is paused.
- **Bundle:** dynamic-`import()` the Canvas so `three`/`postprocessing` code-split out of first paint.
- **Disposal:** dispose geometries/materials/composer on component unmount (`onDestroy`/`$effect` cleanup).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest@4.1.9` (installed) |
| Config file | `vitest.config.ts` — ⚠️ `include` must be extended to `src/lib/crystarium/**/*.test.{js,ts}` (Wave 0) |
| Quick run command | `pnpm test:unit` (`vitest run`) |
| Full suite command | `pnpm test:unit && BASE_PATH=/Eman_dashboard pnpm build && pnpm verify:build` |
| Windows build note | `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` |

### Phase Requirements → Test Map
| Req | Behavior | Type | Automated command / assertion | File exists? |
|-----|----------|------|-------------------------------|--------------|
| CRYS-02 | 28 nodes, all `{x,y,z}` finite | unit | `computeLayout(grants).nodes.length===28`; every coord `Number.isFinite` | ❌ Wave 0 |
| CRYS-02 | Deterministic (no RNG/clock) | unit | `deepEqual(computeLayout(grants), computeLayout(grants))` | ❌ Wave 0 |
| CRYS-02/03 | Center = active funder at origin | unit | `layout.center==='ny-community-trust'`; its node `x==0&&z==0` | ❌ Wave 0 |
| CRYS-02/03 | Ring counts by status | unit | active 1 / applied 1 / in-progress 3 / to-research 17 / recurring 2 / dim-arc 4 | ❌ Wave 0 |
| CRYS-04 | TBD → minimal scale | unit | every `g.amount.isTBD` node `scale===0.5`; count of TBD `===16` | ❌ Wave 0 |
| CRYS-04 | Amount → log scale | unit | `giving-joy` scale `≈0.6`; ford-justfilms scale `>2.2`; all scales in `[0.5,2.4]` | ❌ Wave 0 |
| CRYS-05 | Pulse set = exactly 3 | unit | pulse ids `=== {harry-s-black, ford-justfilms, ben-jerry}`; `hey-helen` NOT in set | ❌ Wave 0 |
| CRYS-05 | Passed/rolling/declined never pulse | unit | no node with `isPassed`/rolling cadence/declined status has `pulse===true` | ❌ Wave 0 |
| CRYS-06 | Beam targets = exactly 4 | unit | beam edges `to` set `=== 4 fiscal-sponsor ids`; source always `ny-community-trust` | ❌ Wave 0 |
| CRYS-06 | Family edges = Ford + BofA pairs | unit | `edges` includes Ford pair + BofA pair, `kind:'family'` | ❌ Wave 0 |
| CRYS-01 | Build prerenders, no WebGL in SSR | build-gate | `pnpm build` exits 0 (no `window is not defined`) | ✅ existing build |
| CRYS-01 | HUD prerenders, base-path safe | build-gate | `pnpm verify:build` PASS (incl. check #6 title content) | ✅ `tools/verify-build.mjs` |
| CRYS-01/03/08 | Crystal facets, bloom, hue fidelity | **manual** | eyes on live scene | manual |
| CRYS-05 | Pulse visible on the 3 nodes only | **manual** | eyes on live scene | manual |
| CRYS-07 | Camera spring feel, focus framing | **manual** | eyes on live scene | manual |
| CRYS-08 | Hover vs select distinction | **manual** | eyes on live scene | manual |
| — | Mobile GPU FPS with bloom | **manual** | real mid-range phone | manual |

### Sampling Rate
- **Per task commit:** `pnpm test:unit` (fast; the pure-layout assertions are the highest-leverage tests).
- **Per wave merge:** `pnpm test:unit && BASE_PATH=/Eman_dashboard pnpm build && pnpm verify:build`.
- **Phase gate:** full suite green + manual visual pass before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/crystarium/layout.test.ts` — all CRYS-02/04/05/06 unit assertions above.
- [ ] `vitest.config.ts` — extend `include` to run `src/lib/crystarium/**/*.test.{js,ts}`.
- [ ] `vite.config.ts` — add `ssr: { noExternal: ['postprocessing'] }`.
- [ ] `src/app.d.ts` — `interface UserProps extends InteractivityProps {}` (typed pointer events).
- [ ] Deps install: `@threlte/core@8.5.16 @threlte/extras@9.21.0 three@0.185.1 postprocessing@6.39.2 gsap@3.15.0` + `-D @types/three@0.185.0`.
- [ ] `src/lib/crystarium/tokens.ts` — numeric-hex mirror of `--status-*` for three materials (no raw hex in components).

---

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| `useFrame` (R3F/Threlte v6-7) | `useTask(delta, {stage, autoInvalidate})` | Threlte 8 (Svelte 5) | All render-loop tutorials pre-2024 are stale. |
| `export let` props + `$:` reactivity | `$props()` / `$state` / `$derived` / `$effect` | Svelte 5 runes | Cannot mix `export let` with runes; reactivity flows through runes. |
| Manual `EffectComposer` render each frame | `autoRender=false` + composer `useTask({stage: renderStage, autoInvalidate:false})` | Threlte 8 | The v8 render-stage handshake is required or nothing renders. |
| `three/examples/jsm` `UnrealBloomPass` | `postprocessing` `BloomEffect` (mipmap, selective) | pmndrs `postprocessing` | Cheaper, half-res, layer-selective bloom. |

**Deprecated/outdated:** `useFrame` (gone in v8), `<Canvas>` without `autoRender` handling for postprocessing, any tutorial using `ssr=false` to "fix" WebGL on static sites.

---

## Open Questions

1. **Pulse "future date" vs determinism (recommend clock-free).**
   - Known: UI-SPEC says pulse when `cadence==='one-time' && date in future && !isPassed && status ∉ {...}`, and asserts exactly 3 nodes today.
   - Unclear: as of 2026-07-04, `harry-s-black`'s 2026-06-30 date is already past — a live `date > now` check drops it to 2, and any clock check makes `layout.js` non-deterministic (forbidden).
   - **Recommendation:** compute the pulse SET in the pure module from `isPassed` + cadence + status (→ exactly 3, deterministic, testable). Use the live clock ONLY for cosmetic pulse amplitude/frequency inside the scene component (near/≤90d/far bands), never for set membership. This satisfies both the "exactly 3" acceptance and the determinism constraint.

2. **TBD count is 16, not the UI-SPEC "~13".**
   - Known: `grants.filter(g => g.amount.isTBD).length === 16` (verified: matriarch, brava, echoing-green, tgr, tisch, kellogg, yield-giving, bofa-charitable, wells-fargo, cek, milbank, borealis, snf, td-bank, truist, 37-angels).
   - **Recommendation:** the rule (all `isTBD` → scale 0.5) is unaffected; the test should assert against the derived count (16) or compute it dynamically, not the "~13" prose. Flag to owner as a spec-vs-data note; behavior is correct.

3. **Selective bloom mechanism: `SelectiveBloom` vs luminance-thresholded `BloomEffect`.**
   - Known: both are in `postprocessing`; UI-SPEC wants only crystals/beam to bloom, not HUD/void (the HUD is DOM over the canvas, so it never enters the WebGL bloom anyway).
   - **Recommendation:** start with luminance-thresholded `BloomEffect` (`luminanceThreshold ~0.6`) — simpler and already excludes the dim frontier; escalate to layer-based `SelectiveBloom` only if the emissive frontier washes out in practice. Tunable in polish (Claude's discretion per CONTEXT).

---

## Sources

### Primary (HIGH confidence)
- Threlte `useTask` + postprocessing example — https://threlte.xyz/docs/reference/core/use-task/ (verified 2026-07-04: `useTask`, `useThrelte`, EffectComposer/BloomEffect pattern, `autoRender=false`, `renderStage`, `autoInvalidate:false`, `ssr.noExternal`).
- Threlte `interactivity()` — https://threlte.xyz/docs/reference/extras/interactivity (verified: `interactivity()`, `onpointerenter/onclick`, `InteractivityProps`).
- Threlte `<Canvas>` props — verified via docs (`renderMode` default `on-demand`, `autoRender`, `dpr`, `toneMapping`).
- npm registry (verified 2026-07-04): `three@0.185.1`, `postprocessing@6.39.2` (peer `three >=0.168 <0.186`), `@threlte/core@8.5.16`, `@threlte/extras@9.21.0` (peer `svelte>=5, three>=0.160`), `gsap@3.15.0`.
- `grants.generated.json` (28 rows) — every derived set (4 beam / 3 pulse / 2 families / 16 TBD / ring counts) verified row-by-row.
- Project files: `svelte.config.js`, `vite.config.ts`, `vitest.config.ts`, `+layout.ts`, `tools/verify-build.mjs`, `src/lib/data/types.ts` — read directly.

### Secondary (MEDIUM confidence)
- STACK.md / ARCHITECTURE.md / PITFALLS.md / 03-UI-SPEC.md / 03-CONTEXT.md — prior phase research (versions cross-verified against npm; layout constants original design).
- Sibling `diversityincludesdisability_three` — checked: **no Threlte/3D usage** (accessibility-first rebuild, deliberately DOM-only). Nothing to reuse.

### Tertiary (LOW confidence)
- Community postprocessing-in-Svelte references (e.g. sangillee.com, 1bye/threlte-postprocessing) — surfaced the `ssr.noExternal` gotcha; superseded by the official docs pattern above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions + peer ranges confirmed against npm on research date; pin caveat is a hard peer ceiling.
- Threlte/postprocessing/GSAP APIs: HIGH — snippets pulled from current official docs, not training data.
- Derived data sets (beam/pulse/family/scale/ring): HIGH — verified against the actual 28-row dataset.
- Layout constants (radii, DOME_CURVE, SPREAD): MEDIUM — original design, needs visual iteration in polish.
- Bloom exact params + camera feel: MEDIUM — UI-SPEC gives a tunable range; final values are manual-visual.

**Research date:** 2026-07-04
**Valid until:** ~2026-08-04 (30 days; `three`/`postprocessing`/Threlte are stable but re-check the `three <0.186` pin before any bump).
</content>
</invoke>
