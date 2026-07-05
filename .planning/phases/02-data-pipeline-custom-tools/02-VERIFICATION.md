---
phase: 02-data-pipeline-custom-tools
verified: 2026-07-05T02:20:05Z
status: passed
score: 6/6 must-haves verified
---

# Phase 2: Data Pipeline + Custom Tools Verification Report

**Phase Goal:** Purpose-built Node tools turn the 28-row messy grants.csv into a validated, typed JSON dataset the app compiles against — and generate the QR assets — with a zod build gate that fails the build on bad data. The foundation contract every UI feature binds to.
**Verified:** 2026-07-05T02:20:05Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `pnpm exec vitest run` passes in full (all tool suites green) | VERIFIED | `Test Files 6 passed (6)` / `Tests 93 passed (93)` — matches expected ~93 |
| 2 | `ingest-grants.mjs` turns the 28-row CSV into a typed 28-record JSON dataset | VERIFIED | `node tools/ingest-grants.mjs` → "PASS 28 rows parsed / PASS 28 unique ids / PASS all records schema-valid"; `grants.generated.json` length === 28 |
| 3 | Aggregates match the documented headline numbers exactly | VERIFIED | Node one-liner importing `tools/aggregates.mjs` against the real generated JSON: `securedTotal=20000`, `potentialTotal=296500`, `countByStatus` sums to 28 (`{active:1,in-progress:3,to-research:17,recurring:2,not-eligible-yet:2,applied:1,declined:1,not-eligible:1}`), `by501c3` sums to 28 (`{no:12,yes:8,unknown:8}`) |
| 4 | TBD/qualitative amounts normalize to null numerics, never 0 | VERIFIED | Spot-checked NY Community Trust (`$20,000 (received 2025)` → min/max/avg=20000, isReceived=true), Ford Foundation (`$100,000+` → min=100000, max=null, avg=null), and all 13 `TBD` rows (min/max/avg=null, isTBD=true) |
| 5 | Deadline parser never blind-calls `new Date()` on raw strings; only the literal `(passed)` row is isPassed | VERIFIED | `grep "new Date(" tools/normalize/deadline.mjs` → no match; only "Hey Helen Grant" (`2025-12-30 (passed)`) has isPassed=true; "Ben & Jerry's Foundation" (`2027-02-18 (2026 cycle passed)`) correctly has isPassed=false |
| 6 | zod build gate fails on malformed data, passes on real data, and never clobbers the committed JSON on failure | VERIFIED | `GRANTS_CSV=data/__fixtures__/grants.bad.csv node tools/ingest-grants.mjs` → exit 1, "FAIL schema validation failed — JSON NOT written"; MD5 of `grants.generated.json` unchanged before/after; real CSV run → exit 0 |
| 7 | QR generator produces two inline-SVG codes for absolute external URLs, never base-prefixed | VERIFIED | `node tools/generate-qr.mjs` → exit 0, both site URLs pass `startsWith('http')` + not-base-prefixed guards; `qr.generated.js` contains 2 `<svg` occurrences and zero `/Eman_dashboard/` references |
| 8 | Full production build succeeds end-to-end and deploy invariants remain intact | VERIFIED | `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` → built client+server+prerendered, "Wrote site to build"; `node tools/verify-build.mjs` → all 6 checks PASS |

**Score:** 8/8 truths verified (6 must-have artifacts/requirements groups, all confirmed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tools/normalize/amount.mjs` | pure `parseAmount(raw)` → GrantAmount struct | VERIFIED | 18-case test suite green; TBD/Equity/Large → null numbers confirmed live against real data |
| `tools/normalize/deadline.mjs` | pure `parseDeadline(raw)` → GrantDeadline struct | VERIFIED | 20-case test suite green; no `new Date(` on raw strings; isPassed logic confirmed live |
| `tools/schema.mjs` | zod v4 `GrantSchema` (single source of truth) | VERIFIED | `z.url()` present (v4 idiom); rejects bad enum/URL (validate.test.mjs unit cases) |
| `src/lib/data/types.ts` | canonical `Grant`/`GrantAmount`/`GrantDeadline`/enum types | VERIFIED | Present, consumed by `index.ts` and `ingest-grants.mjs` |
| `tools/normalize/status.mjs` | `parseStatus` + `parse501c3` | VERIFIED | 8-enum map (yet-before-eligible ordering), throw-on-unmapped; tri-state with raw preserved — all live-verified via generated data |
| `tools/ingest-grants.mjs` | CSV → typed JSON ingest, env-overridable, fails closed | VERIFIED | Live-run: 28 rows, schema-valid, exits 1 on bad fixture without writing, exits 0 on real CSV |
| `src/lib/data/grants.generated.json` | 28 typed Grant records | VERIFIED | `g.length === 28`; all fields typed correctly on spot-checks |
| `src/lib/data/index.ts` | barrel exporting `grants` + `qrCodes` + types | VERIFIED | `export const grants`, `export { qrCodes } from './qr.generated.js'`, `export * from './types'` all present |
| `tools/aggregates.mjs` | `securedTotal`/`potentialTotal`/`countByStatus`/`by501c3` | VERIFIED | All four selectors live-verified against real dataset with exact expected values |
| `src/lib/config/sites.js` | single swap-point, 2 placeholder absolute https URLs | VERIFIED | Two labeled entries (`main`, `support`) with explicit swap-instruction comments |
| `tools/generate-qr.mjs` | build-time QR SVG generator | VERIFIED | Live-run emits 2 inline SVGs, guards non-http URLs (exit 1 path in code) |
| `src/lib/data/qr.generated.js` | `qrCodes` array with inline SVG per site | VERIFIED | 2 `<svg` entries; 0 `/Eman_dashboard/` references |
| `tools/validate.test.mjs` | schema unit-rejection + bad-CSV integration gate | VERIFIED | Part of the 93 passing tests; unit rejects bad enum/URL/tri-state; integration spawns ingest against bad fixture |
| `package.json` build chain | explicit `build:data && build:qr && vite build`, no `prebuild` | VERIFIED | Confirmed via `node -e` script dump; no `prebuild` key present; existing scripts (`verify:build`, `test:smoke`, `check`) intact |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `tools/ingest-grants.mjs` | `tools/normalize/{amount,deadline,status,slug}.mjs` | import normalizers | WIRED | Ingest run correctly produces normalized amount/deadline/status/501c3 fields on all 28 records |
| `tools/ingest-grants.mjs` | `tools/schema.mjs` | `GrantSchema.safeParse` before emit | WIRED | Bad fixture run shows row-level `link: Invalid URL` failure and aborts write — proves safeParse gate is live |
| `src/lib/data/index.ts` | `src/lib/data/grants.generated.json` | import raw json | WIRED | `import raw from './grants.generated.json'` present and the app-facing `grants` export type-casts it |
| `src/lib/data/index.ts` | `src/lib/data/qr.generated.js` | `export { qrCodes } from` | WIRED | Confirmed in file; Phase 4 import readiness satisfied (`import { grants, qrCodes } from '$lib/data'`) |
| `tools/generate-qr.mjs` | `src/lib/config/sites.js` | `import { sites }` | WIRED | Live-run output correctly lists `main`/`support` ids+URLs sourced from sites.js |
| `package.json` build script | `tools/ingest-grants.mjs` + `tools/generate-qr.mjs` | `&&` chain before `vite build` | WIRED | `"build": "pnpm build:data && pnpm build:qr && vite build"` confirmed; no reliance on `prebuild` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DATA-01 | 02-02 | CSV→typed JSON ingest, no runtime fetch | SATISFIED | `ingest-grants.mjs` live-run: 28 typed records written; `index.ts` imports JSON directly (no fetch) |
| DATA-02 | 02-01 | Amount normalizer → typed struct, never bare number | SATISFIED | 18/18 unit cases green; live spot-checks confirm null-not-0 behavior on TBD/equity/open-ended rows |
| DATA-03 | 02-01 | Deadline normalizer → typed struct | SATISFIED | 20/20 unit cases green; no blind `new Date(`; isPassed correctly scoped to exactly one row |
| DATA-04 | 02-02 | Status enum + 501c3 tri-state | SATISFIED | 8-value status enum (yet-before-eligible ordering, throw-on-unmapped) + tri-state 501c3 with raw preserved, confirmed via `countByStatus`/`by501c3` sums (28 each) |
| DATA-05 | 02-04 | Validator fails build on malformed row | SATISFIED | Live-run: bad fixture → exit 1, no JSON write (MD5 unchanged); real CSV → exit 0; build chain wired with `&&` (no prebuild trap) |
| DATA-06 | 02-03 | QR generator, single config, build-time, absolute URLs | SATISFIED | `generate-qr.mjs` live-run emits 2 inline SVGs from `sites.js`; zero `/Eman_dashboard/` references in output |

No orphaned requirements — all 6 DATA-xx IDs are claimed across the four Phase-2 plans and REQUIREMENTS.md traceability already marks them Complete, which this verification confirms is accurate (not just claimed).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/config/sites.js` | 3, 16 | "PLACEHOLDER" comments | ℹ️ Info | Intentional and spec-required — DATA-06's truth explicitly calls for placeholder absolute URLs with a swap comment. Not a stub; the generator/QR pipeline is fully functional against these placeholders. |
| `tools/generate-qr.mjs` | 5 | "PLACEHOLDER" in doc comment | ℹ️ Info | Same as above — documents the swap contract, not a functional gap. |

No blocker or warning-level anti-patterns found. No TODO/FIXME/HACK markers, no empty-return stubs, no console.log-only implementations in any of the tool/data files reviewed.

### Human Verification Required

None. This phase is entirely build-time tooling with deterministic, machine-checkable outputs (typed JSON, generated SVG, exit codes). No UI/visual/runtime-behavior surfaces exist yet (those begin in Phase 3/4).

### Gaps Summary

No gaps. All 6 DATA requirements (DATA-01 through DATA-06) are independently confirmed against the live codebase, not just SUMMARY claims:

- Full vitest suite: 93/93 passing across 6 test files.
- `ingest-grants.mjs` deterministically reproduces the committed 28-record `grants.generated.json` (byte-identical on re-run).
- Aggregate selectors return the exact spec'd headline numbers: `securedTotal=20000`, `potentialTotal=296500`, both count maps summing to 28.
- Amount/deadline null-vs-zero and isPassed-scoping regressions are guarded and confirmed live against the real dataset, not just fixture strings.
- The zod build gate demonstrably blocks a bad row (non-zero exit, no file write, unchanged MD5) and passes clean data, and the `package.json` build chain wires this before `vite build` with no silent-skip `prebuild` trap.
- QR generation produces genuinely absolute, non-base-prefixed inline SVGs from a single swappable config module, and `src/lib/data/index.ts` re-exports both `grants` and `qrCodes` for Phase 4 import readiness.
- The end-to-end `pnpm build` (with correct `BASE_PATH`) succeeds and `tools/verify-build.mjs` still passes all 6 deploy-invariant checks — Phase 1's contract is undisturbed by Phase 2's changes.
- No forbidden 3D/animation/chart dependencies (`three`, `@threlte/*`, `gsap`, `layerchart`) were added; only the three permitted build-time deps (`papaparse`, `zod`, `qrcode`) are present, correctly pinned.

Phase 2 goal is fully achieved: the messy 28-row CSV is now a validated, typed JSON dataset with a working zod build gate, and the QR assets are generated from a single swappable config — the complete foundation contract for Phase 3/4 UI work.

---

*Verified: 2026-07-05T02:20:05Z*
*Verifier: Claude (gsd-verifier)*
