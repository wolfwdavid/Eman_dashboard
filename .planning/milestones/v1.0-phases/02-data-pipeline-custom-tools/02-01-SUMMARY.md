---
phase: 02-data-pipeline-custom-tools
plan: 01
subsystem: data
tags: [papaparse, zod, qrcode, vitest, csv, normalizer, typescript, esm]

# Dependency graph
requires:
  - phase: 01-deploy-skeleton-toolchain
    provides: SvelteKit + Vite + pnpm toolchain, tools/ custom-tool ESM style (verify-build.mjs), vitest devDependency
provides:
  - Three permitted build-time deps installed and pinned (papaparse 5.5.4, zod 4.4.3, qrcode 1.5.4 + @types)
  - vitest.config.ts (node env) covering tools/**/*.test.mjs and src/lib/data/**/*.test.ts
  - Canonical Grant / GrantAmount / GrantDeadline / enum types (src/lib/data/types.ts) — shared contract for Phase 3/4
  - Zod v4 GrantSchema mirror (tools/schema.mjs) — single source of truth for the build-gate in 02-04
  - parseAmount normalizer (tools/normalize/amount.mjs) — typed struct, missing → null never 0
  - parseDeadline normalizer (tools/normalize/deadline.mjs) — leading-ISO regex, exact "(passed)" marker
  - 28-row bad-CSV fixture (data/__fixtures__/grants.bad.csv) with one malformed Link for the 02-04 build-gate test
affects: [02-02-status-ingest-aggregates, 02-03-qr-generator, 02-04-build-gate-wiring]

# Tech tracking
tech-stack:
  added: [papaparse@5.5.4, zod@4.4.3, qrcode@1.5.4, "@types/papaparse@5.5.2", "@types/qrcode@1.5.6"]
  patterns:
    - "Normalizers return typed structs, never bare values; missing number = null (never 0)"
    - "Node ESM (.mjs) pure importable tools in tools/, mirroring verify-build.mjs"
    - "TDD: RED test committed, then GREEN implementation, one case per literal CSV string"
    - "zod v4 idiom — top-level z.url(), z.enum([...]); no v3 z.string().url()"

key-files:
  created:
    - vitest.config.ts
    - src/lib/data/types.ts
    - tools/schema.mjs
    - tools/normalize/amount.mjs
    - tools/normalize/amount.test.mjs
    - tools/normalize/deadline.mjs
    - tools/normalize/deadline.test.mjs
    - data/__fixtures__/grants.bad.csv
  modified:
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "isPassed is the exact literal '(passed)' marker only (clock-independent) — '2027-02-18 (2026 cycle passed)' is NOT passed (Open Q1)"
  - "Amount avg = explicit (avg $X) if present, else range midpoint, else the single/max figure; '+' suffix → min only (max/avg null)"
  - "Deadline note: date/rolling rows carry the parenthetical; annual keeps trailing text; invitation/TBD/-- → null; unknown descriptive strings preserve the whole raw"

patterns-established:
  - "Pattern 1: parseX(raw) is pure and importable — no fs, no side effects — so vitest tests and the ingest tool share one implementation"
  - "Pattern 2: every distinct literal CSV string gets its own test case + anti-regression assertions (null-not-0, exact-passed-marker)"

requirements-completed: [DATA-02, DATA-03]

# Metrics
duration: 9min
completed: 2026-07-05
---

# Phase 2 Plan 01: Deps + Schema + Amount/Deadline Normalizers Summary

**Installed the three permitted build-time deps and shipped the two highest-leverage CSV normalizers — parseAmount (18 literal strings, missing→null never 0) and parseDeadline (20 literal strings, leading-ISO regex, exact "(passed)" marker) — each unit-tested green (46 cases), plus the canonical Grant type and its zod v4 schema mirror.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-05T01:17:12Z
- **Completed:** 2026-07-05T01:26:31Z
- **Tasks:** 3
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments
- papaparse 5.5.4 / zod 4.4.3 / qrcode 1.5.4 (+ @types) installed as devDependencies and pinned; no three/threlte/gsap/layerchart added
- Canonical `Grant` type model in `src/lib/data/types.ts` and a zod v4 mirror (`GrantSchema`, top-level `z.url()`) in `tools/schema.mjs` — the shared contract consumed by 02-02/02-04
- `parseAmount` handles all 18 distinct amount shapes; TBD/Large/Equity/Fellowship → numbers null (guarded by null-not-0 anti-assertions)
- `parseDeadline` handles all 20 distinct deadline shapes; leading ISO extracted by regex, only the exact `(passed)` marker yields isPassed=true
- vitest node-env config wired; `pnpm exec vitest run tools/normalize` green with 46 passing cases
- 28-row `data/__fixtures__/grants.bad.csv` with exactly one malformed Link (`not-a-url`) staged for the 02-04 build-gate integration test

## Task Commits

Each task was committed atomically (TDD tasks split RED → GREEN):

1. **Task 1: Deps + vitest config + types + schema + bad-CSV fixture** - `95dc479` (chore)
2. **Task 2: parseAmount normalizer (DATA-02)** - `59cb629` (test, RED) → `591b915` (feat, GREEN)
3. **Task 3: parseDeadline normalizer (DATA-03)** - `d829ca8` (test, RED) → `257c16d` (feat, GREEN)

## Files Created/Modified
- `vitest.config.ts` - node-env vitest config including tools/**/*.test.mjs + src/lib/data/**/*.test.ts
- `src/lib/data/types.ts` - canonical Grant / GrantAmount / GrantDeadline / enum types (app imports these in Phase 3/4)
- `tools/schema.mjs` - zod v4 GrantSchema mirror; single source of truth for record shape
- `tools/normalize/amount.mjs` - pure parseAmount(raw) → GrantAmount struct
- `tools/normalize/amount.test.mjs` - 18 literal-string cases + null-not-0 anti-assertions
- `tools/normalize/deadline.mjs` - pure parseDeadline(raw) → GrantDeadline struct
- `tools/normalize/deadline.test.mjs` - 20 literal-string cases + exact-passed-marker assertions
- `data/__fixtures__/grants.bad.csv` - 28-row fixture with one bad Link for the 02-04 gate
- `package.json` / `pnpm-lock.yaml` - three deps + types pinned

## Decisions Made
- **isPassed = exact `(passed)` only:** kept clock-independent for deterministic tests; `2027-02-18 (2026 cycle passed)` stays isPassed=false with "2026 cycle passed" preserved in note (Open Q1 resolution).
- **Amount avg precedence:** explicit `(avg $X)` overrides the range midpoint; `Up to $X` → max-only with avg=X; `$X+` → min-only (max/avg null); received single figure → min=max=avg.
- **Deadline note derivation:** dated + rolling rows carry the parenthetical; annual keeps the trailing descriptor ("relationship"); invitation/TBD/`--` → null; unknown descriptive strings preserve the whole raw string verbatim.

## Deviations from Plan

None - plan executed exactly as written.

One minor in-task adjustment (not a scope deviation): the deadline.mjs header comment was reworded to avoid containing the literal string `new Date(`, so the acceptance grep `! grep -q "new Date(" tools/normalize/deadline.mjs` passes on intent (no blind Date construction) rather than tripping on a comment. No behavior change.

## Issues Encountered
- The plan's acceptance check `! grep -q "new Date("` initially matched a cautionary comment in the source. Reworded the comment; the implementation never constructed a Date from a raw string. Resolved before the Task 3 commit.

## User Setup Required
None - no external service configuration required. All three deps are build-time devDependencies.

## Next Phase Readiness
- **02-02 (status/ingest/aggregates):** can import `parseAmount`/`parseDeadline` and `GrantSchema`; needs to add `parseStatus`/`parse501c3`/`slug` + the ingest orchestrator emitting `grants.generated.json`.
- **02-04 (build-gate wiring):** `data/__fixtures__/grants.bad.csv` (28 rows, one bad Link) is in place for the spawn-on-bad-CSV → exit 1 integration test; `GrantSchema.safeParse` verified to reject the malformed link and accept an assembled valid record.
- No blockers.

---
*Phase: 02-data-pipeline-custom-tools*
*Completed: 2026-07-05*

## Self-Check: PASSED

All 8 created files verified on disk; all 5 task commits (95dc479, 59cb629, 591b915, d829ca8, 257c16d) verified in git history.
