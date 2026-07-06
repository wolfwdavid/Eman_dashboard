---
phase: 04-hud-overlay-ui-fallback
plan: 02
subsystem: ui
tags: [svelte5, runes, detail-panel, glassmorphism, svelte-transition, hud]

# Dependency graph
requires:
  - phase: 04-01 (foundation-deps-pure-state-scenedim)
    provides: format.ts (formatAmount/formatDeadline/gateBadge), widened ui.filter, crystarium runes bridge
  - phase: 02 (data-pipeline)
    provides: Grant type model, grants.generated.json barrel ($lib/data)
  - phase: 03 (crystarium-scene)
    provides: ui.selected/deselect bridge, --status-* / glass tokens (app.css)
provides:
  - Right-edge slide-in grant Detail Panel (src/lib/hud/DetailPanel.svelte)
  - All 9 Grant fields surfaced; Amount/Deadline human-readable + raw subtext
  - Next Action CTA banner + external funder link (new tab)
  - Panel open/close motion (fly) + Esc→deselect wiring
affects: [04-04 integration-mount, 04-05 interactive-uat, RESL fallback (reuses display helpers)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "$derived record lookup off ui.selected → panel content only exists {#if grant} (no empty shell)"
    - "svelte/transition fly with cubicOut enter (220ms) / cubicIn exit (150ms) — exit faster than enter"
    - "tone→token maps in <script> keep all color flowing through declared CSS vars (no raw hex)"
    - "node hue passed as --node-hue custom prop → header accent, pill, CTA hairline, link all echo one status hue"

key-files:
  created:
    - src/lib/hud/DetailPanel.svelte
  modified: []

key-decisions:
  - "Consumed the REAL format.ts API (tone / sponsorHint) rather than the plan prose's loose token/hint names — sponsorHint=true renders the gold 'NY Community Trust may sponsor' line"
  - "color-mix(in srgb, var(--node-hue) N%, transparent) for pill/badge/link tints keeps token discipline (no new hex, no new alpha tokens)"
  - "Esc handled on <svelte:window>; background-click close deferred to the scene layer (04-04) per UI-SPEC"

patterns-established:
  - "Detail rail = position:fixed right edge, z-30, pointer-events:auto only on itself (no full-viewport catch layer that would eat canvas raycast)"

requirements-completed: [DETL-01, DETL-02, DETL-03]

# Metrics
duration: 9min
completed: 2026-07-06
---

# Phase 4 Plan 02: Detail Panel Summary

**Right-edge slide-in glass rail that opens on `ui.selected`, surfaces all 9 Grant fields (Amount/Deadline human-readable + raw subtext via format.ts), a status pill echoing the node hue, a 501(c)(3) gate badge with fiscal-sponsor hint, the loudest Next Action CTA banner, and a new-tab funder link — fly in 220ms / out 150ms, Esc closes.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-06T10:47:39Z
- **Completed:** 2026-07-06T10:57:15Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments
- `DetailPanel.svelte` — z-30 right-edge glass rail (blur 16px), opens when `ui.selected` is set, `{#if grant}` so no empty shell renders when null.
- Header echoes the selected crystal: 12×12 rotated-diamond hue swatch + node-hue top hairline + funder title (Orbitron 20/600) + program subtitle + `×` deselect.
- Rows 1–6: STATUS pill, TYPE badge (Investment flagged "Equity — not a grant"), AMOUNT (Orbitron 32/600, tone-colored) + raw subtext, DEADLINE chip + raw subtext, 501(C)(3) gate badge + gold sponsor hint, FIT/ELIGIBILITY prose — all via the tested `format.ts` helpers.
- Row 7 NEXT ACTION: the loudest element — full-width tinted CTA banner with node-hue hairline (null → muted "No action queued."), 48px (2xl) top rhythm.
- Row 8: "Open funder site ↗" link (`target="_blank" rel="noopener noreferrer"`), hue-tinted, brightens on hover.
- Motion: `fly` enter 220ms cubicOut / exit 150ms cubicIn (exit faster than enter); Esc via `<svelte:window>` calls `deselect()`.

## Task Commits

Each task was committed atomically (--no-verify, parallel execution):

1. **Task 1: Panel shell + header + field rows 1-6** - `3ca7f77` (feat)
2. **Task 2: Next Action CTA banner + funder link + fly motion + Esc** - `eda3627` (feat)

**Plan metadata:** (final docs commit below)

## Files Created/Modified
- `src/lib/hud/DetailPanel.svelte` - Right-edge slide-in grant detail rail (z-30); reads `ui.selected`, looks up the record from `$lib/data` grants, shapes Amount/Deadline/gate via `format.ts`, calls `deselect()` on ×/Esc.

## Decisions Made
- Used the actual `format.ts` return shapes: `formatAmount`→`tone: gold|muted|hi`, `formatDeadline`→`tone: urgent|in-progress|declined|lo|hi`, `gateBadge`→`{ label, tone, sponsorHint }`. Mapped each tone to a declared CSS var in the `<script>` so no raw hex enters the component. The plan prose's `g501.token`/`g501.hint` were illustrative; the real API is `tone`/`sponsorHint`.
- `color-mix(in srgb, var(--node-hue) N%, transparent)` for pill/type/gate/link tints — reuses the single node hue, no new palette or alpha tokens.
- Esc closes via `<svelte:window onkeydown>`; background-click close is intentionally left to the scene layer in Plan 04-04 (per UI-SPEC interaction contract).

## Deviations from Plan

None - plan executed exactly as written. (The tone/sponsorHint API usage matches the shipped `format.ts` from 04-01; the plan's `token`/`hint` naming was loose prose, not a contract change.)

## Issues Encountered
None. `pnpm check` (svelte-check) reports 0 errors / 0 warnings across 1532 files; `pnpm test:unit` green (159 tests, 12 files).

## Known Stubs
None — the panel is fully data-wired to `ui.selected` + `$lib/data`. It is not yet mounted into `+page.svelte`; that integration is Plan 04-04's scope (deliberate, not a stub).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DetailPanel is standalone-compiling and ready for Plan 04-04 to mount into `+page.svelte` alongside the scene + other overlay panels.
- Interactive drill-down (select crystal → rail slides in) is verified manually at the Plan 04-05 checkpoint.

## Self-Check: PASSED

- FOUND: src/lib/hud/DetailPanel.svelte
- FOUND: .planning/phases/04-hud-overlay-ui-fallback/04-02-SUMMARY.md
- FOUND commits: 3ca7f77, eda3627

---
*Phase: 04-hud-overlay-ui-fallback*
*Completed: 2026-07-06*
