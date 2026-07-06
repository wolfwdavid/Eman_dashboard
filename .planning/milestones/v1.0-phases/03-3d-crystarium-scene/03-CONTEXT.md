# Phase 3: 3D Crystarium Scene - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Render the FFXIII Crystarium sphere grid in 3D (Threlte 8 / Three.js + postprocessing bloom + GSAP) as the navigable primary surface — all 28 funders as crystal nodes whose ring, scale, and glow make status, amount, and deadline urgency legible from shape before a single click. This phase builds the SCENE and raises selection/hover events to a shared runes state module. The full 2D HUD (detail panel, filters, QR panel, charts) is Phase 4 — this phase ships only a minimal in-scene HUD (legend + title + secured-vs-potential readout).

</domain>

<decisions>
## Implementation Decisions

### Design contract (canonical: `03-UI-SPEC.md`, produced via ui-ux-pro-max)
- Full color system, crystal node material/geometry, bloom tuning, camera/interaction states, and HUD layout are LOCKED in `03-UI-SPEC.md`. Follow it. Key tokens: `--bg #05060D`, glass HUD `rgba(18,26,48,0.55)` + blur(16px), 8 status hues (active/gold `#FFC24B`, in-progress/cyan `#33E1FF`, applied/violet `#A98BFF`, recurring/emerald `#4BE39B`, to-research/steel `#5B84C4`, not-eligible-yet/bronze `#B0894E`, not-eligible/ash `#565D75`, declined/ash-rust `#8A5560`), `--secured-gold #FFC24B` (reserved for the one active node + the $20,000 figure), `--urgent #FF5A3C` (deadline pulse), `--path #6FA8FF`, beam gradient gold→cyan.
- Typography: Orbitron display (titles, node labels, big numbers) + Inter body; tabular figures for the $ totals.

### Data-derived facts (COMPUTE, never hardcode)
- **Fiscal-sponsor beam = exactly 4 targets**: the funders whose 501(c)(3) raw value is "Yes - or fiscal sponsor" (Harry S. Black/BofA, Ford JustFilms, Ford NYC Good Neighbor, Ben & Jerry's). The UI-SPEC corrected FEATURES.md's "5" — derive the set from `grants` data at build/scene-init, do not hardcode a count.
- **Deadline pulse = only non-passed / non-rolling / non-declined / non-ineligible nodes with a real future one-time deadline** (currently 3: Harry S. Black, Ford JustFilms, Ben & Jerry's). Passed/rolling/declined nodes never pulse (Hey Helen = burnt-out ember).
- **Family links**: two Ford nodes linked; two BofA-related nodes (Harry S. Black is BofA) linked.
- Node scale = log-scaled amount (avg/representative); TBD/qualitative → fixed minimal "unformed raw-ore crystal."
- Ring/tier = status funnel (center = active/secured → rim = to-research); angular sector = 501(c)(3) gate.

### Load-bearing engineering constraints (from PITFALLS — this phase OWNS #1/#2)
- **SSR-safe WebGL**: the Threlte `<Canvas>` MUST be browser-gated (`{#if browser}` / onMount / dynamic import) so WebGL never runs during prerender. Keep `ssr = true` + `prerender = true` globally — NEVER set `ssr = false`. `pnpm build` must still prerender the HUD shell cleanly.
- All imperative Three.js loader URLs (if any textures) route through `base` from `$app/paths`. Deploy invariants (`verify-build.mjs`) must still pass.
- Pin `three@0.185.1` (postprocessing 6.39 needs three <0.186). Use Threlte v8 runes APIs (`useTask`, not `useFrame`).
- The layout math is a PURE module returning plain `{x,y,z}` — no Three.js coupling — so it is unit-testable and deterministic.
- Bloom is GPU-costly: use selective/threshold bloom; cap pixel ratio; deadline pulse via material uniform, not per-frame object churn.

### Claude's Discretion
- Exact crystal facet geometry, shader/material specifics, precise UnrealBloom params (tune to the UI-SPEC direction), auto-orbit speed, and the runes state module shape — within the UI-SPEC direction.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 2 typed data: `import { grants } from '$lib/data'` (28 typed Grant records with `amount`, `deadline`, `status`, `requires501c3`, etc.) + aggregates (`securedTotal`=20000, `potentialTotal`=296500). Scene binds to these — no runtime fetch.
- Phase 1 shell: SvelteKit + Tailwind v4 + Orbitron/Inter fonts + `+layout.ts` (prerender+ssr true) + `tools/verify-build.mjs` deploy invariants.

### Established Patterns
- Svelte 5 runes; pnpm; Node 22; Windows local base-path builds need `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build`.
- Deps to ADD this phase: `three@0.185.1`, `@threlte/core@8`, `@threlte/extras`, `postprocessing`, `gsap`. (LayerChart is Phase 4.)

### Integration Points
- New: `src/lib/crystarium/layout.js` (pure), scene components (Canvas boundary, node, path/edge, camera rig, bloom), and `src/lib/state/crystarium.svelte.js` (runes: selected/hovered node, camera focus) — the bridge Phase 4's HUD consumes.
- Mounts into `src/routes/+page.svelte` replacing the placeholder landing content (keep a prerendered HUD shell for SSR).

</code_context>

<specifics>
## Specific Ideas

The scene must read as a faithful Crystarium: a glowing constellation where the lonely gold secured node at the center contrasts the crowded dim to-research frontier at the rim, with the fiscal-sponsor beam dramatizing the 501(c)(3) unlock path. "Legible from shape before a click" is the acceptance feeling. Build must still prerender + deploy (WebGL client-only).

</specifics>

<deferred>
## Deferred Ideas

None new. Detail panel, filters, QR panel, and the full analytics charts are Phase 4 (the scene raises the selection events they will consume). Sound and heavy particle immersion are v2.

</deferred>
