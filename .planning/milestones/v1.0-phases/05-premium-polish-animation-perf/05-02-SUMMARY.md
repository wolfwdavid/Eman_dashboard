---
phase: 05-premium-polish-animation-perf
plan: 02
subsystem: hud-overlay
tags: [hud, polish, aesthetics, detail-panel, filter-bar, tokens]
requires:
  - format.ts pure helpers (formatAmount/formatDeadline)
  - ui runes bridge (crystarium.svelte.js)
provides:
  - rawRedundant predicate (duplicate-subtext guard, reusable)
  - PipelineReadout auto-hide while detail rail is open
  - PipelineDrawer 60vh expanded cap
  - FilterBar hover+press parity (chips/segments/reset)
affects:
  - src/lib/hud/DetailPanel.svelte
  - src/lib/hud/PipelineReadout.svelte
  - src/lib/hud/PipelineDrawer.svelte
  - src/lib/hud/FilterBar.svelte
tech-stack:
  added: []
  patterns:
    - "Pure trim-equal predicate for subtext dedupe (unit-tested, generic over deadline/amount)"
    - "class:hidden={ui.selected !== null} + opacity/translateX exit for prerender-safe auto-hide"
    - "max-height:60vh + overflow-y:auto on inner .grid, keeping slide overflow:hidden on outer .charts"
    - ":active press = translateY(1px) + color-mix token tint (no new tokens)"
key-files:
  created: []
  modified:
    - src/lib/data/format.ts
    - src/lib/data/format.test.ts
    - src/lib/hud/DetailPanel.svelte
    - src/lib/hud/PipelineReadout.svelte
    - src/lib/hud/PipelineDrawer.svelte
    - src/lib/hud/FilterBar.svelte
decisions:
  - "rawRedundant kept generic (text/raw) so the same guard covers both AMOUNT and DEADLINE subtext"
  - "Drawer cap applied to inner .grid (not .charts) so the svelte slide transition (height-based, overflow:hidden) stays intact while scroll lives under the 60vh cap"
  - "PipelineReadout hidden via CSS class toggle (not {#if}) so opacity/transform exit animates and SSR still emits the visible readout for first paint"
metrics:
  duration: 16min
  tasks: 3
  files: 6
  completed: 2026-07-06
---

# Phase 5 Plan 2: HUD Fixes & Tightening Summary

Landed the three carried Phase-4 UAT collisions and tightened the glassmorphism HUD (AEST-02) entirely within the existing token/motion system — no new deps, no a11y additions, no v2 scope.

## What Was Built

**Task 1 — Duplicate deadline/amount subtext (04-05 note 2)**
- Added pure `rawRedundant(text, raw): boolean` to `format.ts` (trim-insensitive equality). Generic so it guards both subtext rows.
- 3 unit cases (identical → true, differing → false, whitespace-only → true). Suite now 162 (was 159).
- `DetailPanel.svelte` wraps both the AMOUNT and DEADLINE `<span class="subtext">` in `{#if !rawRedundant(...)}`. When `raw` genuinely differs (DETL-02 contract), both lines still render.

**Task 2 — Detail rail ↔ PipelineReadout collision (04-05 note 1)**
- `PipelineReadout.svelte` imports the `ui` runes bridge (plain module, no Three → prerender-safe; SSR sees `selected:null` → readout visible for first paint).
- `class:hidden={ui.selected !== null}` on `.panel`; `.panel.hidden` fades `opacity:0` + `translateX(12px)` within an `opacity/transform 180ms` transition. Returns on deselect.

**Task 3 — Drawer covers SceneTitle (04-05 note 3) + HUD tightening**
- `PipelineDrawer.svelte`: `.grid` capped at `max-height:60vh; overflow-y:auto` so the expanded drawer never eclipses the SceneTitle/scene. The slide reveal stays on the outer `.charts` (`overflow:hidden`) so the transition is untouched.
- `FilterBar.svelte`: added `:active` press feedback (`translateY(1px)` + subtle `color-mix` token tint) to `.chip`, `.seg`, `.reset`, and extended each transition list with `transform 120ms` — hover+press parity within the 150ms discipline. Radii/hairlines unchanged (already consistent: 999px chips, 10px segments/reset, 1px `--surface-glass-border`).

## Regression Gate (per task)

| Gate | Result |
|------|--------|
| `pnpm test:unit` | 162 passed (159 baseline + 3 new rawRedundant) |
| `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` | exit 0 |
| `pnpm run verify:build` | 6/6 PASS |
| `pnpm run check` (svelte-check) | 0 errors / 0 warnings |
| `ssr=false` introduced | none |

## Deviations from Plan

None — plan executed exactly as written. The plan's "pick the cleaner of the two" latitude on the drawer cap was resolved by capping the inner `.grid` (keeps the slide transition intact), which the plan explicitly allowed.

## Parallel-Execution Note

Ran as the parallel executor alongside plan 05-01 (scene intro). Touched only `src/lib/hud/*` + `src/lib/data/format.ts`/`format.test.ts` — zero overlap with 05-01's scope (`intro.svelte.js`, `CrystariumScene`, `CrystalNode`, `CrystalPath`, `CameraRig`, `+page.svelte`). All commits used `--no-verify`.

## Commits

- `148c5fb` fix(05-02): suppress duplicate raw subtext in DetailPanel
- `cea0131` fix(05-02): auto-hide PipelineReadout while detail rail is open
- `90512ff` fix(05-02): cap expanded drawer at 60vh + FilterBar press states

## Verification Note

Final live visual gate (rail-no-overlap, deadline-no-duplicate, drawer-capped, hover/press) is performed by the orchestrator via Playwright — not a task in this plan.

## Known Stubs

None.

## Self-Check: PASSED

All 6 modified files present on disk; all 3 task commits (148c5fb, cea0131, 90512ff) present in git history.
