---
phase: 04-hud-overlay-ui-fallback
plan: 01
subsystem: ui
tags: [layerchart, svelte-runes, threlte, pure-functions, vitest, filter, aggregates]

# Dependency graph
requires:
  - phase: 02-data-pipeline-custom-tools
    provides: grants.generated.json + tools/aggregates.mjs (rule source) + Grant types + qrCodes barrel
  - phase: 03-crystarium-scene
    provides: CrystalNode/CrystalPath/CrystariumScene + ui.selected/hovered runes bridge + tokens.ts
provides:
  - "layerchart@2.0.1 installed (charts dep for Wave-2)"
  - "src/lib/data/aggregates.ts — securedTotal/potentialTotal/countByStatus/by501c3/estimate/potentialContributors (browser SoT, computed by rule)"
  - "src/lib/data/filter.ts — matchesFilter/gateBucket/typeBucket + FilterState"
  - "src/lib/data/format.ts — formatAmount/formatDeadline(clock-injected)/gateBadge"
  - "widened ui.filter {status,gate,type} + setFilter/resetFilters (additive)"
  - "5 gate/chart CSS alias tokens in app.css"
  - "scene dims + raycast-guards filtered-out crystals; edges dim per-endpoint"
affects: [04-02-detail-panel, 04-03-pipeline-charts-filters-qr, 04-04-integration-mount-build-gate]

# Tech tracking
tech-stack:
  added: [layerchart@2.0.1]
  patterns:
    - "Pure data modules under src/lib/data/** (in existing vitest glob) as the single source of truth for HUD figures"
    - "One matchesFilter predicate shared by BOTH scene-dim and UI so they agree by construction"
    - "Clock-injected formatters (now param) for deterministic day-count tests"

key-files:
  created:
    - src/lib/data/aggregates.ts
    - src/lib/data/aggregates.test.ts
    - src/lib/data/filter.ts
    - src/lib/data/filter.test.ts
    - src/lib/data/format.ts
    - src/lib/data/format.test.ts
    - .planning/phases/04-hud-overlay-ui-fallback/04-01-SUMMARY.md
  modified:
    - package.json
    - pnpm-lock.yaml
    - vitest.config.ts
    - src/app.css
    - src/lib/state/crystarium.svelte.js
    - src/lib/crystarium/CrystalNode.svelte
    - src/lib/crystarium/CrystalPath.svelte
    - src/lib/crystarium/CrystariumScene.svelte

key-decisions:
  - "FilterState fields typed as plain string (values originate from DOM chips) — resolves svelte-check union friction with setFilter; allowed values documented in comments"
  - "Added $lib resolve alias to vitest.config.ts so data tests import the barrel ($lib/data) exactly as the app does (bare vitest has no SvelteKit plugin)"
  - "Filter-dim folded into the existing CrystalNode useTask (opacity + emissive x0.15) rather than a new task; nodes DIMMED never deleted so the funnel layout stays stable"
  - "Raycast disable = handler guard ('if (!matches) return') per 04-RESEARCH Open Q3 — no raycast-set surgery for 28 nodes"

patterns-established:
  - "Pattern: aggregates.ts is the browser TS twin of tools/aggregates.mjs; a parity test forbids numeric drift (20000/296500/Σ28)"
  - "Pattern: edge dims when EITHER endpoint filtered — computed in CrystariumScene, applied as uniform/opacity-only in CrystalPath"

requirements-completed: [DETL-02, PIPE-01, PIPE-02, PIPE-04, PIPE-05]

# Metrics
duration: 13min
completed: 2026-07-06
---

# Phase 4 Plan 01: Foundation — Deps, Pure State, Scene-Dim Summary

**Three tested pure data modules (aggregates/filter/format) computing every Phase-4 figure by rule, a widened three-axis ui.filter, and a scene that dims + raycast-guards filtered-out crystals — with layerchart@2.0.1 in place for Wave-2 charts.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-06T10:28:39Z
- **Completed:** 2026-07-06T10:41:35Z
- **Tasks:** 3
- **Files modified:** 14 (6 created data modules/tests + 8 modified)

## Accomplishments
- Installed `layerchart@2.0.1` (no new 3D deps; d3/LayerCake bundled transitively).
- Authored three PURE modules under `src/lib/data/` with 35 colocated assertions: `securedTotal`=20000, `potentialTotal`=296500 (9 contributors), `countByStatus` Σ28 (17/3/2/2/1/1/1/1), `by501c3` 12/8/8, `matchesFilter` (each axis + combined + zero-match), `formatAmount`/`formatDeadline`/`gateBadge` with `.raw` preserved and clock-injected day-count.
- Widened `ui.filter` from the string `'all'` to `{status,gate,type}` + `setFilter`/`resetFilters` — additive; `select`/`deselect`/`hover` untouched.
- Added 5 gate/chart display alias tokens to `app.css` (aliases of existing hues).
- Wired the scene: non-matching crystals fade (opacity →0.3, emissive ×0.15) and are raycast-guarded; connecting edges dim when either endpoint is filtered; nodes are never removed so the funnel layout is stable.
- Full suite 159/159 green; base-path build + verify-build 6/6; svelte-check 0 errors.

## Task Commits

Each task committed atomically:

1. **Task 1: Install layerchart, widen ui.filter, add gate/chart CSS tokens** — `492c86e` (feat)
2. **Task 2: Author the three pure data modules + colocated vitest tests** — `91ff1d1` (feat, TDD RED→GREEN in one commit)
3. **Task 3: Wire scene filter-dim + raycast-guard from matchesFilter** — `9175167` (feat)

_Note: Task 2 tests were written first and confirmed RED (module + alias resolution failures) before the GREEN implementation; committed as a single feat since Task 2 is one atomic unit._

## Files Created/Modified
- `src/lib/data/aggregates.ts` — pure selectors (browser twin of tools/aggregates.mjs)
- `src/lib/data/filter.ts` — matchesFilter predicate + gateBucket/typeBucket + FilterState
- `src/lib/data/format.ts` — formatAmount/formatDeadline/gateBadge display helpers
- `src/lib/data/{aggregates,filter,format}.test.ts` — 35 assertions keyed to real grant strings
- `vitest.config.ts` — added `$lib` resolve alias
- `src/app.css` — 5 gate/chart alias tokens
- `src/lib/state/crystarium.svelte.js` — widened ui.filter + setFilter/resetFilters
- `src/lib/crystarium/CrystalNode.svelte` — filter-dim + raycast-guard folded into useTask
- `src/lib/crystarium/CrystalPath.svelte` — `dim` prop fades tube/flow opacity
- `src/lib/crystarium/CrystariumScene.svelte` — per-edge dim from both endpoints
- `package.json` / `pnpm-lock.yaml` — layerchart@2.0.1

## Decisions Made
- Typed `FilterState` axes as plain `string` (values come from DOM chips) rather than narrow unions — the honest contract and eliminates `setFilter` union friction. Allowed values documented in comments.
- Added a `$lib` alias to `vitest.config.ts` so data tests can import the `$lib/data` barrel as the plan specified (bare vitest has no SvelteKit plugin).
- Filter-dim folded into the existing `useTask` and edges dimmed via a `dim` prop — uniform/opacity-only, layout never shifts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `$lib` resolve alias to vitest.config.ts**
- **Found during:** Task 2 (writing the pure-module tests)
- **Issue:** The plan specifies tests import `{ grants }` from `$lib/data`, but the bare `vitest.config.ts` has no SvelteKit plugin, so `$lib` did not resolve — all three test files errored with "Cannot find module '$lib/data'".
- **Fix:** Added `resolve.alias.$lib → ./src/lib` in `vitest.config.ts`. This is an additive config change (the `include` glob was untouched, per 04-RESEARCH).
- **Files modified:** vitest.config.ts
- **Verification:** `pnpm exec vitest run src/lib/data` → 35/35 pass; full suite 159/159.
- **Committed in:** `91ff1d1` (Task 2 commit)

**2. [Rule 3 - Blocking] Widened FilterState fields to `string`**
- **Found during:** Task 3 (svelte-check after scene wiring)
- **Issue:** `matchesFilter` originally typed `gate`/`type` as narrow unions, but `ui.filter` is typed with plain-string axes (setFilter accepts arbitrary DOM strings). svelte-check raised 3 assignment errors in CrystalNode + CrystariumScene.
- **Fix:** Widened `FilterState` gate/type to `string` (allowed values documented in comments) in both `filter.ts` and the runes-file typedef. No casts needed.
- **Files modified:** src/lib/data/filter.ts, src/lib/state/crystarium.svelte.js
- **Verification:** `pnpm check` → 0 errors, 0 warnings; data tests still 35/35 (type-only change).
- **Committed in:** `9175167` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking, type/test-infra)
**Impact on plan:** Both fixes were required to honor the plan's own import contract (`$lib/data`) and to keep svelte-check clean. No behavioral or numeric change; no scope creep.

## Issues Encountered
- None beyond the two blocking-fixes above. All plan numbers (20000/296500/Σ28/12-8-8) verified exactly as specified.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave-2 UI (Detail Panel, Pipeline charts, Filter bar, QR) can bind purely to these tested contracts: `formatAmount`/`formatDeadline`/`gateBadge` for DETL-02, `countByStatus`/`securedTotal`/`potentialTotal`/`by501c3` for PIPE-01/02/04, `matchesFilter` + `setFilter`/`resetFilters` for PIPE-05.
- `layerchart@2.0.1` is installed and ready; charts are client-rendered SVG (do NOT gate the build on chart SVG — Pitfall 1).
- Scene already reflects `ui.filter` (dim + guard), so the Wave-2 FilterBar just calls `setFilter`/`resetFilters`.

## Self-Check: PASSED

All 6 pure-module files + SUMMARY.md exist on disk; all 3 task commits (492c86e, 91ff1d1, 9175167) present in git history.

---
*Phase: 04-hud-overlay-ui-fallback*
*Completed: 2026-07-06*
