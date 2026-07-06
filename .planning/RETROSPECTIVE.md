# Retrospective — Eman_dashboard

## Milestone: v1.0 — Grant Crystarium MVP

**Shipped:** 2026-07-06 (started 2026-07-04 — ~2 days)
**Phases:** 5 | **Plans:** 18 | **Tasks:** 36 | **Commits:** ~124 | **LOC:** ~5,400 (src + tools, excluding generated)

### What Was Built

A faithful FFXIII-Crystarium 3D grant command-center for Diversity Includes Disability, live at https://wolfwdavid.github.io/Eman_dashboard/ — 28 funders as data-encoded crystal nodes (ring=status funnel, scale=amount, pulse=deadline urgency, beam=fiscal-sponsor path), with a glassmorphism HUD (detail rail, 4-chart pipeline drawer, 3-axis filters, QR share panel), a GSAP awakening intro, and a custom build-time toolchain (CSV ingest/normalizers with a zod build gate, QR generator, deploy verifier, Playwright UAT drivers). 162 unit tests; every phase live-verified.

### What Worked

- **Deploy-first, data-as-contract ordering** (from upfront research) — the two invisible failure modes (GH Pages base-path, SSR-WebGL) were burned down in Phase 1 before any 3D existed; zero base-path incidents afterward.
- **Parser-first testing** — unit-testing every literal CSV string (18 amount + 20 deadline shapes) made the headline numbers ($20,000 / $296,500) trustworthy and caught the "TBD→0" and "count 5 vs 4 beam targets" classes of bugs at plan time.
- **Orchestrator-verified checkpoints** — instead of blind-approving human-verify gates, Playwright screenshot/interaction passes against the LIVE deploy caught real issues (drawer covering canvas clicks) and produced durable evidence.
- **Parallel executors with strict file scopes** — Waves with zero file overlap (02-02∥02-03, 04-02∥04-03, 05-01∥05-02) ran cleanly with `--no-verify` + post-wave gates.
- **Plan-checker empiricism** — the checker sandbox-tested `grep -qv` acceptance criteria and proved them no-ops; two plans fixed before execution.

### What Was Inefficient

- **GitHub Pages deployment wedge** (status: null) cost ~3 failed runs before the delete+recreate remedy; now documented.
- **Stale local `vite preview` on :4173** caused false Playwright failures twice; kill-before-run is now habit.
- **A ROADMAP.md overwrite by the Phase-4 planner** required a git-history reconciliation (turned out benign, but cost a verification loop).
- The local screenshot tool's first version tried to manage its own preview server and hung; hitting the live URL directly was simpler and more truthful.

### Patterns Established

- `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` for all local Windows base-path builds.
- Explicit `build:data && build:qr && vite build` chaining (pnpm skips `prebuild`).
- Pure, Three-free layout/derivation modules as the automated-verification surface for 3D work; pixels stay manual.
- `tools/*.mjs` custom-tool idiom: no-dep Node ESM, clear exit codes, grep-able assertions.
- UI-SPEC design contracts (ui-ux-pro-max) before planning frontend phases; semantic hex tokens end-to-end (scene materials = chart fills = HUD chips).

### Key Lessons

1. Verify checkpoint gates against the deployed artifact, not localhost — base-path and CDN behavior only exist there.
2. Compute data-derived sets (beam targets, pulse membership) from the dataset at build/scene time; never hardcode counts from prose (research said 5; data said 4).
3. Clock-free derivations keep layout deterministic and testable; use the clock only for cosmetic amplitude.
4. When a Pages deployment fails instantly with `status: null`, recreate the Pages site — reruns won't fix a wedged provisioning state.

### Cost Observations

- Model mix: Opus for research/planning/execution agents, Sonnet for checkers/verifiers — the checker/verifier tier caught issues without Opus cost.
- ~35 subagent runs across 5 phases (researchers, planners, checkers, executors, verifiers, integration).
- Notable: the 4-way parallel project-research fan-out and the 2-way parallel executor waves were the biggest wall-clock savers.

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases / plans / tasks | 5 / 18 / 36 |
| Tests at ship | 162 |
| Verification score | 29/29 reqs, 19/19 integration links, 5/5 flows |
| Deploy incidents | 2 (pnpm-version CI mismatch; Pages wedge) — both documented with remedies |
