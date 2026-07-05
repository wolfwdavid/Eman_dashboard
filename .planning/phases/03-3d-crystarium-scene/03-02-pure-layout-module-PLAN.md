---
phase: 03-3d-crystarium-scene
plan: 02
type: tdd
wave: 2
depends_on: ["03-01"]
files_modified:
  - src/lib/crystarium/layout.js
  - src/lib/crystarium/layout.test.ts
  - src/lib/crystarium/derive.test.ts
autonomous: true
requirements: [CRYS-02, CRYS-04, CRYS-05, CRYS-06]
must_haves:
  truths:
    - "computeLayout(grants) returns 28 nodes with finite {x,y,z} and is deterministic across calls"
    - "The center node is the active funder (ny-community-trust) at the origin"
    - "Node scale is log-scaled from amount; all 16 TBD nodes get the fixed minimal scale (never 0)"
    - "The pulse set is exactly the 3 clock-free qualifying nodes; passed/rolling/declined/ineligible never pulse"
    - "The beam target set is exactly the 4 fiscal-sponsor funders; family edges are the Ford + BofA pairs"
  artifacts:
    - path: "src/lib/crystarium/layout.js"
      provides: "PURE computeLayout(grants) → {nodes, edges, center}; no three, no Date, no RNG"
      min_lines: 80
      exports: ["computeLayout"]
    - path: "src/lib/crystarium/layout.test.ts"
      provides: "CRYS-02/04 unit assertions (count, finite, deterministic, center, rings, scale)"
    - path: "src/lib/crystarium/derive.test.ts"
      provides: "CRYS-05/06 unit assertions (pulse=3, beam=4, family pairs, spine)"
  key_links:
    - from: "src/lib/crystarium/layout.js"
      to: "$lib/data grants"
      via: "computeLayout(grants) argument (pure, no import of Date/three)"
      pattern: "export function computeLayout"
    - from: "layout.js beam derivation"
      to: "requires501c3Raw"
      via: "raw-string match (NOT tri-state)"
      pattern: "requires501c3Raw"
---

<objective>
Build the pure, deterministic `layout.js` — the load-bearing automated core of Phase 3. It maps the 28 typed grants to `{nodes, edges, center}` (positions, ring-by-status, sector-by-501c3, log-scaled amount, TBD→minimal) and derives the three data-driven sets (beam=4, pulse=3, family pairs) plus the spine edges. No `three`, no `Date`, no RNG — so it is unit-testable and identical across builds. This module is where CRYS-02/04/05/06 are PROVEN before a pixel renders.

Purpose: The whole scene reads positions/scale/edges/pulse from this module; the derived sets are the project's differentiator and MUST come from data, not hardcoded counts. Full vitest coverage here is the highest-leverage verification in the phase (VALIDATION.md: layout math is the automated surface, 3D pixels are manual).
Output: `src/lib/crystarium/layout.js` + `layout.test.ts` + `derive.test.ts`, all green.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-3d-crystarium-scene/03-RESEARCH.md
@.planning/phases/03-3d-crystarium-scene/03-UI-SPEC.md
@src/lib/data/types.ts
@src/lib/data/index.ts

<interfaces>
<!-- LOCKED signature (RESEARCH §Deterministic Layout Algorithm) -->
```js
export function computeLayout(grants) // → { nodes: Node[], edges: Edge[], center: string }
// Node: { id, x, y, z, scale, ring, sector, status, isTBD, isEquity, pulse, beamTarget }
// Edge: { from, to, kind: 'spine' | 'family' | 'beam' }
```

<!-- LOCKED constants (world units — tunable in Phase 5, ship these) -->
```js
const RING_RADIUS = { active: 0, applied: 6, 'in-progress': 11, 'to-research': 17, recurring: 9, dim: 20 };
const DOME_CURVE = 0.35;   // elevation gain per unit radius
const SPREAD     = 0.12;   // deterministic angular fan (index-derived, NOT random)
const SCALE_MIN = 0.6, SCALE_MAX = 2.4, TBD_SCALE = 0.5;
const AMT_FLOOR = 500, AMT_CEIL = 200000;
```

<!-- Ring bucket by status (dim arc = declined + not-eligible + not-eligible-yet) -->
// active→ring0(1) · applied→ring1(1) · in-progress→ring2(3) · to-research→ring3(17)
// recurring→orbit@9 inclined(2) · {declined,not-eligible,not-eligible-yet}→dim@20 y-down(4)  ⇒ 28

<!-- Angular sector by requires501c3 tri-state -->
// 'no' → open-now front arc θ≈200–340° · 'yes' → gated rear-left θ≈20–140° · 'unknown' → side θ≈140–200°
// within a sector: order by representative amount desc, tie-break deadline.date asc, then index-derived ±SPREAD fan

<!-- Scale (CRYS-04) -->
```js
const rep = (g) => g.amount.avg ?? g.amount.max ?? g.amount.min;
function scaleFor(g) {
  if (g.amount.isTBD) return TBD_SCALE;                 // 0.5 "unformed raw-ore crystal"
  const a = Math.max(AMT_FLOOR, Math.min(AMT_CEIL, rep(g)));
  const t = (Math.log(a) - Math.log(AMT_FLOOR)) / (Math.log(AMT_CEIL) - Math.log(AMT_FLOOR));
  return SCALE_MIN + t * (SCALE_MAX - SCALE_MIN);
}
```

<!-- Derived sets — from DATA, verified row-by-row against grants.generated.json -->
```js
// BEAM (CRYS-06) exactly 4 — use requires501c3Raw, NOT the tri-state:
const isBeamTarget = (g) => g.requires501c3Raw === 'Yes - or fiscal sponsor';
//  → harry-s-black-allon-fuller-fund-bank-of-america, ford-foundation-justfilms-documentary-production,
//    ford-foundation-nyc-good-neighbor-committee, ben-jerry-s-foundation-jerry-greenfield-grassroots-organizing
//  beam source is always the center: {from:'ny-community-trust', to, kind:'beam'}

// PULSE (CRYS-05) exactly 3 — CLOCK-FREE (no Date.now); set membership from isPassed+cadence+status:
const NEVER_PULSE = new Set(['declined', 'not-eligible', 'not-eligible-yet']);
const isPulse = (g) => g.deadline.cadence === 'one-time' && !g.deadline.isPassed && !NEVER_PULSE.has(g.status);
//  → harry-s-black, ford-justfilms, ben-jerry (hey-helen excluded: passed+declined)

// FAMILY (CRYS-06) 2 pairs — parent SUBSTRING match (BofA funder strings differ):
const PARENTS = ['Ford Foundation', 'Bank of America'];
//  → Ford: justfilms ↔ nyc-good-neighbor ; BofA: harry-s-black ↔ bank-of-america-charitable-foundation
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: computeLayout positions/rings/sectors/scale + layout.test.ts (CRYS-02/04)</name>
  <read_first>.planning/phases/03-3d-crystarium-scene/03-RESEARCH.md (§Deterministic Layout Algorithm), src/lib/data/types.ts, src/lib/data/grants.generated.json (skim for id/amount/status shapes)</read_first>
  <files>src/lib/crystarium/layout.js, src/lib/crystarium/layout.test.ts</files>
  <behavior>
    - computeLayout(grants).nodes.length === 28; every node x/y/z/scale is Number.isFinite.
    - Deterministic: deepEqual(computeLayout(grants), computeLayout(grants)) (no Date/RNG in module).
    - center === 'ny-community-trust'; that node has x===0 && z===0 (ring 0, radius 0).
    - Ring counts by status bucket: active 1, applied 1, in-progress 3, to-research 17, recurring 2, dim-arc 4 (sum 28).
    - Scale: every node with amount.isTBD has scale === 0.5, and exactly 16 such nodes; giving-joy-grants scale ≈ 0.6 (floor); a Ford node (justfilms, avg 125000) scale > 2.2; all scales within [0.5, 2.4].
    - y follows DOME_CURVE (rim rings sit higher than the core); dim-arc nodes have y pushed below the core.
  </behavior>
  <action>
    Create `src/lib/crystarium/layout.js` as a PURE ES module — NO `import * as THREE`, NO `Date`, NO `Math.random()`. Signature and constants exactly per `<interfaces>`. Implement:
    1. A `ringOf(status)` bucketer: active→'active', applied→'applied', in-progress→'in-progress', to-research→'to-research', recurring→'recurring', and {declined, not-eligible, not-eligible-yet}→'dim'. Radius from `RING_RADIUS`.
    2. `scaleFor(g)` verbatim from `<interfaces>` (log-scale, TBD→0.5).
    3. Sector angle from `requires501c3` tri-state: 'no'→front arc (θ base 270°, span 200–340°), 'yes'→rear-left (θ base 80°, span 20–140°), 'unknown'→side (θ base 170°, span 140–200°). Within each (ring,sector) bucket, sort members by `rep(g)` desc, tie-break `deadline.date` asc (nulls last), then spread them across the arc using an INDEX-derived fan (`(i - (n-1)/2) * SPREAD` added to the base angle) — deterministic, never random.
    4. Position: `x = radius*cos(theta)`, `z = radius*sin(theta)`, `y = radius*DOME_CURVE + amountBump` where `amountBump = (scale - SCALE_MIN) * 0.5` (larger crystals lift slightly). Recurring = inclined orbit at radius 9 (add a small fixed +y tilt); dim-arc = radius 20 with `y` pushed negative (e.g. `y = -3 - ...`) so it reads as fallen off the dome. Core (radius 0) sits at origin low-center.
    5. Attach per-node fields: `{ id, x, y, z, scale, ring, sector, status, isTBD: g.amount.isTBD, isEquity: g.amount.isEquity, pulse: <false for now, set in Task 2>, beamTarget: <false for now, set in Task 2> }`. Return `{ nodes, edges: [], center: 'ny-community-trust' }` (edges filled in Task 2).
    Then create `src/lib/crystarium/layout.test.ts` importing `{ grants }` from `$lib/data` (or the relative json) and `computeLayout` — assert every `<behavior>` case. Use the derived TBD count (16) computed from the data, not a prose "~13".
  </action>
  <verify>
    <automated>pnpm exec vitest run src/lib/crystarium/layout.test.ts</automated>
  </verify>
  <done>layout.js exports pure `computeLayout` producing 28 finite deterministic nodes, center at origin, correct ring counts, and log/TBD scale; layout.test.ts green; `grep -L "Date\\|Math.random\\|from 'three'" layout.js` confirms no clock/RNG/three import.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Derived edges + pulse/beam flags + derive.test.ts (CRYS-05/06)</name>
  <read_first>src/lib/crystarium/layout.js (Task 1 output), .planning/phases/03-3d-crystarium-scene/03-RESEARCH.md (§Derived sets)</read_first>
  <files>src/lib/crystarium/layout.js, src/lib/crystarium/derive.test.ts</files>
  <behavior>
    - Beam: edges.filter(kind==='beam') has exactly 4, every `from` === 'ny-community-trust', and the `to` set equals the 4 fiscal-sponsor ids; each targeted node has beamTarget === true. Derived via `requires501c3Raw === 'Yes - or fiscal sponsor'` (using tri-state `requires501c3==='yes'` would wrongly yield 8 — assert the count is 4, not 8).
    - Pulse: exactly 3 nodes have pulse === true = {harry-s-black, ford-justfilms, ben-jerry}; no node with deadline.isPassed, non-'one-time' cadence, or status in {declined,not-eligible,not-eligible-yet} has pulse === true (hey-helen pulse === false).
    - Family: edges.filter(kind==='family') includes the Ford pair (justfilms↔nyc-good-neighbor) and the BofA pair (harry-s-black↔bank-of-america-charitable-foundation); count === 2.
    - Spine: edges.filter(kind==='spine').length > 0 and every spine edge connects existing node ids (from/to resolve in nodes).
  </behavior>
  <action>
    Extend `layout.js` (do not fork a new file). Add the three derivations verbatim from `<interfaces>`:
    - `isBeamTarget(g)` on `requires501c3Raw` → set each node's `beamTarget` and emit `{from:'ny-community-trust', to:id, kind:'beam'}` for the 4.
    - `isPulse(g)` clock-free → set each node's `pulse` boolean (exactly 3 true).
    - `deriveFamilies(grants)` with `PARENTS = ['Ford Foundation','Bank of America']`, `g.funder.includes(parent)` SUBSTRING match (NOT equality — the BofA funder strings differ), emitting `{from,to,kind:'family'}` for each consecutive pair in a parent group.
    - Spine (`kind:'spine'`): `center → each ring's inward-most node`, plus sequential `node[i]→node[i+1]` within each ring cluster (ordered as positioned in Task 1). Concatenate spine + family + beam into `edges`.
    Return `{ nodes, edges, center: 'ny-community-trust' }`. Create `src/lib/crystarium/derive.test.ts` asserting every `<behavior>` case — explicitly assert beam count === 4 (and that the tri-state approach would give 8, documented in a comment), pulse count === 3 with hey-helen excluded, and both family pairs present.
  </action>
  <verify>
    <automated>pnpm exec vitest run src/lib/crystarium/derive.test.ts</automated>
    <automated>pnpm exec vitest run src/lib/crystarium</automated>
  </verify>
  <done>layout.js emits spine+family+beam edges and per-node pulse/beamTarget flags; beam===4 (source always ny-community-trust), pulse===3 (hey-helen excluded), family===2 pairs; derive.test.ts + the full crystarium suite green.</done>
</task>

</tasks>

<verification>
- `pnpm exec vitest run src/lib/crystarium` all green (tokens + layout + derive).
- `layout.js` has no `three` import, no `Date`, no `Math.random` (grep clean) — determinism guaranteed.
- Beam/pulse/family counts are asserted against the data-derived sets (4/3/2), not hardcoded prose counts.
</verification>

<success_criteria>
The pure layout module deterministically produces 28 finite nodes (center at origin), log/TBD-correct scales, and the three data-derived edge/flag sets (beam 4, pulse 3, family 2 pairs) — all proven by passing unit tests that are the phase's load-bearing automated verification.
</success_criteria>

<output>
After completion, create `.planning/phases/03-3d-crystarium-scene/03-02-SUMMARY.md`.
</output>
