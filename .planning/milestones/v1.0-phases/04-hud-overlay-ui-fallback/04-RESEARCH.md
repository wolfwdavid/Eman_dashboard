# Phase 4: HUD / Overlay UI + Fallback - Research

**Researched:** 2026-07-06
**Domain:** 2D DOM dashboard (detail panel, LayerChart analytics, filters, QR) layered over a fixed Threlte WebGL canvas, driven by a Svelte-5 runes bridge; fully-static (adapter-static / GitHub Pages)
**Confidence:** HIGH (LayerChart 2.0.1 API verified against the actual shipped npm tarball type definitions; all data numbers verified against `grants.generated.json`; runes/scene patterns read from live source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Design contract is canonical `04-UI-SPEC.md`** (ui-ux-pro-max), which **EXTENDS `03-UI-SPEC.md` verbatim** — same hex tokens (`src/lib/crystarium/tokens.ts` + `src/app.css`), glass `blur(16px)`, Orbitron display + Inter body, 4 type sizes / 2 weights, 8pt spacing, transform/opacity/uniform-only motion, tabular numerals, one-primary-focus. The overlay must feel like the SAME product as the scene.
- **Layer model (critical):** discrete `position: fixed` panels — **NO full-viewport catch layer** (it would kill the canvas raycast). z-layers: canvas `0` → ambient Phase-3 HUD `10` (`pointer-events:none`) → interactive controls `20` → Detail/QR panels `30`. Corners: Title TL, Pipeline readout TR, Legend BL (inherited P3); Detail Panel = right-edge slide-in rail (~380px); Pipeline Overview = bottom-center collapsible drawer (collapsed by default); QR = bottom-right toggle widget.
- **Detail Panel (DETL-01/02/03):** all 9 `Grant` fields; type "Investment" flagged "Equity — not a grant"; normalized Amount human-readable **WITH `.raw` subtext**; normalized Deadline **+ `.raw`**; 501c3 gate badge + NY Community Trust sponsor hint on fiscal-sponsor funders; fit/eligibility; status pill echoing node hue; **Next Action = loudest CTA banner**; external Link "Open funder site ↗" (`target=_blank rel=noopener noreferrer`). Nothing-selected → panel closed.
- **Pipeline Overview + Filters (PIPE-01..05) — LayerChart 2.0.1 (add dep):**
  - Chart A: status distribution horizontal bar (8 status-hue fills; counts 17/3/2/2/1/1/1/1 = 28).
  - Chart B: secured $20,000 (gold) vs potential $296,500 (cool) two-bar.
  - Chart C: deadline timeline ordered by urgency (`<30d` = `--urgent`, passed = ash).
  - Chart D: 501c3 segmented bar Open 12 / Gated 8 / Unknown 8 (gold beam-tick on the 5 sponsor-eligible).
  - Filters (status / 501c3 gate / type) drive `ui.filter`. Filters **DIM (not delete)** non-matching nodes and **disable their raycast**; funnel/layout stays stable.
  - Charts use the SAME status-hue tokens as the nodes; legend-visible, direct-labeling, tooltip-on-interact, subtle gridlines.
- **Required state change:** widen `ui.filter` in `src/lib/state/crystarium.svelte.js` from a string (`'all'`) to `{ status, gate, type }` + add `setFilter`/`resetFilters`. Scene reads it to dim/disable non-matching nodes. Phase-3 scene must still consume `ui.selected`/`ui.hovered` unchanged.
- **QR panel (QRUI-01/02):** two `{@html qrCodes[].svg}` tiles on white "scannability plates" with labels, from `src/lib/data/qr.generated.js`. URLs swappable via `src/lib/config/sites.js` (regen, zero component change).
- **Aggregates hygiene:** expose an aggregates selector from `$lib/data` (single source of truth) computing counts/totals from `grants` at runtime, NOT hardcoded. `securedTotal` MUST be $20,000; `potentialTotal` $296,500.
- Add dep: `layerchart@2.0.1` (+ any peer). Do **NOT** add new 3D deps.

### Claude's Discretion
- Exact panel dimensions, chart micro-styling, drawer animation specifics, the WebGL-probe fallback shape — within the UI-SPEC.

### Deferred Ideas (OUT OF SCOPE)
- Full WCAG accessibility (out of scope this build — checker MUST NOT penalize missing a11y).
- Rich immersion (sound, particles) — Phase 5 / v2.
- Expanded analytics beyond the 4 core charts — v2 (ANLY-01).
- Robust non-WebGL fallback (RESL-01) — v2; only a **minimal** WebGL probe → 2D list this phase **if time permits**, and it must NOT block DETL/PIPE/QRUI.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DETL-01 | Selecting a node opens a detail view of all that funder's fields | §Detail panel field mapping; runes bridge already exposes `ui.selected` + `select()`/`deselect()` (unchanged) |
| DETL-02 | Normalized Amount + Deadline shown human-readable alongside the raw value | §Pure formatters (`formatAmount`, `formatDeadline`) — verified rule tables over the 28 real records; `.raw` always shown as subtext |
| DETL-03 | Next Action as a CTA; external Link opens funder site in a new tab | §Detail panel — `nextAction` banner (null→muted), `<a href={grant.link} target="_blank" rel="noopener noreferrer">` |
| PIPE-01 | Overview totals by status | §Chart A (LayerChart horizontal `BarChart`) + `countByStatus` selector (17/3/2/2/1/1/1/1 Σ28) |
| PIPE-02 | Funding secured vs. potential | §Chart B (2-bar `BarChart`) + `securedTotal`=20000 / `potentialTotal`=296500 selectors |
| PIPE-03 | Upcoming deadlines on a timeline ordered by urgency | §Chart C (LayerChart `ScatterChart`/time-scale) + verified dates (Harry S. Black 2026-06-30, Ford 2026-09-01, Ben & Jerry's 2027-02-18, Hey Helen passed) |
| PIPE-04 | 501(c)(3)-gated vs. open split | §Chart D (single stacked `BarChart`) + `by501c3` (no 12 / yes 8 / unknown 8 Σ28); 5 fiscal-sponsor rows verified |
| PIPE-05 | Filter/segment by status, 501(c)(3), type | §`matchesFilter` pure predicate + widened `ui.filter` + scene dim/raycast-disable in `CrystalNode.svelte` |
| QRUI-01 | QR panel renders scannable codes for two URLs | §QR render — `{@html qrCodes[i].svg}` (build-time inline SVG, already generated) |
| QRUI-02 | Two URLs swappable via a single config module | `src/lib/config/sites.js` → `node tools/generate-qr.mjs` → `qr.generated.js`; component imports `qrCodes`, zero change |
| RESL-01 | Non-WebGL 2D fallback (v2, OPTIONAL) | §Minimal WebGL-probe fallback — probe in `onMount`, render 2D list whose rows call `select(id)` |
</phase_requirements>

## Summary

Phase 4 is almost entirely **DOM + pure-data** work layered over an already-shipped, SSR-safe Threlte scene. The heavy lift is not the 3D — it is (1) a small, verifiable set of **pure functions** (an aggregates selector, a `matchesFilter` predicate, and amount/deadline/gate formatters) and (2) wiring four tiny **LayerChart 2.0.1** charts plus a glass overlay that respects a strict pointer-events/z-index layer model so it never eats the canvas raycast.

LayerChart 2.0.1 is **verified Svelte-5-native** (peer `svelte ^5.0.0`, confirmed from the shipped tarball) and ships high-level "simplified chart" components — `BarChart`, `ScatterChart`, `LineChart`, `AreaChart`, `PieChart` — importable by name from `'layerchart'`. All four required charts map cleanly onto `BarChart` (A horizontal, B two-bar, D single stacked) and `ScatterChart`/time-scale (C timeline). LayerChart renders **SVG** and does not touch WebGL, so the page continues to prerender under `adapter-static` without crashing. One nuance: the `Chart` container measures its size via a client-side `clientWidth` binding, so by default (`ssr` prop = `false`) chart marks paint **after hydration**, not into the prerendered HTML — which is fine because the drawer is collapsed by default and the build gate should not grep for chart SVG.

The one required state change — widening `ui.filter` from `'all'` to `{status, gate, type}` — is additive and does not touch the Phase-3 consumers (`ui.selected`/`ui.hovered`/`select`/`deselect`/`hover` are unchanged). The scene's `CrystalNode.svelte` already has a dim path for deselected siblings; a filter-dim path (opacity ×0.3, `emissiveIntensity` ×0.15, guarded pointer handlers) slots in beside it.

**Primary recommendation:** Add `layerchart@2.0.1` only (no other deps — `d3-scale`/LayerCake are bundled transitively). Author three pure modules under `src/lib/data/` (`aggregates.ts`, `filter.ts`, `format.ts`) so they land inside the **existing vitest include glob** and are unit-testable without config changes. Build the overlay as discrete `position: fixed` panels with `pointer-events` gated per-panel. Use LayerChart for all four charts, themed exclusively through the inherited `--status-*` / gate-alias CSS tokens.

## Standard Stack

### Core (add exactly one dependency)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **layerchart** | `2.0.1` | The 4 pipeline charts (bar A, two-bar B, timeline C, stacked D) | Verified Svelte-5-native (`peerDependencies.svelte: ^5.0.0`), SVG (no canvas/WebGL, prerender-safe), composable on LayerCake + D3 scales, themeable to the dark/glass palette via CSS vars. Already vetted in `STACK.md`; CONTEXT locks it in scope. |

### Supporting (already installed — no new installs)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| svelte (runes) | 5.56.x | `$state`/`$derived`/`$effect`, `{@html}`, transitions | Overlay panels are plain Svelte 5 + Tailwind v4; no component library. |
| tailwindcss (v4 `@theme`) | 4.3.x | Layout/spacing utilities | Glass finish stays hand-CSS; tokens live in `src/app.css` `@theme`. |
| gsap | 3.15.0 | (optional) panel enter/exit if svelte transitions insufficient | Prefer built-in `svelte/transition` (`fly`/`fade`/`scale`) for the DOM panels — zero extra weight, matches the UI-SPEC 150–300ms discipline. |

**LayerChart transitive peers (do NOT add manually):** LayerChart bundles its D3 dependencies (`d3-scale`, `d3-shape`, `d3-array`, `d3-time`, LayerCake internals). `pnpm add layerchart@2.0.1` pulls them. The additional_context note about "d3-scale peer" is **not required as a direct dep** — verified `layerchart` declares only `svelte ^5.0.0` as a peer.

**Installation:**
```bash
pnpm add layerchart@2.0.1
```

**Version verification (run before writing the plan):**
```bash
npm view layerchart version        # confirmed: 2.0.1 (published, tarball fetched & inspected 2026-07-06)
npm view layerchart peerDependencies   # confirmed: { svelte: '^5.0.0' }
```
Verified 2026-07-06 by downloading `layerchart-2.0.1.tgz` and reading the shipped `.d.ts` files directly — the API below is from the actual package, not training data or stale v1 tutorials.

## Architecture Patterns

### Recommended Structure (new files this phase)
```
src/lib/
├── data/
│   ├── aggregates.ts     # PURE selectors (securedTotal/potentialTotal/countByStatus/by501c3) — browser SoT
│   ├── aggregates.test.ts# parity: 20000 / 296500 / counts Σ28  (matches tools/aggregates.mjs)
│   ├── filter.ts         # PURE matchesFilter(grant, filter) + gateBucket + typeBucket
│   ├── filter.test.ts    # each axis + combined + zero-match
│   ├── format.ts         # PURE formatAmount(amount) / formatDeadline(deadline, now?) / gateBadge(...)
│   └── format.test.ts    # over the REAL 28 records
├── hud/                  # existing: SceneTitle, PipelineReadout, Legend  (Phase 3, unchanged)
│   ├── DetailPanel.svelte      # right-edge rail; reads ui.selected; uses format.ts
│   ├── PipelineDrawer.svelte   # bottom-center collapsible; hosts the 4 charts
│   ├── charts/
│   │   ├── StatusChart.svelte      # Chart A — BarChart horizontal
│   │   ├── SecuredVsPotential.svelte # Chart B — BarChart two-bar
│   │   ├── DeadlineTimeline.svelte  # Chart C — ScatterChart / time scale
│   │   └── GateSplit.svelte         # Chart D — BarChart single stacked + sponsor tick
│   ├── FilterBar.svelte        # status chips + gate/type segments → setFilter/resetFilters
│   ├── QrPanel.svelte          # {@html qrCodes[i].svg}
│   └── FallbackList.svelte     # (optional RESL-01) 2D list, rows call select(id)
└── state/
    └── crystarium.svelte.js    # WIDEN ui.filter → {status,gate,type} + setFilter/resetFilters
```
**Why `src/lib/data/` for the pure modules:** the existing `vitest.config.ts` `include` already globs `src/lib/data/**/*.test.ts`. Placing the pure logic + tests there means **zero vitest-config change** and keeps the single-source-of-truth next to `grants.generated.json`. (Putting formatters under `src/lib/hud/` would require extending the include array — avoid.)

### Pattern 1: Runes bridge extension (the ONE required state change)
**What:** widen `ui.filter` from a string to a structured object; add setters. Additive — Phase-3 consumers untouched.
**Example:**
```js
// src/lib/state/crystarium.svelte.js  — extend (verified against current source)
/** @typedef {{ status: string, gate: 'all'|'open'|'gated'|'unknown', type: 'all'|'Grant'|'Fellowship'|'Investment' }} FilterState */
export const ui = $state({
  selected: null,      // ← Phase 3, UNCHANGED
  hovered: null,       // ← Phase 3, UNCHANGED
  cameraFocus: null,   // ← Phase 3, UNCHANGED
  filter: { status: 'all', gate: 'all', type: 'all' }   // was: 'all'
});
export function setFilter(axis, value) { ui.filter[axis] = value; }
export function resetFilters() { ui.filter = { status: 'all', gate: 'all', type: 'all' }; }
// select() / deselect() / hover() are UNCHANGED — do not touch them.
```
**Verification:** `grep -rn "ui.filter" src/lib/crystarium` currently returns **nothing** — the Phase-3 scene does not yet read `filter` (only `ui.selected`/`ui.hovered` in `CrystalNode.svelte`), so widening the shape breaks no existing consumer. Update the JSDoc `@property filter` line (currently typed `{string}`).

### Pattern 2: Pure filter predicate (unit-testable, imported by BOTH scene and UI)
**What:** a single pure `matchesFilter(grant, filter)` so the scene-dim logic and the chart/list logic agree by construction.
**Example:**
```ts
// src/lib/data/filter.ts
import type { Grant } from './types';
export type FilterState = { status: string; gate: 'all'|'open'|'gated'|'unknown'; type: 'all'|'Grant'|'Fellowship'|'Investment' };

export const gateBucket = (g: Grant) =>
  g.requires501c3 === 'no' ? 'open' : g.requires501c3 === 'yes' ? 'gated' : 'unknown';
export const typeBucket = (g: Grant) =>
  g.type === 'Grant/Fellowship' ? 'Fellowship' : g.type;   // 'Grant' | 'Fellowship' | 'Investment'

export function matchesFilter(g: Grant, f: FilterState): boolean {
  return (f.status === 'all' || g.status === f.status)
      && (f.gate   === 'all' || gateBucket(g) === f.gate)
      && (f.type   === 'all' || typeBucket(g) === f.type);
}
```

### Pattern 3: Scene reads `ui.filter` to dim + disable raycast (in `CrystalNode.svelte`)
**What:** extend the node's existing dim machinery (it already dims deselected siblings) with a filter-dim path.
**Example (integrates with the verified `useTask` in `CrystalNode.svelte`):**
```svelte
<script lang="ts">
  import { matchesFilter } from '$lib/data/filter';
  import { ui } from '$lib/state/crystarium.svelte.js';
  const matches = $derived(matchesFilter(grant, ui.filter));   // reactive
  // inside useTask: fold `!matches` into stateTarget & opacity:
  //   if (!matches) { stateTarget *= 0.15; targetOpacity = 0.3; }   // dim
  //   else            targetOpacity = 1;
  // material.opacity = smoothed(targetOpacity); material.transparent = true;
</script>

<T.Mesh
  onpointerenter={(e) => { if (!matches) return; e.stopPropagation(); hover(grant.id); }}
  onpointerleave={() => matches && hover(null)}
  onclick={(e) => { if (!matches) return; e.stopPropagation(); select(grant.id); }}
>
```
**Raycast disable:** `interactivity()` (called once in `CrystariumScene.svelte`) raycasts every mesh; the simplest, sufficient disable is the **handler guard** above (`if (!matches) return;`) — a filtered-out node cannot be hovered/selected. Add opacity dim + `emissiveIntensity ×0.15` for the visual. Transition ~200ms via the existing smoothing constant `k = min(1, delta*10)`. Also dim the family/spine/beam edges in `CrystalPath.svelte` in step (read `matchesFilter` for both endpoints). **Do NOT delete nodes** — layout stays stable (funnel preserved).

### Pattern 4: Pure aggregates selector (browser-importable, single source of truth)
**What:** re-expose the `tools/aggregates.mjs` logic as a browser/Vite-importable module. The Node tool stays for the build; the app imports a TS twin, and a parity test forbids drift.
**Example:**
```ts
// src/lib/data/aggregates.ts   (mirror of tools/aggregates.mjs, importing the real JSON)
import type { Grant } from './types';
const NON_POTENTIAL = new Set(['declined','not-eligible','not-eligible-yet']);
export const estimate = (g: Grant) => g.amount.avg ?? g.amount.max ?? g.amount.min ?? null;
export const securedTotal = (gs: Grant[]) => gs.filter(g => g.amount.isReceived)
  .reduce((s,g) => s + (g.amount.avg ?? estimate(g) ?? 0), 0);              // → 20000
export const potentialContributors = (gs: Grant[]) => gs.filter(g =>
  !g.amount.isReceived && !g.amount.isEquity && !NON_POTENTIAL.has(g.status) && estimate(g) !== null);
export const potentialTotal = (gs: Grant[]) => potentialContributors(gs).reduce((s,g)=>s+estimate(g)!,0); // → 296500
export const countByStatus = (gs: Grant[]) => { const o:Record<string,number>={}; for(const g of gs) o[g.status]=(o[g.status]??0)+1; return o; };
export const by501c3 = (gs: Grant[]) => { const o:Record<string,number>={}; for(const g of gs) o[g.requires501c3]=(o[g.requires501c3]??0)+1; return o; };
```
Components use `$derived`: `const secured = $derived(securedTotal(grants));` etc. The existing `PipelineReadout` currently receives hardcoded `secured={20000} potential={296500}` props in `+page.svelte` — swap those to the selector for the "single source of truth" hygiene note (optional but recommended by CONTEXT).

### Pattern 5: LayerChart 2.0.1 — simplified-chart components (VERIFIED API)
All four charts use the high-level components. Import by name from `'layerchart'`.

**Chart A — status distribution, horizontal bar (per-bar status hue):**
```svelte
<script lang="ts">
  import { BarChart } from 'layerchart';
  import { countByStatus } from '$lib/data/aggregates';
  import { grants } from '$lib/data';
  // funnel order + hue token per status (hue via CSS var, NOT raw hex):
  const order = ['to-research','in-progress','recurring','not-eligible-yet','active','applied','declined','not-eligible'];
  const data = order.map(s => ({ status: s, count: countByStatus(grants)[s] ?? 0 }));
</script>
<BarChart {data} x="count" y="status" orientation="horizontal"
  c="status" cRange={order.map(s => `var(--status-${s})`)}
  labels legend={false} height={220} />
```
- Verified: `orientation="horizontal"` sets the value axis to **x**; `x` = value accessor, `y` = category (string key or fn). Per-category color via the `c` accessor + `cRange` (array of CSS vars — keeps token discipline). `labels` (boolean, default `false`) turns on **direct value labels** (the small 28-row dataset).

**Chart B — secured vs potential, two bars:**
```svelte
<script lang="ts">
  import { BarChart } from 'layerchart';
  import { securedTotal, potentialTotal } from '$lib/data/aggregates';
  import { grants } from '$lib/data';
  const data = [
    { k: 'Secured',   v: securedTotal(grants),   color: 'var(--secured-gold)' },
    { k: 'Potential', v: potentialTotal(grants), color: 'var(--chart-potential)' }
  ];
</script>
<BarChart {data} x="k" y="v" c="k"
  cRange={['var(--secured-gold)','var(--chart-potential)']} labels height={200} />
```

**Chart D — 501c3 split, single 100%-stacked segmented bar:**
```svelte
<script lang="ts">
  import { BarChart } from 'layerchart';
  import { by501c3 } from '$lib/data/aggregates';
  import { grants } from '$lib/data';
  const c = by501c3(grants);   // { no:12, yes:8, unknown:8 }
  // one row, three series → a single stacked bar
  const data = [{ label: '501(c)(3)', open: c.no, gated: c.yes, unknown: c.unknown }];
</script>
<BarChart {data} y="label" orientation="horizontal" seriesLayout="stack"
  series={[
    { key: 'open',    label: 'Open now', color: 'var(--gate-open)' },
    { key: 'gated',   label: 'Gated',    color: 'var(--gate-gated)' },
    { key: 'unknown', label: 'Unknown',  color: 'var(--gate-unknown)' }
  ]}
  legend labels height={120}>
  {#snippet aboveMarks({ context })}
    <!-- bespoke gold beam-tick for the 5 fiscal-sponsor rows within the Gated segment -->
  {/snippet}
</BarChart>
```
- Verified: `series` is `SeriesData[]` = `{ key, label?, value?, color?, data?, selected?, props? }`. `seriesLayout` ∈ `'overlap'|'stack'|'stackExpand'|'stackDiverging'|'group'` — use `'stack'` (or `'stackExpand'` for true 100%). The **sponsor beam-tick** (design-authority bespoke mark echoing the Phase-3 beam) is drawn in the `aboveMarks` snippet using the chart `context` scales — this is the clean way to overlay custom SVG without abandoning the component.

**Chart C — deadline timeline (time scale, ordered by urgency):**
```svelte
<script lang="ts">
  import { ScatterChart } from 'layerchart';
  import { grants } from '$lib/data';
  const dated = grants.filter(g => g.deadline.date)   // Harry S. Black, Ford, Ben & Jerry's, Hey Helen(passed)
    .map(g => ({ date: new Date(g.deadline.date!), funder: g.funder, status: g.status, passed: g.deadline.isPassed }))
    .sort((a,b) => +a.date - +b.date);
</script>
<ScatterChart data={dated} x="date" y="funder" c="status"
  props={{ xAxis: { format: 'day' } }} height={220} />
```
- `ScatterChart` auto-selects a **time scale** when `x` yields `Date` objects. Markers colored by status hue via `c`; the `<30d` ring = `--urgent` and passed = `--status-declined` are applied via the `props.points`/`aboveMarks` overlay. Rolling/window/invitation cadences (no concrete date) render in a separate "Rolling" lane or as a small caption list — they have no x-position.

**Shared LayerChart facts (all VERIFIED from the 2.0.1 tarball):**
| Prop | Type / values | Notes |
|------|---------------|-------|
| `data` | `T[]` | Flat array of objects. |
| `x`,`y`,`c`,`r` | accessor: `string` key or `(d)=>value` | `c` drives color category; pair with `cRange` (string[] of CSS vars) or `series[].color`. |
| `orientation` | `'vertical'`(default) \| `'horizontal'` | Sets which axis is the value axis. |
| `series` | `SeriesData[]` | `{ key, label?, value?, color?, data?, selected?, props? }`. |
| `seriesLayout` | `'overlap'`(default)\|`'stack'`\|`'stackExpand'`\|`'stackDiverging'`\|`'group'` | Stacked bar D → `'stack'`. |
| `axis` | `true`(default)\|`'x'`\|`'y'`\|props\|snippet | Gridlines subtle via `props.grid`. |
| `grid` | `true`(default)\|props\|snippet | `--grid-line` token. |
| `labels` | `false`(default)\|`true`\|props\|snippet | **Direct labeling** — turn on. |
| `legend` | `false`(default)\|`true`\|props\|snippet | Turn on for A/D. |
| `tooltip` | snippet | Tooltip-on-interact; customize via `props.tooltip.{header,list,item}`. |
| `props` | `{ bars, xAxis, yAxis, grid, labels, legend, tooltip, rule, points, svg, ... }` | **Passthrough** to internal marks — the escape hatch for per-mark styling (e.g. `props={{ xAxis:{format:'none'}, tooltip:{header:{format:'none'}} }}`). |
| `padding` | `{top,right,bottom,left}` or number | Use exported `defaultChartPadding({ left: 30 })` for left-label room on horizontal bars. |
| `height` | number | Container measures **width** via client `clientWidth`; give an explicit `height`. |
| `ssr` | `false`(default)\|`true` | See Pitfall 1 — default renders marks **client-side after hydration**. |
| snippet slots | `belowContext`,`belowMarks`,`marks`,`aboveMarks`,`aboveContext`,`tooltip`,`children` | `aboveMarks` = clean overlay for bespoke SVG (sponsor tick, urgent rings). |

### Anti-Patterns to Avoid
- **Full-viewport overlay `div`:** kills the canvas raycast. Use discrete `position: fixed` panels + per-panel `pointer-events`.
- **Raw hex in components/charts:** every fill traces to a declared token (`--status-*`, `--gate-*`, `--secured-gold`, `--chart-potential`, `--grid-line`). Charts get CSS vars via `cRange`/`series[].color`.
- **Hardcoding chart numbers:** compute from `grants` through the selectors (CONTEXT hygiene rule). Hardcoded `20000`/`296500` are only acceptable as a fallback *echo*, not the source.
- **`export const ssr = false` to "fix" anything:** never — the page must keep prerendering (`STACK.md` Pattern 1). LayerChart is SVG and does not need it.
- **Adding a chart library that uses `<canvas>`** (Chart.js): outside Svelte reactivity, fights glass styling, needs an SSR guard. LayerChart is the decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Axed/scaled bar & stacked charts with tooltips + legends | Custom D3 scale + axis + tooltip positioning | `layerchart` `BarChart`/`ScatterChart` | Scales, tick formatting, tooltip hit-testing, stacking math are exactly what LayerChart wraps. |
| Time-axis for the deadline timeline | Manual date→pixel math | LayerChart auto `scaleTime` when `x` yields `Date` | Nice ticks, domain padding handled. |
| QR codes | Runtime QR encoder | Already generated `qrCodes` (`{@html svg}`) | Build-time inline SVG exists in `qr.generated.js`; zero client JS. |
| Aggregate rules (secured/potential exclusions) | Re-derive per component | `src/lib/data/aggregates.ts` (mirrors verified `tools/aggregates.mjs`) | The exclusion logic (equity/declined/not-eligible, received→secured) is subtle and already tested. |
| Panel enter/exit motion | Custom RAF animations | `svelte/transition` (`fly`,`fade`,`scale`) | Built-in, matches the 150–300ms transform/opacity discipline. |

**Key insight:** Phase 4's real risk is **numeric drift and token drift**, not rendering. Route every figure through the tested selectors and every color through a declared token; then the charts are thin.

## Runtime State Inventory

> Phase 4 is additive UI, not a rename/migration. Included for completeness — the one *state-shape* change is the `ui.filter` widening.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — all data is build-time (`grants.generated.json`, `qr.generated.js`) inlined by Vite; no DB, no localStorage, no runtime fetch. | none |
| Live service config | **None** — static GitHub Pages site; no external service holds Phase-4 state. | none |
| OS-registered state | **None** — no scheduled tasks / daemons. | none |
| Secrets/env vars | Only `BASE_PATH=/Eman_dashboard` (build-time, unchanged). No secrets. | none |
| Build artifacts | `qr.generated.js` currently encodes the **`REPLACE-ME`** support URL — a config placeholder, not a bug. Swapping `src/lib/config/sites.js` + `node tools/generate-qr.mjs` regenerates it. The tile renders regardless. | none this phase (QRUI-02 note only) |
| **State shape (in-code)** | `ui.filter: string → {status,gate,type}` in `crystarium.svelte.js`. `grep -rn "ui.filter" src` confirms **no current reader** in the scene → safe widening. | code edit (Pattern 1) |

## Common Pitfalls

### Pitfall 1: Charts are empty in the prerendered HTML (client-side sizing)
**What goes wrong:** you `grep build/index.html` for chart values (e.g. `$296,500`) and don't find them, then conclude the build is broken.
**Why it happens:** LayerChart's `Chart` container measures **width** via a client-side `clientWidth` binding; with `ssr` defaulting to `false`, marks paint on the client after hydration. The chart `<div>` prerenders (no crash), but the SVG bars/labels are not in the static HTML. The drawer is also collapsed by default.
**How to avoid:** Do **not** gate the build on chart SVG content. Gate on the prerenderable DOM that *is* baked (QR `{@html}` SVG, the `<title>`, static panel chrome). If a chart *must* be in the static HTML, set the `ssr` prop `true` on that chart (data is static, so it renders deterministically at build) — but this is not required for Phase 4.
**Warning signs:** verify-build "chart missing" false alarms; charts flashing in only after JS loads (expected).

### Pitfall 2: Overlay eats the canvas raycast
**What goes wrong:** after adding panels, orbit/hover/select on the crystals stops working over large screen areas.
**Why it happens:** a wrapping full-viewport element (even transparent) with default `pointer-events: auto` intercepts the pointer before it reaches the `<canvas>`.
**How to avoid:** NO catch layer. Each panel is its own `position: fixed` element; ambient HUD stays `pointer-events: none`; only interactive panels set `pointer-events: auto` **on themselves**. Empty overlay space must pass clicks through. z-scale: canvas 0 / ambient 10 / controls 20 / detail+QR 30.
**Warning signs:** hover highlight dies except directly on a panel; `deselect()` on background-click stops firing.

### Pitfall 3: Numeric / status-key drift between charts, selectors, and tokens
**What goes wrong:** a chart shows 27 instead of 28, or a status bar has no color.
**Why it happens:** status keys are hyphenated enums (`'not-eligible-yet'`); a typo (`c[status]` miss) yields `undefined`; a CSS var name mismatch (`--status-notEligible`) yields a transparent bar.
**How to avoid:** derive chart data from `countByStatus`/`by501c3` (never a literal), map hues as `var(--status-${status})` with the **exact** enum keys from `types.ts` (`active`,`in-progress`,`to-research`,`recurring`,`applied`,`declined`,`not-eligible`,`not-eligible-yet`), and assert Σ28 in a test.
**Warning signs:** a transparent/black bar; counts not summing to 28.

### Pitfall 4: `formatDeadline` "in N days" is clock-dependent → flaky tests
**What goes wrong:** a unit test asserting `"in 12 days"` breaks tomorrow.
**Why it happens:** `Date.now()` moves. (The scene already isolates this — `CrystalNode` uses a clock-free `node.pulse` set for membership and only reads `Date.now()` for cosmetic amplitude.)
**How to avoid:** signature `formatDeadline(d, now = Date.now())`; tests pass a fixed `now`. Test the clock-independent branches (`isPassed`→"Passed", cadence rolling/annual/invitation/unknown) exhaustively; test the day-count branch with an injected `now`.
**Warning signs:** intermittent CI failures near month boundaries.

### Pitfall 5: `{@html}` XSS assumption
**What goes wrong:** a reviewer flags `{@html qrCodes[i].svg}` as unsafe.
**Why it happens:** `{@html}` bypasses Svelte escaping — dangerous for *user* input.
**How to avoid:** document that `qrCodes[].svg` is **build-time generated** by `tools/generate-qr.mjs` from a fixed config (`sites.js`) with no user/runtime input — a trusted static string. This is the intended, safe use.

## Code Examples

### Detail-panel amount formatter (DETL-02, pure — rules from UI-SPEC verified against `types.ts`)
```ts
// src/lib/data/format.ts   (Source: 04-UI-SPEC §Amount→human-readable + src/lib/data/types.ts GrantAmount)
import type { GrantAmount, GrantDeadline } from './types';
const usd = (n: number) => '$' + n.toLocaleString('en-US');

export function formatAmount(a: GrantAmount): { text: string; tone: 'gold'|'muted'|'hi'; raw: string } {
  const raw = a.raw;
  if (a.isReceived) return { text: `Secured ${usd(a.avg ?? a.min ?? 0)}`, tone: 'gold', raw };  // $20,000
  if (a.isEquity)   return { text: 'Equity investment', tone: 'muted', raw };
  if (a.isTBD)      return { text: 'Amount TBD',        tone: 'muted', raw };
  if (a.avg != null)            return { text: `avg ${usd(a.avg)}`, tone: 'hi', raw };
  if (a.min != null && a.max != null) return { text: `${usd(a.min)}–${usd(a.max)}`, tone: 'hi', raw };
  if (a.min != null)            return { text: `${usd(a.min)}+`, tone: 'hi', raw };
  if (a.max != null)            return { text: `up to ${usd(a.max)}`, tone: 'hi', raw };
  return { text: raw, tone: 'muted', raw };
}
```

### Detail-panel deadline formatter (DETL-02, pure + injectable clock)
```ts
// src/lib/data/format.ts (Source: 04-UI-SPEC §Deadline→chip; clock isolated per Pitfall 4)
const DAY = 86_400_000;
export function formatDeadline(d: GrantDeadline, now = Date.now()): { text: string; tone: string; raw: string } {
  const raw = d.raw;
  if (d.isPassed) return { text: 'Passed', tone: 'declined', raw };
  if (d.cadence === 'one-time' && d.date) {
    const days = Math.ceil((new Date(d.date).getTime() - now) / DAY);
    const tone = days < 30 ? 'urgent' : days <= 90 ? 'in-progress' : 'hi';
    return { text: `in ${days} days`, tone, raw };
  }
  if (d.cadence === 'rolling')    return { text: d.note ? `Rolling · ${d.note}` : 'Rolling', tone: 'lo', raw };
  if (d.cadence === 'annual')     return { text: 'Annual', tone: 'lo', raw };
  if (d.cadence === 'invitation') return { text: 'Invitation only', tone: 'lo', raw };
  return { text: d.note ?? 'Timing TBD', tone: 'lo', raw };
}
```

### QR tile render (QRUI-01, safe inline SVG)
```svelte
<!-- src/lib/hud/QrPanel.svelte  (Source: 04-UI-SPEC §QR Panel) -->
<script lang="ts">
  import { qrCodes } from '$lib/data';   // [{ id, label, url, svg }, …] build-time
</script>
{#each qrCodes as qr (qr.id)}
  <figure class="qr-tile">
    <div class="plate">{@html qr.svg}</div>      <!-- trusted build-time SVG -->
    <figcaption>{qr.label}</figcaption>
    <small class="url">{qr.url}</small>
  </figure>
{/each}
```

### Minimal WebGL-probe fallback (RESL-01, OPTIONAL — do not let it block)
```svelte
<!-- src/routes/+page.svelte — extend the existing browser+mounted guard -->
<script lang="ts">
  let webgl = $state(true);
  onMount(() => {
    mounted = true;
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  });
</script>
{#if browser && mounted && webgl}
  {#await import('$lib/crystarium/CrystariumCanvas.svelte') then { default: Canvas }}<Canvas />{/await}
{:else if browser && mounted}
  {#await import('$lib/hud/FallbackList.svelte') then { default: FallbackList }}<FallbackList />{/await}
{/if}
<!-- FallbackList rows call select(id) → the SAME DetailPanel opens; reuse format.ts helpers -->
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LayerChart v1 (Svelte 4, slot-based, LayerCake-first composition) | LayerChart **v2** — Svelte-5 runes, high-level `BarChart`/`ScatterChart`/`LineChart`/`AreaChart`/`PieChart` "simplified charts" + `{#snippet}` slots | LayerChart 2.0 (2025) | v1 tutorials/`<slot>`/`let:` patterns are **stale**; use `{#snippet aboveMarks(...)}` and the `props={{…}}` passthrough. |
| `ui.filter` as a single string | `{ status, gate, type }` + `setFilter`/`resetFilters` | This phase | Enables 3-axis filtering; additive to the runes bridge. |
| Chart.js / canvas | LayerChart SVG (Svelte-native, prerender-safe) | Project decision (STACK.md) | No SSR guard, themeable via CSS vars. |

**Deprecated/outdated:**
- Any LayerChart example using `<slot name>` / `let:` directives or a manual `<LayerCake>`+`<Svg>`+`<Bars>` stack **for these simple charts** — v2's simplified components replace that boilerplate. (The low-level `Chart`/`Svg`/`Bars`/`Axis` primitives still exist and are exported if bespoke composition is ever needed.)

## Open Questions

1. **Per-bar color on a single-series bar (Chart A) — `c`+`cRange` vs. `series`.**
   - What we know: `c` accessor + `cRange` colors marks by category; `series[].color` colors by series. Both are valid v2 APIs (verified in types + the `legend-stack-series` example).
   - What's unclear: which yields the cleaner legend for 8 single-count categories.
   - Recommendation: start with `c="status"` + `cRange=[…var(--status-*)…]`; if the legend renders poorly, model each status as a one-item `series`. Low risk — 30-min spike during implementation.

2. **Chart C non-dated cadences (rolling/window/invitation) placement.**
   - What we know: only 4 grants have concrete `deadline.date`; ~24 are rolling/annual/invitation/unknown with no x-position.
   - What's unclear: whether to show a "Rolling" lane inside the ScatterChart or a caption list beside it.
   - Recommendation: dated markers in the ScatterChart (urgency-ordered) + a compact "Rolling / Annual / Invitation" caption row beneath — keeps the timeline honest without inventing positions.

3. **True raycast disable vs. handler-guard for filtered nodes.**
   - What we know: handler-guard (`if (!matches) return;`) fully prevents hover/select and is trivial.
   - What's unclear: whether design wants the mesh removed from the raycast set entirely (micro-perf).
   - Recommendation: handler-guard + visual dim is sufficient for 28 nodes; skip raycast-set surgery.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **vitest 4.1.9** (`environment: 'node'`) |
| Config file | `vitest.config.ts` — `include: ['tools/**/*.test.mjs','src/lib/data/**/*.test.ts','src/lib/crystarium/**/*.test.{js,ts}']` |
| Quick run command | `pnpm exec vitest run src/lib/data` |
| Full suite command | `pnpm test:unit` (= `vitest run`) |
| Build gate | `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && pnpm verify:build` |

**Key config fact:** the pure Phase-4 modules land under `src/lib/data/**` which is **already in the include glob** → **no vitest-config edit needed** (a Wave-0 trap avoided). If any pure test is placed under `src/lib/hud/**`, the include array MUST be extended first.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | `countByStatus` = 17/3/2/2/1/1/1/1 (Σ28) | unit | `pnpm exec vitest run src/lib/data/aggregates.test.ts` | ❌ Wave 0 (mirror of `tools/aggregates.test.mjs`) |
| PIPE-02 | `securedTotal`=20000, `potentialTotal`=296500 (9 contributors) | unit | `pnpm exec vitest run src/lib/data/aggregates.test.ts` | ❌ Wave 0 |
| PIPE-04 | `by501c3` = no12/yes8/unknown8 (Σ28); 5 fiscal-sponsor rows | unit | `pnpm exec vitest run src/lib/data/aggregates.test.ts` | ❌ Wave 0 |
| PIPE-05 | `matchesFilter` each axis + combined + zero-match; `gateBucket`/`typeBucket` | unit | `pnpm exec vitest run src/lib/data/filter.test.ts` | ❌ Wave 0 |
| DETL-02 | `formatAmount` all 7 branches over real records; `formatDeadline` clock-independent branches + injected `now` | unit | `pnpm exec vitest run src/lib/data/format.test.ts` | ❌ Wave 0 |
| DETL-02 | gate badge (`no`→Open now / `yes`→Gated / `unknown`→Gate unknown; fiscal-sponsor hint) | unit | `pnpm exec vitest run src/lib/data/format.test.ts` | ❌ Wave 0 |
| —(state) | widened `ui.filter` default `{all,all,all}`; `setFilter`/`resetFilters`; Phase-3 `select`/`deselect`/`hover` unchanged | unit | `pnpm exec vitest run src/lib/state` (+ extend include glob) OR keep predicate-only tests in data | ❌ Wave 0 (optional; glob note) |
| DETL-01/03, QRUI-01 | build still prerenders; `<title>` = "Eman_dashboard"; QR `{@html}` SVG present; base-path safe | build gate | `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && pnpm verify:build` | ✅ `tools/verify-build.mjs` |
| PIPE-01..04 | charts render + tooltips (client-side SVG) | **manual** | eyes / `tools/screenshot-scene.mjs` | ✅ screenshot tool exists |
| DETL-01, PIPE-05 | select→panel slides in; filter dims scene + disables raycast | **manual** | eyes / screenshot | ✅ |
| RESL-01 | WebGL probe → 2D list (optional) | **manual** | eyes (disable WebGL) | n/a |

### Build-gate greps (what IS prerenderable)
- ✅ Gate on: `<title>Eman_dashboard…` (verify-build check #6 already does this), base-path safety (checks #4/#5), `.nojekyll`/`404.html`.
- ✅ QR: the `{@html qrCodes[i].svg}` inline SVG **is** baked (static string) → optionally `grep build/index.html` for `viewBox="0 0 31 31"` to assert QR presence.
- ⚠️ Detail-panel content: prerenders with `ui.selected == null` → panel closed/off-canvas; static chrome (eyebrows, "SHARE"/"PIPELINE OVERVIEW" titles, filter labels, overview hint) may be baked and greppable, but selected-grant fields are NOT (nothing selected at build).
- ❌ Do **NOT** gate on chart SVG values ($296,500, status bars) — client-rendered by default (Pitfall 1).

### Sampling Rate
- **Per task commit:** `pnpm exec vitest run src/lib/data` (pure modules — sub-second).
- **Per wave merge:** `pnpm test:unit` (full suite: existing crystarium/tools tests + new data tests).
- **Phase gate:** full suite green **and** `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && pnpm verify:build` passes, before `/gsd:verify-work`. Manual UAT (drill-down, filter-dims-scene, tooltips) captured via `tools/screenshot-scene.mjs`.

### Wave 0 Gaps
- [ ] `src/lib/data/aggregates.ts` + `src/lib/data/aggregates.test.ts` — PIPE-01/02/04 (mirror `tools/aggregates.mjs`; assert parity 20000/296500/counts Σ28).
- [ ] `src/lib/data/filter.ts` + `src/lib/data/filter.test.ts` — PIPE-05 (`matchesFilter`, `gateBucket`, `typeBucket`; each axis + combined + zero-match).
- [ ] `src/lib/data/format.ts` + `src/lib/data/format.test.ts` — DETL-02 (`formatAmount` 7 branches, `formatDeadline` w/ injected `now`, `gateBadge`).
- [ ] `layerchart@2.0.1` install (`pnpm add layerchart@2.0.1`).
- [ ] Widen `ui.filter` shape in `src/lib/state/crystarium.svelte.js` (+ update JSDoc `@property filter`).
- [ ] (Only if any pure test is placed under `src/lib/hud/**` or `src/lib/state/**`) extend `vitest.config.ts` `include`. Preferred: keep pure tests under `src/lib/data/**` to avoid this.

## Sources

### Primary (HIGH confidence)
- **LayerChart 2.0.1 npm tarball** (`layerchart-2.0.1.tgz`, fetched & extracted 2026-07-06) — read shipped `.d.ts`: `BarChart.shared.svelte.d.ts` (orientation/series/seriesLayout/bandPadding/onBarClick), `ScatterChart.shared.svelte.d.ts`, `Chart.shared.svelte.d.ts` (x/y/c accessors, ssr, padding, domains, tooltipContext), `ChartChildren.shared.svelte.d.ts` (axis/grid/labels/legend/rule/tooltip + `props` passthrough + snippet slots), `charts/types.d.ts` (`SeriesData`), `components/charts/index.d.ts` (named exports). `package.json` peer `svelte ^5.0.0`.
- **LayerChart docs examples** (github.com/techniq/layerchart `docs/src/examples/components/BarChart/`) — `horizontal.svelte` (x=value,y=category,orientation="horizontal",defaultChartPadding), `legend-stack-series.svelte` (series[]+seriesLayout="stack"+props={{xAxis,yAxis,tooltip}}+legend).
- **Project source** (read directly): `src/lib/state/crystarium.svelte.js`, `src/lib/crystarium/CrystalNode.svelte` + `CrystariumScene.svelte`, `src/lib/data/{types.ts,index.ts,qr.generated.js}`, `src/lib/config/sites.js`, `tools/{aggregates.mjs,aggregates.test.mjs,verify-build.mjs}`, `src/routes/+page.svelte`, `vitest.config.ts`, `package.json`, `.planning/config.json`.
- **Data verified** via `node` over `grants.generated.json`: 28 records; by501c3 no12/yes8/unknown8; 5 fiscal-sponsor rows; types Grant26/Fellowship1/Investment1; dated deadlines Harry S. Black 2026-06-30, Ford 2026-09-01, Ben & Jerry's 2027-02-18, Hey Helen 2025-12-30 (passed).
- **npm registry:** `layerchart` latest = `2.0.1`, peer `{ svelte: ^5.0.0 }` (verified 2026-07-06).

### Secondary (MEDIUM confidence)
- LayerChart changelog / shadcn-svelte chart docs (WebSearch) — corroborate the v2 "simplified charts" + `seriesLayout` stack/group naming.

### Tertiary (LOW confidence)
- None relied upon — all load-bearing API claims verified against the shipped tarball.

## Metadata

**Confidence breakdown:**
- Standard stack (layerchart@2.0.1, Svelte-5 API): **HIGH** — read from the actual shipped package types + real examples.
- Architecture (runes widening, pure modules, scene dim): **HIGH** — read from live project source; `ui.filter` confirmed to have no current scene reader.
- Data numbers (20000/296500/counts/dates/gate/sponsor): **HIGH** — computed from the real generated JSON.
- Charts-in-prerender (ssr/clientWidth) nuance: **HIGH** — `ssr` prop + `clientWidth` binding confirmed in the tarball; recommend not gating build on chart SVG.
- Chart C timeline exact styling (urgency rings/lanes): **MEDIUM** — component supports it; micro-styling is a short implementation spike (Open Q2/Q3).

**Research date:** 2026-07-06
**Valid until:** ~2026-08-05 (30 days; LayerChart 2.x API stable, but re-verify if bumping to a 2.1+/3.x line).
