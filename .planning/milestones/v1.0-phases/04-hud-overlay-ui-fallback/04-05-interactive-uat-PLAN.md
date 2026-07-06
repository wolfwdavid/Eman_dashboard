---
phase: 04-hud-overlay-ui-fallback
plan: 05
type: execute
wave: 4
depends_on: [04]
files_modified: []
autonomous: false
requirements: [DETL-01, DETL-02, DETL-03, PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, QRUI-01]
must_haves:
  truths:
    - "Clicking a crystal slides in the detail rail with all fields, Next Action CTA, and a working new-tab link"
    - "Applying a filter dims non-matching crystals and disables their hover/select"
    - "Expanding the drawer renders all 4 charts with status/gate hues; tooltips show on hover"
    - "The QR widget toggles open and shows two scannable tiles on white plates"
  artifacts: []
  key_links: []
---

<objective>
Human verification of the interactive canvas↔DOM flows that cannot be asserted automatically (client-hydrated chart SVG, 3D dim effect, drill-down, QR scannability). Everything automatable was already gated in Plans 04-01..04-04; this checkpoint confirms the live experience.

Purpose: The pure math, component structure, and build invariants are machine-verified; the felt interaction (select → rail, filter → scene dim, charts render, QR toggles) needs eyes.
Output: user sign-off (or a gap list feeding `/gsd:plan-phase --gaps`).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/04-hud-overlay-ui-fallback/04-UI-SPEC.md
@.planning/phases/04-hud-overlay-ui-fallback/04-VALIDATION.md
@tools/screenshot-scene.mjs
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Interactive UAT — drill-down, filter dim, charts, QR, raycast</name>
  <files>none (verification only)</files>
  <what-built>
    The full Phase-4 HUD overlay layered over the Crystarium: a right-edge Detail Panel (opens on node select), a collapsible bottom Pipeline drawer (4 LayerChart charts + a 3-axis filter bar), and a bottom-right QR widget — all machine-verified for math (securedTotal=20000, potentialTotal=296500, counts Σ28, gate 12/8/8, matchesFilter), component structure (exact eyebrows/CTA strings/target=_blank), and the base-path build (verify-build 6/6, SSR-safe, title intact).
  </what-built>
  <action>
    Human-only interactive verification of the canvas↔DOM flows that cannot be asserted automatically (client-hydrated chart SVG, 3D dim effect, drill-down, QR scannability). Follow the how-to-verify steps below and report pass/fail per step.
  </action>
  <how-to-verify>
    Start the app locally: `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm dev` (or `pnpm build && pnpm preview`), open the served base-path URL, then:
    1. DRILL-DOWN (DETL-01/02/03): click a crystal node → the detail rail slides in from the right (220ms). Confirm all 9 fields show; Amount and Deadline each show a human-readable line AND the raw string beneath; the Next Action banner is the loudest element; click "Open funder site ↗" → the funder site opens in a NEW tab. Close via ×, Esc, and a background click — each returns to overview.
    2. FILTER → SCENE DIM (PIPE-05): open the filter bar; pick a status chip → non-matching crystals visibly DIM (opacity ~0.3) and you CANNOT hover/select them; matching nodes stay full. Try a gate segment and a type segment; combine axes; hit Reset → all restored. A zero-match combo shows "No funders match these filters."
    3. CHARTS (PIPE-01..04): expand the Pipeline drawer → 4 charts render — A status distribution (8 hue bars), B Secured $20,000 (gold) vs Potential $296,500 (cool), C deadline timeline ordered by urgency (near = coral, Hey Helen = passed/ash), D 501(c)(3) Open 12 / Gated 8 / Unknown 8. Hover a mark → tooltip shows funder + figure. (Charts paint AFTER load — expected; they are client-hydrated.)
    4. QR (QRUI-01/02): click the bottom-right `SHARE ◹` widget → it expands to two QR tiles on white plates with labels "Visit DID" / "Support / Tracker". Scan the "Visit DID" tile with a phone → it opens diversityincludesdisability.org. (The second is a REPLACE-ME placeholder — expected.)
    5. RAYCAST INTACT (Pitfall 2): confirm orbit/hover/select still work when clicking empty canvas space between panels — the overlay must NOT have swallowed the canvas raycast.
    6. (Optional) If the WebGL fallback shipped: disable WebGL / hard-refresh on a no-WebGL context → a 2D grant list renders with the notice, and a row click still opens the Detail Panel.
    Capture a screenshot if helpful: `node tools/screenshot-scene.mjs`.
  </how-to-verify>
  <verify>Manual — human confirmation of steps 1-5 (6 optional). No automated command; the automated gates ran in Plans 04-01..04-04.</verify>
  <done>User types "approved" after all interactive flows pass, or lists specific step failures for gap closure.</done>
  <resume-signal>Type "approved" if all pass, or list the specific failures (which step, what you saw) to feed `/gsd:plan-phase 04 --gaps`.</resume-signal>
</task>

</tasks>

<verification>
Human confirmation of the four interactive flows (drill-down, filter-dims-scene, charts+tooltips, QR toggle) plus raycast-intact. No automated gate here — those ran in 04-01..04-04.
</verification>

<success_criteria>
- User confirms select→detail rail with all fields + working new-tab link (DETL).
- User confirms filter dims + disables non-matching crystals (PIPE-05).
- User confirms 4 charts render with correct numbers/hues + tooltips (PIPE-01..04).
- User confirms QR widget toggles + tiles are scannable (QRUI-01).
- Canvas raycast still works in empty overlay space.
</success_criteria>

<output>
After sign-off, create `.planning/phases/04-hud-overlay-ui-fallback/04-05-SUMMARY.md` recording the UAT result (approved or gaps).
</output>
