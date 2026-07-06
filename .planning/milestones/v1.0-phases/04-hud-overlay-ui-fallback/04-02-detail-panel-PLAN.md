---
phase: 04-hud-overlay-ui-fallback
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/lib/hud/DetailPanel.svelte
autonomous: true
requirements: [DETL-01, DETL-02, DETL-03]
must_haves:
  truths:
    - "Selecting a node (ui.selected) slides in a right-edge rail showing all 9 Grant fields"
    - "Amount and Deadline show human-readable text AND the raw string as subtext"
    - "Next Action is the loudest element (full-width CTA banner); null → muted 'No action queued.'"
    - "The Link is 'Open funder site ↗' opening in a new tab with rel=noopener noreferrer"
    - "ui.selected == null → panel closed (translated off-canvas); × / Esc / calls deselect()"
    - "Investment type is flagged 'Equity — not a grant'; status pill echoes the node hue"
  artifacts:
    - path: "src/lib/hud/DetailPanel.svelte"
      provides: "Right-edge slide-in grant detail rail (z-30), reads ui.selected, uses format.ts"
      min_lines: 120
  key_links:
    - from: "src/lib/hud/DetailPanel.svelte"
      to: "src/lib/state/crystarium.svelte.js"
      via: "reads ui.selected + calls deselect()"
      pattern: "ui.selected|deselect"
    - from: "src/lib/hud/DetailPanel.svelte"
      to: "src/lib/data/format.ts"
      via: "formatAmount / formatDeadline / gateBadge"
      pattern: "formatAmount|formatDeadline|gateBadge"
---

<objective>
Build the grant Detail Panel: a right-edge slide-in glass rail (z-30, ~380px) that opens when a crystal is selected and surfaces all 9 `Grant` fields — normalized Amount/Deadline human-readable WITH raw subtext, a status pill echoing the node hue, a 501(c)(3) gate badge, the Next Action as the loudest CTA banner, and the external Link opening in a new tab.

Purpose: The single primary focus while a node is selected — the DOM mirror of the scene's "one selected node." All display logic already lives in the tested `format.ts`; this is composition + the inherited glass styling.
Output: `src/lib/hud/DetailPanel.svelte` (mounted by Plan 04-04).
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
@src/lib/state/crystarium.svelte.js
@src/lib/hud/PipelineReadout.svelte

<interfaces>
<!-- format.ts (from Plan 04-01) — USE these, do not re-derive rules -->
formatAmount(a: GrantAmount): { text: string; tone: 'gold'|'muted'|'hi'; raw: string }
formatDeadline(d: GrantDeadline, now?: number): { text: string; tone: string; raw: string }
gateBadge(requires501c3, requires501c3Raw): { label: string; token: string; hint?: string }

<!-- runes bridge -->
import { ui, deselect } from '$lib/state/crystarium.svelte.js'   // ui.selected is the grant id | null
import { grants } from '$lib/data'                               // grant = grants.find(g => g.id === ui.selected)

<!-- Inherited glass recipe (from PipelineReadout.svelte) -->
background: var(--surface-glass); border: 1px solid var(--surface-glass-border);
backdrop-filter: blur(16px); radius 14px; tokens: --text-hi/--text-lo/--secured-gold/--urgent/--status-*
Type: Orbitron display (--font-display) 32/20; Inter body (--font-body) 14/12; tabular-nums on figures.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Detail Panel shell + header + field rows (status/type/amount/deadline/gate/fit)</name>
  <files>src/lib/hud/DetailPanel.svelte</files>
  <read_first>04-UI-SPEC.md §Detail Panel (header + field-rows table + amount/deadline/gate rule tables), src/lib/data/types.ts, src/lib/hud/PipelineReadout.svelte (glass recipe)</read_first>
  <action>
    Create `src/lib/hud/DetailPanel.svelte`. Derive the record:
    ```svelte
    import { ui, deselect } from '$lib/state/crystarium.svelte.js';
    import { grants } from '$lib/data';
    import { formatAmount, formatDeadline, gateBadge } from '$lib/data/format';
    const grant = $derived(ui.selected ? grants.find(g => g.id === ui.selected) ?? null : null);
    ```
    Wrap in `{#if grant}` so the panel content only exists when selected. Root = `position: fixed`, right edge, full height, width ~380px, z-index 30, `pointer-events: auto`, glass recipe (blur 16px), padding lg/24px, radius 14px, internal scroll on overflow.
    HEADER (per §Detail Panel → Header): 12×12px crystal swatch in `var(--status-{grant.status})` + hairline top-border same hue; funder title `grant.funder` Orbitron 20/600 `--text-hi`; program subtitle `grant.program` (if non-null) Inter 14/400 `--text-lo`; a `×` close button top-right (`--text-lo`→`--text-hi` on hover) calling `deselect()`.
    FIELD ROWS — each row = Inter 12/400 UPPERCASE eyebrow in `--text-lo` (+0.14em tracking) + value below. Implement rows 1,2,3,4,5,6 (Next Action + Link are Task 2). EXACT eyebrows:
      1. `STATUS` → status pill: 12×12 hue swatch + `grant.statusLabel` verbatim; pill tint = color-mix of `var(--status-{status})` low alpha on glass.
      2. `TYPE` → badge. `Grant` = neutral (`--text-lo` border); `Grant/Fellowship` = violet (`--status-applied`) tint; `Investment` = ash (`--status-not-eligible`) tint + append label text "Equity — not a grant".
      3. `AMOUNT` → `const a = formatAmount(grant.amount)`. Primary line Orbitron 32/600 tabular = `a.text`, colored: `a.tone==='gold'`→`--secured-gold`, `'muted'`→`--text-lo`, `'hi'`→`--text-hi`. Directly beneath: `a.raw` as Inter 14/400 `--text-lo` subtext (ALWAYS shown).
      4. `DEADLINE` → `const d = formatDeadline(grant.deadline)`. Chip Inter 14/400 tabular = `d.text`, tint by `d.tone` (urgent→`--urgent`, in-progress→`--status-in-progress`, declined→`--status-declined`, lo→`--text-lo`, hi→`--text-hi`). Beneath: `d.raw` subtext (ALWAYS shown).
      5. `501(C)(3)` → `const g501 = gateBadge(grant.requires501c3, grant.requires501c3Raw)`. Badge label `g501.label` colored `var(${g501.token})` (--gate-open/--gate-gated/--gate-unknown); if `g501.hint` present render it in `--secured-gold` 12/400 (e.g. "NY Community Trust may sponsor").
      6. `FIT / ELIGIBILITY` → `grant.fit` body prose Inter 14/400 `--text-hi`, line-height 1.5.
    Use tabular-nums (`font-variant-numeric: tabular-nums`) on all figures. Exactly the 4 sizes (12/14/20/32) and 2 weights (400/600). 8-pt spacing (rows gap md/16px, inner sm/8px).
  </action>
  <verify>
    <automated>test -f src/lib/hud/DetailPanel.svelte && grep -q "formatAmount" src/lib/hud/DetailPanel.svelte && grep -q "gateBadge" src/lib/hud/DetailPanel.svelte && grep -q "STATUS" src/lib/hud/DetailPanel.svelte && grep -q "AMOUNT" src/lib/hud/DetailPanel.svelte && grep -q "DEADLINE" src/lib/hud/DetailPanel.svelte && grep -q "501(C)(3)" src/lib/hud/DetailPanel.svelte && grep -q "Equity — not a grant" src/lib/hud/DetailPanel.svelte && grep -q "deselect" src/lib/hud/DetailPanel.svelte</automated>
  </verify>
  <done>DetailPanel renders header (hue swatch + funder title + program + × deselect) and rows 1-6 with exact eyebrows, amount/deadline via format.ts with raw subtext, Investment flagged "Equity — not a grant", gate badge, fit prose. Glass styling inherited.</done>
</task>

<task type="auto">
  <name>Task 2: Next Action CTA banner + external Link + open/close motion</name>
  <files>src/lib/hud/DetailPanel.svelte</files>
  <read_first>04-UI-SPEC.md §Detail Panel (rows 7-8, Empty state) + §Motion (Detail Panel enter 220ms / exit 150ms), 04-RESEARCH §Code Examples</read_first>
  <action>
    Extend `DetailPanel.svelte` with the two loudest rows and the motion:
    ROW 7 `NEXT ACTION` (DETL-03) → the PRIMARY CTA banner, the loudest element: a full-width tinted band (`--surface` fill + hue hairline in `var(--status-{grant.status})`), Inter 14/400 `--text-hi`, containing `grant.nextAction` VERBATIM. If `grant.nextAction == null` → render muted "No action queued." in `--text-lo`. Give it the 2xl/48px vertical rhythm (banner stands apart).
    ROW 8 (Link, DETL-03) → a Link button "Open funder site ↗" as:
    ```svelte
    <a href={grant.link} target="_blank" rel="noopener noreferrer">Open funder site ↗</a>
    ```
    Primary-action styling: hue-tinted border, brightens on hover. The `↗` glyph is required copy.
    MOTION (transform/opacity only, exits faster): use `svelte/transition` `fly` — enter `translateX(24px→0)` + opacity, 220ms ease-out; exit 150ms ease-in. Apply to the `{#if grant}` root so it slides in on select and out on deselect (spatial continuity toward the node — origin nudged toward the right edge is fine).
    EMPTY STATE: when `ui.selected == null` the `{#if grant}` is false → nothing rendered (panel is off-canvas/closed). Do NOT render an empty shell.
    CLOSE via Esc: add a `<svelte:window onkeydown={(e) => e.key === 'Escape' && deselect()} />` (background-click close is handled by the scene layer in Plan 04-04). Keep exactly 4 type sizes / 2 weights; tabular-nums on any figure.
  </action>
  <verify>
    <automated>grep -q "NEXT ACTION" src/lib/hud/DetailPanel.svelte && grep -q "No action queued" src/lib/hud/DetailPanel.svelte && grep -q "Open funder site ↗" src/lib/hud/DetailPanel.svelte && grep -q 'target="_blank"' src/lib/hud/DetailPanel.svelte && grep -q 'rel="noopener noreferrer"' src/lib/hud/DetailPanel.svelte && grep -qE "fly|transition:" src/lib/hud/DetailPanel.svelte && grep -q "Escape" src/lib/hud/DetailPanel.svelte && pnpm check</automated>
  </verify>
  <done>Next Action renders as the loudest CTA banner (null→"No action queued."); Link is "Open funder site ↗" with target=_blank rel=noopener noreferrer; panel flies in 220ms / out 150ms; Esc calls deselect(); `pnpm check` (svelte-check) passes.</done>
</task>

</tasks>

<verification>
- `pnpm check` (svelte-check) clean.
- grep asserts: all 7 eyebrows, "Equity — not a grant", "Open funder site ↗", target=_blank, rel=noopener noreferrer, "No action queued.", format.ts usage, deselect wiring, Esc handler.
- Interactive drill-down (select → rail slides in with all fields) is manual — covered by the Plan 04-05 checkpoint.
</verification>

<success_criteria>
- All 9 Grant fields surfaced; Amount/Deadline human-readable + raw subtext (DETL-02).
- Next Action = loudest CTA banner; Link opens funder site in a new tab (DETL-03).
- Panel opens on ui.selected, closed when null; × / Esc call deselect() (DETL-01).
- Inherited glass, exactly 4 sizes / 2 weights, tabular figures, exits faster than enters.
</success_criteria>

<output>
After completion, create `.planning/phases/04-hud-overlay-ui-fallback/04-02-SUMMARY.md`
</output>
