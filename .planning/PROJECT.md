# Eman_dashboard

## What This Is

A premium, modern 3D grant/funding **command center** for Eman Rimawi's organization, Diversity Includes Disability (DID). The primary navigation surface is a faithful homage to the Final Fantasy XIII **Crystarium** sphere grid — radial crystal nodes connected by glowing paths, with unlock/activation animations — where each node represents a funder or grant opportunity. Selecting a node drills into that grant's detail. It turns a flat 28-row grant spreadsheet into an explorable, high-visual-investment dashboard that surfaces pipeline status, funding secured vs. potential, upcoming deadlines, and next actions at a glance.

## Core Value

The Crystarium sphere grid makes the entire grant pipeline legible and navigable at a glance — funder status, funding amount, and deadline urgency are all readable from the shape and glow of the grid before a single click.

## Requirements

### Validated

- ✓ Deploy to GitHub Pages under repo `Eman_dashboard` (adapter-static, correct base path, .nojekyll, 404.html SPA fallback, Actions pipeline) — Phase 1 (live at https://wolfwdavid.github.io/Eman_dashboard/)
- ✓ Ingest `data/grants.csv` (28 funders) into structured, typed data via custom build tools (amount/deadline/status normalizers, zod build gate, aggregates: secured $20,000 / potential $296,500) — Phase 2
- ✓ Custom build tools: CSV ingest/transform, QR-code generation (2 swappable config URLs), data validation (fails build on bad row) — Phase 2

- ✓ Faithful FFXIII Crystarium sphere grid as the primary 3D navigation surface (Threlte 8, browser-guarded SSR-safe WebGL, selective bloom); node status/amount/deadline encodings + fiscal-sponsor beam; live-screenshot verified — Phase 3

- ✓ Selecting a node opens a grant detail view (all fields, normalized+raw amount/deadline, Next Action CTA, external link; camera focus) — Phase 4 (live-UAT verified)
- ✓ Pipeline overview: 4 charts (status totals, secured $20,000 vs potential $296,500, deadline timeline, 501c3 split) + status/gate/type filters that dim the grid — Phase 4
- ✓ QR code panel: two swappable-config QR tiles (SHARE widget) — Phase 4
- ✓ Minimal WebGL-less fallback list (optional RESL-01, shipped early) — Phase 4
- ✓ GSAP Crystarium "awakening" intro (staggered rim→center, gold master lands last, interruptible) + activation polish — Phase 5 (live-verified)
- ✓ Glassmorphism RPG HUD polish: rail/readout collision fixed, duplicate deadline subtext fixed, drawer height capped, press states — Phase 5

### Active

(None — v1.0 shipped. Define next-milestone scope via `/gsd:new-milestone`.)

### Out of Scope

- Accessibility features (WCAG, screen-reader, keyboard-first, reduced-motion) — deliberately excluded for THIS build; full 3D/visual investment is the priority instead. (DID's accessibility-first mission is served by the sibling `diversityincludesdisability_*` projects.)
- Live CRUD editing of grant data in-app — data is build-time ingested from CSV; edits happen in the CSV source, not the UI.
- Backend / database / auth — static site, no server. Data is baked at build time.
- Multiple theme variants — single premium 3D version only.

## Current State (v1.0 — shipped 2026-07-06)

- **Live:** https://wolfwdavid.github.io/Eman_dashboard/ (GitHub Pages, Actions deploy on push to main)
- **Codebase:** ~5,400 LOC (SvelteKit 2 / Svelte 5 runes / Threlte 8 / three@0.185.1 pinned / postprocessing / GSAP / LayerChart / Tailwind v4; pnpm, Node 22); 162 unit tests; custom tools in `tools/` (ingest, QR, verify-build, UAT drivers)
- **Milestone record:** `.planning/MILESTONES.md`, archives in `.planning/milestones/`, retrospective in `.planning/RETROSPECTIVE.md`
- **Known deferred (v2 candidates):** sound cues, ambient particles, node leveling arcs, expanded analytics, robust WebGL fallback, REAL QR target URLs (placeholders in `src/lib/config/sites.js`), verify-build in CI
- **Ops notes:** GH Pages wedge remedy = `gh api DELETE /pages` + `POST build_type=workflow` + re-run; local base-path builds need `MSYS_NO_PATHCONV=1`

## Next Milestone Goals

Not yet defined — candidates: the DID grant-automation agent (separate brief), v2 immersion/analytics backlog, or handoff polish for Eman. Start with `/gsd:new-milestone`.

## Context

- **Data source:** `data/grants.csv` — 28 funders. Columns: Funder/Program, Type, Amount, Deadline, 501(c)(3) Required, Fit/Eligibility, Status, Next Action, Link. Statuses observed: Active funder, In progress, To research, Recurring, Applied, Declined, Not eligible (yet), Not eligible. Amounts are messy strings ("$5,000-$20,000 (avg $10,000)", "TBD", "$20,000 (received 2025)") — the ingest tool must parse/normalize them (min/max/avg, received flag, TBD flag). Deadlines are also messy ("2026-06-30 (decision by Oct 31)", "Rolling (monthly)", "Invitation only", "Annual") — parse to a normalized date + cadence + note.
- **Reference:** `data/reference-grant-tracker.html` — the existing flat HTML grant tracker (design inspiration / data cross-check).
- **Owner:** Eman Rimawi, Diversity Includes Disability (DID). Org is 501(c)(3)-pending; the 501(c)(3) gate is a meaningful axis in the data (some funders require it, some don't).
- **Sibling projects:** `Websites/diversityincludesdisability_{one,two,three,four}` (accessibility-first DID sites) and `Websites/Rimawi` (original grant tracker + `grants.csv` source).
- **Sensitive data note:** the upstream Notion source contained plaintext credentials — never commit raw credentials. `grants.csv` here is the sanitized, public-safe grant pipeline data only.

## Constraints

- **Tech stack**: SvelteKit + a Svelte 3D layer (Threlte / Three.js) for the Crystarium. Modern, premium aesthetic.
- **Rendering**: Static site (SvelteKit `adapter-static`) — must fully prerender for GitHub Pages.
- **Deployment**: GitHub Pages under repo `Eman_dashboard`; base path must match the repo name for correct asset URLs.
- **Design authority**: `ui-ux-pro-max` skill drives the UI-SPEC — dark premium palette, glassmorphism/glow, grant command-center dashboard patterns, appropriate chart types for the funding pipeline.
- **Data**: build-time ingest from `data/grants.csv`; no runtime data fetching.
- **QR targets**: two site URLs, not yet finalized — must be config-driven so they can be dropped in later without code changes.
- **Custom tooling**: user explicitly requested building custom tools rather than relying solely on off-the-shelf libraries where a purpose-built tool fits.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Faithful FFXIII Crystarium as nav surface (not a subtle motif) | User chose "Faithful Crystarium homage" — high visual investment is the point | ✓ Good |
| No accessibility layer this build | User explicitly waived a11y for this version to maximize 3D/visual investment | ✓ Good |
| SvelteKit + Threlte for 3D | Svelte requested; Threlte is the idiomatic Svelte wrapper over Three.js | ✓ Good |
| Build-time CSV ingest via custom tool | Data is static, 28 rows, messy strings needing normalization; no backend | ✓ Good |
| GitHub Pages static deploy | User specified gh-pages; no server needed | ✓ Good (one Pages wedge; remedy documented) |
| QR targets as swappable config | Two URLs not finalized; decouple content from code | ✓ Good (real URLs still pending) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-06 after v1.0 milestone*
