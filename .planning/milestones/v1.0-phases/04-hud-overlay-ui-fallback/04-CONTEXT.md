# Phase 4: HUD / Overlay UI + Fallback - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The 2D DOM dashboard layered over the fixed Crystarium canvas: a grant Detail Panel (opens on node select via the runes bridge), a Pipeline Overview (LayerChart analytics + filter controls that drive the scene), and a QR panel — so the user can drill into any grant and read the entire pipeline at a glance. Driven by the shared runes state module (`ui.selected` consumed; `ui.filter` produced). The Crystarium scene stays the hero; these are overlay panels, not a new page.

</domain>

<decisions>
## Implementation Decisions

### Design contract (canonical: `04-UI-SPEC.md`, ui-ux-pro-max) — EXTENDS `03-UI-SPEC.md`
- Reuse the Phase-3 dark glassmorphism system verbatim (same hex tokens from `src/lib/crystarium/tokens.ts`, glass blur(16px), Orbitron display + Inter body). Same product feel as the scene.
- **Layer model (critical):** discrete `position: fixed` panels — NO full-viewport catch layer (it would kill the canvas raycast). z-layers: canvas 0 → ambient Phase-3 HUD 10 (pointer-events:none) → interactive controls 20 → Detail/QR panels 30. Corners: Title TL, Pipeline readout TR, Legend BL (all inherited); Detail Panel = right-edge slide-in rail (~380px); Pipeline Overview = bottom-center collapsible drawer (collapsed by default); QR = bottom-right toggle widget.
- **number-tabular** for all figures. Exactly 4 type sizes / 2 weights, 8pt spacing. transform/opacity/uniform-only motion; panel enter 150–300ms, exit faster; animate from trigger (spatial continuity with selected node). One primary focus (open detail panel).

### Detail Panel (DETL-01/02/03)
- All 9 Grant fields: funder/program, type (Investment flagged "Equity — not a grant"), normalized Amount human-readable WITH `.raw` subtext, normalized Deadline + `.raw`, 501c3 requirement (gate badge + NY Community Trust sponsor hint on the 4 "Yes - or fiscal sponsor" funders), fit/eligibility, status pill (echoes node hue), **Next Action as the loudest CTA banner**, external Link "Open funder site ↗" (`target=_blank rel=noopener`). Nothing-selected → panel closed.

### Pipeline Overview + Filters (PIPE-01..05) — LayerChart 2.0.1 (now in scope; add dep)
- Chart A: status distribution horizontal bar (8 status-hue fills; counts 17/3/2/2/1/1/1/1 = 28).
- Chart B: secured $20,000 (gold) vs potential $296,500 (cool) two-bar.
- Chart C: deadline timeline ordered by urgency (<30d = `--urgent`, passed = ash).
- Chart D: 501c3 segmented bar Open 12 / Gated 8 / Unknown 8 (gold beam-tick on sponsor-eligible).
- Filters (by status, by 501c3 gate, by type) drive `ui.filter`. **Filters DIM (not delete) non-matching nodes and disable their raycast** — the funnel/layout stays stable.
- Charts use the SAME status hue tokens as the nodes (consistency); legend-visible, direct-labeling (small 28 dataset), tooltip-on-interact, subtle gridlines.

### Required state change
- Widen `ui.filter` in `src/lib/state/crystarium.svelte.js` from a string to `{ status, gate, type }` + add `setFilter`/`resetFilters`. The scene reads this to dim/disable non-matching nodes. Verify the Phase-3 scene still consumes `ui.selected`/`ui.hovered` unchanged.

### QR panel (QRUI-01/02)
- Two `{@html qrCodes[].svg}` tiles on white "scannability plates" with labels, from `src/lib/data/qr.generated.js`. Note in-UI that URLs are swappable via `src/lib/config/sites.js` (regen, zero component change).

### Aggregates hygiene (from Phase 3 checker note)
- Prefer exposing an aggregates selector from `$lib/data` (single source of truth) for the charts/readout rather than hardcoding — the counts/totals should compute from `grants` at runtime (they are static build-time data, so a `$derived`/module selector is fine). securedTotal must be $20,000; potentialTotal $296,500.

### Claude's Discretion
- Exact panel dimensions, chart micro-styling, drawer animation specifics, the WebGL-probe fallback shape — within the UI-SPEC.

### Fallback (RESL-01) — OPTIONAL / lower priority
- A WebGL-less 2D grant list is listed in the phase name but RESL-01 is v2. Implement only a MINIMAL graceful degradation if time permits (WebGL probe → 2D list whose rows call `select(id)` to reuse the Detail Panel). Do NOT let it block DETL/PIPE/QRUI. No a11y requirements this build.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 3 runes bridge `src/lib/state/crystarium.svelte.js` (ui.selected/hovered/filter/cameraFocus + select/deselect/hover) — the overlay consumes selected, extends filter.
- Phase 3 glass HUD components (SceneTitle, PipelineReadout, Legend) + `tokens.ts` color system.
- Phase 2 data: `grants` (typed), `qrCodes` (inline SVG), and the amount/deadline/status/501c3 shapes in `types.ts`. Aggregates logic exists in `tools/aggregates.mjs` (Node build tool) — may re-expose a browser selector in `$lib/data`.

### Established Patterns
- Svelte 5 runes; pnpm; Node 22; Windows base-path build `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build`; `tools/verify-build.mjs` deploy invariants must still pass; `<title>` keeps "Eman_dashboard"; ssr never false.

### Integration Points
- Overlay mounts in `src/routes/+page.svelte` alongside the existing scene + HUD (which prerenders). New components under `src/lib/hud/` (or similar). LayerChart charts are SVG + prerender-safe.
- Add dep: `layerchart@2.0.1` (+ peer if needed). Do NOT add new 3D deps.

</code_context>

<specifics>
## Specific Ideas

The overlay must feel like the SAME product as the scene — same glass, same hues, same fonts — and never obscure the Crystarium (collapsible/corner panels). Selecting a crystal node flies the camera (Phase 3) AND slides in the detail rail (Phase 4); the charts + filters let the user re-read the pipeline and re-highlight the grid. The messy raw Amount/Deadline strings are shown as human-readable + raw subtext so nothing is lost.

</specifics>

<deferred>
## Deferred Ideas

- Full WCAG accessibility (out of scope this build).
- Rich immersion (sound, particles) — Phase 5 / v2.
- Expanded analytics beyond the 4 core charts — v2 (ANLY-01).
- Robust non-WebGL fallback (RESL-01) — v2; only a minimal probe this phase if time permits.

</deferred>
