---
phase: 04-hud-overlay-ui-fallback
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/lib/hud/charts/StatusChart.svelte
  - src/lib/hud/charts/SecuredVsPotential.svelte
  - src/lib/hud/charts/DeadlineTimeline.svelte
  - src/lib/hud/charts/GateSplit.svelte
  - src/lib/hud/FilterBar.svelte
  - src/lib/hud/PipelineDrawer.svelte
  - src/lib/hud/QrPanel.svelte
autonomous: true
requirements: [PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, QRUI-01, QRUI-02]
must_haves:
  truths:
    - "Chart A shows status distribution (8 status-hue bars, counts 17/3/2/2/1/1/1/1 Σ28)"
    - "Chart B shows Secured $20,000 (gold) vs Potential $296,500 (cool) two-bar"
    - "Chart C shows deadline timeline ordered by urgency; <30d = urgent, passed = ash"
    - "Chart D shows 501(c)(3) split Open 12 / Gated 8 / Unknown 8 as a stacked bar"
    - "Filter bar (status chips + gate/type segments) writes ui.filter via setFilter/resetFilters"
    - "Pipeline drawer is a bottom-center collapsible, collapsed by default"
    - "QR panel renders both qrCodes[].svg tiles on white plates with labels + config-swap note"
  artifacts:
    - path: "src/lib/hud/charts/StatusChart.svelte"
      provides: "LayerChart BarChart A — status distribution, per-status hue"
      contains: "BarChart"
    - path: "src/lib/hud/PipelineDrawer.svelte"
      provides: "collapsible bottom drawer hosting FilterBar + 2×2 chart grid"
      min_lines: 40
    - path: "src/lib/hud/FilterBar.svelte"
      provides: "3-axis filter controls → setFilter/resetFilters"
      contains: "setFilter"
    - path: "src/lib/hud/QrPanel.svelte"
      provides: "two {@html qrCodes[].svg} tiles on white plates"
      contains: "@html"
  key_links:
    - from: "src/lib/hud/charts/StatusChart.svelte"
      to: "src/lib/data/aggregates.ts"
      via: "countByStatus(grants) drives bar data"
      pattern: "countByStatus"
    - from: "src/lib/hud/FilterBar.svelte"
      to: "src/lib/state/crystarium.svelte.js"
      via: "setFilter(axis,val) / resetFilters()"
      pattern: "setFilter|resetFilters"
    - from: "src/lib/hud/QrPanel.svelte"
      to: "src/lib/data/qr.generated.js"
      via: "import { qrCodes } from '$lib/data'"
      pattern: "qrCodes"
---

<objective>
Build the Pipeline Overview (4 LayerChart charts in a collapsible bottom drawer), the 3-axis Filter bar that drives `ui.filter`, and the QR panel — all consuming the Plan 04-01 selectors and the runes bridge. Every figure routes through the tested aggregates; every fill traces to a declared token.

Purpose: Let the user re-read the whole pipeline at a glance and re-highlight the grid, without ever obscuring the Crystarium (collapsed-by-default drawer, corner QR widget).
Output: `charts/{StatusChart,SecuredVsPotential,DeadlineTimeline,GateSplit}.svelte`, `FilterBar.svelte`, `PipelineDrawer.svelte`, `QrPanel.svelte` (mounted by Plan 04-04).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/04-hud-overlay-ui-fallback/04-CONTEXT.md
@.planning/phases/04-hud-overlay-ui-fallback/04-UI-SPEC.md
@.planning/phases/04-hud-overlay-ui-fallback/04-RESEARCH.md

# Contracts (read — do NOT re-explore):
@src/lib/data/types.ts
@src/lib/data/index.ts
@src/lib/config/sites.js
@src/lib/hud/PipelineReadout.svelte

<interfaces>
<!-- Plan 04-01 selectors — USE these, never hardcode chart numbers -->
import { countByStatus, by501c3, securedTotal, potentialTotal } from '$lib/data/aggregates';
import { grants, qrCodes } from '$lib/data';   // qrCodes: { id, label, url, svg }[]
import { ui, setFilter, resetFilters } from '$lib/state/crystarium.svelte.js';

<!-- LayerChart 2.0.1 VERIFIED API (import by name from 'layerchart') -->
<BarChart {data} x="count" y="status" orientation="horizontal" c="status" cRange={[...]} labels legend height={...} />
props={{ xAxis, yAxis, grid, tooltip, labels, legend, points, bars }}  // passthrough escape hatch
series: { key, label?, color? }[]  +  seriesLayout="stack"   // for Chart D single stacked bar
ScatterChart auto-selects a time scale when x yields Date objects
{#snippet aboveMarks({ context })}...{/snippet}  // clean overlay for bespoke SVG (sponsor tick / urgent ring)
Container measures WIDTH via client clientWidth → give an explicit height; marks paint AFTER hydration (ssr default false) — this is FINE.

<!-- EXACT status enum keys (hyphenated) for var(--status-${key}) -->
active | in-progress | to-research | recurring | applied | declined | not-eligible | not-eligible-yet
<!-- gate tokens (added in 04-01): --gate-open --gate-gated --gate-unknown --chart-potential --grid-line --secured-gold --urgent -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Four LayerChart chart components (A status, B secured/potential, C timeline, D gate split)</name>
  <files>src/lib/hud/charts/StatusChart.svelte, src/lib/hud/charts/SecuredVsPotential.svelte, src/lib/hud/charts/DeadlineTimeline.svelte, src/lib/hud/charts/GateSplit.svelte</files>
  <read_first>04-RESEARCH.md §Pattern 5 (VERIFIED LayerChart snippets — copy verbatim) + §Common Pitfalls 1 & 3, 04-UI-SPEC.md §Pipeline Overview chart table</read_first>
  <action>
    Create four chart components under `src/lib/hud/charts/`. Import LayerChart components by name from `'layerchart'`. Every number comes from the 04-01 selectors (NEVER a literal); every color is a CSS var (NO raw hex). Give each chart an explicit `height`.

    A) `StatusChart.svelte` (PIPE-01) — horizontal bar, per-status hue. Copy 04-RESEARCH §Pattern 5 Chart A verbatim:
       ```svelte
       import { BarChart } from 'layerchart';
       import { countByStatus } from '$lib/data/aggregates';
       import { grants } from '$lib/data';
       const order = ['to-research','in-progress','recurring','not-eligible-yet','active','applied','declined','not-eligible']; // funnel order
       const c = countByStatus(grants);
       const data = order.map(s => ({ status: s, count: c[s] ?? 0 }));
       ```
       `<BarChart {data} x="count" y="status" orientation="horizontal" c="status" cRange={order.map(s => `var(--status-${s})`)} labels legend={false} height={220} />`. Chart title "STATUS" (Orbitron 20/600). If the per-bar legend renders poorly (Open Q1), fall back to modeling each status as a one-item `series` — 30-min spike, don't over-invest.

    B) `SecuredVsPotential.svelte` (PIPE-02) — two bars. Copy §Pattern 5 Chart B:
       ```svelte
       import { securedTotal, potentialTotal } from '$lib/data/aggregates';
       const data = [
         { k: 'Secured',   v: securedTotal(grants) },   // 20000
         { k: 'Potential', v: potentialTotal(grants) }  // 296500
       ];
       ```
       `<BarChart {data} x="k" y="v" c="k" cRange={['var(--secured-gold)','var(--chart-potential)']} labels height={200} />`. Direct-label the two figures ($20,000 gold / $296,500 cool). Tabular numerals.

    C) `DeadlineTimeline.svelte` (PIPE-03) — ScatterChart time scale, ordered by urgency. Copy §Pattern 5 Chart C:
       ```svelte
       import { ScatterChart } from 'layerchart';
       const dated = grants.filter(g => g.deadline.date)
         .map(g => ({ date: new Date(g.deadline.date), funder: g.funder, status: g.status, passed: g.deadline.isPassed }))
         .sort((a,b) => +a.date - +b.date);  // Harry S. Black 2026-06-30, Ford 2026-09-01, Ben & Jerry's 2027-02-18, Hey Helen 2025-12-30(passed)
       ```
       `<ScatterChart data={dated} x="date" y="funder" c="status" props={{ xAxis: { format: 'day' } }} height={220} />`. Markers colored by status hue; `<30d` marker ring = `--urgent`, passed = `--status-declined` via a `{#snippet aboveMarks}` overlay or `props.points`. Add a compact "Rolling / Annual / Invitation" caption row beneath for the non-dated cadences (Open Q2) — do not invent x-positions for them.

    D) `GateSplit.svelte` (PIPE-04) — single 100%-stacked segmented bar. Copy §Pattern 5 Chart D:
       ```svelte
       const c = by501c3(grants); // { no:12, yes:8, unknown:8 }
       const data = [{ label: '501(c)(3)', open: c.no, gated: c.yes, unknown: c.unknown }];
       ```
       `<BarChart {data} y="label" orientation="horizontal" seriesLayout="stack" series={[{ key:'open', label:'Open now', color:'var(--gate-open)' },{ key:'gated', label:'Gated', color:'var(--gate-gated)' },{ key:'unknown', label:'Unknown', color:'var(--gate-unknown)' }]} legend labels height={120} />`. OPTIONAL: a thin `--secured-gold` beam-tick for the 5 fiscal-sponsor-eligible rows inside the Gated segment via `{#snippet aboveMarks({ context })}` (echoes the Phase-3 beam) — nice-to-have, not blocking.

    Shared: subtle gridlines via `props={{ grid: ... }}` using `--grid-line`; tooltip-on-interact (funder + figure). Do NOT set `ssr` true (not needed; drawer is collapsed by default). Chart titles Orbitron 20/600; axis/legend/labels Inter 12–14/400 tabular.
  </action>
  <verify>
    <automated>for f in StatusChart SecuredVsPotential DeadlineTimeline GateSplit; do test -f src/lib/hud/charts/$f.svelte || exit 1; done && grep -q "countByStatus" src/lib/hud/charts/StatusChart.svelte && grep -q "securedTotal" src/lib/hud/charts/SecuredVsPotential.svelte && grep -q "ScatterChart" src/lib/hud/charts/DeadlineTimeline.svelte && grep -q "seriesLayout" src/lib/hud/charts/GateSplit.svelte && grep -q "by501c3" src/lib/hud/charts/GateSplit.svelte && ! grep -REn "#[0-9a-fA-F]{6}" src/lib/hud/charts/ && pnpm check</automated>
  </verify>
  <done>Four chart components exist, each driven by a 04-01 selector (no literal counts), colored only via CSS vars (grep finds no raw hex in charts/), status keys exact/hyphenated; `pnpm check` passes.</done>
</task>

<task type="auto">
  <name>Task 2: Filter bar (3 axes → ui.filter) + collapsible Pipeline drawer</name>
  <files>src/lib/hud/FilterBar.svelte, src/lib/hud/PipelineDrawer.svelte</files>
  <read_first>04-UI-SPEC.md §Filter Controls + §Pipeline Overview (drawer) + §Motion (drawer 240/180ms), src/lib/state/crystarium.svelte.js</read_first>
  <action>
    `FilterBar.svelte` (PIPE-05) — three axes, each writing the structured filter, ALWAYS visible (even when the drawer is collapsed):
    ```svelte
    import { ui, setFilter, resetFilters } from '$lib/state/crystarium.svelte.js';
    ```
      - Status: chip row (single-isolate) — "All" + the 8 statuses; each chip = 12×12 hue swatch (`var(--status-{s})`) + label + count (from `countByStatus`). Click → `setFilter('status', s)` ('all' for the All chip). Active chip = full hue fill; inactive = swatch + `--text-lo` label on glass.
      - 501(c)(3): segmented control All / Open / Gated / Unknown → `setFilter('gate', v)` (values 'all'|'open'|'gated'|'unknown').
      - Type: segmented control All / Grant / Fellowship / Investment → `setFilter('type', v)` (values 'all'|'Grant'|'Fellowship'|'Investment').
      - `Reset` clears all → `resetFilters()`. Active axis reads from `ui.filter.{status,gate,type}` for the active-state styling.
      - Chip/segment transitions 120ms color/opacity only (no transform).
      - Zero-match empty state hint text "No funders match these filters." + a `Reset filters` action (the drawer/charts show this when the active combo matches nothing — compute via `grants.filter(g => matchesFilter(g, ui.filter)).length === 0`).
    `PipelineDrawer.svelte` (PIPE-01..05 host) — bottom-center glass drawer, `position: fixed`, z-index 20, `pointer-events: auto`, COLLAPSED BY DEFAULT (local `let open = $state(false)`). Collapsed shows the drawer handle (`▲ PIPELINE OVERVIEW`) + `<FilterBar />` always visible. Expanding slides up a 2×2 chart grid (gap xl/32px) hosting `<StatusChart/> <SecuredVsPotential/> <DeadlineTimeline/> <GateSplit/>`. Drawer title "PIPELINE OVERVIEW" Orbitron 20/600. Motion: `translateY` up + opacity 240ms enter / 180ms exit (svelte `slide`/`fly`, transform/opacity only). Handle toggles `open` (its own local state, NOT ui). Glass recipe inherited (blur 16px). Responsive: full-width below 640px.
  </action>
  <verify>
    <automated>test -f src/lib/hud/FilterBar.svelte && test -f src/lib/hud/PipelineDrawer.svelte && grep -q "setFilter" src/lib/hud/FilterBar.svelte && grep -q "resetFilters" src/lib/hud/FilterBar.svelte && grep -q "No funders match these filters" src/lib/hud/FilterBar.svelte && grep -q "PIPELINE OVERVIEW" src/lib/hud/PipelineDrawer.svelte && grep -q "FilterBar" src/lib/hud/PipelineDrawer.svelte && grep -q "StatusChart" src/lib/hud/PipelineDrawer.svelte && pnpm check</automated>
  </verify>
  <done>FilterBar writes all 3 axes via setFilter/resetFilters, reads active state from ui.filter, shows zero-match message; PipelineDrawer is collapsed-by-default, hosts FilterBar + the four charts, title "PIPELINE OVERVIEW"; `pnpm check` passes.</done>
</task>

<task type="auto">
  <name>Task 3: QR panel — two {@html} tiles on white plates + config-swap note</name>
  <files>src/lib/hud/QrPanel.svelte</files>
  <read_first>04-UI-SPEC.md §QR Panel, 04-RESEARCH §Code Examples (QR tile) + §Pitfall 5, src/lib/config/sites.js, src/lib/data/index.ts</read_first>
  <action>
    Create `src/lib/hud/QrPanel.svelte` (QRUI-01/02). Bottom-right toggle widget (the free corner), `position: fixed`, z-index 30, `pointer-events: auto`. A small glass button `SHARE ◹` (Orbitron 14) toggles a LOCAL `let open = $state(false)` (NOT the shared ui). Expanded → glass panel titled `SHARE` (Orbitron 20/600) holding two QR tiles side by side (gap xl/32px):
    ```svelte
    import { qrCodes } from '$lib/data';   // [{ id, label, url, svg }, …] build-time inline SVG
    {#each qrCodes as qr (qr.id)}
      <figure class="qr-tile">
        <div class="plate">{@html qr.svg}</div>   <!-- trusted build-time SVG (Pitfall 5: no user input) -->
        <figcaption>{qr.label}</figcaption>
        <small class="url">{qr.url}</small>
      </figure>
    {/each}
    ```
    Each tile: WHITE plate (rounded, md/16px padding, the intentional one white surface for QR scannability) clamped 112–160px square holding the inline SVG; label below = `qr.label` (renders "Visit DID" / "Support / Tracker") Inter 14/400 `--text-hi`; URL hint `qr.url` Inter 12/400 `--text-lo`, truncated with ellipsis.
    Add a small in-UI config-swap note (QRUI-02): text that the two URLs live in `src/lib/config/sites.js` and re-running `node tools/generate-qr.mjs` (or `pnpm build`) regenerates them with zero component change. The component imports `qrCodes` and needs NO edit on swap.
    Toggle motion: scale + opacity from the button (transform-origin bottom-right), 200ms enter / 140ms exit. The `support` tile is a REPLACE-ME placeholder URL — it still renders; the swap happens at config time, not in the component.
  </action>
  <verify>
    <automated>test -f src/lib/hud/QrPanel.svelte && grep -q "qrCodes" src/lib/hud/QrPanel.svelte && grep -q "@html" src/lib/hud/QrPanel.svelte && grep -q "SHARE" src/lib/hud/QrPanel.svelte && grep -qi "sites.js" src/lib/hud/QrPanel.svelte && pnpm check</automated>
  </verify>
  <done>QrPanel toggles a local SHARE widget rendering both qrCodes tiles via {@html} on white plates with label + url hint + config-swap note; imports qrCodes from $lib/data; `pnpm check` passes.</done>
</task>

</tasks>

<verification>
- `pnpm check` (svelte-check) clean across all 7 new components.
- grep: charts driven by selectors (countByStatus/securedTotal/potentialTotal/by501c3), no raw hex in charts/, FilterBar wires setFilter/resetFilters, QrPanel uses {@html qrCodes}.
- Chart RENDER + tooltips are client-hydrated SVG → verified manually in Plan 04-05 (do NOT grep build/index.html for chart SVG — known trap).
</verification>

<success_criteria>
- Charts A/B/C/D render the verified numbers via selectors, status/gate hues 1:1 with the Legend (PIPE-01..04).
- Filter bar segments all 3 axes into ui.filter with a Reset + zero-match message (PIPE-05).
- Pipeline drawer collapsed by default, never obscures the scene.
- QR panel renders both tiles on white plates with the config-swap note (QRUI-01/02).
</success_criteria>

<output>
After completion, create `.planning/phases/04-hud-overlay-ui-fallback/04-03-SUMMARY.md`
</output>
