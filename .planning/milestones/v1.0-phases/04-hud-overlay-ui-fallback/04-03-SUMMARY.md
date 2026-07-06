---
phase: 04-hud-overlay-ui-fallback
plan: 03
subsystem: ui
tags: [layerchart, svelte-runes, charts, filter, qr, glassmorphism, svelte-transition]

# Dependency graph
requires:
  - phase: 04-01-foundation-deps-pure-state-scenedim
    provides: layerchart@2.0.1 + aggregates.ts (countByStatus/securedTotal/potentialTotal/by501c3) + filter.ts (matchesFilter) + widened ui.filter{status,gate,type} + setFilter/resetFilters + gate/chart CSS alias tokens
  - phase: 02-data-pipeline-custom-tools
    provides: grants.generated.json + qrCodes barrel ($lib/data) + sites.js config
  - phase: 03-crystarium-scene
    provides: glass HUD recipe (PipelineReadout/Legend) + status-hue tokens
provides:
  - "4 LayerChart charts: StatusChart (A, status distribution), SecuredVsPotential (B), DeadlineTimeline (C, ScatterChart time scale), GateSplit (D, stacked)"
  - "FilterBar.svelte — 3-axis (status chips / gate + type segments) writing ui.filter via setFilter/resetFilters, with zero-match empty state"
  - "PipelineDrawer.svelte — bottom-center collapsible glass drawer (collapsed by default) hosting FilterBar + 2x2 chart grid"
  - "QrPanel.svelte — bottom-right SHARE toggle rendering both qrCodes {@html} tiles on white plates + config-swap note"
affects: [04-04-integration-mount-build-gate, 04-05-interactive-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LayerChart simplified charts (BarChart/ScatterChart) themed exclusively via CSS-var cRange/series[].color + cDomain-pinned category→token maps"
    - "Chart figures derive from tested aggregates selectors (never literals); every fill traces to a declared token (no raw hex in charts)"
    - "Corner-anchored discrete position:fixed glass panels with per-panel pointer-events (no full-viewport catch layer)"

key-files:
  created:
    - src/lib/hud/charts/StatusChart.svelte
    - src/lib/hud/charts/SecuredVsPotential.svelte
    - src/lib/hud/charts/DeadlineTimeline.svelte
    - src/lib/hud/charts/GateSplit.svelte
    - src/lib/hud/FilterBar.svelte
    - src/lib/hud/PipelineDrawer.svelte
    - src/lib/hud/QrPanel.svelte
  modified: []

key-decisions:
  - "Chart C markers coloured by a deterministic URGENCY bucket (passed→ash, <30d→urgent, ≤90d→in-progress, else path) via cDomain/cRange instead of a fragile aboveMarks overlay — satisfies the '<30d urgent, passed ash' contract with zero context-scale math"
  - "Chart B exact figures ($20,000 gold / $296,500 cool) direct-labelled in a dedicated value row beneath the plot, guaranteeing correct tone + tabular format regardless of in-bar label formatting"
  - "cDomain pins every category→token mapping so a bar can never lose its hue to data-order drift (04-RESEARCH Pitfall 3)"
  - "White QR plate uses the `white` CSS keyword (not a hex literal) to keep the no-raw-hex discipline while honouring the documented scannability exception"

patterns-established:
  - "Chart component = <figure> with Orbitron-20 title + <div class=plot> wrapper giving explicit height and Inter/tabular text context to the SVG"
  - "Gridlines themed via props={{ grid: { stroke: 'var(--grid-line)' } }} passthrough"
  - "Local component $state for open/collapse toggles (drawer, QR) — never the shared ui runes"

requirements-completed: [PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, QRUI-01, QRUI-02]

# Metrics
duration: 20min
completed: 2026-07-06
---

# Phase 4 Plan 3: Pipeline Charts, Filters & QR Summary

**Four token-themed LayerChart 2.0.1 charts (status / secured-vs-potential / deadline-timeline / 501c3-split) in a collapsed-by-default glass drawer, a 3-axis FilterBar wired to `ui.filter`, and a bottom-right QR share panel — every figure routed through the tested aggregates, every fill through a declared CSS token.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-06T10:54:33Z
- **Completed:** 2026-07-06T11:05:00Z
- **Tasks:** 3
- **Files modified:** 7 created

## Accomplishments
- Four LayerChart charts driven entirely by the Plan 04-01 selectors (`countByStatus` Σ28, `securedTotal` $20,000, `potentialTotal` $296,500, `by501c3` 12/8/8) — no hardcoded chart numbers, no raw hex.
- FilterBar segments all three axes (status chips with hue swatch + count, 501c3 + type segmented controls) into `ui.filter` via `setFilter`/`resetFilters`, reads active state back, and surfaces the zero-match empty state + Reset action.
- PipelineDrawer is a bottom-center glass drawer collapsed by default, hosting the always-visible FilterBar and a 2×2 chart grid that slides up (240ms enter / 180ms exit) — never obscures the Crystarium.
- QrPanel renders both `qrCodes[].svg` tiles via `{@html}` on white scannability plates with labels + truncated URLs + the QRUI-02 config-swap note (edit `sites.js`, re-run `generate-qr.mjs`).
- `pnpm check`: 0 errors / 0 warnings across all 7 new components; full vitest suite 159/159 green.

## Task Commits

1. **Task 1: Four LayerChart chart components** - `530a2cd` (feat)
2. **Task 2: FilterBar + collapsible PipelineDrawer** - `a0cbe49` (feat)
3. **Task 3: QrPanel with white-plate {@html} tiles** - `0d183ca` (feat)

## Files Created/Modified
- `src/lib/hud/charts/StatusChart.svelte` - Chart A: horizontal bar, 8 status-hue fills from `countByStatus`, cDomain-pinned tokens, direct labels.
- `src/lib/hud/charts/SecuredVsPotential.svelte` - Chart B: two-bar from `securedTotal`/`potentialTotal` + gold/cool direct-label value row.
- `src/lib/hud/charts/DeadlineTimeline.svelte` - Chart C: ScatterChart time scale over dated grants, urgency-bucket colours + non-dated cadence caption.
- `src/lib/hud/charts/GateSplit.svelte` - Chart D: single horizontal stacked bar Open/Gated/Unknown from `by501c3` + fiscal-sponsor caption.
- `src/lib/hud/FilterBar.svelte` - 3-axis filter controls → `setFilter`/`resetFilters`; zero-match hint.
- `src/lib/hud/PipelineDrawer.svelte` - Bottom-center collapsible glass drawer hosting FilterBar + the four charts.
- `src/lib/hud/QrPanel.svelte` - Bottom-right SHARE toggle → two white-plate QR tiles + config-swap note.

## Decisions Made
- **Chart C urgency-bucket colouring** over a bespoke `aboveMarks` ring overlay: colours markers deterministically (`passed`→`--status-declined`, `<30d`→`--urgent`, `≤90d`→`--status-in-progress`, else `--path`) via `cDomain`/`cRange`. This satisfies the "<30d = urgent, passed = ash" must-have without depending on the internal chart context/scale API — robust and svelte-check-clean. The gold urgency ring and Chart-D gold beam-tick overlays were explicit nice-to-haves and are surfaced as captions instead of fragile SVG marks (see Known Stubs — intentional, non-blocking).
- **Chart B figure row**: the exact $20,000 (gold) / $296,500 (cool) are direct-labelled in a dedicated value row beneath the plot so copywriting + tone + tabular format are guaranteed regardless of LayerChart's in-bar label formatting.
- **`white` keyword for QR plates**: honours the documented one-white-surface scannability exception while keeping the no-raw-hex discipline that the charts grep enforces.

## Deviations from Plan

None requiring auto-fix rules. Two plan-sanctioned micro-scope choices (both within "Claude's discretion — chart micro-styling"):
- Chart C: urgency-bucket colour scale instead of status-hue base + urgent ring overlay (see Decisions).
- Chart D: fiscal-sponsor beam-tick rendered as a caption line rather than an in-segment SVG overlay (plan marked it OPTIONAL / nice-to-have).

**Impact on plan:** None — all seven required components ship, all must-have truths met, no scope creep.

## Known Stubs

- **Chart C urgent ring / Chart D gold beam-tick (bespoke SVG overlays)** — intentionally deferred nice-to-haves (plan: "not blocking", Open Q2/Q3). The information they'd convey (urgency, fiscal-sponsor count) is instead surfaced via deterministic marker colours (C) and a caption line (D). No data is missing; these are cosmetic embellishments only. Resolve in Phase 5 / v2 if desired.
- **QR `support` tile URL** is the `REPLACE-ME` placeholder from `sites.js` — this is config data, not a code stub. The tile renders; swapping is a config-time edit per QRUI-02 (documented in-panel).

## Issues Encountered
- svelte-check flagged an a11y warning (`<figcaption>` must be first/last child of `<figure>`) in QrPanel — resolved by wrapping the label + URL inside a single `<figcaption>`, yielding 0 warnings.

## User Setup Required
None - no external service configuration required. (QR `support` URL swap is optional config, not setup.)

## Next Phase Readiness
- All seven components compile standalone and are NOT yet mounted — Plan 04-04 integrates them into `+page.svelte` and runs the build gate.
- Charts are client-hydrated SVG (drawer collapsed by default); do NOT gate the build on chart SVG content (04-RESEARCH Pitfall 1). Manual chart/tooltip verification lands in Plan 04-05 UAT.

## Self-Check: PASSED

All 7 components + SUMMARY.md exist on disk; all 3 task commits (`530a2cd`, `a0cbe49`, `0d183ca`) present in git history. `pnpm check` 0/0; vitest 159/159.

---
*Phase: 04-hud-overlay-ui-fallback*
*Completed: 2026-07-06*
