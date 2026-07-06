---
phase: 5
slug: premium-polish-animation-perf
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-06
---

# Phase 5 — Validation Strategy

> Polish phase: the automated surface is regression protection (full existing suite + build gate); animation feel and HUD fixes are verified via the established live-URL Playwright screenshot/UAT pass. All test infrastructure already exists (Wave 0 complete).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (existing 159 tests — regression) + `tools/verify-build.mjs` + Playwright UAT tools (`screenshot-scene`, `uat-overlay`, `uat-detail`, `uat-filter`) |
| **Config file** | existing — no changes |
| **Quick run command** | `pnpm exec vitest run` |
| **Full suite command** | `pnpm exec vitest run && MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs` |
| **Estimated runtime** | ~40s |

---

## Sampling Rate

- **After every task commit:** `pnpm exec vitest run` (regression)
- **After every plan wave:** full suite
- **Before `/gsd:verify-work`:** full suite + live deploy + fresh Playwright UAT/screenshot pass
- **Max feedback latency:** ~45s

---

## Per-Task Verification Map

| Task ID | Requirement | Test Type | Automated Command / Check | Status |
|---------|-------------|-----------|---------------------------|--------|
| 5-intro | AEST-01 | build+grep+manual | intro code exists (gsap timeline in scene components); interruptible (kill-on-input present); build gate green; visual: intro plays then settles | ⬜ |
| 5-activation | AEST-01 | grep+manual | selection activation polish present (uniform/scale tween 150–300ms); visual pass | ⬜ |
| 5-hud-fix-readout | AEST-02 | grep+manual | readout hidden/faded while ui.selected set (code); visual: rail open → no overlap | ⬜ |
| 5-hud-fix-deadline | AEST-02 | unit/grep | raw subtext suppressed when identical to human-readable (conditional present; ideally unit-tested in format or component logic) | ⬜ |
| 5-hud-fix-drawer | AEST-02 | grep+manual | drawer max-height cap present; visual: expanded drawer leaves title/scene visible | ⬜ |
| 5-perf | AEST-01/02 | grep+manual | dpr cap confirmed; no per-frame allocations added; frame feel smooth in capture | ⬜ |
| 5-regression | all | auto | 159 vitest green; `pnpm build` exit 0; verify-build 6/6; title intact; no ssr=false | ⬜ |
| 5-live-gate | all | manual (orchestrator) | fresh deploy + Playwright screenshots: intro settled state, rail-no-overlap, drawer-capped, activation | ⬜ |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Intro choreography feel (stagger, camera settle, skip-on-input) | AEST-01 | Motion feel is perceptual | Load live URL; watch intro; click mid-intro to confirm skip |
| HUD collision fixes + game-UI feel | AEST-02 | Visual | Open rail (readout hides), expand drawer (title visible), hover states |

---

## Validation Sign-Off

- [x] Wave 0 complete (all infra exists)
- [ ] Regression suite green after every task
- [ ] Live visual gate captured by orchestrator
- [x] `nyquist_compliant: true`

**Approval:** approved 2026-07-06
