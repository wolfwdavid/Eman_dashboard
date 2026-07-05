---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 03-03-PLAN.md
last_updated: "2026-07-05T04:10:01.619Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 11
  completed_plans: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** The Crystarium sphere grid makes the entire grant pipeline legible and navigable at a glance — funder status, funding amount, and deadline urgency are all readable from the shape and glow of the grid before a single click.
**Current focus:** Phase 03 — 3D Crystarium Scene

## Current Position

Phase: 03 (3D Crystarium Scene) — EXECUTING
Plan: 4 of 4

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

### Pending Todos

None yet.

### Blockers/Concerns

- **SSR-safe WebGL** (Phase 3): Three.js must never run during prerender — gate Canvas behind browser flag; never `ssr=false`. Load-bearing failure point.
- **GitHub Pages base-path** (Phase 1): the #1 killer — every asset/link/texture must route through `base`; fails invisibly (green on localhost, broken on deploy).
- **Crystarium layout** (Phase 3/5): original design (MEDIUM confidence); tunable constants need visual iteration — flagged for research-phase.
- **Two QR URLs not finalized:** ship absolute placeholder https URLs in `config/sites.js`; swap later with zero code change.
- **Sensitive-field exposure:** confirm all displayed fields (esp. Next Action notes) are public-safe before shipping; never commit raw Notion source / creds.

## Session Continuity

Last session: 2026-07-05T04:09:06.013Z
Stopped at: Completed 03-03-PLAN.md
Resume file: None
