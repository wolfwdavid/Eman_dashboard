---
phase: 4
slug: hud-overlay-ui-fallback
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-06
---

# Phase 4 — Validation Strategy

> Canonical detail: `04-RESEARCH.md` → "## Validation Architecture". Pure modules (`aggregates.ts`, `filter.ts`, `format.ts`) are the automated surface; interactive drill-down/filter/tooltips are manual (screenshot pass).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (pure modules under `src/lib/data/` — covered by the EXISTING include glob, zero config change) + `tools/verify-build.mjs` + manual/screenshot |
| **Config file** | `vitest.config.ts` (unchanged) |
| **Quick run command** | `pnpm exec vitest run src/lib/data` |
| **Full suite command** | `pnpm exec vitest run && MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs` |
| **Estimated runtime** | ~35s (build dominates) |

---

## Sampling Rate

- **After every task commit:** `pnpm exec vitest run src/lib/data`
- **After every plan wave:** full suite
- **Before `/gsd:verify-work`:** full suite green + live screenshot pass
- **Max feedback latency:** ~40s

---

## Per-Task Verification Map

| Task ID | Wave | Requirement | Test Type | Automated Command / Check | Status |
|---------|------|-------------|-----------|---------------------------|--------|
| 4-aggregates | 1 | PIPE-01/02/04 | unit | `aggregates.ts` selector: securedTotal===20000; potentialTotal===296500; countByStatus sums to 28 (17/3/2/2/1/1/1/1); by501c3 = 12/8/8 | ⬜ |
| 4-filter | 1 | PIPE-05 | unit | `matchesFilter(grant, filter)`: each axis (status/gate/type) + combined + all-pass default; pure, deterministic | ⬜ |
| 4-format | 1 | DETL-02 | unit | amount/deadline human-readable formatters over the REAL grant strings (TBD, ranges, received, passed, rolling, invitation) + raw subtext preserved | ⬜ |
| 4-state-widen | 1 | PIPE-05 | unit+grep | `ui.filter` widened to `{status,gate,type}` + `setFilter`/`resetFilters`; Phase-3 scene untouched (`ui.selected`/`hovered` API unchanged) | ⬜ |
| 4-detail-panel | 2 | DETL-01/02/03 | build+grep | build prerenders; detail panel component exists; CTA + `target="_blank"` + `rel="noopener"` present in source | ⬜ |
| 4-charts | 2 | PIPE-01..04 | build | layerchart@2.0.1 installed; 4 chart components exist; build prerenders. **Do NOT grep build/index.html for chart SVG (client-hydrated — known trap)** | ⬜ |
| 4-qr-panel | 2 | QRUI-01/02 | build+grep | QR panel renders `qrCodes[].svg` via `{@html}`; source imports from `$lib/data`; labels present | ⬜ |
| 4-build-gate | 2 | all | build | `pnpm build` (BASE_PATH) exits 0; `verify-build.mjs` 6/6; `<title>` keeps "Eman_dashboard"; no `ssr = false` | ⬜ |
| 4-interactive | 2 | DETL/PIPE/QRUI | manual | live: click node → detail rail slides in with all fields; filters dim non-matching nodes; drawer charts render; QR widget toggles | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] Install `layerchart@2.0.1` (+ required peers only). NO new 3D deps.
- [ ] Pure modules under `src/lib/data/`: `aggregates.ts`, `filter.ts`, `format.ts` + colocated `.test.ts` files (existing vitest glob covers them)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Node-select → detail rail drill-down | DETL-01..03 | Interactive canvas↔DOM flow | Click a crystal; rail slides in; all 9 fields + Next Action CTA + link |
| Filter dims scene nodes | PIPE-05 | Visual 3D effect | Apply a status filter; non-matching crystals dim; raycast disabled on them |
| Charts + tooltips render | PIPE-01..04 | Client-hydrated SVG + hover | Open drawer; 4 charts with status hues; hover shows values |
| QR codes scannable | QRUI-01 | Phone camera | Scan both tiles (placeholder URLs) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicitly manual (interactive/visual)
- [ ] Pure-module math covers PIPE numbers + filter predicate + formatters automatically
- [ ] Wave 0 covers the layerchart dep
- [ ] No watch-mode flags; chart-SVG-grep trap documented
- [ ] `nyquist_compliant: true`

**Approval:** approved 2026-07-06
