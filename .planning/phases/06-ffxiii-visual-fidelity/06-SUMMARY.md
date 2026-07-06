---
phase: 06-ffxiii-visual-fidelity
plan: 06
subsystem: ui
tags: [threlte, three, postprocessing, bloom, canvas-texture, shaders, crystarium]

# Dependency graph
requires:
  - phase: 03-3d-crystarium-scene
    provides: CrystariumScene, CrystalNode, CrystalPath, Effects, CameraRig, intro reveal
  - phase: 05-premium-polish
    provides: AEST-01 awakening + tuned bloom baseline
provides:
  - Cosmic backdrop (starfield + additive nebula clouds + FogExp2 depth)
  - 3-layer luminous node orbs (emissive core + translucent shell + additive halo)
  - Arced thin light-filament paths (QuadraticBezierCurve3 tubes)
  - Retuned tight bloom (threshold 0.38 / intensity 1.35 / radius 0.65)
  - Constellation camera framing (pulled back, gentle downward angle)
affects: [phase-07-immersion, screenshot-acceptance-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Browser-only CanvasTexture util (radialSprite) for procedural glow — no image assets, SSR-gated"
    - "Composite 3-layer node (core/shell/halo) under one group driven by scalars/uniforms in a single useTask (no per-frame allocation)"
    - "Additive backside shell for a fresnel-ish crystal rim"

key-files:
  created:
    - src/lib/crystarium/gradients.js
    - src/lib/crystarium/Starfield.svelte
    - src/lib/crystarium/Nebula.svelte
  modified:
    - src/lib/crystarium/CrystariumScene.svelte
    - src/lib/crystarium/CrystalNode.svelte
    - src/lib/crystarium/CrystalPath.svelte
    - src/lib/crystarium/Effects.svelte
    - src/lib/crystarium/CameraRig.svelte

key-decisions:
  - "Global NODE_SCALE=0.5 compression so crystals read as orbs in a vast void"
  - "CORE_GAIN=2.3 lifts the tokens.ts activation ladder proportionally so bright cores bloom hard while dim/TBD cores stay under threshold — ladder stays authoritative"
  - "Backdrop layers (stars/nebula) kept dim + fog:false so they never feed bloom"
  - "Raycast disabled on core+halo; shell icosahedron remains the sole hit target → pointer behaviour byte-identical to v1.0"

patterns-established:
  - "radialSprite CanvasTexture util reused across nebula, starfield, and node halos"
  - "Multiply-at-the-end gain (CORE_GAIN) preserves all relative state modulation while brightening for bloom"

requirements-completed: [VIS-01, VIS-02, VIS-03, VIS-04, VIS-05]

# Metrics
duration: 20min
completed: 2026-07-06
---

# Phase 6: FFXIII Visual Fidelity Overhaul Summary

**The Crystarium was restyled into the real FFXIII look — luminous crystal orbs (white-hot cores, colored glow shells, soft halos) floating in a nebula/starfield void, wired by thin arced light-filaments, under a tighter, brighter bloom — with every v1.0 data encoding and interaction preserved byte-for-byte.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-06
- **Tasks:** 3 (backdrop / nodes / paths+bloom+composition)
- **Files created:** 3 · **Files modified:** 5

## Accomplishments
- **Backdrop:** deep-void cosmic scene — ~1200-point drifting starfield, four soft additive nebula clouds (violet/cyan/magenta/indigo), and FogExp2 depth falloff toward the rim. All backdrop layers are deliberately dim / fog-disabled so they never feed the bloom pass.
- **Nodes:** the matte icosahedra became 3-layer luminous orbs — a small white-lifted emissive **core** (the bloom carrier), a translucent additive-backside faceted **shell** (fresnel-ish rim), and a soft additive status-hued **halo** (~3×, breathes on pulse nodes). Compressed to ~50% global scale so they read as orbs in space.
- **Paths:** straight opaque tubes became gently-arced `QuadraticBezierCurve3` filaments (midpoint lifted along the dome normal), very thin (spine 0.03 / family 0.022 / beam 0.045), low additive opacity with a brighter travelling flow pulse; the gold→cyan fiscal-sponsor beam remains the signature element.
- **Bloom:** retuned to threshold 0.38 / intensity 1.35 / radius 0.65 / LARGE kernel — cores bloom hard, everything else stays crisp.
- **Composition:** camera pulled back with a gentle downward angle (default `0/16/38`, intro `0/28/58`) so the grid reads as a floating constellation; fog softens the rim.

## Encodings & interactions preserved (verified against source)
- hue = `statusHue`, scale ∝ amount ordering, the clock-free 3-node `node.pulse` deadline set, the `tokens.ts` activation ladder (lifted proportionally, not reordered).
- Hover lift + scale, one-at-a-time select activation burst, sibling dim/desaturate, filter dim + raycast-guard (inert filtered nodes), AEST-01 awakening reveal (rim→center, gold master lands last), auto-orbit, GSAP focus, `onpointermissed` deselect-all.
- Shell is the sole raycast target (core/halo raycast-disabled) → pointer semantics identical to v1.0.

## Task Commits

1. **Task 1: Cosmic backdrop** — `15c7f75` (feat)
2. **Task 2: 3-layer luminous node orbs** — `51d6a60` (feat)
3. **Task 3: Arced paths + retuned bloom + constellation framing** — `b65648e` (feat)
4. **Iteration 1: round crystal shells + halo/nebula micro-tunes** — `b7c386a` (fix)
5. **Iteration 2: invisible hit-proxy restores easy node picking** — `0b9ccb6` (fix)

## Files Created/Modified
- `src/lib/crystarium/gradients.js` — browser-only `radialSprite` CanvasTexture util (procedural glow, no image assets, no new deps)
- `src/lib/crystarium/Starfield.svelte` — ~1200 dim drifting points on a spherical shell, kept below bloom threshold
- `src/lib/crystarium/Nebula.svelte` — four large soft additive nebula-cloud sprites far behind the grid
- `src/lib/crystarium/CrystariumScene.svelte` — mounts backdrop layers + FogExp2 (indigo, density 0.011)
- `src/lib/crystarium/CrystalNode.svelte` — 3-layer orb rewrite; all encodings preserved via a single allocation-free useTask
- `src/lib/crystarium/CrystalPath.svelte` — arced thin light-filament tubes + brighter flow pulse
- `src/lib/crystarium/Effects.svelte` — bloom retune (0.38 / 1.35 / 0.65 / LARGE)
- `src/lib/crystarium/CameraRig.svelte` — constellation framing (pulled-back, downward angle)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Null-guarded 2D canvas context**
- **Found during:** Task 1 (svelte-check)
- **Issue:** `canvas.getContext('2d')` is typed `CanvasRenderingContext2D | null`; strict TS flagged three "possibly null" errors.
- **Fix:** added an explicit `if (!ctx) throw` guard in `radialSprite`.
- **Files modified:** `src/lib/crystarium/gradients.js`
- **Commit:** `15c7f75`

## Screenshot-Gate Iteration 1 (`b7c386a`)

Coordinator's live-deploy judgment: overhaul reads FFXIII (void/starfield/cores/filaments/composition all pass); one primary issue + two micro-tunes, fixed in `fix(06): round crystal shells + halo/nebula micro-tunes`:

**Primary — shells read as flat hexagonal plates.** Root causes and fixes in `CrystalNode.svelte`:
- Silhouette: icosahedron detail 0/1 at constellation distance = hexagon outline → detail **2** (active master **3**) rounds the silhouette while keeping crystal facets.
- Size: shell radius **1.0 → 0.55** (~1.3× the 0.42 core — a tight crystal skin, not a plate).
- Opacity/tint: `SHELL_OPACITY` **0.26 → 0.11** and blending switched to **Additive** — plain transparent blending over the void washed every shell toward pale blue regardless of status hue; additive guarantees the rim is genuinely status-tinted.
- Centering: core + shell are siblings at the same group origin — verified exactly centered (the "offset" read was the plate silhouette artifact).

**Micro-tunes:**
- Halo `HALO_SCALE` **3.0 → 3.45** (+15%) to preserve the orb-in-glow read with the smaller shell.
- Nebula violet/magenta/indigo opacities **+0.02–0.03** (0.13/0.09/0.10; cyan unchanged) for the dreamy colour wash — still far under the 0.38 bloom threshold.

Full regression gate re-run green after the fix commit.

## Screenshot-Gate Iteration 2 (`0b9ccb6`)

**UAT regression:** after iteration 1 the Playwright grid-sweep (`tools/uat-detail.mjs`) could no longer open the detail rail — shrinking the shell (then the sole raycast target) to r=0.55 made hit targets tiny from the pulled-back camera. Zero console errors; pure target-size issue.

**Fix (`CrystalNode.svelte`):** a generous INVISIBLE hit-proxy sphere per node (r=2.4, ~the halo footprint) is now the sole pointer/raycast target — `transparent opacity={0}` + `depthWrite:false` + `colorWrite:false`, with `visible` left true so the raycaster still intersects it (zero framebuffer contribution). Pointer handlers + the `matchesFilter` raycast-guard moved from the shell onto the proxy; core/shell/halo are all raycast-disabled. Visuals and handler semantics unchanged.

**Verified:** ran `uat-detail.mjs` against a locally-served BASE_PATH build (scratch `/Eman_dashboard`-prefixed static server) — detail rail opens on an early sweep click (hit 0.48/0.30), Esc-deselect closes it, zero console errors. Full regression gate green.

## Regression Gate (green after every commit)
- `pnpm exec vitest run` → **162 passed** (12 files)
- `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` → **exit 0**
- `node tools/verify-build.mjs` → **6/6 PASS**
- `pnpm run check` → **0 errors, 0 warnings**
- no `ssr = false`, no new dependencies, layout.js / tokens.ts / derive / runes bridge / intro API / HUD untouched

## Known Stubs
None — pure visual restyle; all data encodings and interactions are live and preserved.

## Screenshot-pass tuning notes (for the orchestrator)
- If cores look under-bloomed on the live GPU: raise `CORE_GAIN` (2.3→2.6) in `CrystalNode.svelte` or drop bloom `luminanceThreshold` (0.38→0.34) in `Effects.svelte`.
- If stars/nebula start blooming (twinkle/haze): lower `Starfield` `opacity` (0.5) / `PointsMaterial` color, or `Nebula` cloud opacities (0.06–0.11).
- Halo strength is `haloBase` (status-driven) × `HALO_SCALE` (3.45); nudge `HALO_SCALE` for a bigger glow footprint.
- Shell rim presence is `SHELL_OPACITY` (0.11, additive) × `SHELL_RADIUS` (0.55) — raise opacity toward 0.14 if the crystal skin disappears on the live GPU.
- Path visibility is `opacity` per kind + `flowRadius` multipliers in `CrystalPath.build()`; beam is intentionally the brightest/thickest.
- Void emptiness is `NODE_SCALE` (0.5) + camera `DEFAULT_POS` (0/16/38) + `FogExp2` density (0.011 in `CrystariumScene.svelte`).

## Self-Check: PASSED

All created files present on disk; all three task commits present in git history.
