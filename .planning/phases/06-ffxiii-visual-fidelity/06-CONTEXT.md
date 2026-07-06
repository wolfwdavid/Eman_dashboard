# Phase 6: FFXIII Visual Fidelity Overhaul - Context (design brief)

**Gathered:** 2026-07-06 · **Status:** Ready for execution
**Trigger:** User reviewed the live v1.0 scene: "redo the graphics like ff13, it seems to be off."

<diagnosis>
## Why the current look reads "off" vs the real FFXIII Crystarium

| Current (v1.0) | Real FFXIII Crystarium |
|---|---|
| Large matte low-poly icosahedra ("boulders") | Small **luminous orbs/crystal spheres** — white-hot core, colored glow shell, soft halo |
| Thick, straight, opaque blue tubes | **Thin, gently curved filaments of light**, additive glow, energy traveling along them |
| Flat navy background | **Deep indigo-violet cosmic void** with soft nebula clouds (cyan/magenta/violet) and a fine starfield |
| Moderate bloom, matte surfaces don't feed it | **Heavy, tight bloom** — the emissive cores carry the whole composition; darkness everywhere else |
| Objects fill the frame | A **floating constellation** with depth fog; lights small against a vast dark space |
</diagnosis>

<decisions>
## Implementation Decisions (locked)

### VIS-01 Backdrop
- In-scene starfield: `THREE.Points`, ~900–1400 tiny points, subtle size/opacity variation, very slow drift/rotation; brightness BELOW bloom threshold (stars must not bloom).
- Nebula: 3–5 very large additive-blended billboards (radial-gradient `CanvasTexture`, violet `#3b2a68`-ish / deep cyan / magenta tints at LOW opacity ~0.05–0.12) far behind/around the grid — soft cosmic clouds, never crisp shapes. (No new deps — canvas textures.)
- `THREE.FogExp2` (deep indigo, gentle density) for depth falloff toward the rim.

### VIS-02 Nodes (encodings preserved EXACTLY: hue=statusHue, scale=amount, pulse=3-node set, activation=status)
- Three-layer node replaces the matte icosahedron:
  1. **Core**: small sphere, emissive = white-lifted status hue at HIGH intensity (this is what blooms).
  2. **Crystal shell**: translucent faceted shell (icosahedron detail 1 is fine), `transparent`, opacity ~0.18–0.3, slight emissive tint, backside/additive for a fresnel-ish rim feel.
  3. **Halo**: additive radial-gradient sprite, ~2.5–3.5× node scale, status-hued, very soft.
- Global node scale compressed DOWN (~40–55% of current) so nodes read as orbs in space; TBD "raw ore" nodes = dimmest cores, near-no halo. Dim/unformed statuses = low core intensity (activation ladder from tokens.ts stays authoritative).
- Pulse (the 3 deadline nodes) = halo scale + core intensity oscillation (existing uniform pattern). Hover/select modulation and dim/raycast-guard behavior unchanged.

### VIS-03 Paths
- Replace straight tubes: gentle arcs (`QuadraticBezierCurve3`, midpoint lifted a little along the dome normal), `TubeGeometry` VERY thin (radius ≈ 0.02–0.045 world units), additive blending, low base opacity (~0.15–0.25) + a brighter traveling flow pulse (adapt the existing flow logic).
- Spine: dim blue-white filaments. Family links: thinner/dimmer. **Beam**: gold→cyan gradient, slightly thicker + brighter flow — still the signature element.

### VIS-04 Bloom
- Retune: `luminanceThreshold` ~0.32–0.42, `intensity` ~1.2–1.5, `radius` ~0.6–0.7, `mipmapBlur: true`. Node cores must bloom hard; starfield/nebula/HUD must NOT (keep them under threshold). dpr cap `[1,2]` intact; no per-frame allocations (reuse vectors, drive via uniforms/scalars).

### VIS-05 Composition
- Camera default pulled back slightly / gentle downward angle for the constellation read; fog density tuned so rim nodes soften into the void. Intro (awakening), orbit, GSAP focus, onpointermissed deselect all keep working unchanged.

### Hard invariants (regression gate)
- `src/lib/crystarium/layout.js`, `tokens.ts` hues, `derive` sets, runes bridge, HUD components: UNTOUCHED (visual layers only).
- 162 vitest green; `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` exit 0; `verify-build.mjs` 6/6; svelte-check clean; no `ssr = false`; NO new dependencies; browser-gated Canvas untouched.
- Acceptance = orchestrator screenshot gate against the live deploy, judged against the table above.
</decisions>

<code_context>
Files in scope: `src/lib/crystarium/{CrystariumScene,CrystalNode,CrystalPath,Effects,CameraRig}.svelte` + NEW `src/lib/crystarium/{Starfield,Nebula}.svelte` (or equivalent) + a small canvas-texture util. Nothing else.
</code_context>
