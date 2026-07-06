---
phase: 3
slug: 3d-crystarium-scene
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-04
---

# Phase 3 — Validation Strategy

> Canonical detail: `03-RESEARCH.md` → "## Validation Architecture". The load-bearing testable surface is the PURE layout module; the 3D visual fidelity is manual (needs eyes on the live scene).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (pure layout/derivation unit tests) + `tools/verify-build.mjs` (prerender/deploy invariants) + manual visual on live scene |
| **Config file** | `vitest.config.ts` — extend `include` to cover `src/lib/crystarium/**/*.test.ts` |
| **Quick run command** | `pnpm exec vitest run src/lib/crystarium` |
| **Full suite command** | `pnpm exec vitest run && MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs` |
| **Estimated runtime** | ~30s (build dominates) |

---

## Sampling Rate

- **After every task commit:** `pnpm exec vitest run src/lib/crystarium`
- **After every plan wave:** full suite (unit + build + verify-build)
- **Before `/gsd:verify-work`:** full suite green + live scene visually confirmed
- **Max feedback latency:** ~35s

---

## Per-Task Verification Map

| Task ID | Wave | Requirement | Test Type | Automated Command / Check | Status |
|---------|------|-------------|-----------|---------------------------|--------|
| 3-layout-nodes | 1 | CRYS-02 | unit | `computeLayout(grants)` returns 28 nodes, all finite `{x,y,z}`; deterministic (same input → same output) | ⬜ |
| 3-layout-center | 1 | CRYS-02/03 | unit | center node (origin, min radius) === `ny-community-trust` (the active funder) | ⬜ |
| 3-layout-scale | 1 | CRYS-04 | unit | node scale = log(amount); the 16 TBD/qualitative nodes get the fixed minimal "unformed" scale (not 0, not amount-scaled) | ⬜ |
| 3-derive-beam | 1 | CRYS-06 | unit | beam target set has EXACTLY 4 members = funders with `requires501c3Raw === 'Yes - or fiscal sponsor'` (Harry S. Black, Ford JustFilms, Ford NYC, Ben & Jerry's) | ⬜ |
| 3-derive-pulse | 1 | CRYS-05 | unit | clock-free pulse set = EXACTLY 3 (one-time, non-passed, live status); excludes passed/rolling/declined/ineligible (Hey Helen excluded) | ⬜ |
| 3-derive-families | 1 | CRYS-06 | unit | family links: Ford×2 (funder equality) + BofA×2 ("Bank of America" substring) | ⬜ |
| 3-status-hue | 1 | CRYS-03 | unit | each of 8 statuses maps to its UI-SPEC hex hue; active → `--secured-gold #FFC24B` | ⬜ |
| 3-ssr-safe-build | 2 | CRYS-01 | build | `pnpm build` prerenders with NO WebGL error (Canvas browser-guarded); `verify-build.mjs` 6 checks pass; `<title>` still contains "Eman_dashboard" | ⬜ |
| 3-scene-render | 2 | CRYS-01/07/08 | manual | live scene: 28 crystal nodes render, auto-orbit, hover lifts+labels, click springs camera focus + dims siblings, bloom glows | ⬜ |
| 3-visual-encoding | 2 | CRYS-03/04/05 | manual | live: gold active center vs dim to-research rim; node size tracks amount; 3 nodes pulse, passed/declined do not; fiscal-sponsor beam visible from NYCT | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] Install `three@0.185.1` (PINNED), `@threlte/core@8`, `@threlte/extras`, `postprocessing`, `gsap`
- [ ] `vite.config.ts`: add `ssr: { noExternal: ['postprocessing'] }` (prerender gotcha) — verified needed by research
- [ ] `vitest.config.ts`: extend `include` to `src/lib/crystarium/**/*.test.ts`
- [ ] `src/app.d.ts`: InteractivityProps augmentation for @threlte/extras pointer events
- [ ] `src/lib/crystarium/tokens.ts`: the UI-SPEC color hexes as exported tokens
- [ ] test files: `layout.test.ts`, `derive.test.ts` (beam/pulse/families), `tokens.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 3D scene renders + orbits + focuses | CRYS-01/07/08 | WebGL visual output can't be asserted headlessly here | Open live scene, confirm 28 nodes, auto-orbit, hover/click focus, bloom |
| Visual encodings read correctly | CRYS-03/04/05 | Perceptual (hue/scale/pulse legibility) | Confirm gold center vs dim rim, size≈amount, only 3 pulse, beam visible |

*Rationale: layout/derivation MATH is fully automated (the load-bearing correctness); only the rendered pixels are manual, which is inherent to 3D.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicitly manual-only (3D pixels)
- [ ] Sampling continuity: math tests cover CRYS-02..06 automatically
- [ ] Wave 0 covers deps + config gotchas (noExternal, vitest include)
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true`

**Approval:** approved 2026-07-04
