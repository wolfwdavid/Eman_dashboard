---
phase: 02-data-pipeline-custom-tools
plan: 04
subsystem: build
tags: [vitest, zod, spawnSync, build-gate, package-json, ci, esm, tdd]

# Dependency graph
requires:
  - phase: 02-data-pipeline-custom-tools
    plan: 02
    provides: tools/ingest-grants.mjs (GRANTS_CSV/GRANTS_OUT env, safeParse-before-write, exit 1 on bad row) + src/lib/data/index.ts barrel
  - phase: 02-data-pipeline-custom-tools
    plan: 03
    provides: tools/generate-qr.mjs + src/lib/data/qr.generated.js (export const qrCodes)
  - phase: 02-data-pipeline-custom-tools
    plan: 01
    provides: tools/schema.mjs (zod v4 GrantSchema) + data/__fixtures__/grants.bad.csv
provides:
  - "tools/validate.test.mjs — DATA-05 gate proof: unit schema rejections (bad enum/URL/tri-state/empty-id) + spawnSync integration (bad fixture exit!=0, real CSV exit 0)"
  - "package.json explicit build chain: build:data && build:qr && vite build (no reliance on pnpm prebuild); build:qr, test:unit added; dev also chained"
  - "src/lib/data/index.ts re-exports qrCodes — Phase 4 QR panel can import { qrCodes } from '$lib/data'"
affects: [03-crystarium, 04-hud-panels, 04-qr-panel, ci]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build gate as an explicit && chain (pnpm does NOT run pre/post lifecycle scripts) — a non-zero build:data short-circuits before vite build"
    - "spawnSync integration test drives the real tool against a bad fixture with GRANTS_OUT=<tmp> so the committed JSON is never touched"
    - "Two-layer data assurance: unit (schema.safeParse rejects) + integration (real ingest exits 1 on the 28-row bad CSV)"

key-files:
  created:
    - tools/validate.test.mjs
  modified:
    - package.json
    - src/lib/data/index.ts

key-decisions:
  - "Explicit `pnpm build:data && pnpm build:qr && vite build` chain (not a prebuild hook) — pnpm skips pre/post scripts by default, so a hook would silently NOT gate the build"
  - "Bad-fixture integration test points GRANTS_OUT at os.tmpdir() — belt-and-suspenders (ingest validates before writing anyway), so the real grants.generated.json can never be clobbered by the negative test"
  - "qrCodes re-export added to index.ts here (Rule 3 deviation) — 02-02 owned the barrel and 02-03 owned qr.generated.js, but neither wired them together; Phase 4 needs the single import"

requirements-completed: [DATA-05]

# Metrics
duration: 8min
completed: 2026-07-05
---

# Phase 2 Plan 04: Build Gate Wiring Summary

**Hardened and proved the DATA-05 build gate: `tools/validate.test.mjs` asserts the zod GrantSchema rejects a bad enum/URL/tri-state/empty-id (unit) AND that spawning the real ingest tool against the 28-row `grants.bad.csv` exits non-zero while the real CSV exits 0 (integration), and wired `package.json` into an explicit `pnpm build:data && pnpm build:qr && vite build` chain so bad data can never reach production. Also closed the cross-plan deferred wiring by re-exporting `qrCodes` from the data barrel for the Phase 4 QR panel. Full `BASE_PATH=/Eman_dashboard pnpm build` succeeds end-to-end and `verify-build.mjs` passes all six deploy invariants.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-05T01:53:10Z
- **Completed:** 2026-07-05T02:01:00Z
- **Tasks:** 2
- **Files created:** 1 (+2 modified)

## Accomplishments
- `tools/validate.test.mjs` (vitest, node env) — 7 tests. UNIT: a minimal fully-valid Grant clone is mutated one field at a time; `GrantSchema.safeParse` rejects `status:'bogus'`, `link:'not-a-url'`, `requires501c3:'maybe'`, `id:''`, and accepts the valid record; every failure yields a non-empty `result.error.issues` array (zod v4 shape). INTEGRATION: `spawnSync('node',['tools/ingest-grants.mjs'], {env: GRANTS_CSV=grants.bad.csv, GRANTS_OUT=<tmp>})` exits non-zero; the real-CSV run exits 0.
- `package.json` build chain wired explicitly: `build:data` (ingest) and `build:qr` (generate-qr) run before `vite build` via `&&` — and the same before `vite dev`. `test:unit` added. No `prebuild` hook (pnpm would silently skip it). `preview`, `prepare`, `check`, `check:watch`, `verify:build`, `test:smoke`, `verify:live` preserved verbatim.
- `src/lib/data/index.ts` now re-exports `qrCodes` from `qr.generated.js`, closing the deferred cross-plan wiring so the Phase 4 QR panel can `import { qrCodes } from '$lib/data'`.
- Proven end-to-end: `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` regenerates data + QR, builds, prerenders; `node tools/verify-build.mjs` passes all 6 invariants; `pnpm check` reports 0 errors; the full `pnpm exec vitest run tools` suite is 93/93 green.

## Task Commits

Each task committed atomically (`--no-verify`):

1. **Task 1: validate.test.mjs — schema rejections + bad-CSV gate (DATA-05)** — `f8febd4` (test)
2. **Task 2: explicit build chain in package.json (DATA-05)** — `b305ddc` (chore)
3. **Deviation: re-export qrCodes from data barrel (Phase 4 readiness)** — `976bc6c` (feat)

## Decisions Made
- **Explicit chain over prebuild hook:** pnpm does not run `pre`/`post` lifecycle scripts unless `enable-pre-post-scripts=true`. An explicit `build:data && build:qr && vite build` is unambiguous and always gates the build — the recommended path per 02-RESEARCH.
- **Negative test writes to a throwaway path:** the bad-fixture run points `GRANTS_OUT` at `os.tmpdir()`. The ingest tool already validates before writing (nothing is emitted on failure), so this is defense-in-depth ensuring the committed `grants.generated.json` is never at risk from the test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-exported qrCodes from the data barrel**
- **Found during:** Task 2 (build wiring)
- **Issue:** Neither 02-02 (which owned `src/lib/data/index.ts`) nor 02-03 (which owned `qr.generated.js`) wired the two together — 02-03's SUMMARY explicitly deferred the barrel export to "02-02's index.ts, out of scope here." Left unwired, the Phase 4 QR panel could not `import { qrCodes } from '$lib/data'`, and the critical constraint for this plan requires that import to be ready.
- **Fix:** Added `export { qrCodes } from './qr.generated.js';` to `src/lib/data/index.ts`.
- **Files modified:** src/lib/data/index.ts
- **Verification:** `pnpm check` → 0 errors (clean .js-into-.ts re-export); full `pnpm build` succeeds; verify-build passes.
- **Commit:** 976bc6c

**Total deviations:** 1 auto-fixed (1 blocking wiring gap). No architectural changes.

## Issues Encountered
None. The build chain, gate, and re-export all worked first try; the bad-fixture negative and real-CSV positive both behaved as designed.

## Known Stubs
None introduced by this plan. (The two placeholder QR target URLs in `src/lib/config/sites.js` remain a documented, intentional stub from 02-03 — resolved by editing sites.js + re-running the now-wired `build:qr`; unaffected here.)

## Next Phase Readiness
- **Phase 3 (Crystarium) / Phase 4 (HUD + QR panels):** `import { grants, qrCodes } from '$lib/data'` is fully wired (typed grants + inline-SVG QR codes, zero runtime fetch). Aggregate selectors live in `tools/aggregates.mjs`.
- **CI:** `pnpm build` now self-gates on data validity; a malformed `data/grants.csv` fails the build before `vite build`. `pnpm test:unit` runs the full tool suite (93 tests incl. the DATA-05 gate).
- Phase 02 is complete: DATA-01/04 (02-02), DATA-06 (02-03), DATA-05 (this plan). No blockers.

---
*Phase: 02-data-pipeline-custom-tools*
*Completed: 2026-07-05*

## Self-Check: PASSED

- All 3 changed files (1 created, 2 modified) + SUMMARY verified on disk.
- All 3 task commits verified in git history: f8febd4, b305ddc, 976bc6c.
