---
phase: 03-3d-crystarium-scene
plan: 04
type: execute
wave: 4
depends_on: ["03-03"]
files_modified:
  - src/lib/crystarium/CrystalPath.svelte
  - src/lib/crystarium/CameraRig.svelte
  - src/lib/crystarium/Effects.svelte
  - src/lib/crystarium/CrystariumScene.svelte
  - src/lib/crystarium/CrystalNode.svelte
autonomous: true
requirements: [CRYS-05, CRYS-06, CRYS-07, CRYS-08]
must_haves:
  truths:
    - "Connecting paths render the progression spine, the Ford/BofA family bridges, and the gold→cyan fiscal-sponsor beam from NYCT to the 4 gated funders"
    - "The camera auto-orbits in overview and eases to frame a node when it is selected"
    - "The 3 qualifying deadline nodes pulse; passed/rolling/declined/ineligible nodes never pulse"
    - "Hover and selection are visually distinct — selection dims siblings and blooms the focus above them"
    - "Bloom postprocessing glows the emissive crystals/beam and pnpm build still prerenders cleanly"
  artifacts:
    - path: "src/lib/crystarium/CrystalPath.svelte"
      provides: "one edge renderer for spine/family/beam kinds (emissive, gold→cyan beam gradient)"
    - path: "src/lib/crystarium/CameraRig.svelte"
      provides: "OrbitControls autoRotate + GSAP focus-on-node reacting to ui.cameraFocus"
      contains: "gsap"
    - path: "src/lib/crystarium/Effects.svelte"
      provides: "postprocessing EffectComposer + BloomEffect via autoRender=false + useTask renderStage"
      contains: "EffectComposer"
  key_links:
    - from: "src/lib/crystarium/CameraRig.svelte"
      to: "src/lib/state/crystarium.svelte.js (ui.cameraFocus)"
      via: "$effect → gsap tween of controls.object.position + controls.target"
      pattern: "ui.cameraFocus"
    - from: "src/lib/crystarium/Effects.svelte"
      to: "Threlte renderStage"
      via: "useTask(() => composer.render(delta), {stage: renderStage, autoInvalidate:false})"
      pattern: "renderStage"
    - from: "src/lib/crystarium/CrystalNode.svelte"
      to: "node.pulse + ui.selected/hovered"
      via: "emissiveIntensity uniform modulation"
      pattern: "pulse|ui\\.(selected|hovered)"
---

<objective>
Complete the scene's legibility and signature glow: render the three edge kinds (spine, Ford/BofA family bridges, and the gold→cyan fiscal-sponsor beam to the 4 gated funders), add the auto-orbit + GSAP focus-on-node camera, animate the deadline pulse on exactly the 3 qualifying nodes, make hover vs. selection unmistakable (siblings dim, focus blooms), and wire the SelectiveBloom composer — all while keeping `pnpm build` prerendering cleanly.

Purpose: This lands CRYS-05/06/07/08 — the paths that tell the fiscal-sponsor unlock story, the camera that makes a node navigable, and the bloom that is the Crystarium's signature. It builds on 03-03's Canvas/Node/state and the 03-02 edge/pulse data.
Output: CrystalPath, CameraRig, Effects components + pulse/interaction updates to CrystalNode + their wiring in CrystariumScene.
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
@src/lib/crystarium/CrystariumScene.svelte
@src/lib/crystarium/CrystalNode.svelte
@src/lib/crystarium/CrystariumCanvas.svelte
@src/lib/crystarium/tokens.ts
@src/lib/crystarium/layout.js
@src/lib/state/crystarium.svelte.js

<interfaces>
<!-- Bloom composer (RESEARCH Code Example 3) — the EXACT official pattern. Companions: <Canvas autoRender={false}> (done in 03-03) + ssr.noExternal (done in 03-01) -->
```svelte
<script>
  import { useThrelte, useTask } from '@threlte/core';
  import { EffectComposer, EffectPass, RenderPass, BloomEffect, KernelSize } from 'postprocessing';
  const { scene, renderer, camera, size, renderStage, autoRender } = useThrelte();
  const composer = new EffectComposer(renderer);
  const setup = (cam) => {
    composer.removeAllPasses();
    composer.addPass(new RenderPass(scene, cam));
    composer.addPass(new EffectPass(cam, new BloomEffect({
      intensity: 1.0, luminanceThreshold: 0.6, luminanceSmoothing: 0.2,
      radius: 0.5, mipmapBlur: true, kernelSize: KernelSize.MEDIUM })));
  };
  $effect(() => setup($camera));
  $effect(() => composer.setSize($size.width, $size.height));
  $effect(() => { const b = autoRender.current; autoRender.set(false); return () => autoRender.set(b); });
  useTask((delta) => composer.render(delta), { stage: renderStage, autoInvalidate: false });
</script>
```

<!-- GSAP camera focus (RESEARCH Code Example 4) — tween a plain object, kill previous tween on new selection -->
```svelte
import { OrbitControls } from '@threlte/extras';
import gsap from 'gsap';
import { ui } from '$lib/state/crystarium.svelte.js';
// camPos = { x: n.x+8, y: n.y+6, z: n.z+8 }; tween controls.object.position + controls.target, 0.6s power3.out
// $effect(() => { if (ui.cameraFocus) focus(ui.cameraFocus); });  useTask(() => controls?.update());
<T.PerspectiveCamera makeDefault position={[0,14,34]}>
  <OrbitControls bind:ref={controls} enableDamping autoRotate autoRotateSpeed={0.4} target={[0,0,0]} />
</T.PerspectiveCamera>
// deselect: tween back to default framing + re-enable autoRotate, exit ~250ms (faster than the ~600ms enter)
```

<!-- Deadline pulse (UI-SPEC §Bloom/Glow) — SET membership is node.pulse (clock-free, from 03-02). Live clock ONLY for cosmetic amplitude. -->
// pulse via material emissiveIntensity uniform in ONE useTask (not object churn). --urgent 0xff5a3c additive.
// amplitude bands (cosmetic, may read Date in-scene): near <30d ±0.4 @~0.8Hz · ≤90d ±0.25 @~0.5Hz · far ±0.1 @~0.3Hz.
// exactly the 3 node.pulse===true nodes animate: harry-s-black, ford-justfilms, ben-jerry. Passed/declined never.

<!-- Path/beam styling (UI-SPEC §Path & Beam) — colours from tokens (no raw hex) -->
// spine: tokens.path 0x6fa8ff low alpha, steady flow toward core
// family: tokens.path reduced alpha, thinner, no directional flow (2 pairs)
// beam: thickest, gradient tokens.beamCore 0xffc24b → tokens.beamTip 0x7fe9ff, animated pulse core→target, higher bloom

<!-- Hover vs select (UI-SPEC §Camera & Interaction) -->
// hover (secondary): +Y lift, scale +8%, emissive/fresnel +0.2, small bloom bump, billboard label
// select (primary, one at a time): activation burst (emissive flash + scale pop ~300ms), raise bloom above siblings,
//   ALL other nodes dim emissiveIntensity ×0.35 + slight desaturate. Enter ~600ms, exit ~250ms.
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: CrystalPath (spine/family/beam) + CameraRig (auto-orbit + GSAP focus)</name>
  <read_first>src/lib/crystarium/CrystariumScene.svelte, src/lib/crystarium/layout.js, src/lib/crystarium/tokens.ts, src/lib/state/crystarium.svelte.js, .planning/phases/03-3d-crystarium-scene/03-RESEARCH.md (Code Examples 4, §Path & Beam)</read_first>
  <files>src/lib/crystarium/CrystalPath.svelte, src/lib/crystarium/CameraRig.svelte, src/lib/crystarium/CrystariumScene.svelte</files>
  <action>
    1. `CrystalPath.svelte` — props `{ edge, from, to }` where from/to are `{x,y,z}` node positions (look them up in the Scene by id). Render an emissive tube/line between the two points using additive blending, low base alpha. Colour by `edge.kind` from tokens (NO raw hex): `spine`→`tokens.path`; `family`→`tokens.path` at reduced alpha + thinner; `beam`→a gold→cyan gradient from `tokens.beamCore` to `tokens.beamTip`, thickest, with an animated flow uniform (core→target). Use a `<T.TubeGeometry>` along a straight `THREE.LineCurve3` (or `<T.Line>` with a line material) — the beam gets a `useTask`-driven offset for the travelling pulse.
    2. `CameraRig.svelte` — verbatim structure from `<interfaces>` Code Example 4: `<T.PerspectiveCamera makeDefault position={[0,14,34]}>` wrapping `<OrbitControls bind:ref={controls} enableDamping autoRotate autoRotateSpeed={0.4} target={[0,0,0]}>`. `focus(nodeId)`: find the node in `computeLayout(grants).nodes`, `tween?.kill()`, set `controls.autoRotate=false`, GSAP-timeline tween `controls.object.position` → `{x:n.x+8,y:n.y+6,z:n.z+8}` and `controls.target` → `{x:n.x,y:n.y,z:n.z}` over 0.6s `power3.out`, `onUpdate: invalidate`. `deselect`: tween back to the default framing + re-enable `autoRotate` over ~0.25s (exit faster than enter). `$effect(() => { if (ui.cameraFocus) focus(ui.cameraFocus); else resetView(); })`; `useTask(() => controls?.update())` for damping; kill the tween on unmount.
    3. `CrystariumScene.svelte` — replace the temporary inline camera (from 03-03) with `<CameraRig />`; render one `<CrystalPath>` per `edges[]` entry, resolving from/to positions by node id. Keep `interactivity()` and the node loop.
  </action>
  <verify>
    <automated>MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs</automated>
    <automated>grep -q "ui.cameraFocus" src/lib/crystarium/CameraRig.svelte && grep -q "gsap" src/lib/crystarium/CameraRig.svelte && grep -q "autoRotate" src/lib/crystarium/CameraRig.svelte && grep -Eq "beamCore|beamTip" src/lib/crystarium/CrystalPath.svelte && grep -q "CrystalPath" src/lib/crystarium/CrystariumScene.svelte && echo "paths+camera ok"</automated>
  </verify>
  <done>CrystalPath renders spine/family/beam edges with tokenised colours (gold→cyan beam); CameraRig auto-orbits and GSAP-eases to `ui.cameraFocus` on select (exit faster than enter); Scene wires both; `pnpm build` + `verify-build.mjs` stay green. Manual: overview auto-orbit, spine+family+beam visible, camera springs to a clicked node.</done>
</task>

<task type="auto">
  <name>Task 2: Bloom composer + deadline pulse + hover/select distinction</name>
  <read_first>src/lib/crystarium/CrystariumScene.svelte, src/lib/crystarium/CrystalNode.svelte, src/lib/crystarium/CrystariumCanvas.svelte (autoRender=false already set), src/lib/crystarium/tokens.ts, .planning/phases/03-3d-crystarium-scene/03-RESEARCH.md (Code Example 3, §Bloom/Glow, §Camera & Interaction), .planning/phases/03-3d-crystarium-scene/03-UI-SPEC.md (§Bloom/Glow Tuning)</read_first>
  <files>src/lib/crystarium/Effects.svelte, src/lib/crystarium/CrystalNode.svelte, src/lib/crystarium/CrystariumScene.svelte</files>
  <action>
    1. `Effects.svelte` — the postprocessing composer verbatim per `<interfaces>` Code Example 3: `EffectComposer(renderer)` + `RenderPass(scene, cam)` + `EffectPass(cam, new BloomEffect({ intensity:1.0, luminanceThreshold:0.6, luminanceSmoothing:0.2, radius:0.5, mipmapBlur:true, kernelSize:KernelSize.MEDIUM }))`. Wire `$effect(() => setup($camera))`, `$effect(() => composer.setSize($size.width,$size.height))`, take over auto-render (`autoRender.set(false)` with cleanup restore), and `useTask((delta)=>composer.render(delta), { stage: renderStage, autoInvalidate:false })`. `luminanceThreshold 0.6` keeps the dim steel-blue to-research frontier crisp so only bright cores/rims/beam bloom (UI-SPEC direction). Mount `<Effects />` inside `CrystariumScene`. (Its companions — `<Canvas autoRender={false}>` and `ssr.noExternal` — already exist from 03-03/03-01.)
    2. `CrystalNode.svelte` — add, in ONE `useTask`, the deadline pulse and hover/select modulation of `emissiveIntensity` (uniform/material property, NOT object creation per frame — Pitfall F/Perf):
       - Pulse: only when `node.pulse === true` (the clock-free set of 3 from 03-02). Additive `tokens.urgent` coral modulation; amplitude/frequency by proximity bands (near <30d ±0.4 @~0.8Hz · ≤90d ±0.25 @~0.5Hz · far ±0.1 @~0.3Hz) — a live `Date` read is allowed here for the COSMETIC band only, never for membership. Passed/rolling/declined/ineligible nodes (pulse===false) never animate.
       - Hover (secondary): when `ui.hovered === grant.id`, lift +Y, scale ×1.08, emissive/fresnel +0.2, small bloom bump; ~150ms in / ~120ms out.
       - Select (primary, one at a time): when `ui.selected === grant.id`, one-shot activation burst (emissive flash + scale pop ~300ms) and raise its effective emissive above siblings; when `ui.selected` is set but this node is NOT it, dim `emissiveIntensity ×0.35` + slight desaturate. Base intensity stays `activation[grant.status]` from tokens.
    3. `CrystariumScene.svelte` — ensure `<Effects />` is mounted once and after the render pass sees all nodes/paths.
  </action>
  <verify>
    <automated>MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs</automated>
    <automated>grep -q "EffectComposer" src/lib/crystarium/Effects.svelte && grep -q "renderStage" src/lib/crystarium/Effects.svelte && grep -q "BloomEffect" src/lib/crystarium/Effects.svelte && grep -Eq "node.pulse|\\.pulse" src/lib/crystarium/CrystalNode.svelte && grep -Eq "ui\\.(selected|hovered)" src/lib/crystarium/CrystalNode.svelte && echo "bloom+pulse ok"</automated>
    <automated>pnpm exec vitest run src/lib/crystarium</automated>
  </verify>
  <done>Effects.svelte drives the composer via `autoRender=false`+`renderStage` (bloom glows only bright emissive crystals/beam, threshold 0.6); CrystalNode pulses exactly the 3 `node.pulse` nodes and shows distinct hover (lift/scale/bump) vs select (burst + siblings dim ×0.35); `pnpm build`+`verify-build.mjs` green and crystarium unit tests still pass. Manual (VALIDATION.md): only the 3 nodes pulse, hey-helen/declined do not; hover vs select unmistakable; bloom is the signature glow.</done>
</task>

</tasks>

<verification>
- `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs` — prerender + 6 checks stay green with bloom/postprocessing in the graph (proves ssr.noExternal + autoRender=false + browser-gating all hold).
- `pnpm exec vitest run src/lib/crystarium` — pure-layout suite unaffected.
- greps confirm: `ui.cameraFocus` in CameraRig, `renderStage`/`EffectComposer` in Effects, `node.pulse` + `ui.selected/hovered` in CrystalNode.
- Manual (VALIDATION.md manual set): spine+family+beam render, camera focus springs, only 3 nodes pulse, hover≠select, bloom signature present.
</verification>

<success_criteria>
CRYS-05/06/07/08 complete: spine/family/beam paths render (gold→cyan fiscal-sponsor beam to the 4 gated funders), the camera auto-orbits and eases to a selected node, exactly the 3 qualifying nodes pulse (passed/declined never), hover and selection are visually distinct, and SelectiveBloom supplies the signature glow — all with `pnpm build` + `verify-build.mjs` still green.
</success_criteria>

<output>
After completion, create `.planning/phases/03-3d-crystarium-scene/03-04-SUMMARY.md`.
</output>
