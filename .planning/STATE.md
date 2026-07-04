# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** The Crystarium sphere grid makes the entire grant pipeline legible and navigable at a glance — funder status, funding amount, and deadline urgency are all readable from the shape and glow of the grid before a single click.
**Current focus:** Phase 1 — Deploy Skeleton + Toolchain

## Current Position

Phase: 1 of 5 (Deploy Skeleton + Toolchain)
Plan: 0 of ~2 in current phase
Status: Ready to plan
Last activity: 2026-07-04 — Roadmap created (5 phases, 29 v1 requirements mapped)

Progress: [░░░░░░░░░░] 0%

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: **Deploy-first, data-as-contract** build order (both ARCHITECTURE.md and PITFALLS.md converge on it) — Phase 1 ships a real Pages skeleton before any 3D.
- Roadmap: QR-code generation TOOL (DATA-06) lives in Phase 2 (build tool); QR panel UI (QRUI-01/02) lives in Phase 4.
- Stack: pin `three@0.185.1` (postprocessing peer constraint <0.186), Node 22 LTS, pnpm exclusively.

### Pending Todos

None yet.

### Blockers/Concerns

- **SSR-safe WebGL** (Phase 3): Three.js must never run during prerender — gate Canvas behind browser flag; never `ssr=false`. Load-bearing failure point.
- **GitHub Pages base-path** (Phase 1): the #1 killer — every asset/link/texture must route through `base`; fails invisibly (green on localhost, broken on deploy).
- **Crystarium layout** (Phase 3/5): original design (MEDIUM confidence); tunable constants need visual iteration — flagged for research-phase.
- **Two QR URLs not finalized:** ship absolute placeholder https URLs in `config/sites.js`; swap later with zero code change.
- **Sensitive-field exposure:** confirm all displayed fields (esp. Next Action notes) are public-safe before shipping; never commit raw Notion source / creds.

## Session Continuity

Last session: 2026-07-04
Stopped at: ROADMAP.md + STATE.md created, REQUIREMENTS.md traceability populated
Resume file: None — next step is `/gsd:plan-phase 1`
