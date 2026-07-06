---
phase: 03-3d-crystarium-scene
plan: 04
subsystem: crystarium
tags: [threlte, three, webgl, postprocessing, bloom, gsap, camera, svelte5-runes, ssr-safe]

# Dependency graph
requires:
  - phase: 03-01
    provides: three/threlte/postprocessing/gsap deps, vite ssr.noExternal['postprocessing'], tokens.ts (path/beamCore/beamTip/urgent/secured/bg numeric hex)
  - phase: 03-02
    provides: PURE computeLayout(grants) → {nodes, edges, center} with edge.kind spine|family|beam, node.pulse (3), node.beamTarget (4)
  - phase: 03-03
    provides: browser-gated <Canvas autoRender={false}>, runes ui{selected,hovered,cameraFocus}, CrystalNode base material, interactivity(), temp render task (now removed)
provides:
  - CrystalPath.svelte — one edge renderer for spine/family/beam (additive emissive tubes; beam is a gold→cyan vertex gradient with a travelling core→target flow pulse)
  - CameraRig.svelte — OrbitControls auto-orbit idle + GSAP focus-on-select (~600ms enter / ~250ms exit) reacting to ui.cameraFocus
  - Effects.svelte — postprocessing EffectComposer + BloomEffect as the SINGLE render authority (autoRender=false + renderStage, autoInvalidate=false)
  - CrystalNode deadline pulse (3 nodes only) + hover (lift/scale/+emissive) + select (activation burst + siblings dim ×0.35 + desaturate)
affects: [Phase-4-detail-panel, Phase-4-filters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "postprocessing EffectComposer as the single render authority: autoRender.set(false) + useTask({stage: renderStage, autoInvalidate:false}) — supersedes the 03-03 temporary render task (Pitfall C resolved)"
    - "GSAP timeline tweening controls.object.position + controls.target with tween.kill() on every new selection (no stacked focuses); autoRotate toggled off on focus, back on after the exit tween completes"
    - "Beam gradient via per-vertex colours on a TubeGeometry (core→tip lerp keyed on tubular index) + vertexColors MeshBasicMaterial, additive, toneMapped=false so the beam blooms"
    - "Deadline pulse membership is the clock-free node.pulse set; a live Date read drives ONLY the cosmetic amplitude/frequency band (never membership)"
    - "Emissive/scale/lift modulation via material-property + mesh-transform mutation inside ONE useTask (no per-frame object churn); prop reads kept in closures/$derived to hold svelte-check 0/0"

key-files:
  created:
    - src/lib/crystarium/CrystalPath.svelte
    - src/lib/crystarium/CameraRig.svelte
    - src/lib/crystarium/Effects.svelte
  modified:
    - src/lib/crystarium/CrystalNode.svelte
    - src/lib/crystarium/CrystariumScene.svelte

key-decisions:
  - "Beam gradient done with vertex colours on the tube (not a shader) — cheapest gold→cyan that still blooms via toneMapped=false; a bright travelling sphere gives the charging core→target motion"
  - "Sibling desaturate implemented as an emissive lerp toward ash (0x565d75) alongside the ×0.35 intensity dim, so the selected node's bloom clearly sits above its neighbours"
  - "State intensity is smoothed toward per-frame targets while the deadline pulse is applied instantaneously ON TOP, so smoothing never attenuates the pulse oscillation"
  - "Kept luminance-thresholded BloomEffect (threshold 0.6) rather than layer-based SelectiveBloom — the dim steel-blue to-research frontier already stays crisp (03-RESEARCH Open Question 3 recommendation)"

patterns-established:
  - "Pattern: CrystalPath.build() closure captures immutable edge/from/to props once → geometry built a single time, component-instance scope free of non-reactive prop reads"
  - "Pattern: CrystalNode seeds animation state (baseColor/curIntensity/curScale) on the first task tick inside the closure, keeping the top-level scope reactive-clean"

requirements-completed: [CRYS-05, CRYS-06, CRYS-07, CRYS-08]

# Metrics
duration: 25min
completed: 2026-07-05
---

# Phase 3 Plan 04: Paths, Camera, Bloom & Interactions Summary

**The Crystarium gains its legibility and signature glow: spine/family/fiscal-sponsor-beam paths render, the camera auto-orbits and GSAP-springs to a selected node (siblings dim), exactly the 3 qualifying nodes deadline-pulse, and a postprocessing bloom composer — now the single render authority — makes the emissive crystals and gold→cyan beam glow, all while `pnpm build` still prerenders cleanly.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-05
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- **CrystalPath** renders all three edge kinds from `computeLayout`: the progression **spine**, the Ford/BofA **family** bridges (thinner, fainter, no flow), and the **fiscal-sponsor BEAM** to the 4 gated funders — a thickest, gold→cyan vertex-gradient tube with a bright travelling pulse charging core→target.
- **CameraRig** idle auto-orbits the dome (`OrbitControls autoRotate`), and on `ui.cameraFocus` GSAP-springs the camera to frame the node (~600ms enter, power3.out) then eases back to overview on deselect (~250ms — exit faster than enter); tweens are killed before each new focus so rapid selections never stack.
- **Effects** wires the postprocessing `EffectComposer` + `BloomEffect` (threshold 0.6, radius 0.5, mipmapBlur) and takes over rendering via `autoRender.set(false)` + `useTask({stage: renderStage, autoInvalidate:false})` — becoming the single render authority. The 03-03 **temporary render task was removed** from the Scene; the scene renders through the composer (not black).
- **CrystalNode** now overlays three signals in one `useTask`: the **deadline pulse** on exactly the 3 `node.pulse` nodes (additive `--urgent` coral, amplitude/frequency by proximity band; passed/rolling/declined/ineligible never pulse), **hover** (+Y lift, ×1.08 scale, +0.2 emissive), and **select** (one-shot activation burst + scale pop; every other node dims ×0.35 and desaturates so the focus blooms above siblings).
- `pnpm build` (BASE_PATH) prerenders cleanly with bloom/postprocessing in the graph; `verify-build.mjs` 6/6; `<title>` keeps "Eman_dashboard"; svelte-check 0/0; 31 crystarium layout tests still green.

## Task Commits

1. **Task 1: CrystalPath edges + GSAP CameraRig** - `fc7e3dd` (feat)
2. **Task 2: SelectiveBloom composer + deadline pulse + hover/select states** - `3961e4e` (feat)

## Files Created/Modified
- `src/lib/crystarium/CrystalPath.svelte` - one edge renderer (spine/family/beam); beam gold→cyan vertex gradient + travelling flow pulse
- `src/lib/crystarium/CameraRig.svelte` - PerspectiveCamera + OrbitControls auto-orbit + GSAP focus-on-`ui.cameraFocus` (enter 600ms / exit 250ms)
- `src/lib/crystarium/Effects.svelte` - postprocessing EffectComposer + BloomEffect; single render authority (autoRender=false + renderStage)
- `src/lib/crystarium/CrystalNode.svelte` - added pulse/hover/select emissive+transform modulation in one useTask
- `src/lib/crystarium/CrystariumScene.svelte` - wires CameraRig + one CrystalPath per edge + Effects; removed the temporary render task and temp camera

## Decisions Made
- **Vertex-colour beam gradient (not a shader):** cheapest gold→cyan that still blooms (`toneMapped=false`), with a bright travelling sphere for the charging core→target motion.
- **Bloom-above-siblings via desaturate + dim:** selected node keeps full emissive while others lerp toward ash and drop to ×0.35 intensity, carrying the primary/secondary hierarchy through bloom.
- **Pulse applied instantaneously over smoothed state:** state intensity eases toward targets, but the deadline oscillation is added on top each frame so smoothing never damps it.
- **Luminance-thresholded BloomEffect kept over layer-based SelectiveBloom:** threshold 0.6 already keeps the dim frontier crisp (03-RESEARCH Open Question 3); escalation deferred to polish if needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Warning debt] Restored svelte-check to 0/0 after new prop reads warned**
- **Found during:** Task 2 (svelte-check gate)
- **Issue:** Reading immutable `grant`/`node`/`edge`/`from`/`to` props in top-level `const`s produced 12 `state_referenced_locally` warnings + 1 `non_reactive_update` (`beamGeometry`), regressing the 0/0 baseline the prior plan (03-03) established.
- **Fix:** Moved prop-dependent geometry into a `build()` closure in CrystalPath (single `const cfg = build()`), converted CrystalNode's hue/intensity/roughness/detail to `$derived`, and seeded animation state (baseColor/curIntensity/curScale) on the first task tick inside the closure. Behaviour-preserving.
- **Files modified:** src/lib/crystarium/CrystalPath.svelte, src/lib/crystarium/CrystalNode.svelte
- **Verification:** svelte-check 0 errors / 0 warnings; build + verify-build 6/6; 31 layout tests still green.
- **Committed in:** `3961e4e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (warning-debt). No scope creep; no Phase-4 consumers built.
**Impact on plan:** Necessary to hold the plan's "svelte-check clean" success criterion.

## Issues Encountered
- Under `checkJs`/strict Svelte 5, capturing immutable props in top-level consts is flagged even when semantically safe — resolved with the `build()`-closure + `$derived` + first-tick-seed patterns above.

## Known Stubs
None. All three edge kinds, the camera, bloom, pulse, and hover/select states are wired to live layout/runes data — no placeholder or empty-data paths remain. The runes `select`/`hover`/`cameraFocus` writes still have no DOM consumer (DetailPanel/filters) — that is Phase 4 by design, not a stub.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 can consume `ui.selected` / `ui.hovered` / `ui.cameraFocus` (all now actively written by the scene) to drive the DetailPanel, filters, and QR panel.
- The render authority is settled (Effects composer); any future post FX should be added as additional passes in `Effects.svelte`, not new render tasks.
- Manual visual pass (VALIDATION.md manual set) is the remaining gate: confirm spine+family+beam render, camera springs on select, only the 3 nodes pulse, hover≠select, bloom is the signature glow.

## Self-Check: PASSED

All 3 created files + SUMMARY present on disk; both task commits (`fc7e3dd`, `3961e4e`) exist in git history. Build prerenders (BASE_PATH), verify-build 6/6, svelte-check 0/0, 31 crystarium tests green.

---
*Phase: 03-3d-crystarium-scene*
*Completed: 2026-07-05*
