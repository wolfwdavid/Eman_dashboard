---
phase: 05-premium-polish-animation-perf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/crystarium/intro.svelte.js
  - src/lib/crystarium/CrystariumScene.svelte
  - src/lib/crystarium/CrystalNode.svelte
  - src/lib/crystarium/CrystalPath.svelte
  - src/lib/crystarium/CameraRig.svelte
autonomous: true
requirements: [AEST-01]
must_haves:
  truths:
    - "On load, the 28 crystals materialize in a staggered wave (not all at once), the connecting paths draw in AFTER the nodes, and the camera eases from a pulled-back reveal into the idle orbit — total intro ≤ 2.5s"
    - "Any pointer input during the intro immediately snaps the scene to the fully-settled steady state (interruptible)"
    - "Selecting a node produces a visible activation spike (emissive/bloom flash + scale pop) that settles within 150–300ms, transform/uniform only"
    - "After the intro completes the scene renders identically to the pre-intro steady state; pnpm build still prerenders SSR-safe (no window-is-not-defined, ssr never false)"
  artifacts:
    - path: "src/lib/crystarium/intro.svelte.js"
      provides: "Client-only intro controller — a GSAP-tweened revealProgress rune + startIntro/skipIntro/done"
      contains: "revealProgress"
    - path: "src/lib/crystarium/CrystalNode.svelte"
      provides: "Per-node staggered materialization (reveal factor) + tightened activation burst"
      contains: "revealProgress"
    - path: "src/lib/crystarium/CrystalPath.svelte"
      provides: "Path draw-in gated on intro progress (after nodes)"
      contains: "revealProgress"
    - path: "src/lib/crystarium/CameraRig.svelte"
      provides: "Reveal→settle intro camera tween, guarded against the cameraFocus effect"
      contains: "intro"
    - path: "src/lib/crystarium/CrystariumScene.svelte"
      provides: "Starts the intro on mount, plumbs revealRank to each node, skips on first pointer input"
      contains: "startIntro"
  key_links:
    - from: "src/lib/crystarium/CrystariumScene.svelte"
      to: "src/lib/crystarium/intro.svelte.js"
      via: "startIntro() on mount + window pointerdown → skipIntro()"
      pattern: "startIntro|skipIntro"
    - from: "src/lib/crystarium/CrystalNode.svelte"
      to: "src/lib/crystarium/intro.svelte.js"
      via: "reads intro.revealProgress in useTask to scale reveal factor"
      pattern: "intro\\.revealProgress"
    - from: "src/lib/crystarium/CameraRig.svelte"
      to: "src/lib/crystarium/intro.svelte.js"
      via: "intro camera tween runs while intro.active, cameraFocus effect early-returns during intro"
      pattern: "intro\\.(active|done)"
---

<objective>
Give the Crystarium its "awakening" intro (AEST-01): on load the crystals ignite in a staggered wave (gold secured master crystal at the origin lands last), the connecting paths trace in after the nodes, and the camera eases from a pulled-back reveal into the steady idle orbit — all within a ≤2.5s budget and fully interruptible (any pointer input snaps to the settled state). Also polish the existing node-selection burst so it reads as an FFXIII crystal "activation" (bloom/emissive spike + scale pop, 150–300ms).

Purpose: This is the phase's "wow" moment — the last visual layer that turns a working dashboard into a premium RPG game-UI. It must never block input and must never regress the SSR-safe prerender.
Output: A client-only intro controller module plus staggered materialization / path draw-in / camera reveal wired through the existing scene components, and a tightened activation burst.
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

# The files this plan modifies — READ THEM FIRST, this is a modification phase.
@src/lib/crystarium/CrystariumScene.svelte
@src/lib/crystarium/CrystalNode.svelte
@src/lib/crystarium/CrystalPath.svelte
@src/lib/crystarium/CameraRig.svelte
@src/lib/crystarium/CrystariumCanvas.svelte
@src/lib/state/crystarium.svelte.js
@src/lib/crystarium/tokens.ts

<interfaces>
<!-- Contracts the executor needs. Use directly — no codebase exploration. -->

The runes bridge (src/lib/state/crystarium.svelte.js) already exports:
  ui = $state({ selected, hovered, cameraFocus, filter })
  select(id) / deselect() / hover(id) / setFilter / resetFilters

CrystalNode current per-frame model (src/lib/crystarium/CrystalNode.svelte):
  - useTask((delta) => {...}) smooths curIntensity / curScale / curLift / curOpacity toward targets with k = min(1, delta*10)
  - `node` prop carries { id, x, y, z, scale, pulse }
  - burstT (seconds since selected) drives the activation burst: `burst = burstT < 0.3 ? 1 - burstT/0.3 : 0`
  - $effect: `if (ui.selected === grant.id) burstT = 0`
  - mesh.scale.setScalar(curScale); mesh.position.set(node.x, node.y + curLift, node.z)
  - material.emissiveIntensity = finalIntensity; material.opacity = curOpacity

CameraRig current model (src/lib/crystarium/CameraRig.svelte):
  - DEFAULT_POS = { x: 0, y: 14, z: 34 }; DEFAULT_TARGET = { x: 0, y: 0, z: 0 }
  - `controls` = OrbitControls ref (autoRotate, autoRotateSpeed 0.4, controls.object = camera)
  - focus(id) / resetView() use gsap.timeline({ onUpdate: invalidate })
  - $effect: `if (ui.cameraFocus) focus(ui.cameraFocus); else resetView();`
  - useTask(() => controls?.update())
  - gsap already imported here (client-only, mounts inside the browser-gated Canvas)

CrystariumScene (src/lib/crystarium/CrystariumScene.svelte):
  - const { nodes, edges } = computeLayout(grants)
  - renders `{#each nodes as node (node.id)}` → <CrystalNode {grant} {node} />
  - renders `{#each edges ...}` → <CrystalPath {edge} {from} {to} dim={...} />
</interfaces>

<constraints>
- CLIENT-ONLY: intro.svelte.js and all intro code is only ever imported by the browser-gated scene components (dynamic-imported CrystariumCanvas). Never import three/gsap into an SSR path. NEVER set ssr=false. `pnpm build` must still prerender clean.
- MOTION DISCIPLINE (03-UI-SPEC §Motion, design authority): transform / opacity / material-uniform ONLY (scale, position.y, emissiveIntensity, opacity). No layout-shifting animation. Micro-interactions 150–300ms. Exits faster than enters. Interruptible tweens (kill on new input).
- PERF: NO per-frame allocations inside any useTask loop (Pitfall F). Reuse the existing scratch Color/Vector objects; do not `new` anything inside a tick. Bloom params in Effects.svelte stay UNCHANGED (already tuned). dpr stays [1,2] in CrystariumCanvas.
- NO new dependencies. gsap@3.15 is already installed. NO sound, NO particles (v2 deferred).
- Deadline-pulse membership stays the clock-free `node.pulse` set — do not touch it.
</constraints>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Intro controller module + scene wiring (contract-first)</name>
  <files>src/lib/crystarium/intro.svelte.js (new), src/lib/crystarium/CrystariumScene.svelte</files>
  <action>
    Create `src/lib/crystarium/intro.svelte.js` — a client-only runes singleton that mirrors the pattern of `crystarium.svelte.js` (module-level `$state`, survives mount/unmount). Export:
      - `intro = $state({ revealProgress: 0, active: false, done: false })`
        `revealProgress` 0→1 is the single tweened scalar the nodes/paths read (a "wavefront"); `active` true while the intro is running; `done` latches true once settled.
      - `startIntro()` — sets active=true, done=false, revealProgress=0, then builds ONE gsap timeline (import gsap from 'gsap') tweening `intro.revealProgress` 0→1 over ~1.9s ease 'power2.out'; onComplete → `intro.active=false; intro.done=true`. Guard against double-start (if active or done, no-op). Keep a module-scoped `tl` handle so skip can kill it.
      - `skipIntro()` — if not active, no-op; else `tl?.kill()`, snap `intro.revealProgress = 1`, `intro.active = false`, `intro.done = true`.
    Keep the total budget ≤2.5s (node wave ~1.9s reveal + path/camera settle overlap inside it).

    In `CrystariumScene.svelte`:
      - import `{ intro, startIntro, skipIntro }` from './intro.svelte.js'.
      - Compute a per-node reveal RANK so the stagger is deterministic and the gold `active` master crystal at the origin lands LAST: derive `revealRank ∈ [0,1]` from radial distance from origin, OUTER nodes first (rank 0 = farthest rim, rank 1 = center). Build a `Map<id, rank>` once from `nodes` (sort by sqrt(x²+z²) descending → index/(n-1)); pure, no per-frame work.
      - Pass `revealRank={rankById.get(node.id) ?? 0}` into each `<CrystalNode>`.
      - On mount (`import { onMount, onDestroy } from 'svelte'`): call `startIntro()`. Register a ONE-SHOT interrupt: `window.addEventListener('pointerdown', skipIntro, { once: true })` — first pointer input anywhere snaps to settled. Also treat the existing select/hover as interrupts is optional; the window listener is sufficient. Remove the listener in onDestroy and guard for cleanup.
      - Do NOT touch the existing edges/nodes each-blocks beyond adding the revealRank prop; do NOT touch interactivity()/onpointermissed/lights/clear-color.
  </action>
  <verify>
    <automated>grep -q "revealProgress" src/lib/crystarium/intro.svelte.js && grep -q "startIntro" src/lib/crystarium/CrystariumScene.svelte && grep -q "revealRank" src/lib/crystarium/CrystariumScene.svelte && MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build</automated>
  </verify>
  <done>intro.svelte.js exists exporting revealProgress/active/done + startIntro/skipIntro; CrystariumScene starts the intro on mount, plumbs revealRank to each node, and registers a once pointerdown→skipIntro interrupt; build prerenders clean (SSR-safe).</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Node materialization + activation polish + path draw-in</name>
  <files>src/lib/crystarium/CrystalNode.svelte, src/lib/crystarium/CrystalPath.svelte</files>
  <action>
    CrystalNode.svelte:
      - Accept the new prop: `let { grant, node, revealRank = 0 } = $props();`
      - import `{ intro }` from './intro.svelte.js'.
      - In the existing `useTask`, compute a per-node REVEAL FACTOR from the shared wavefront WITHOUT allocating: given `p = intro.revealProgress` and this node's `revealRank r`, use a windowed ramp so nodes ignite in sequence — e.g. `const WINDOW = 0.35; let reveal = intro.done ? 1 : (p * (1 + WINDOW) - r * WINDOW - 0)/WINDOW; reveal = reveal < 0 ? 0 : reveal > 1 ? 1 : reveal;` (tune constants so rim→center reads as a 30–50ms/node stagger within the ~1.9s timeline). When `intro.done` (or when not the first mount), reveal is 1 permanently — the steady state is byte-identical to today.
      - Apply reveal as a MULTIPLIER on the settled outputs (transform/uniform only): `mesh.scale.setScalar(curScale * reveal)`, `material.emissiveIntensity = finalIntensity * reveal`, and fold into opacity: `material.opacity = curOpacity * reveal` (keep transparent=true). Do NOT alter position/hover/pulse/filter math — reveal is a pure gate on top.
      - ACTIVATION POLISH (AEST-01): keep the burst mechanism but tighten it to read as an FFXIII activation within 150–300ms — the emissive spike (`+0.9*burst`) is the bloom flash (bloom is luminance-thresholded so a higher emissive core blooms harder — this IS the "bloom-intensity spike", uniform-only, Effects untouched) and the scale pop (`*1 + 0.15*burst`). Adjust the decay so it feels like a snap-and-settle (e.g. ease the burst curve slightly and/or bump the flash to ~1.0 and the pop to ~0.18) — stay within 300ms and transform/uniform only. No new allocations.

    CrystalPath.svelte:
      - import `{ intro }` from './intro.svelte.js'.
      - Draw the paths in AFTER the nodes: gate the path opacity on the tail of the wavefront so tubes/flow fade in once most nodes are lit. Add `const pathReveal = $derived(intro.done ? 1 : Math.max(0, Math.min(1, (intro.revealProgress - 0.6) / 0.4)));` and multiply it into BOTH `tubeOpacity` and `flowOpacity` (e.g. `$derived((dim ? cfg.opacity*0.25 : cfg.opacity) * pathReveal)`). Uniform/opacity only — geometry, kinds, flow-pulse math, and the beam gradient are untouched. Steady state (intro.done) is identical to today.
  </action>
  <verify>
    <automated>grep -q "intro.revealProgress" src/lib/crystarium/CrystalNode.svelte && grep -q "revealRank" src/lib/crystarium/CrystalNode.svelte && grep -q "intro" src/lib/crystarium/CrystalPath.svelte && pnpm test:unit && pnpm run check</automated>
  </verify>
  <done>Nodes materialize via a windowed reveal factor keyed to revealRank (rim→center, gold center last); paths fade in after nodes via pathReveal; activation burst tightened to a 150–300ms bloom+pop; no per-frame allocations added; vitest 159 green and svelte-check clean; steady state (intro.done) unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: Camera reveal→settle + performance pass + build gate</name>
  <files>src/lib/crystarium/CameraRig.svelte</files>
  <action>
    CameraRig.svelte — add the intro camera reveal, guarded against the existing cameraFocus effect:
      - import `{ intro, skipIntro }` from './intro.svelte.js'.
      - Add an INTRO_POS pulled-back vantage, e.g. `const INTRO_POS = { x: 0, y: 24, z: 52 }` (farther/higher than DEFAULT_POS 0/14/34).
      - Start the camera pulled back: set the initial `<T.PerspectiveCamera position>` to INTRO_POS, and set OrbitControls `autoRotate={false}` initially (it should NOT auto-orbit during the reveal).
      - On mount, if `intro.active`, run ONE gsap timeline (`onUpdate: invalidate`) easing `controls.object.position` and `controls.target` from INTRO_POS/DEFAULT_TARGET to DEFAULT_POS/DEFAULT_TARGET over ~1.6s ease 'power2.out'; onComplete → `controls.autoRotate = true` (hand off to idle orbit). Kill any prior tween first. Use the existing `tween` handle pattern.
      - GUARD the existing selection effect so the intro is not clobbered: at the top of the `$effect(() => { if (ui.cameraFocus) focus... else resetView... })`, add `if (intro.active) return;` so resetView() does not fight the intro reveal on first mount. Once intro completes/skips, selection behaviour is exactly as today.
      - SKIP path: when `skipIntro()` fires (via the scene's window pointerdown), the intro tween must resolve to the settled state — either listen to `intro.active` flipping false (an $effect that, when `!intro.active && !settled`, kills the intro tween, snaps camera to DEFAULT_POS/DEFAULT_TARGET, sets autoRotate=true), or have the scene's skip also cover the camera. Implement the $effect approach so a mid-intro pointerdown snaps the camera to the idle overview immediately.
      - onDestroy already kills `tween` — keep it; ensure the intro tween shares the `tween` handle so cleanup covers it.

    PERFORMANCE PASS (verify-only, no perf regressions introduced):
      - Confirm `dpr={[1, 2]}` is still present in CrystariumCanvas.svelte (do not change it).
      - Confirm Effects.svelte bloom params (intensity 1.0 / luminanceThreshold 0.6 / radius 0.5 / mipmapBlur true) are UNCHANGED.
      - Confirm no `new` allocations were added inside any useTask tick across the intro changes (CrystalNode/CrystalPath/CameraRig) — reveal math uses scalars only.

    Then run the full regression + build gate.
  </action>
  <verify>
    <automated>grep -q "intro" src/lib/crystarium/CameraRig.svelte && grep -q "dpr={\[1, 2\]}" src/lib/crystarium/CrystariumCanvas.svelte && grep -q "luminanceThreshold: 0.6" src/lib/crystarium/Effects.svelte && pnpm test:unit && MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && pnpm run verify:build && pnpm run check</automated>
  </verify>
  <done>Camera starts pulled back and eases into the idle orbit (auto-rotate handed off on complete); the cameraFocus effect early-returns during intro; a mid-intro pointerdown snaps the camera to the settled overview; dpr cap [1,2] and bloom params confirmed unchanged; 159 vitest green, build exit 0, verify-build 6/6, svelte-check clean.</done>
</task>

</tasks>

<verification>
- 159 vitest tests green (`pnpm test:unit`) — no regressions.
- `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` exits 0 (SSR-safe, no window-is-not-defined).
- `pnpm run verify:build` → 6/6 (title "Eman_dashboard" intact, base-path assets).
- `pnpm run check` (svelte-check) clean.
- No `ssr = false` anywhere; the intro is client-only post-mount.
- Effects bloom params + CrystariumCanvas dpr[1,2] unchanged.
- Final live visual gate (intro plays then settles, skip-on-input) is performed by the orchestrator via Playwright screenshots — NOT a task here.
</verification>

<success_criteria>
- AEST-01 satisfied: staggered node materialization (rim→center, gold master last), paths draw in after nodes, camera reveal→idle-orbit settle, total ≤2.5s, interruptible on any pointer input.
- Activation-on-select reads as an FFXIII crystal activation (bloom/emissive spike + scale pop, 150–300ms, uniform/transform only).
- Zero prerender/SSR regression; zero new per-frame allocations; zero new dependencies.
</success_criteria>

<output>
After completion, create `.planning/phases/05-premium-polish-animation-perf/05-01-SUMMARY.md`.
</output>
