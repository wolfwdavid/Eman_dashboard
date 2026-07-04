---
phase: 01-deploy-skeleton-toolchain
plan: 03
subsystem: infra
tags: [github-actions, github-pages, deploy-pages, upload-pages-artifact, pnpm, base-path, oidc, sveltekit, adapter-static]

# Dependency graph
requires:
  - phase: 01-01
    provides: "pinned toolchain (Node 22 / pnpm), svelte.config.js base off BASE_PATH, adapter-static fallback:404.html, pnpm-lock.yaml, pnpm-workspace.yaml (allowBuilds)"
  - phase: 01-02
    provides: "styled landing shell (Orbitron Eman_dashboard title / DID Grant Command Center), green verify-build.mjs + Playwright smoke against the BASE_PATH build"
provides:
  - ".github/workflows/deploy.yml: build (pnpm 11 + Node 22, BASE_PATH=/<repo>) + deploy (upload-pages-artifact + deploy-pages) with pages:write + id-token:write + concurrency group pages"
  - "Repo Pages source set to GitHub Actions (build_type=workflow) via gh api"
  - "Live end-to-end proof: https://wolfwdavid.github.io/Eman_dashboard/ returns 200 with the styled title, base-prefixed /Eman_dashboard/_app/ assets, and a working SPA 404.html deep-link fallback"
affects: [phase-2-data-pipeline, phase-3-crystarium, phase-4-charts, phase-5-animation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GitHub Pages deploy via Actions (NOT gh-pages branch): build job uploads build/ as a Pages artifact, deploy job publishes via actions/deploy-pages@v4 over OIDC (id-token:write)"
    - "BASE_PATH derived from ${{ github.event.repository.name }} so the subpath is never hardcoded wrong-cased"
    - "CI pnpm major must match the local toolchain that generated pnpm-lock.yaml + pnpm-workspace.yaml (pnpm 11) — the allowBuilds: workspace key is pnpm 10+ only"
    - "concurrency group: pages with cancel-in-progress: false so overlapping deploys queue instead of racing"

key-files:
  created:
    - .github/workflows/deploy.yml
  modified: []

key-decisions:
  - "Pinned CI pnpm to 11 (not the research/sibling's 9) to match the local toolchain that wrote pnpm-workspace.yaml's allowBuilds: key — pnpm 9 rejects a workspace file with no packages: field"
  - "Set the Pages source via `gh api -X POST .../pages -f build_type=workflow` rather than leaving it a manual UI step — the executor is authed as wolfwdavid so the one-time setting was automatable"
  - "Kept Node pinned to 22 per project .nvmrc (sibling used 24; both clear Vite 8's 22.12+ floor) — single source of truth"

patterns-established:
  - "Every later phase re-deploys through this exact deploy.yml; base-path/prerender regressions surface on the real host immediately"
  - "First-enable Pages deploys can fail once with 'Deployment failed, try again later' — re-run the failed deploy job (gh run rerun --failed), it is a provisioning race, not a code fault"

requirements-completed: [DPLY-03]

# Metrics
duration: 8min
completed: 2026-07-04
---

# Phase 1 Plan 03: GitHub Actions Deploy Summary

**A push-to-main GitHub Actions pipeline (pnpm 11 + Node 22) that builds SvelteKit with BASE_PATH=/Eman_dashboard and publishes to GitHub Pages via upload-pages-artifact + deploy-pages — proven live end-to-end at https://wolfwdavid.github.io/Eman_dashboard/ with base-prefixed assets, zero root-absolute /_app/ leaks, and a working SPA 404 fallback.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-04T22:37:36Z
- **Completed:** 2026-07-04T22:45:05Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 1 created

## Accomplishments
- Authored `.github/workflows/deploy.yml`: a build job (pnpm 11, Node 22, `BASE_PATH=/${{ github.event.repository.name }}`, `pnpm run build`, `upload-pages-artifact@v3` on `build/`) and a deploy job (`deploy-pages@v4`) with `pages:write` + `id-token:write` OIDC permissions and a `pages` concurrency group.
- Set the repo Pages source to GitHub Actions (`build_type=workflow`) via `gh api` — no manual UI step needed.
- Pushed to `main`, drove the Actions run to `success`, and verified the live URL end-to-end: HTTP 200, title text `Eman_dashboard`, base-prefixed `/Eman_dashboard/_app/` assets, and the deep-link `/nope/` serving the app's own styled `404.html` (SPA fallback) rather than GitHub's raw 404.
- Closed DPLY-03 and confirmed DPLY-01/DPLY-02 survive a real Pages deploy (base-path 404s are invisible on localhost).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the GitHub Actions deploy workflow** - `6f14b62` (feat), plus `0b9c5d0` (fix — Rule 3 CI pnpm version)
2. **Task 2: Set Pages source, push to main, confirm run + live URL** - CLI/CI actions (no file commit): `gh api build_type=workflow`, `git push`, `gh run watch`, live `curl`
3. **Task 3: Human confirms the live styled site with no 404s** - checkpoint (no files); approved by orchestrator after independent live verification

**Plan metadata:** (final docs commit — this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified
- `.github/workflows/deploy.yml` *(created)* - build + deploy jobs; pnpm 11 + Node 22; BASE_PATH from repo name; upload-pages-artifact + deploy-pages; pages:write + id-token:write; concurrency group pages; triggers on push to main + workflow_dispatch

## Decisions Made
- **CI pnpm pinned to 11, not 9:** the research/sibling `deploy.yml` used pnpm 9, but this repo's `pnpm-workspace.yaml` carries an `allowBuilds:` key (a pnpm 10+ workspace feature written by the local pnpm 11.0.9). pnpm 9 rejects a workspace file lacking a `packages:` field, so CI must match the local major.
- **Pages source automated, not left manual:** the executor is authed as `wolfwdavid`, so the one-time "Source = GitHub Actions" setting was set via `gh api` instead of flagging it as a human step.
- **Node stays 22:** matches the project's `.nvmrc` single source of truth (sibling used 24; both satisfy Vite 8's Node 22.12+ floor).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CI pnpm version mismatch broke the first run**
- **Found during:** Task 2 (first Actions run)
- **Issue:** The run failed at the Setup Node pnpm-cache step with `ERROR packages field missing or empty`. Root cause: `pnpm-workspace.yaml` uses the `allowBuilds:` key (pnpm 10+ workspace feature, written by the local pnpm 11.0.9 that generated the `lockfileVersion 9.0` lockfile), but the workflow pinned pnpm **9**, which rejects a workspace file with no `packages:` field when running `pnpm store path`.
- **Fix:** Bumped `pnpm/action-setup` `version: 9 → 11` to match the local toolchain (added an explanatory comment in the workflow).
- **Files modified:** `.github/workflows/deploy.yml`
- **Verification:** Re-run's build job went green (install + build + upload-pages-artifact all passed); `--frozen-lockfile` succeeded.
- **Committed in:** `0b9c5d0` (fix)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Necessary to make CI reproducible against the local pnpm that generated the lockfile/workspace file. No scope creep.

## Issues Encountered
- **Transient Pages first-enable deploy failure:** after the build succeeded, the `deploy` job failed once with `Deployment failed, try again later.` (Pages `status` still `null` — provisioning on first enable). Resolved operationally by re-running the failed deploy job (`gh run rerun 28721969970 --failed`), which then concluded `success`. No code change. Note for future first-time Pages enables: expect one provisioning-race retry.
- **Unrelated working-tree changes left untouched:** pre-existing `agent/did_agent/tools/score_grant.py` (modified) and `agent/did_agent/scoring.py` (untracked) are out of scope for this deploy plan; only `.github/workflows/deploy.yml` was staged/committed.

## Verification Evidence
- **Actions run:** conclusion `success` — https://github.com/wolfwdavid/Eman_dashboard/actions/runs/28721969970
- **Pages source:** `gh api repos/wolfwdavid/Eman_dashboard/pages --jq .build_type` → `workflow`
- **Live URL:** `curl -fsSL https://wolfwdavid.github.io/Eman_dashboard/` → HTTP 200; body contains `Eman_dashboard`; body contains `/Eman_dashboard/_app/` (base-prefixed assets, zero root-absolute `/_app/`)
- **Deep-link SPA fallback:** `https://wolfwdavid.github.io/Eman_dashboard/nope/` → serves the app's own `404.html` (404 status by GitHub design) containing the `Eman_dashboard` title
- **Human/orchestrator confirm:** styled dark page, Orbitron h1 "Eman_dashboard", "Grant Command Center" subtitle, "Diversity Includes Disability" tagline, Crystarium premise line; zero 404s in the network tab

## User Setup Required
None — the one-time Pages "Source = GitHub Actions" setting was automated via `gh api` (`build_type=workflow`). No repo secrets needed (OIDC `id-token: write` + the `github-pages` environment handle auth).

## Next Phase Readiness
- The deploy pipeline is live and proven end-to-end on the real host. DPLY-01, DPLY-02, and DPLY-03 are all closed; every later phase re-deploys through this exact `deploy.yml`.
- Phase 1 (Deploy Skeleton + Toolchain) is complete — ready to plan Phase 2 (build-time CSV → typed JSON data pipeline).

## Self-Check: PASSED

`.github/workflows/deploy.yml` present on disk; commits `6f14b62` and `0b9c5d0` found in git history; live URL verified HTTP 200 with title + base-prefixed assets.

---
*Phase: 01-deploy-skeleton-toolchain*
*Completed: 2026-07-04*
