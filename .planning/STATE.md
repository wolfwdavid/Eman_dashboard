---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 02-02-PLAN.md
last_updated: "2026-07-05T01:50:45.101Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 7
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** The Crystarium sphere grid makes the entire grant pipeline legible and navigable at a glance — funder status, funding amount, and deadline urgency are all readable from the shape and glow of the grid before a single click.
**Current focus:** Phase 02 — Data Pipeline + Custom Tools

## Current Position

Phase: 02 (Data Pipeline + Custom Tools) — EXECUTING
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

### Pending Todos

None yet.

### Blockers/Concerns

- **SSR-safe WebGL** (Phase 3): Three.js must never run during prerender — gate Canvas behind browser flag; never `ssr=false`. Load-bearing failure point.
- **GitHub Pages base-path** (Phase 1): the #1 killer — every asset/link/texture must route through `base`; fails invisibly (green on localhost, broken on deploy).
- **Crystarium layout** (Phase 3/5): original design (MEDIUM confidence); tunable constants need visual iteration — flagged for research-phase.
- **Two QR URLs not finalized:** ship absolute placeholder https URLs in `config/sites.js`; swap later with zero code change.
- **Sensitive-field exposure:** confirm all displayed fields (esp. Next Action notes) are public-safe before shipping; never commit raw Notion source / creds.

## Session Continuity

Last session: 2026-07-05T01:50:20.858Z
Stopped at: Completed 02-02-PLAN.md
Resume file: None
