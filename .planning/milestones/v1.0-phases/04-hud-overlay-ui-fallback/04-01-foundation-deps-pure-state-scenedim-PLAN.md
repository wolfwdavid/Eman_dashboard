---
phase: 04-hud-overlay-ui-fallback
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
  - src/app.css
  - src/lib/state/crystarium.svelte.js
  - src/lib/data/aggregates.ts
  - src/lib/data/aggregates.test.ts
  - src/lib/data/filter.ts
  - src/lib/data/filter.test.ts
  - src/lib/data/format.ts
  - src/lib/data/format.test.ts
  - src/lib/crystarium/CrystalNode.svelte
  - src/lib/crystarium/CrystalPath.svelte
  - src/lib/crystarium/CrystariumScene.svelte
autonomous: true
requirements: [DETL-02, PIPE-01, PIPE-02, PIPE-04, PIPE-05]
must_haves:
  truths:
    - "securedTotal(grants) === 20000 and potentialTotal(grants) === 296500 computed by rule, not hardcoded"
    - "countByStatus sums to 28 (17/3/2/2/1/1/1/1); by501c3 = no12/yes8/unknown8 (Σ28)"
    - "matchesFilter(grant, filter) partitions by status/gate/type; all-'all' filter matches every grant"
    - "formatAmount / formatDeadline render human-readable text plus the raw string, clock-injected"
    - "ui.filter is {status,gate,type} with setFilter/resetFilters; Phase-3 select/deselect/hover unchanged"
    - "Filtered-out crystal nodes dim (opacity ~0.3, emissiveIntensity ×0.15) and cannot be hovered/selected"
  artifacts:
    - path: "src/lib/data/aggregates.ts"
      provides: "browser selectors securedTotal/potentialTotal/countByStatus/by501c3/estimate/potentialContributors"
      exports: ["securedTotal", "potentialTotal", "countByStatus", "by501c3", "estimate"]
    - path: "src/lib/data/filter.ts"
      provides: "matchesFilter predicate + gateBucket + typeBucket + FilterState type"
      exports: ["matchesFilter", "gateBucket", "typeBucket"]
    - path: "src/lib/data/format.ts"
      provides: "formatAmount / formatDeadline / gateBadge pure display helpers"
      exports: ["formatAmount", "formatDeadline", "gateBadge"]
    - path: "src/lib/state/crystarium.svelte.js"
      provides: "widened ui.filter object + setFilter/resetFilters"
      contains: "filter: { status:"
    - path: "src/app.css"
      provides: "gate/chart display token aliases"
      contains: "--gate-open"
  key_links:
    - from: "src/lib/crystarium/CrystalNode.svelte"
      to: "src/lib/data/filter.ts"
      via: "matchesFilter(grant, ui.filter) drives dim + pointer-handler guard"
      pattern: "matchesFilter"
    - from: "src/lib/data/aggregates.ts"
      to: "src/lib/data/grants.generated.json"
      via: "selectors compute over imported grants"
      pattern: "securedTotal|potentialTotal"
---

<objective>
Lay the Phase-4 foundation: add the one chart dependency, author the three PURE data modules (aggregates / filter / format) with colocated vitest tests, widen the runes `ui.filter` shape, add the gate/chart CSS token aliases, and wire the scene to DIM + disable raycast on filtered-out crystals. Everything downstream (Detail Panel, charts, filter bar) binds to these contracts.

Purpose: Route every Phase-4 figure through a tested selector and every filter decision through one pure predicate — the phase's real risk is numeric/token drift, not rendering. Ship the state change and scene reflection so Wave-2 UI is pure composition.
Output: `layerchart@2.0.1` installed; `src/lib/data/{aggregates,filter,format}.ts` (+ tests) green under the existing vitest glob; widened `ui.filter`; gate tokens in `app.css`; `CrystalNode`/`CrystalPath` filter-dim wired.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-hud-overlay-ui-fallback/04-CONTEXT.md
@.planning/phases/04-hud-overlay-ui-fallback/04-RESEARCH.md
@.planning/phases/04-hud-overlay-ui-fallback/04-VALIDATION.md

# Contracts the executor implements against (read these — do NOT re-explore):
@src/lib/data/types.ts
@src/lib/data/index.ts
@src/lib/state/crystarium.svelte.js
@src/lib/crystarium/CrystalNode.svelte
@src/lib/crystarium/CrystalPath.svelte
@src/lib/crystarium/CrystariumScene.svelte
@tools/aggregates.mjs
@src/app.css

<interfaces>
<!-- Grant shape (src/lib/data/types.ts) — drives every rule table below -->
GrantAmount: { raw:string; min:number|null; max:number|null; avg:number|null; isReceived:bool; isTBD:bool; isEquity:bool; isMicro:bool }
GrantDeadline: { raw:string; date:string|null; cadence:'rolling'|'annual'|'invitation'|'one-time'|'passed'|'unknown'; note:string|null; isPassed:bool }
Grant: { id; funder; program:string|null; type:'Grant'|'Grant/Fellowship'|'Investment'; amount:GrantAmount; deadline:GrantDeadline; requires501c3:'yes'|'no'|'unknown'; requires501c3Raw:string; fit:string; status:GrantStatus; statusLabel:string; nextAction:string|null; link:string }
GrantStatus keys (EXACT, hyphenated): active | in-progress | to-research | recurring | applied | declined | not-eligible | not-eligible-yet

<!-- Node aggregates tool to MIRROR verbatim (tools/aggregates.mjs) -->
NON_POTENTIAL_STATUSES = new Set(['declined','not-eligible','not-eligible-yet'])
estimate(g) = g.amount.avg ?? g.amount.max ?? g.amount.min ?? null
securedTotal = Σ over amount.isReceived of (avg ?? estimate ?? 0)      // → 20000
potentialContributors = !isReceived && !isEquity && !NON_POTENTIAL.has(status) && estimate!==null
potentialTotal = Σ estimate over contributors                          // → 296500

<!-- Runes bridge current shape (src/lib/state/crystarium.svelte.js) -->
ui = $state({ selected:null, hovered:null, filter:'all', cameraFocus:null })  // filter is a STRING today
select(id)/deselect()/hover(id) — DO NOT TOUCH these
grep confirms NO current reader of ui.filter in the scene → widening is safe
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install layerchart, widen ui.filter, add gate/chart CSS tokens</name>
  <files>package.json, pnpm-lock.yaml, src/lib/state/crystarium.svelte.js, src/app.css</files>
  <read_first>src/lib/state/crystarium.svelte.js, src/app.css, package.json (deps), 04-RESEARCH.md §Pattern 1 + §Chart/gate display tokens</read_first>
  <action>
    1. Install the one chart dep (NO 3D deps): `pnpm add layerchart@2.0.1`. Verify it declares only `svelte ^5` as peer (already satisfied); do NOT add d3-scale/LayerCake manually (bundled transitively).
    2. Widen `ui.filter` in `src/lib/state/crystarium.svelte.js` from the string `'all'` to a structured object, and add setters — ADDITIVE, do not touch `select`/`deselect`/`hover`:
       ```js
       // update the JSDoc @property filter line to the object type, then:
       export const ui = $state({
         selected: null, hovered: null, cameraFocus: null,
         filter: { status: 'all', gate: 'all', type: 'all' }   // was: 'all'
       });
       export function setFilter(axis, value) { ui.filter[axis] = value; }
       export function resetFilters() { ui.filter = { status: 'all', gate: 'all', type: 'all' }; }
       ```
       Update the JSDoc: `@property {{status:string,gate:string,type:string}} filter` (was `{string}`).
    3. Add the chart/gate display token ALIASES to `src/app.css` inside the existing `:root {}` block (they are aliases of existing hues — NO new palette hex beyond what the UI-SPEC lists). Per 04-UI-SPEC §Color and 04-RESEARCH:
       ```css
       --gate-open: #6FA8FF;        /* = --path        — Chart D "Open now" + filter Open */
       --gate-gated: #B0894E;       /* = --status-not-eligible-yet — Chart D "Gated" + filter Gated */
       --gate-unknown: #565D75;     /* = --status-not-eligible     — Chart D "Unknown" + filter Unknown */
       --chart-potential: #EAF1FF;  /* = --text-hi     — Chart B potential bar */
       --grid-line: rgba(140,180,255,.18); /* = --surface-glass-border — chart gridlines */
       ```
    Do NOT hardcode any new palette entry not listed above. These are the declared aliases the charts/filters reference.
  </action>
  <verify>
    <automated>node -e "import('./src/lib/state/crystarium.svelte.js').catch(()=>{})" ; grep -q "filter: { status:" src/lib/state/crystarium.svelte.js && grep -q "setFilter" src/lib/state/crystarium.svelte.js && grep -q "resetFilters" src/lib/state/crystarium.svelte.js && grep -q -- "--gate-open" src/app.css && grep -q -- "--chart-potential" src/app.css && node -e "console.log(require('./package.json').dependencies.layerchart)" | grep -q 2.0.1</automated>
  </verify>
  <done>layerchart@2.0.1 in package.json dependencies; ui.filter is the {status,gate,type} object with setFilter/resetFilters; select/deselect/hover unchanged; 5 gate/chart alias tokens present in app.css.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Author the three pure data modules + colocated vitest tests</name>
  <files>src/lib/data/aggregates.ts, src/lib/data/aggregates.test.ts, src/lib/data/filter.ts, src/lib/data/filter.test.ts, src/lib/data/format.ts, src/lib/data/format.test.ts</files>
  <read_first>tools/aggregates.mjs (mirror verbatim), src/lib/data/types.ts, 04-RESEARCH.md §Pattern 2 + §Pattern 4 + §Code Examples (formatAmount/formatDeadline), 04-UI-SPEC.md §Amount→human-readable + §Deadline→chip + §Gate badge tables</read_first>
  <behavior>
    aggregates.test.ts (import { grants } from '$lib/data'):
    - securedTotal(grants) === 20000
    - potentialTotal(grants) === 296500
    - potentialContributors(grants).length === 9
    - countByStatus(grants): to-research 17, in-progress 3, recurring 2, not-eligible-yet 2, active 1, applied 1, declined 1, not-eligible 1; Object.values sum === 28
    - by501c3(grants): no 12, yes 8, unknown 8; sum === 28
    filter.test.ts:
    - gateBucket: requires501c3 'no'→'open', 'yes'→'gated', 'unknown'→'unknown'
    - typeBucket: 'Grant/Fellowship'→'Fellowship'; 'Grant'→'Grant'; 'Investment'→'Investment'
    - matchesFilter with {all,all,all} matches EVERY grant (grants.every)
    - each single axis narrows correctly (status / gate / type)
    - combined axes AND together; a zero-match combo returns [] over grants.filter
    format.test.ts (inject a fixed now):
    - formatAmount: isReceived→"Secured $20,000" tone gold; isEquity→"Equity investment" muted; isTBD→"Amount TBD" muted; avg branch→"avg $X"; min&&max→"$min–$max"; min only→"$min+"; max only→"up to $max". Every branch returns { text, tone, raw } and raw === a.raw.
    - formatDeadline(d, FIXED_NOW): isPassed→"Passed" tone 'declined'; one-time future date→"in N days" (assert N with injected now) with tone urgent(<30)/in-progress(≤90)/hi(else); rolling→"Rolling"(+note); annual→"Annual"; invitation→"Invitation only"; unknown→note ?? "Timing TBD". raw always preserved.
    - gateBadge: 'no'→label "Open now"; 'yes'→"Gated (501c3)" and when requires501c3Raw contains "fiscal sponsor" the sponsor hint flag is set; 'unknown'→"Gate unknown".
  </behavior>
  <action>
    Create `aggregates.ts` as the browser/TS twin of `tools/aggregates.mjs` (mirror the logic EXACTLY — this is the single source of truth for the HUD; parity forbids drift). Import types from `./types`; the tests import `{ grants }` from `$lib/data`. Signatures per 04-RESEARCH §Pattern 4.
    Create `filter.ts` with `FilterState`, `gateBucket`, `typeBucket`, `matchesFilter` VERBATIM from 04-RESEARCH §Pattern 2.
    Create `format.ts` with `formatAmount(a)`, `formatDeadline(d, now = Date.now())`, and `gateBadge(requires501c3, requires501c3Raw)` — copy the rule tables from 04-UI-SPEC (§Amount→human-readable, §Deadline→chip, §Gate badge) and the verified code in 04-RESEARCH §Code Examples. Money format: `'$' + n.toLocaleString('en-US')`. Deadline uses `DAY = 86_400_000` and buckets `<30` urgent / `<=90` in-progress / else hi.
    Colocate all three `.test.ts` files next to their module — they land in the EXISTING vitest include glob (`src/lib/data/**/*.test.ts`), so NO vitest.config.ts change. `formatDeadline` MUST accept an injectable `now` so day-count tests are clock-free (Pitfall 4).
    Do NOT hardcode 20000/296500 in aggregates.ts — they must compute from `grants`. The test asserts the computed value.
  </action>
  <verify>
    <automated>pnpm exec vitest run src/lib/data</automated>
  </verify>
  <done>All three modules exist and export the named functions; `pnpm exec vitest run src/lib/data` passes: securedTotal=20000, potentialTotal=296500, counts Σ28, by501c3 12/8/8, matchesFilter axes + zero-match, all formatAmount/formatDeadline branches with raw subtext preserved.</done>
</task>

<task type="auto">
  <name>Task 3: Wire scene filter-dim + raycast-guard from matchesFilter</name>
  <files>src/lib/crystarium/CrystalNode.svelte, src/lib/crystarium/CrystalPath.svelte, src/lib/crystarium/CrystariumScene.svelte</files>
  <read_first>src/lib/crystarium/CrystalNode.svelte (existing dim machinery in useTask), CrystalPath.svelte, CrystariumScene.svelte, 04-RESEARCH.md §Pattern 3, 04-UI-SPEC.md §Scene Reflection of Filters</read_first>
  <action>
    Extend the EXISTING dim path in `CrystalNode.svelte` (it already dims deselected siblings via `stateTarget *= 0.35` + smoothing constant `k = min(1, delta*10)`) with a FILTER-dim path — do NOT rewrite the useTask, fold into it:
    ```svelte
    import { matchesFilter } from '$lib/data/filter';
    // ui already imported. Add:
    const matches = $derived(matchesFilter(grant, ui.filter));   // reactive
    ```
    Inside `useTask`, read `matches` (via a captured closure ref or re-read `matchesFilter(grant, ui.filter)`), and when NOT matching: multiply `stateTarget` by 0.15 and drive a `targetOpacity = 0.3` (else 1). Set `material.transparent = true` and smooth `material.opacity` toward `targetOpacity` with the same `k`. Non-matching nodes keep the ash desaturate is optional; the REQUIRED signal is opacity ~0.3 + emissiveIntensity ×0.15.
    Raycast/pointer disable = HANDLER GUARD (sufficient for 28 nodes per 04-RESEARCH Open Q3 — do NOT surgically remove meshes from the raycast set): guard all three pointer handlers on the `<T.Mesh>`:
    ```svelte
    onpointerenter={(e) => { if (!matches) return; e.stopPropagation(); hover(grant.id); }}
    onpointerleave={() => matches && hover(null)}
    onclick={(e) => { if (!matches) return; e.stopPropagation(); select(grant.id); }}
    ```
    Dim edges in step: a spine/family/beam edge dims when EITHER endpoint is filtered out. Simplest: pass a `dim` prop into `CrystalPath` from `CrystariumScene.svelte` computed as `!(matchesFilter(grantById.get(edge.from)) && matchesFilter(grantById.get(edge.to)))` and reduce the tube material opacity (multiply cfg.opacity, e.g. ×0.25) when `dim`. Keep it transform/opacity/uniform-only, ~200ms feel via the existing smoothing. Transition per 04-UI-SPEC (material-uniform + opacity ~200ms).
    CRITICAL: nodes are DIMMED, never deleted — the layout/funnel stays stable. Phase-3 select/hover behavior for MATCHING nodes is unchanged.
  </action>
  <verify>
    <automated>grep -q "matchesFilter" src/lib/crystarium/CrystalNode.svelte && grep -q "if (!matches) return" src/lib/crystarium/CrystalNode.svelte && grep -q "material.opacity" src/lib/crystarium/CrystalNode.svelte && pnpm exec vitest run src/lib/data && MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs</automated>
  </verify>
  <done>CrystalNode reads matchesFilter(grant, ui.filter); filtered-out nodes dim (opacity ~0.3, emissive ×0.15) and their pointer handlers are guarded; edges dim when an endpoint is filtered; nodes are never removed; full build + verify-build (6/6) stays green.</done>
</task>

</tasks>

<verification>
- `pnpm exec vitest run src/lib/data` green (aggregates/filter/format).
- `pnpm exec vitest run` full suite green (existing crystarium/tools tests unbroken by the ui.filter widening).
- `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs` → 6/6 PASS, title intact, no `ssr = false` introduced.
- grep: `ui.filter` widened; select/deselect/hover unchanged; gate tokens present.
</verification>

<success_criteria>
- layerchart@2.0.1 installed (no new 3D deps).
- securedTotal=20000 / potentialTotal=296500 / counts Σ28 / by501c3 12/8/8 all computed-by-rule and asserted.
- matchesFilter + gateBucket/typeBucket tested (each axis + combined + zero-match).
- formatAmount/formatDeadline render human-readable + raw, clock-injected.
- ui.filter is {status,gate,type} with setFilter/resetFilters; Phase-3 consumers untouched.
- Scene dims + raycast-guards filtered-out crystals; build stays SSR-safe and green.
</success_criteria>

<output>
After completion, create `.planning/phases/04-hud-overlay-ui-fallback/04-01-SUMMARY.md`
</output>
