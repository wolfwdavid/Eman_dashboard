---
phase: 05-premium-polish-animation-perf
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/hud/PipelineReadout.svelte
  - src/lib/hud/DetailPanel.svelte
  - src/lib/data/format.ts
  - src/lib/data/format.test.ts
  - src/lib/hud/PipelineDrawer.svelte
  - src/lib/hud/FilterBar.svelte
autonomous: true
requirements: [AEST-02]
must_haves:
  truths:
    - "When a node is selected (the detail rail is open), the top-right PipelineReadout fades/slides out so it no longer sits under the rail"
    - "The DetailPanel deadline row shows NO duplicate raw line when the human-readable text is identical to the raw string"
    - "The expanded PipelineDrawer is height-capped (~60vh) so the SceneTitle and the scene behind it stay visible"
    - "Interactive chips/segments/buttons have consistent hover AND press feedback (~150ms) within the existing tokens"
  artifacts:
    - path: "src/lib/hud/PipelineReadout.svelte"
      provides: "Auto-hide (fade/slide) while ui.selected is set"
      contains: "ui.selected"
    - path: "src/lib/data/format.ts"
      provides: "Pure predicate that flags when a formatted deadline's raw is redundant (equals the human-readable text)"
      contains: "raw"
    - path: "src/lib/data/format.test.ts"
      provides: "Unit coverage for the redundant-raw predicate"
      contains: "redundant"
    - path: "src/lib/hud/DetailPanel.svelte"
      provides: "Deadline (and amount) raw subtext suppressed when identical to the human-readable text"
      contains: "raw"
    - path: "src/lib/hud/PipelineDrawer.svelte"
      provides: "Expanded charts region capped at ~60vh so the title/scene stay visible"
      contains: "vh"
    - path: "src/lib/hud/FilterBar.svelte"
      provides: "Press (:active) states added to chips/segments/reset within existing token transitions"
      contains: ":active"
  key_links:
    - from: "src/lib/hud/PipelineReadout.svelte"
      to: "src/lib/state/crystarium.svelte.js"
      via: "imports ui, toggles a hidden class on ui.selected !== null"
      pattern: "ui\\.selected"
    - from: "src/lib/hud/DetailPanel.svelte"
      to: "src/lib/data/format.ts"
      via: "conditionally renders the deadline raw subtext using the redundancy predicate"
      pattern: "raw"
---

<objective>
Land the three carried UAT fixes and tighten the glassmorphism HUD (AEST-02) so the overlay reads as a polished RPG interface with no collisions:
  1. Detail rail ↔ PipelineReadout collision — fade/slide the top-right readout out while the rail is open.
  2. Duplicate deadline line in DetailPanel — suppress the raw subtext when it equals the human-readable text.
  3. Expanded drawer covers SceneTitle — cap the drawer's expanded height (~60vh) so the title/scene stay visible.
Plus small, token-safe HUD tightening: consistent hover/press states on interactive chips/buttons (~150ms).

Purpose: These are the last known cosmetic collisions from the Phase-4 UAT (04-05-SUMMARY). They are the difference between "works" and "premium." All changes stay within the established tokens/motion system.
Output: Four surgical component edits + one pure predicate with unit coverage. No new deps, no a11y additions, no v2 scope.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-premium-polish-animation-perf/05-CONTEXT.md
@.planning/phases/05-premium-polish-animation-perf/05-VALIDATION.md
@.planning/phases/04-hud-overlay-ui-fallback/04-05-SUMMARY.md

# The files this plan modifies — READ THEM FIRST, this is a modification phase.
@src/lib/hud/PipelineReadout.svelte
@src/lib/hud/DetailPanel.svelte
@src/lib/hud/PipelineDrawer.svelte
@src/lib/hud/FilterBar.svelte
@src/lib/data/format.ts
@src/lib/data/format.test.ts
@src/lib/state/crystarium.svelte.js

<interfaces>
<!-- Contracts the executor needs. Use directly — no codebase exploration. -->

Runes bridge (src/lib/state/crystarium.svelte.js):
  ui = $state({ selected: string|null, hovered, cameraFocus, filter })
  — importing `ui` in a prerendered HUD component is safe (plain JS module, no Three;
    DetailPanel already does this and prerenders fine; SSR sees selected:null → visible).

format.ts (src/lib/data/format.ts) exports:
  formatAmount(a): { text, tone: 'gold'|'muted'|'hi', raw }
  formatDeadline(d, now?): { text, tone: string, raw }
  gateBadge(requires501c3, requires501c3Raw): { label, tone, sponsorHint }
  — these are PURE and unit-tested in format.test.ts (clock injected via `now`).

DetailPanel deadline row (current — the duplicate source):
  <span class="deadline-chip" ...>{deadline!.text}</span>
  <span class="subtext">{deadline!.raw}</span>   <!-- renders even when raw === text -->
DetailPanel amount row uses the same pattern ({amount!.text} + <span class="subtext">{amount!.raw}</span>).

PipelineReadout: top-right fixed panel, z-index 10, pointer-events: none, no ui import today.
PipelineDrawer: `.charts` wraps the 2×2 `.grid`; `open` is local $state; charts region has no height cap today.
FilterBar: `.chip` / `.seg` / `.reset` buttons already have :hover + 120ms colour transitions; NO :active press states yet.
</interfaces>

<constraints>
- TOKENS ONLY: use existing CSS custom properties (--surface-glass, --surface-glass-border, --text-hi/lo, --node-hue, --status-*, --secured-gold, --path, --urgent). NO new hex/alpha tokens; color-mix on existing tokens is the established tint pattern.
- MOTION DISCIPLINE: transform/opacity only, ~150ms, exits faster than enters. No layout-shifting animations.
- SSR-SAFE: every file here is prerendered DOM. Importing `ui` is fine; do NOT import three/gsap. Do NOT set ssr=false.
- SCOPE: keep it TIGHT — this is polish, not a rebuild. Fix exactly the three collisions + the small hover/press tightening. NO a11y additions (out of scope this build), NO new charts, NO v2 (sound/particles).
- Zero file overlap with plan 05-01 (that plan owns src/lib/crystarium/*). These two plans run in parallel.
</constraints>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Suppress duplicate deadline raw subtext (pure predicate + unit test + DetailPanel)</name>
  <files>src/lib/data/format.ts, src/lib/data/format.test.ts, src/lib/hud/DetailPanel.svelte</files>
  <action>
    Fix #2 (04-05-SUMMARY cosmetic note 2): the deadline line renders twice when the human-readable text equals the raw string.

    format.ts — add a tiny PURE predicate so the rule is unit-testable (VALIDATION 5-hud-fix-deadline prefers a unit test over grep):
      - `export const rawRedundant = (text: string, raw: string): boolean => text.trim() === raw.trim();`
      Keep it generic (works for both deadline and amount subtext). No side effects.

    format.test.ts — add a `describe('rawRedundant', ...)` with cases:
      - identical strings → true (e.g. `rawRedundant('Rolling', 'Rolling')`).
      - differing strings → false (e.g. `rawRedundant('in 24 days', '2026-06-30 (decision by Oct 31)')`).
      - whitespace-only difference → true.
      Import `rawRedundant` from './format'.

    DetailPanel.svelte:
      - import `rawRedundant` alongside the existing `formatAmount, formatDeadline, gateBadge` from '$lib/data/format'.
      - Row 4 (DEADLINE): only render `<span class="subtext">{deadline!.raw}</span>` when `!rawRedundant(deadline!.text, deadline!.raw)`.
      - Apply the SAME guard to Row 3 (AMOUNT) subtext for symmetry (prevents the mirror duplicate; harmless — same one-line conditional).
      - Do NOT change the DETL-02 contract otherwise: when raw genuinely differs, both the human-readable text and the raw subtext still show.
  </action>
  <verify>
    <automated>grep -q "rawRedundant" src/lib/data/format.ts && grep -q "rawRedundant" src/lib/data/format.test.ts && grep -q "rawRedundant" src/lib/hud/DetailPanel.svelte && pnpm test:unit</automated>
  </verify>
  <done>rawRedundant exported + unit-tested; DetailPanel hides the deadline (and amount) raw subtext when identical to the human-readable text, still shows it when different; vitest green (now >159).</done>
</task>

<task type="auto">
  <name>Task 2: Auto-hide PipelineReadout while the detail rail is open</name>
  <files>src/lib/hud/PipelineReadout.svelte</files>
  <action>
    Fix #1 (04-05-SUMMARY cosmetic note 1): the open detail rail (z-30, right edge) overlaps the top-right PipelineReadout (z-10). Fade/slide the readout out while a node is selected.

    PipelineReadout.svelte:
      - import `{ ui }` from '$lib/state/crystarium.svelte.js' (safe — plain module, no Three; SSR sees selected:null → readout renders visible for prerender/first paint).
      - Add `class:hidden={ui.selected !== null}` to the `.panel` div.
      - CSS: add a transform+opacity transition to `.panel` (opacity + translateX, ~180ms enter / ~150ms would be exit — since this is a class toggle, use a single `transition: opacity 180ms ease, transform 180ms ease;`). Add a `.panel.hidden` rule that sets `opacity: 0; transform: translateX(12px); pointer-events: none;` so the readout slides slightly toward its edge and fades while the rail is open, then returns when deselected.
      - Keep `pointer-events: none` in the base rule (readout is ambient). Do not change the figures, tokens, or layout.
      - Note the mobile case: on ≤640px the rail becomes a bottom sheet and the readout is top-right — hiding it on selection is still correct and harmless.
  </action>
  <verify>
    <automated>grep -q "ui.selected" src/lib/hud/PipelineReadout.svelte && grep -q "hidden" src/lib/hud/PipelineReadout.svelte && pnpm run check && MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build</automated>
  </verify>
  <done>PipelineReadout imports ui and fades/slides out (opacity 0 + translateX, ~180ms) whenever ui.selected is set, returns on deselect; prerender still renders it visible; svelte-check clean; build exit 0.</done>
</task>

<task type="auto">
  <name>Task 3: Cap expanded drawer height + HUD hover/press tightening + build gate</name>
  <files>src/lib/hud/PipelineDrawer.svelte, src/lib/hud/FilterBar.svelte</files>
  <action>
    Fix #3 (04-05-SUMMARY cosmetic note 3): the expanded drawer covers the SceneTitle.
    PipelineDrawer.svelte:
      - Cap the expanded charts region so the title/scene stay visible: on `.charts` add `max-height: 60vh; overflow-y: auto;` (it already has `overflow: hidden` for the slide — change to allow vertical scroll within the cap, keep the slide transition intact). If the slide transition conflicts with overflow-y:auto, wrap the inner `.grid` scroll on `.charts` and keep the slide on the outer element — pick the cleaner of the two; the observable requirement is: expanded, the drawer never exceeds ~60vh so SceneTitle (top-left) and the scene remain visible.
      - Keep the drawer bottom-anchored, tokens/motion unchanged otherwise.

    HUD tightening (AEST-02, within existing tokens — small):
    FilterBar.svelte:
      - Add PRESS (:active) feedback to the interactive controls to match the 150ms discipline. For `.chip`, `.seg`, and `.reset`, add `:active` rules that give a subtle press (e.g. `transform: translateY(1px);` and/or a slightly stronger token tint via color-mix on the existing hue/token). Add `transform 120ms ease` to their existing transition lists so the press animates. Keep hover states as-is; do NOT introduce new tokens or change the active-filter (selected) styling.
      - Ensure radii/hairlines stay consistent with the existing values (999px chips, 10px segments/reset, 1px --surface-glass-border) — no changes needed unless something is inconsistent.

    Then run the full regression + build gate for this plan.
  </action>
  <verify>
    <automated>grep -q "60vh" src/lib/hud/PipelineDrawer.svelte && grep -q ":active" src/lib/hud/FilterBar.svelte && pnpm test:unit && MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && pnpm run verify:build && pnpm run check</automated>
  </verify>
  <done>Expanded drawer capped at ~60vh (SceneTitle/scene stay visible); FilterBar chips/segments/reset have press (:active) feedback within the 150ms token motion; vitest green, build exit 0, verify-build 6/6, svelte-check clean.</done>
</task>

</tasks>

<verification>
- vitest green (`pnpm test:unit`) including the new rawRedundant cases — no regressions.
- `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` exits 0.
- `pnpm run verify:build` → 6/6 (title intact, base-path assets).
- `pnpm run check` (svelte-check) clean.
- No ssr=false; all HUD files remain prerendered DOM; no new deps; no a11y additions.
- Final live visual gate (rail-no-overlap, deadline-no-duplicate, drawer-capped, hover/press) performed by the orchestrator via Playwright screenshots — NOT a task here.
</verification>

<success_criteria>
- AEST-02 satisfied: the three carried UAT collisions are fixed (readout auto-hide, deadline no-duplicate, drawer height cap) and the HUD is tightened with consistent hover/press states — all within existing tokens/motion.
- Zero file overlap with plan 05-01 (parallel, same wave).
</success_criteria>

<output>
After completion, create `.planning/phases/05-premium-polish-animation-perf/05-02-SUMMARY.md`.
</output>
