# Phase 5: Premium Polish / Animation / Perf - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

The dashboard gains its final premium RPG game-UI feel: a Crystarium-style INTRO animation on load (AEST-01), an activation animation vocabulary for node selection (already partially present — polish it), refinement of the glassmorphism RPG HUD (AEST-02 — largely shipped in Phases 3/4; this phase fixes the known collisions and tightens the game feel), and a performance pass (pixel-ratio cap, selective bloom cost, render-on-demand where possible) so the scene stays smooth on mid-range hardware. This is the LAST phase of milestone v1.0.

</domain>

<decisions>
## Implementation Decisions

### AEST-01 — Intro / activation animations (GSAP already installed)
- **Intro on load**: a Crystarium "awakening" — nodes materialize/scale-in staggered (30–50ms per node per ui-ux-pro-max stagger rule, rim→center or center→rim), paths draw in after nodes, camera eases from a pulled-back reveal into the idle orbit. Duration budget: total intro ≤ 2.5s; must be interruptible (any pointer input skips to the settled state).
- **Activation on select**: the existing burst is the base — polish so selection reads as an FFXIII crystal "activation" (short bloom-intensity spike + scale pop, 150–300ms, transform/uniform only).
- Respect the existing motion system: transform/opacity/material-uniform only; exits faster than enters; interruptible tweens (kill on new input); no layout-shifting animations.
- No sound this build (v2 IMM-01).

### AEST-02 — Glassmorphism RPG HUD polish + the 3 carried UAT fixes (MUST land)
1. **Detail rail ↔ PipelineReadout collision**: when the detail rail is open, the top-right readout must not sit under it — fade/slide the readout out while the rail is open (or restack). 
2. **Duplicate deadline line** in DetailPanel when human-readable === raw — suppress the raw subtext when identical.
3. **Expanded drawer covers SceneTitle** — cap the drawer's max-height (e.g. ~60vh) and/or fade the title while expanded so the scene/title never fully disappear.
- General HUD tightening within the established tokens: consistent panel radii/borders/hairlines, hover/press states on all interactive chips/buttons (150ms), Orbitron/Inter discipline, tabular figures everywhere.

### Performance pass
- Cap renderer pixel ratio (dpr already [1,2] — verify), confirm bloom threshold/selective settings don't melt weaker GPUs, avoid per-frame allocations in useTask loops, keep draw calls flat (28 nodes + edges is small; no instancing needed).
- The intro must not regress prerender: all animation is client-side post-mount; `pnpm build` + verify-build 6/6 stay green; ssr never false.
- Playwright smoke + UAT tools still pass; capture a fresh live screenshot after deploy as the visual gate.

### Claude's Discretion
- Exact intro choreography/easings, the readout-hide mechanism, drawer max-height value, any micro-polish within the existing token/motion system.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- GSAP 3.15 installed (CameraRig already uses it). Bloom/EffectComposer in `src/lib/crystarium/Effects.svelte`. Node/path components with activation/pulse uniforms. Runes bridge with ui.selected/cameraFocus.
- UAT tooling: `tools/screenshot-scene.mjs`, `tools/uat-overlay.mjs`, `tools/uat-detail.mjs`, `tools/uat-filter.mjs` — reuse for the final visual gate.
- Full test suite: 159 vitest + verify-build 6/6 + Playwright smoke.

### Established Patterns
- pnpm; Windows base-path build `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build`; commit style; three pinned 0.185.1; ssr/prerender invariants; chart-SVG-grep trap; Pages wedge remedy (delete+recreate via gh api) if deploy flakes.

### Integration Points
- Intro lives in the scene components (CrystariumScene/CrystalNode/CrystalPath/CameraRig); HUD fixes in DetailPanel/PipelineDrawer/PipelineReadout/+page.svelte layout.

</code_context>

<specifics>
## Specific Ideas

The intro is the "wow" moment — the Crystarium waking up: crystals igniting outward with the gold secured node landing last (or first — choreographer's call), paths tracing, camera settling into orbit. It should feel like the FFXIII Crystarium reveal without ever blocking input.

</specifics>

<deferred>
## Deferred Ideas

- Sound cues (IMM-01), ambient particles beyond bloom (IMM-02), node leveling arcs (IMM-03), expanded analytics (ANLY-01) — all v2.

</deferred>
