# Phase 1: Deploy Skeleton + Toolchain - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a styled SvelteKit walking skeleton live on the real `https://wolfwdavid.github.io/Eman_dashboard/` URL, proving the base-path, prerender/SSR split, `.nojekyll`, and GitHub Actions deploy pipeline end-to-end **before any 3D or data code exists**. This phase is pure infrastructure — it de-risks the two invisible-failure seams (SSR-safe WebGL scaffolding readiness and GitHub Pages base-path) so later phases build on a proven deploy.

</domain>

<decisions>
## Implementation Decisions

### Stack (research-locked — from .planning/research/STACK.md)
- SvelteKit 2.69 + Svelte 5 (runes) + Vite 8, TypeScript-via-JSDoc or TS (Claude's discretion, prefer TS for tooling).
- `@sveltejs/adapter-static` for full prerender. Node 22 LTS pinned via `.nvmrc`. **pnpm** exclusively (sibling projects hit npm/pnpm lockfile mismatches).
- Tailwind v4 (`@tailwindcss/vite`, CSS-first, no config file) for the base premium dark styling.
- Self-hosted fonts via `@fontsource-variable` (Orbitron display + Inter body) — no external font CDN (prerender/offline clean).
- Do NOT install Three.js/Threlte/postprocessing/GSAP/papaparse yet — those land in their owning phases. Keep Phase 1 dependency-light.

### Base-path & Deploy (load-bearing — from .planning/research/PITFALLS.md)
- `paths.base = process.env.BASE_PATH ?? ''` in `svelte.config.js`; CI sets `BASE_PATH=/Eman_dashboard`.
- Every internal link/asset routed through `base` from `$app/paths`. `fallback: '404.html'`. Adapter auto-writes `.nojekyll` (verify it lands in the artifact).
- `trailingSlash: 'always'` or handled explicitly to avoid Pages redirect asset breakage.
- GitHub Actions workflow (NOT the `gh-pages` npm package) builds with `BASE_PATH=/Eman_dashboard` and publishes to Pages on push to `main`. Repo `wolfwdavid/Eman_dashboard` already exists and is pushed.
- Keep `ssr = true` + `prerender = true` globally (never `ssr = false`) so the shell prerenders — this is the pattern later phases rely on for SSR-safe WebGL.

### Claude's Discretion
- Exact page layout of the skeleton (a branded landing shell with the project title / DID identity is enough), TS-vs-JSDoc, Tailwind token setup, and repo file layout (`tools/` dir may be stubbed now or created in Phase 2). All infrastructure choices are at Claude's discretion — pure infrastructure phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — greenfield. `data/grants.csv` and `data/reference-grant-tracker.html` exist but are consumed in Phase 2, not here.

### Established Patterns
- Sibling SvelteKit projects in this workspace (`diversityincludesdisability_three`, `michelle_ngo_*`, `raj_*`) established the SvelteKit → GitHub Pages pattern; reuse their proven `adapter-static` + `BASE_PATH` + Actions approach. Known gotcha: pnpm-not-npm; correct `base` on every asset.

### Integration Points
- `svelte.config.js` (base path), `.github/workflows/` (deploy), `src/routes/+layout.js` (prerender/ssr flags), `static/.nojekyll` (or adapter-emitted).

</code_context>

<specifics>
## Specific Ideas

A styled — not blank — skeleton: dark premium background, project title ("Eman_dashboard" / DID grant command center), so the live URL visibly proves CSS + fonts + base-path all resolve on the deployed Pages site, not just localhost. This is the acceptance signal for the phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (3D, data ingest, QR, HUD all belong to later phases.)

</deferred>
