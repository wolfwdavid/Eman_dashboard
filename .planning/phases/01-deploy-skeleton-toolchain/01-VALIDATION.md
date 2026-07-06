---
phase: 1
slug: deploy-skeleton-toolchain
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (unit) + Playwright 1.x (smoke) + custom `tools/verify-build.mjs` (build-output assertions) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` — none — Wave 0 installs |
| **Quick run command** | `node tools/verify-build.mjs` (after a build) |
| **Full suite command** | `pnpm build && node tools/verify-build.mjs && pnpm test` |
| **Estimated runtime** | ~30 seconds (build) + ~10 seconds (checks) |

---

## Sampling Rate

- **After every task commit:** Run `node tools/verify-build.mjs` (once a build exists)
- **After every plan wave:** Run `pnpm build && node tools/verify-build.mjs`
- **Before `/gsd:verify-work`:** Full suite must be green + live URL returns 200
- **Max feedback latency:** ~40 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | DPLY-01 | build | `pnpm build` exits 0; `build/index.html` exists | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | DPLY-02 | build-grep | `node tools/verify-build.mjs` asserts every `_app/` asset URL is prefixed `/Eman_dashboard/`; zero root-absolute `/_app/` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | DPLY-02 | build-grep | `build/.nojekyll` exists AND `build/404.html` exists | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | DPLY-02 | e2e-smoke | Playwright loads preview at base `/Eman_dashboard/`, asserts title text present, zero failed asset requests | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | DPLY-03 | manual+ci | GitHub Actions run on push to main succeeds; live `https://wolfwdavid.github.io/Eman_dashboard/` returns 200 with title text | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@playwright/test` installed (dev deps) — no framework present yet (greenfield)
- [ ] `playwright.config.ts` — points at `pnpm preview`, `baseURL` includes `/Eman_dashboard/`
- [ ] `tools/verify-build.mjs` — build-output assertion script (base-path prefix, `.nojekyll`, `404.html`, `index.html`)
- [ ] `tests/smoke.spec.ts` — one smoke test asserting the deployed shell renders

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub Pages source set to "GitHub Actions" | DPLY-03 | One-time repo setting, not code | Settings → Pages → Source = GitHub Actions (or `gh api -X POST repos/wolfwdavid/Eman_dashboard/pages -f build_type=workflow`) |
| Live Pages URL serves the styled shell | DPLY-02, DPLY-03 | Requires the real github.io subpath, which localhost can't fully replicate | After Actions run completes, open `https://wolfwdavid.github.io/Eman_dashboard/` — page loads styled, no 404s in devtools network tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 40s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
