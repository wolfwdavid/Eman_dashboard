<!-- GSD:project-start source:PROJECT.md -->
## Project

**Eman_dashboard**

A premium, modern 3D grant/funding **command center** for Eman Rimawi's organization, Diversity Includes Disability (DID). The primary navigation surface is a faithful homage to the Final Fantasy XIII **Crystarium** sphere grid — radial crystal nodes connected by glowing paths, with unlock/activation animations — where each node represents a funder or grant opportunity. Selecting a node drills into that grant's detail. It turns a flat 28-row grant spreadsheet into an explorable, high-visual-investment dashboard that surfaces pipeline status, funding secured vs. potential, upcoming deadlines, and next actions at a glance.

**Core Value:** The Crystarium sphere grid makes the entire grant pipeline legible and navigable at a glance — funder status, funding amount, and deadline urgency are all readable from the shape and glow of the grid before a single click.

### Constraints

- **Tech stack**: SvelteKit + a Svelte 3D layer (Threlte / Three.js) for the Crystarium. Modern, premium aesthetic.
- **Rendering**: Static site (SvelteKit `adapter-static`) — must fully prerender for GitHub Pages.
- **Deployment**: GitHub Pages under repo `Eman_dashboard`; base path must match the repo name for correct asset URLs.
- **Design authority**: `ui-ux-pro-max` skill drives the UI-SPEC — dark premium palette, glassmorphism/glow, grant command-center dashboard patterns, appropriate chart types for the funding pipeline.
- **Data**: build-time ingest from `data/grants.csv`; no runtime data fetching.
- **QR targets**: two site URLs, not yet finalized — must be config-driven so they can be dropped in later without code changes.
- **Custom tooling**: user explicitly requested building custom tools rather than relying solely on off-the-shelf libraries where a purpose-built tool fits.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **SvelteKit** (`@sveltejs/kit`) | `2.69.1` | App framework, routing, SSG | The static-first meta-framework for Svelte; first-class prerender + `adapter-static`. Peer-allows Vite `^8`. |
| **Svelte** | `5.56.4` | UI framework (runes era) | Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) are the current idiom; Threlte 8 targets Svelte 5 exclusively. |
| **Vite** | `8.1.3` | Build tool / dev server | Bundler under SvelteKit. Vite 8 requires **Node 20.19+ / 22.12+** — pin Node accordingly. |
| **@sveltejs/adapter-static** | `3.0.10` | Static site generation | Emits pure HTML/JS/CSS for GitHub Pages (no server runtime). Auto-writes `.nojekyll`. |
| **@sveltejs/vite-plugin-svelte** | `7.1.2` | Svelte compilation in Vite | Pulled in by the SvelteKit template; listed for lockfile clarity. |
| **TypeScript** | `5.x` (latest) | Types for grant data model | Messy CSV → typed JSON demands a real type model; catches normalization bugs at build. |
### 3D Layer (the Crystarium)
| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **@threlte/core** | `8.5.16` | Declarative Three.js in Svelte | **Recommended over raw Three.js.** Threlte 8 is built for Svelte 5 runes; it wraps Three's scene graph as Svelte components (`<T.Mesh>`, `<T.PointLight>`), gives a `useTask` render loop, and — critically — inits WebGL inside `onMount`, so it is **SSR/prerender-safe by design**. Peer: `svelte >=5`, `three >=0.160`. |
| **three** | `0.185.1` | 3D engine | The renderer. **PIN to `0.185.x`** — see Version Compatibility (postprocessing caps at `<0.186`). |
| **@types/three** | `0.185.0` | Three.js types | Match to the `three` minor. |
| **@threlte/extras** | `9.21.0` | Helpers: controls, effects, text, instancing | Provides `<OrbitControls>`, `<Float>`, `<Text>`, `<InstancedMesh>`/`<Instance>` (ideal for 28+ crystal nodes), `<Environment>`, and interactivity. Peer: `svelte >=5`, `three >=0.160`. |
| **postprocessing** | `6.39.2` | Bloom / glow pipeline | **Essential for the Crystarium look.** `BloomEffect` + `SelectiveBloom` deliver the glowing-crystal/emissive-path aesthetic. Wire via Threlte's `useThrelte()` renderer + `useTask`. Peer: `three >=0.168 <0.186`. |
### Animation / Timeline
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **GSAP** | `3.15.0` | Node unlock/activation timelines, camera moves, UI transitions | **Recommended.** Framework-agnostic, battle-tested, precise timelines/easings. Drive Three object props (position/scale/emissiveIntensity) inside `onMount`/`useTask`; drive DOM/overlay panels too. No SSR concerns (import client-side). |
| **svelte transitions / `svelte/motion`** (`Tween`, `Spring`) | built-in (Svelte 5) | DOM panel/glass transitions, small reactive tweens | Use for HTML overlay (detail panel, QR panel) micro-interactions — zero extra dependency. |
### Data Ingest (build-time CSV → typed JSON)
| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **papaparse** | `5.5.4` | Robust CSV tokenization | Use it **only** to parse quoted/comma-in-field rows correctly (the CSV has embedded commas, parentheticals, quotes). Do NOT rely on it to normalize — that's custom logic. |
| **zod** | `3.x` / `4.x` (latest) | Validate normalized records at build | Fail the build if a row doesn't produce a valid `Grant`. Cheap insurance for messy source data. |
- **Why a script, not a Vite plugin:** simpler, independently runnable/debuggable, and it matches the project's explicit "build custom tools" directive. A Vite plugin adds HMR complexity you don't need for a 28-row static dataset.
- **Why a script, not `+page.server.ts` load:** a prerender `load` reading the CSV via `fs` *does* work at build time, but it couples data shape to a route and hides the artifact. A committed/inspectable `grants.json` is easier to diff and validate.
- **Custom normalizers** (hand-rolled, per the messy-field spec) parse: `Amount` → `{min, max, avg, received, tbd}`; `Deadline` → `{date, cadence, note}`; `501(c)(3) Required` → tri-state; `Status` → enum. papaparse handles rows; you own the semantics.
### QR Codes
| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **qrcode** | `1.5.4` | Build-time SVG QR generation | **Generate at build**, not runtime. In the ingest/QR script call `QRCode.toString(url, { type: 'svg' })` and write inline SVG (or a data-URI) into the generated config/JSON. Crisp at any scale, zero client-side JS, nothing to guard against SSR, and it prerenders cleanly. URLs are config-driven → regenerate on next build when the two URLs are finalized (no code change, just config). |
### Charts (pipeline overview)
| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **LayerChart** | `2.0.1` | Status totals, secured-vs-potential, deadline timeline | **Recommended for the conventional charts.** Svelte-5-native (peer `svelte ^5`), composable (built on LayerCake + D3 scales), renders SVG → **prerender/SSR-safe**, and themeable to the dark/glass palette. |
| *hand-rolled SVG* | — | Bespoke hero/pipeline visuals | For any signature visual that must match the crystal-glow aesthetic pixel-for-pixel, author SVG directly in Svelte — full control of gradients/filters/glow that a charting lib fights you on. Only 28 rows, so hand-rolling is cheap. |
### Styling & Fonts
| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **tailwindcss** | `4.3.2` | Utility layout, spacing, dark theme | Tailwind **v4** — CSS-first config via `@theme` in your CSS, **no `tailwind.config.js`/PostCSS required**. Fast, ergonomic for layout and the glass grid. |
| **@tailwindcss/vite** | `4.3.2` | Tailwind v4 Vite plugin | The v4 integration path (replaces the old PostCSS plugin). Add to `vite.config` plugins. |
| *hand-authored CSS layer* | — | Glassmorphism, glow, crystal gradients | Design tokens (colors, blurs, shadows) in `@theme`; the signature `backdrop-filter`, layered `box-shadow`/`drop-shadow` glow, and radial gradients as a small bespoke CSS layer. Tailwind for structure, hand-CSS for the premium finish. |
| **@fontsource-variable/** packages | latest | Self-hosted game-UI fonts | **Self-host, don't hotlink Google Fonts** — avoids a runtime request, works offline, and dodges base-path issues on GitHub Pages. |
- **Display / headings:** `Orbitron` (overtly sci-fi/game HUD) *or* the softer `Chakra Petch` / `Michroma` for a Crystarium-HUD vibe.
- **Body / data / tables:** `Inter` (variable) or `Geist` — high legibility for dense grant fields.
### Development Tools
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| **pnpm** | `9.x`/`10.x` (latest) | Package manager | **Use pnpm** (workspace siblings use it; npm-vs-pnpm mismatches bit other projects). If a package needs flat node_modules, add `.npmrc` with a targeted `public-hoist-pattern` rather than global `shamefully-hoist`. |
| **Node** | `22 LTS` (pin via `.nvmrc`) | Runtime | Vite 8 needs Node 20.19+/22.12+. Pin `22` for the Windows dev env and CI. |
| **vitest** | `4.1.9` | Unit tests | Test the CSV normalizers (amount/deadline parsing) — the highest-value tests in this project. |
| **@playwright/test** | `1.61.1` | E2E / visual smoke | Optional but recommended: one smoke test that the prerendered page boots and the WebGL canvas mounts under the correct base path. |
| **svelte-check** | latest | Type/diagnostics | Run in CI alongside `pnpm build`. |
## Installation
# scaffold (SvelteKit minimal, TS)
# Core (already added by scaffold, listed for clarity)
# 3D
# Animation
# Data ingest + QR (build-time)
# Charts
# Styling + fonts
# Testing
## CRITICAL PATTERN #1 — SSR-safe WebGL (never run Three.js during prerender)
## CRITICAL PATTERN #2 — GitHub Pages base path (repo = `Eman_dashboard`)
- In CI (GitHub Actions) set `BASE_PATH=/Eman_dashboard` before `pnpm build`.
- In markup/links use the base: `import { base } from '$app/paths';` → `<a href="{base}/grants/…">`, `<img src="{base}/…">`. Internal `href`s that start with `/` **must** be `{base}/…`.
- `adapter-static` **auto-writes `.nojekyll`** into the build output, so Jekyll won't strip `_`-prefixed asset folders — no manual step needed. (Confirm it's present in `build/` before deploy.)
- Optional: `kit.prerender.entries` if any node-detail route isn't discoverable by crawling links; and consider `trailingSlash: 'always'` only if you hit relative-asset edge cases.
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Threlte 8 | Raw Three.js in Svelte | Only if a low-level renderer feature Threlte can't express is required (not the case here). |
| GSAP | `@threlte/theatre` (Theatre.js) | If you need a visual keyframe *editor* for authored cinematics rather than data-driven procedural animation. |
| postprocessing lib | Emissive materials + `MeshBasicMaterial` fakery | If you want to avoid a bloom pass entirely — but you lose the signature glow; not recommended for a "faithful" Crystarium. |
| Node build script (papaparse) | `+page.server.ts` prerender `load` w/ `fs` | If you'd rather colocate ingest with the route and skip an artifact file. |
| LayerChart | Hand-rolled SVG (whole dashboard) | If every chart must match a bespoke crystal aesthetic and you don't want D3 scale deps. |
| Tailwind v4 | Vanilla CSS + CSS modules | If the team prefers zero utility framework; the glass finish is hand-CSS either way. |
| build-time `qrcode` SVG | runtime `qrcode` | Only if QR URLs must change without a rebuild (they won't — config + rebuild suffices). |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `export const ssr = false` globally | Produces an empty prerendered shell; discards real static content and SEO/first-paint. | `prerender = true` + `ssr = true`, guard WebGL in `onMount`. |
| Chart.js | Canvas-based, imperative, outside Svelte reactivity, fights glassmorphism styling, needs SSR guard. | LayerChart (SVG, Svelte-native) or hand-rolled SVG. |
| Hotlinked Google Fonts | Runtime request, offline break, base-path/CSP friction on GH Pages. | `@fontsource-variable/*` self-hosted. |
| `@threlte/theatre` for node animations | Drags in `@theatre/core` + `@theatre/studio`; editor workflow overkill for procedural data-driven motion. | GSAP + `useTask`. |
| `three@>=0.186` | Breaks `postprocessing@6.39.2` peer range (`<0.186`) — bloom pipeline won't install/behave. | Pin `three@0.185.x`. |
| Runtime canvas QR generation | Extra client JS + an SSR guard for URLs already known at build. | build-time `qrcode.toString({type:'svg'})`. |
| npm (in this workspace) | Sibling projects hit npm-vs-pnpm lockfile/hoisting gotchas. | pnpm (+ targeted `.npmrc` hoist only if a package demands it). |
| Hand-rolled CSV splitter (`.split(',')`) | Fields contain commas, quotes, parentheticals — naive split corrupts rows. | papaparse for tokenizing; custom logic only for normalization. |
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `postprocessing@6.39.2` | `three >=0.168 <0.186` | **Tightest constraint in the stack.** `three@0.185.1` fits; do **not** bump three to 0.186+ without checking a newer postprocessing release. Pin three. |
| `@threlte/core@8.5.16` / `@threlte/extras@9.21.0` | `svelte >=5`, `three >=0.160` | Both satisfied by svelte 5.56.4 + three 0.185.1. |
| `@sveltejs/kit@2.69.1` | `svelte ^5`, `vite ^8` | Vite 8.1.3 is within peer range. |
| `vite@8.1.3` | Node `20.19+` / `22.12+` | Pin Node 22 LTS (`.nvmrc`) for dev + CI. |
| `layerchart@2.0.1` | `svelte ^5` | SSR/SVG-safe; prerenders fine. |
| `@types/three@0.185.0` | `three@0.185.1` | Keep types minor-aligned with three. |
## Stack Patterns by Variant
- Use `SelectiveBloom` (only crystal/emissive layers) instead of full-scene `BloomEffect`, and instance nodes via `@threlte/extras` `<InstancedMesh>`/`<Instance>`.
- Because full-scene bloom + many draw calls is the usual FPS killer; selective bloom + instancing keeps it smooth.
- Re-check `postprocessing` for a release lifting the `<0.186` cap first; upgrade them together.
- Because they're the coupled pair — three drives the break, not Threlte.
- Ship placeholder URLs in a `src/lib/config/qr.ts`, generate SVGs at build; swap the config and rebuild when finalized.
- Because build-time generation is decoupled from code — config edit + rebuild, no component changes.
## Sources
- npm registry `/latest` (verified 2026-07-04, HIGH): `@sveltejs/kit` 2.69.1, `svelte` 5.56.4, `vite` 8.1.3, `@sveltejs/adapter-static` 3.0.10, `@sveltejs/vite-plugin-svelte` 7.1.2, `@threlte/core` 8.5.16, `@threlte/extras` 9.21.0, `three` 0.185.1, `@types/three` 0.185.0, `postprocessing` 6.39.2, `gsap` 3.15.0, `@threlte/theatre` 3.2.2, `papaparse` 5.5.4, `qrcode` 1.5.4, `layerchart` 2.0.1, `tailwindcss` 4.3.2, `@tailwindcss/vite` 4.3.2, `vitest` 4.1.9, `@playwright/test` 1.61.1 — plus peerDependency ranges.
- SvelteKit official docs — Single-page apps / adapter-static (HIGH): `ssr=true` required for real prerender; `fallback` for SPA/404; `paths.base` for project sites. https://svelte.dev/docs/kit/single-page-apps , https://svelte.dev/docs/kit/adapter-static
- SvelteKit issue #14471 (MEDIUM): confirms `ssr=true` needed or prerender emits an empty shell.
- Threlte peer-dependency metadata (HIGH): Svelte 5 + three ≥0.160; Canvas WebGL init is `onMount`-scoped (SSR-safe).
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
