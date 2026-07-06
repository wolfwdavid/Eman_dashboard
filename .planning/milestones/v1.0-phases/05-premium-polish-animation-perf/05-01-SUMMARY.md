---
phase: 05-premium-polish-animation-perf
plan: 01
subsystem: crystarium
tags: [animation, gsap, intro, threlte, aesthetics, perf]
requires:
  - Threlte scene (CrystariumScene/CrystalNode/CrystalPath/CameraRig) from Phase 03
  - crystarium.svelte.js runes bridge (ui.selected/hovered/cameraFocus/filter)
provides:
  - Client-only awakening intro controller (intro.svelte.js) — a GSAP-tweened revealProgress rune wavefront
  - Staggered rim->center node materialization keyed to a deterministic revealRank (gold origin master lands last)
  - Path draw-in gated on the wavefront tail (paths trace in after nodes)
  - Camera reveal->idle-orbit settle, interruptible on any pointer input
  - Tightened FFXIII-style activation burst (bloom/emissive spike + scale pop, <300ms)
affects:
  - src/lib/crystarium/*
tech-stack:
  added: []
  patterns:
    - "Single tweened scalar (revealProgress 0->1) as a shared 'wavefront' read per-node against a pure revealRank — no per-frame allocation, steady state (intro.done) byte-identical to pre-intro"
    - "Children-mount-before-parents timing handled via $effect that waits for intro.active to flip (not onMount)"
key-files:
  created:
    - src/lib/crystarium/intro.svelte.js
  modified:
    - src/lib/crystarium/CrystariumScene.svelte
    - src/lib/crystarium/CrystalNode.svelte
    - src/lib/crystarium/CrystalPath.svelte
    - src/lib/crystarium/CameraRig.svelte
decisions:
  - "Reveal ramp reformulated to reveal = clamp((p - rank*(1-W))/W) so rim (rank 0) fully lit at p~0.35 and the gold origin master (rank 1) lands LAST exactly at p=1 — spans the full timeline (plan's example finished the wave at p~0.52)"
  - "Camera intro driven by an $effect waiting on intro.active (not onMount) because Threlte children mount before the parent Scene calls startIntro; a remount where intro.done is already true snaps straight to the overview so the camera never sticks at INTRO_POS"
  - "Activation burst decay switched linear -> (1-u)^2 eased snap-and-settle; flash 0.9->1.0, pop 0.15->0.18, still within 300ms, uniform/transform only"
metrics:
  duration: 18 min
  tasks: 3
  files: 5
  completed: 2026-07-06
---

# Phase 5 Plan 01: Scene Intro + Activation Summary

Gave the Crystarium its AEST-01 "awakening": a single GSAP-tweened `revealProgress` wavefront ignites the 28 crystals rim->center (the gold secured master at the origin lands last), the connecting paths trace in on the wavefront's tail, and the camera eases from a pulled-back vantage into the idle auto-orbit — all inside a ~1.9s reveal (≤2.5s budget) and fully interruptible (any pointerdown snaps to the settled steady state). Also tightened the node-selection burst into an FFXIII crystal activation (emissive/bloom spike + scale pop, eased snap-and-settle under 300ms). Zero new deps, zero new per-frame allocations, SSR-safe prerender intact.

## What Was Built

**Task 1 — Intro controller + scene wiring (`intro.svelte.js` new, `CrystariumScene.svelte`)** — commit `d3ff0e8`
- New client-only runes singleton mirroring `crystarium.svelte.js`: `intro = $state({ revealProgress, active, done })` plus `startIntro()` (one idempotent GSAP tween 0->1 over ~1.9s power2.out, latches `done` on complete) and `skipIntro()` (kills the tween, snaps to settled). `gsap` is only imported here, reached solely through the browser-gated Canvas, so it never enters the SSR graph.
- Scene computes a pure `revealRank` Map once (sort by radial distance from origin descending -> `i/(n-1)`, so rank 0 = farthest rim, rank 1 = origin master), plumbs `revealRank` into each `<CrystalNode>`, starts the intro on mount, and registers a one-shot `window` `pointerdown -> skipIntro` interrupt (removed on destroy).

**Task 2 — Node materialization + activation polish + path draw-in (`CrystalNode.svelte`, `CrystalPath.svelte`)** — commit `4be504a`
- CrystalNode reads the shared wavefront against its rank with a windowed ramp (`reveal = clamp((p - rank*(1-W))/W)`, W=0.35) — scalar-only, no allocation — and gates `scale`, `emissiveIntensity`, and `opacity` by it. When `intro.done`, reveal is a hard 1 so the steady scene is byte-identical to before.
- Activation burst tightened: eased `(1-u)^2` snap-and-settle decay, flash bumped to 1.0 (the bloom-core spike — luminance-thresholded bloom blooms harder, Effects untouched) and scale pop to 0.18, still ≤300ms, transform/uniform only.
- CrystalPath adds `pathReveal = clamp((revealProgress - 0.6)/0.4)` (hard 1 when done) multiplied into both `tubeOpacity` and `flowOpacity`, so paths draw in on the wavefront tail — after the nodes. Geometry/kinds/flow-pulse math untouched.

**Task 3 — Camera reveal->settle + perf/build gate (`CameraRig.svelte`)** — commit `162fe78`
- Camera starts pulled back at `INTRO_POS {0,24,52}` with auto-orbit OFF; an `$effect` waiting on `intro.active` runs a ~1.6s power2.out reveal easing position+target to `DEFAULT_POS/DEFAULT_TARGET`, handing off to auto-orbit on complete.
- The `cameraFocus` selection effect early-returns while `intro.active` so `resetView()` never fights the reveal on mount; a second `$effect` snaps the camera to the overview if a mid-intro skip flips `intro.active` false before the tween settles; an already-settled remount snaps straight to the overview (no stuck `INTRO_POS`). Shared `tween` handle stays covered by the existing `onDestroy`.
- Perf pass confirmed: `dpr={[1,2]}` intact, bloom params (intensity 1.0 / luminanceThreshold 0.6 / radius 0.5 / mipmapBlur true) unchanged, no `new` inside any `useTask` tick.

## Deviations from Plan

### Tuning within plan latitude (not behavioral deviations)

**1. Reveal-ramp formula reformulated (Task 2)**
- The plan's example ramp (`(p*(1+W) - r*W)/W`) completes the entire wave at p~0.52, leaving half the timeline idle. Reformulated to `reveal = clamp((p - rank*(1-W))/W)` so the stagger spans the full 0->1 timeline and the gold origin master lands LAST exactly at p=1 — a strictly better satisfaction of the "gold center last" + ≤2.5s intent. The plan explicitly invited tuning ("tune constants so rim->center reads as a 30-50ms/node stagger").

**2. Camera intro triggered via $effect-on-`intro.active`, not `onMount` (Task 3)**
- The plan suggested running the intro camera tween in `onMount`. Threlte children mount BEFORE the parent Scene's `onMount` calls `startIntro()`, so at CameraRig mount `intro.active` is still false. Used an `$effect` that waits for `intro.active` to flip true (and handles the already-`done` remount case) — this is the plan's own suggested "$effect approach" for the skip path, extended to the start path for correctness. Same observable behavior, no timing race.

No other deviations; no auto-fixes required; no auth gates.

## Verification

- `pnpm test:unit` -> **162 passed** (the plan's "159" note was stale; baseline is 162 and no tests regressed).
- `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` -> exit 0, wrote site to `build/` (SSR-safe prerender, no window-is-not-defined).
- `pnpm run verify:build` -> **6/6 PASS** (title "Eman_dashboard" intact, base-path assets present, zero root-absolute `/_app/`).
- `pnpm run check` (svelte-check) -> **0 errors, 0 warnings**.
- No `ssr = false` introduced anywhere; intro is client-only post-mount.
- Bloom params + `dpr={[1,2]}` confirmed unchanged; no new per-frame allocations.

## Success Criteria

- [x] AEST-01: staggered rim->center node materialization (gold master last), paths draw in after nodes, camera reveal->idle-orbit settle, total ~1.9s (≤2.5s), interruptible on any pointer input.
- [x] Activation-on-select reads as an FFXIII crystal activation (bloom/emissive spike + scale pop, ≤300ms, uniform/transform only).
- [x] Zero prerender/SSR regression; zero new per-frame allocations; zero new dependencies.
- [x] Each task committed atomically (--no-verify, parallel executor); regression gate green at every task.

## Notes for the Verifier

- Live visual gate (intro plays then settles, skip-on-input, activation burst) is the orchestrator's Playwright pass — not scripted here.
- File scope was strictly `src/lib/crystarium/*` (parallel with 05-02 HUD fixes); no HUD / data / +page.svelte files touched.

## Self-Check: PASSED

- intro.svelte.js: FOUND
- 05-01-SUMMARY.md: FOUND
- Commits d3ff0e8, 4be504a, 162fe78: all FOUND
