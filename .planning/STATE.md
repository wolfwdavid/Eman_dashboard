---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 05-02-PLAN.md
last_updated: "2026-07-06T13:17:20.898Z"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 18
  completed_plans: 18
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** The Crystarium sphere grid makes the entire grant pipeline legible and navigable at a glance — funder status, funding amount, and deadline urgency are all readable from the shape and glow of the grid before a single click.
**Current focus:** Phase 05 — Premium Polish / Animation / Perf

## Current Position

Phase: 05 (Premium Polish / Animation / Perf) — EXECUTING
Plan: 2 of 2

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: — min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 13 | 2 tasks | 13 files |
| Phase 01 P02 | 14min | 2 tasks | 7 files |
| Phase 01-deploy-skeleton-toolchain P03 | 8 | 3 tasks | 1 files |
| Phase 02 P01 | 9 | 3 tasks | 10 files |
| Phase 02 P03 | 4 | 2 tasks | 4 files |
| Phase 02 P02 | 11min | 3 tasks | 8 files |
| Phase 02 P04 | 8min | 2 tasks | 3 files |
| Phase 03 P01 | 11 | 2 tasks | 7 files |
| Phase 03 P02 | 8 | 2 tasks | 3 files |
| Phase 03 P03 | 30 | 2 tasks | 10 files |
| Phase 03 P04 | 25min | 2 tasks | 5 files |
| Phase 04 P01 | 13 | 3 tasks | 14 files |
| Phase 04-hud-overlay-ui-fallback P02 | 9 | 2 tasks | 1 files |
| Phase 04 P03 | 20 | 3 tasks | 7 files |
| Phase 04 P04 | 8 | 3 tasks | 3 files |
| Phase 05 P01 | 18 | 3 tasks | 5 files |
| Phase 05 P02 | 16min | 3 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: **Deploy-first, data-as-contract** build order (both ARCHITECTURE.md and PITFALLS.md converge on it) — Phase 1 ships a real Pages skeleton before any 3D.
- Roadmap: QR-code generation TOOL (DATA-06) lives in Phase 2 (build tool); QR panel UI (QRUI-01/02) lives in Phase 4.
- Stack: pin `three@0.185.1` (postprocessing peer constraint <0.186), Node 22 LTS, pnpm exclusively.
- [Phase 01]: paths.relative=false: emit absolute /Eman_dashboard/_app/ URLs so the DPLY-02 base-prefix grep is verifiable (SvelteKit default relative './_app/' is not)
- [Phase 01]: static/.nojekyll added manually — adapter-static 3.0.10 does not auto-emit it (research note outdated)
- [Phase 01]: 01-02: app.css owns Tailwind+@fontsource+@theme, imported via +layout.svelte; favicon via %sveltekit.assets% (base-safe)
- [Phase 01]: 01-02: explicit body background-color (not just gradient) + playwright webServer BASE_PATH so preview serves the subpath — verify-build + smoke green
- [Phase 01-deploy-skeleton-toolchain]: CI pnpm pinned to 11 to match local toolchain (pnpm-workspace.yaml allowBuilds: is pnpm 10+; pnpm 9 errored 'packages field missing or empty')
- [Phase 01-deploy-skeleton-toolchain]: Pages source set to GitHub Actions via gh api build_type=workflow (automated, no manual UI step)
- [Phase 02]: isPassed is the exact literal '(passed)' marker only (clock-independent); '2027-02-18 (2026 cycle passed)' stays isPassed=false (Open Q1)
- [Phase 02]: Amount normalizers return null (never 0) for TBD/qualitative amounts; avg = explicit (avg $X) else range midpoint
- [Phase 02]: 02-03: QR targets are absolute external URLs; generator asserts startsWith('http') AND no /Eman_dashboard/ base prefix (Pitfall 5)
- [Phase 02]: 02-03: sites.js is the single swap point; second URL is an explicit REPLACE-ME placeholder; re-run generate-qr.mjs after swap (no component change)
- [Phase 02]: by501c3 = 12 no / 8 yes / 8 unknown — parser is source of truth (asserted sum=28, not a hardcoded count); 02-RESEARCH's 11-no hand-count omitted 37 Angels
- [Phase 02]: Grant id = slug of full 'Funder / Program' cell; potentialTotal basis = avg ?? max ?? min over 9 rows = 296500; securedTotal=20000 hard-locked
- [Phase 02]: 02-04: build gate wired as explicit pnpm build:data && build:qr && vite build chain (pnpm skips prebuild) — bad CSV fails the build; validate.test.mjs proves it (unit + spawnSync integration)
- [Phase 02]: 02-04: qrCodes re-exported from $lib/data barrel (deferred cross-plan wiring closed) — Phase 4 QR panel import ready
- [Phase 03]: 03-01: three pinned exact 0.185.1 (no caret) — postprocessing 6.39.2 peer ceiling <0.186
- [Phase 03]: 03-01: postprocessing added to vite ssr.noExternal so prerender resolves the ESM (Pitfall B)
- [Phase 03]: 03-01: tokens.ts is numeric-hex source of truth for Three materials; UI-SPEC @theme CSS is the DOM twin (keep in lock-step)
- [Phase 03]: Beam targets derived from requires501c3Raw (exactly 4), not tri-state requires501c3==='yes' (which yields 8)
- [Phase 03]: Deadline pulse set is clock-free (cadence+isPassed+status) → exactly 3; a live Date check would break determinism
- [Phase 03]: 03-03: Canvas kept autoRender=false (03-04 composer contract) + temporary in-Scene render task so 28 crystals render now
- [Phase 03]: 03-03: SSR-safe WebGL boundary owned — Canvas dynamic-imported behind {#if browser && mounted}; HUD prerenders; build+verify-build green
- [Phase 03]: Bloom EffectComposer is the single render authority (autoRender=false + renderStage); temp 03-03 render task removed
- [Phase 03]: Deadline pulse membership stays the clock-free node.pulse set (3 nodes); live Date drives cosmetic amplitude band only
- [Phase 04]: 04-01: FilterState axes typed as plain string (DOM-origin values) — resolves setFilter/svelte-check union friction; allowed values documented
- [Phase 04]: 04-01: added $lib resolve alias to vitest.config.ts so data tests import the barrel as the app does (bare vitest has no SvelteKit plugin)
- [Phase 04]: 04-01: filter-dim folded into CrystalNode useTask (opacity+emissive x0.15) + handler-guard raycast; nodes dimmed never deleted so funnel layout stays stable
- [Phase 04-hud-overlay-ui-fallback]: 04-02: DetailPanel consumes real format.ts API (tone/sponsorHint), not the plan prose's token/hint; sponsorHint→gold 'NY Community Trust may sponsor' line
- [Phase 04-hud-overlay-ui-fallback]: 04-02: color-mix(var(--node-hue) N%) for pill/badge/link tints keeps token discipline (no new hex/alpha tokens); single --node-hue prop echoes selected crystal across header/pill/CTA/link
- [Phase 04]: Chart C uses deterministic urgency-bucket colouring (cDomain/cRange) instead of a bespoke overlay to meet the <30d-urgent/passed-ash contract
- [Phase 04]: Background-click deselect wired via onpointermissed on the geometry-less scene Group (never in initialHits → fires on every click, before dispatch); no DOM/3D catch layer, canvas raycast intact
- [Phase 04]: Shipped optional WebGL-probe 2D fallback (RESL-01) — client-only probe swaps FallbackList for Canvas; reuses DetailPanel + format helpers; never blocks the build gate
- [Phase 05]: 05-02: rawRedundant(text,raw) pure trim-equal predicate guards both AMOUNT+DEADLINE subtext; PipelineReadout auto-hides via class:hidden (opacity/translateX, SSR-visible); drawer capped on inner .grid (60vh) so .charts slide stays intact

### Pending Todos

None yet.

### Blockers/Concerns

- **SSR-safe WebGL** (Phase 3): Three.js must never run during prerender — gate Canvas behind browser flag; never `ssr=false`. Load-bearing failure point.
- **GitHub Pages base-path** (Phase 1): the #1 killer — every asset/link/texture must route through `base`; fails invisibly (green on localhost, broken on deploy).
- **Crystarium layout** (Phase 3/5): original design (MEDIUM confidence); tunable constants need visual iteration — flagged for research-phase.
- **Two QR URLs not finalized:** ship absolute placeholder https URLs in `config/sites.js`; swap later with zero code change.
- **Sensitive-field exposure:** confirm all displayed fields (esp. Next Action notes) are public-safe before shipping; never commit raw Notion source / creds.

## Session Continuity

Last session: 2026-07-06T13:14:39.863Z
Stopped at: Completed 05-02-PLAN.md
Resume file: None
