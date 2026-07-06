---
phase: 03-3d-crystarium-scene
plan: 03
subsystem: crystarium
tags: [threlte, three, webgl, svelte5-runes, ssr-safe, glassmorphism, hud, interactivity]

# Dependency graph
requires:
  - phase: 03-01
    provides: tokens.ts (statusHue/activation numeric hex), three/threlte/postprocessing deps, vite ssr.noExternal, app.d.ts InteractivityProps
  - phase: 03-02
    provides: PURE computeLayout(grants) → {nodes, edges, center} (28 positioned nodes, scale, pulse, beamTarget)
  - phase: 02
    provides: typed grants dataset ($lib/data barrel, grants.generated.json)
provides:
  - runes state singleton src/lib/state/crystarium.svelte.js (ui{selected,hovered,filter,cameraFocus} + select/deselect/hover) — the Phase-3→Phase-4 bridge
  - browser-gated Threlte <Canvas> (dynamic-import-only, autoRender=false, dpr [1,2]) — SSR-safe WebGL boundary owned
  - CrystalNode: faceted emissive crystal, hue by status + scale by amount, hover/click raise into runes state
  - three prerendered glassmorphic HUD panels (SceneTitle, PipelineReadout, Legend) — real DOM, verify-build-safe
  - UI-SPEC HUD CSS tokens in app.css (DOM twin of tokens.ts)
affects: [03-04, Phase-4-detail-panel, Phase-4-filters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSR/WebGL seam: guard ONLY the <Canvas> behind {#if browser && mounted} + dynamic import(); HUD stays plain Svelte and prerenders. Never ssr=false."
    - "Runes module singleton (not context) as the scene→panel event bridge — survives the conditionally-mounted Canvas"
    - "Token discipline on the DOM side: HUD colours via CSS custom properties (--status-*, --surface-glass), no raw hex in components"
    - "Temporary in-Scene render task while autoRender=false, to be superseded by the 03-04 bloom EffectComposer as render authority"

key-files:
  created:
    - src/lib/state/crystarium.svelte.js
    - src/lib/hud/SceneTitle.svelte
    - src/lib/hud/PipelineReadout.svelte
    - src/lib/hud/Legend.svelte
    - src/lib/crystarium/CrystalNode.svelte
    - src/lib/crystarium/CrystariumScene.svelte
    - src/lib/crystarium/CrystariumCanvas.svelte
  modified:
    - src/routes/+page.svelte
    - src/app.css
    - src/lib/crystarium/layout.js

key-decisions:
  - "Kept plan-mandated <Canvas autoRender={false}> (reserved for 03-04 composer) and added a clearly-marked temporary render task in CrystariumScene so the 28 crystals are visible now"
  - "HUD strings authored as literal uppercase text (GRANT CRYSTARIUM etc.), not CSS text-transform, to satisfy the exact-string acceptance + verify grep"
  - "Annotated the 03-02 layout.js with additive JSDoc types (no behavior change) to keep svelte-check clean under checkJs — same subsystem, not deferred"

patterns-established:
  - "Pattern: browser-gated dynamic-import Canvas host + prerendered HUD siblings on one page"
  - "Pattern: CrystalNode reads statusHue/activation from tokens.ts + node.scale from layout — zero hardcoded visual constants"

requirements-completed: [CRYS-01, CRYS-03, CRYS-04]

# Metrics
duration: 30min
completed: 2026-07-05
---

# Phase 3 Plan 03: Scene Canvas, Nodes & HUD Summary

**A browser-gated Threlte Canvas renders all 28 status-coloured, amount-scaled crystal nodes and raises hover/select into a runes bridge, while three glassmorphic HUD panels prerender as real DOM — `pnpm build` + verify-build stay green (SSR-safe WebGL owned).**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-04T23:40Z
- **Completed:** 2026-07-05T04:10Z
- **Tasks:** 2
- **Files modified:** 10 (7 created, 3 modified)

## Accomplishments
- Runes state singleton (`ui` + `select/deselect/hover`) — the Phase-3 writes / Phase-4 reads bridge, module-scoped so it survives the conditionally-mounted Canvas.
- SSR-safe WebGL boundary owned: the `<Canvas>` mounts only behind `{#if browser && mounted}` via a dynamic `import()`; `pnpm build` prerenders with NO "window is not defined", ssr stays `true`.
- 28 crystal nodes from `computeLayout(grants)` — each an emissive faceted icosahedron coloured by `statusHue[status]` and scaled by `node.scale`; the active master gets a denser facet cluster; TBD nodes render rougher.
- Hover/click on any node raise `hover(id)` / `select(id)` into the runes state (interactivity() called once high in the tree).
- Three glassmorphic HUD panels (title/eyebrow, secured-vs-potential readout with tabular numerals, 8-hue status legend) prerender as real DOM with exact UI-SPEC copy.
- verify-build passes all 6 checks; `<title>` still contains "Eman_dashboard"; svelte-check clean (0/0); 31 layout tests still green.

## Task Commits

1. **Task 1: Runes state bridge + prerendered glassmorphic HUD** - `29c0bac` (feat)
2. **Task 2: Browser-gated Canvas + Scene + CrystalNode; +page.svelte rewire** - `543285d` (feat)

## Files Created/Modified
- `src/lib/state/crystarium.svelte.js` - runes `ui` singleton + select/deselect/hover (Phase-3→4 bridge)
- `src/lib/hud/SceneTitle.svelte` - top-left glass title/eyebrow panel
- `src/lib/hud/PipelineReadout.svelte` - top-right glass chip, SECURED $20,000 (gold) / POTENTIAL $296,500, tabular-nums
- `src/lib/hud/Legend.svelte` - bottom-left 8-row status legend, swatches driven from `--status-*` vars
- `src/lib/crystarium/CrystalNode.svelte` - one crystal: faceted geometry + emissive material (status hue), scale from layout, hover/click handlers
- `src/lib/crystarium/CrystariumScene.svelte` - interactivity() + 28 nodes + lights + temp camera/render task
- `src/lib/crystarium/CrystariumCanvas.svelte` - the `<Canvas autoRender={false} dpr={[1,2]}>` host (dynamic-import-only)
- `src/routes/+page.svelte` - prerendered HUD + browser-gated dynamic-import Canvas (rewritten from the Phase-1 shell)
- `src/app.css` - UI-SPEC HUD tokens (`--surface-glass`, `--text-hi/lo`, `--secured-gold`, `--status-*`)
- `src/lib/crystarium/layout.js` - additive JSDoc types (no behavior change)

## Decisions Made
- **autoRender=false kept + temporary render task:** the plan mandates `autoRender={false}` "reserved for the 03-04 bloom composer", but with no composer this phase the scene would draw black. Added a clearly-commented temporary render task in `CrystariumScene` (renders straight to screen each frame) that 03-04 removes when the EffectComposer becomes the render authority. This honours the plan's Canvas contract while satisfying the "28 crystals visible" success criterion.
- **Literal uppercase HUD strings:** authored `GRANT CRYSTARIUM` / `DIVERSITY INCLUDES DISABILITY` as literal text (not CSS `text-transform`) so both the exact-string checker acceptance and the verify grep pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a temporary render task so the scene renders under autoRender=false**
- **Found during:** Task 2 (Canvas + Scene wiring)
- **Issue:** Plan mandates `<Canvas autoRender={false}>` but the composer that would drive rendering is 03-04 — nothing would render this phase (Pitfall C).
- **Fix:** Added a commented temporary `useTask({stage: renderStage, autoInvalidate:false})` in `CrystariumScene` that renders scene→screen; flagged for removal in 03-04.
- **Files modified:** src/lib/crystarium/CrystariumScene.svelte
- **Verification:** Build prerenders; scene has a live render authority; manual render path present.
- **Committed in:** `543285d` (Task 2 commit)

**2. [Rule 1 - Type debt] Cleared 20 pre-existing checkJs errors in layout.js to hit "svelte-check clean"**
- **Found during:** Task 2 (svelte-check gate)
- **Issue:** `layout.js` (created in 03-02, checkJs=true) had 20 "implicitly any" / index-signature errors, blocking the plan's "svelte-check clean" success criterion. Typing `rep`/`scaleFor` params also surfaced latent `number | null` and possibly-undefined accesses.
- **Fix:** Added additive JSDoc `@param`/`@type` annotations and null-safe fallbacks (`rep(g) ?? AMT_FLOOR`, bucket/themeIndex guards) — behaviour-preserving. Same subsystem the scene consumes, so fixed rather than deferred.
- **Files modified:** src/lib/crystarium/layout.js, src/lib/state/crystarium.svelte.js (typed the `ui` $state shape)
- **Verification:** svelte-check 0 errors / 0 warnings; all 31 layout unit tests still pass (determinism intact).
- **Committed in:** `543285d` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 type-debt)
**Impact on plan:** Both necessary to meet the plan's own success criteria (visible scene + svelte-check clean). No scope creep; no Phase-4 consumers built.

## Issues Encountered
- svelte-check runs under `checkJs: true`, so annotating one function param cascaded into surfacing real null-safety gaps in `layout.js`. Resolved with behaviour-preserving fallbacks, confirmed by the 31 pre-existing layout tests.

## Known Stubs
The scene intentionally leaves 03-04 placeholders (documented in-plan, not blocking this plan's CRYS-01/03/04 goal):
- No `CrystalPath` (spine/family/beam edges) yet — 03-04.
- No `CameraRig` (OrbitControls autoRotate + GSAP focus-on-select) — a temporary static camera + gentle idle orbit stands in — 03-04.
- No `Effects` SelectiveBloom composer — a temporary render task stands in — 03-04.
- Runes `select/hover` are written but have no consumer (DetailPanel/filters) — Phase 4 by design.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 03-04 can now add `CrystalPath`, `CameraRig`, and the `Effects` SelectiveBloom composer. When the composer lands, REMOVE the temporary render task in `CrystariumScene` (it will otherwise double-render with the composer).
- The runes bridge is ready for Phase 4 to consume `ui.selected` / `ui.hovered` / `ui.cameraFocus`.

## Self-Check: PASSED

All 7 created files present on disk + SUMMARY.md; both task commits (`29c0bac`, `543285d`) exist in git history. Build prerenders, verify-build 6/6, svelte-check 0/0, 31 layout tests green.

---
*Phase: 03-3d-crystarium-scene*
*Completed: 2026-07-05*
