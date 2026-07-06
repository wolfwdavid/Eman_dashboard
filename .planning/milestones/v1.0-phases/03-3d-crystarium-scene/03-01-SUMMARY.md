---
phase: 03-3d-crystarium-scene
plan: 01
subsystem: infra
tags: [threlte, three, postprocessing, gsap, vite, vitest, sveltekit, tokens]

# Dependency graph
requires:
  - phase: 02-data-ingest
    provides: GrantStatus union in src/lib/data/types.ts (token maps are exhaustive over it)
provides:
  - Pinned 3D/bloom/animation dependency set (three 0.185.1, @threlte/core 8.5.16, @threlte/extras 9.21.0, postprocessing 6.39.2, gsap 3.15.0, @types/three 0.185.0)
  - vite.config ssr.noExternal postprocessing (prerender resolution fix)
  - vitest include extended to src/lib/crystarium/**/*.test.{js,ts}
  - Threlte.UserProps extends InteractivityProps (typed pointer events)
  - src/lib/crystarium/tokens.ts — numeric-hex statusHue + activation maps + signal/path/beam/bg tokens
affects: [03-02-pure-layout-module, 03-03-scene-canvas-nodes-hud, 03-04-paths-camera-bloom-interactions]

# Tech tracking
tech-stack:
  added: ["three@0.185.1 (pinned)", "@threlte/core@8.5.16", "@threlte/extras@9.21.0", "postprocessing@6.39.2", "gsap@3.15.0", "@types/three@0.185.0"]
  patterns: ["numeric-hex token module mirrors UI-SPEC CSS tokens for Three materials (no raw hex in components)", "postprocessing kept in SSR bundle via ssr.noExternal for prerender"]

key-files:
  created: [src/lib/crystarium/tokens.ts, src/lib/crystarium/tokens.test.ts]
  modified: [package.json, pnpm-lock.yaml, vite.config.ts, vitest.config.ts, src/app.d.ts]

key-decisions:
  - "three pinned to exact 0.185.1 (no caret) — postprocessing 6.39.2 peer ceiling is <0.186"
  - "postprocessing added to ssr.noExternal so prerender can resolve the ESM (Phase-3 Pitfall B)"
  - "tokens.ts is the numeric-hex source of truth for Three materials; UI-SPEC CSS @theme block stays the DOM/HUD twin"

patterns-established:
  - "Token discipline: Three.js materials import statusHue/activation from tokens.ts instead of carrying raw hex literals"
  - "Crystarium tests live under src/lib/crystarium/**/*.test.{js,ts} (now in the vitest include glob)"

requirements-completed: [CRYS-01, CRYS-03]

# Metrics
duration: 11min
completed: 2026-07-05
---

# Phase 3 Plan 01: Foundation — Deps, Config & Tokens Summary

**Installed the pinned Threlte 8 / three 0.185.1 / postprocessing / GSAP stack, applied the two SvelteKit build gotchas (postprocessing `noExternal`, crystarium vitest glob) plus typed Threlte pointer events, and shipped a tested `tokens.ts` numeric-hex colour/activation contract exhaustive over all 8 GrantStatus values.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-05T03:13:38Z
- **Completed:** 2026-07-05T03:24:45Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- 3D/bloom/animation deps installed at researched-verified versions; `three` pinned exactly `0.185.1` (postprocessing peer ceiling `<0.186`); no `layerchart` added (Phase 4).
- `vite.config.ts` now sets `ssr: { noExternal: ['postprocessing'] }` — prerender resolves the postprocessing ESM instead of externalizing and failing (Pitfall B).
- `vitest.config.ts` include extended with `src/lib/crystarium/**/*.test.{js,ts}` (existing tools + data globs preserved) — Phase-3 tests now run.
- `src/app.d.ts` declares `Threlte.UserProps extends InteractivityProps` so `onclick`/`onpointerenter` on `<T.Mesh>` type-check in later plans.
- `tokens.ts` exports `statusHue` + `activation` (both exhaustive over the 8 GrantStatus values) + `secured/urgent/path/beamCore/beamTip/bg/bgGlow`, all mirroring the exact UI-SPEC hexes; TDD-covered by 6 passing assertions.
- Full base-path build (`BASE_PATH=/Eman_dashboard pnpm build`) succeeds and `verify-build.mjs` passes all 6 deploy invariants; full unit suite green (99 tests / 7 files).

## Task Commits

Each task was committed atomically:

1. **Task 1: Install pinned 3D deps + apply build gotchas + typed pointer events** - `38f0ee9` (chore)
2. **Task 2: tokens.ts token contract (TDD)** - `71ad62d` (test, RED) → `d83d72e` (feat, GREEN)

**Plan metadata:** _(final docs commit — see below)_

_Note: Task 2 followed TDD — failing test committed first, then implementation. No refactor commit needed (implementation was clean)._

## Files Created/Modified
- `package.json` / `pnpm-lock.yaml` - added the 5 runtime deps (three pinned) + `@types/three` dev dep
- `vite.config.ts` - `ssr.noExternal: ['postprocessing']`; preserved tailwindcss()-before-sveltekit() order
- `vitest.config.ts` - extended `include` with the crystarium test glob (existing globs kept)
- `src/app.d.ts` - `Threlte.UserProps extends InteractivityProps`
- `src/lib/crystarium/tokens.ts` - numeric-hex statusHue + activation maps + signal/path/beam/bg tokens
- `src/lib/crystarium/tokens.test.ts` - 6 assertions locking the exact UI-SPEC hexes + activation levels

## Decisions Made
- Pinned `three` to the exact `0.185.1` (no caret) to guarantee the postprocessing `<0.186` peer ceiling holds across future installs.
- Kept `tokens.ts` as the single numeric-hex source of truth for Three materials; the UI-SPEC `@theme` CSS tokens remain the parallel DOM/HUD representation (both must stay in lock-step).

## Deviations from Plan

None - plan executed exactly as written. (Verification steps used the plan's own `grep`/node assertions plus the phase's documented Windows build invocation `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard`.)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Deps + config foundation is in place; `03-02-pure-layout-module` can now build `src/lib/crystarium/layout.js` and its tests run via the new vitest glob.
- `tokens.ts` is ready for consumption by crystal materials and the legend in `03-03`.
- No blockers.

## Self-Check: PASSED

- FOUND: src/lib/crystarium/tokens.ts
- FOUND: src/lib/crystarium/tokens.test.ts
- FOUND: .planning/phases/03-3d-crystarium-scene/03-01-SUMMARY.md
- FOUND commits: 38f0ee9, 71ad62d, d83d72e

---
*Phase: 03-3d-crystarium-scene*
*Completed: 2026-07-05*
