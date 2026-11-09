---
phase: quick-261109-dxq
plan: 01
subsystem: data
tags: [grants, csv, tests, docs]
requires: []
provides: ["40-row grant tracker", "re-pinned 40-row dataset tests", "row-count guard note for Eman"]
affects: [data/grants.csv, src/lib/data/grants.generated.json, unit tests, HOW-TO-UPDATE.md]
tech-stack:
  added: []
  patterns: ["dataset tests pinned to rule-derived real-data facts"]
key-files:
  created: []
  modified:
    - data/grants.csv
    - src/lib/data/grants.generated.json
    - tools/ingest-grants.mjs
    - tools/aggregates.test.mjs
    - src/lib/data/aggregates.test.ts
    - src/lib/data/filter.test.ts
    - src/lib/crystarium/derive.test.ts
    - src/lib/crystarium/layout.test.ts
    - src/lib/data/templates.test.ts
    - HOW-TO-UPDATE.md
decisions:
  - "All re-pinned values derived by importing tools/aggregates.mjs and src/lib/crystarium/layout.js over grants.generated.json; every one matched the orchestrator's expected 40-row facts"
metrics:
  completed: 2026-11-09
  tasks: 3
  files: 10
---

# Quick 261109-dxq: Add 12 funders from Eman's emails Summary

The tracker now has 40 rows (28 original plus the 12 funders Eman emailed). The dataset unit tests were re-pinned to facts derived from the app's own rules, and HOW-TO-UPDATE.md now tells Eman about the `EXPECTED_ROWS` row-count guard.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 117afb8 | data: add 12 funders from Eman's emails (40 rows) |
| 2 | 740021b | test: re-pin dataset facts for the 40-row tracker |
| 3 | d317f0c | docs: note the row-count guard and test re-pin when grants are added |

Not pushed (branch is 3 ahead of origin/main).

## Verification

- `node tools/ingest-grants.mjs` printed PASSED for 40 unique ids. It is idempotent: re-running it produced no further JSON diff.
- All 12 new rows (indices 28-39) have a status from the enum and an https link. The funders match the list in the plan.
- The CSV has LF line endings (0 CR bytes).
- vitest: 13/13 files, **172/172 tests passed**. The baseline had 20 failures (171 tests). The +1 is the new BofA Neighborhood Builders family-edge test.
- svelte-check: 0 errors, 1 warning (the existing `messagesEl` one in ChatWidget.svelte).
- `BASE_PATH=/Eman_dashboard` build exited 0. `node tools/verify-build.mjs` printed PASSED. The build did not regenerate any tracked file.

## Derived facts vs orchestrator expectations

Every value was derived with the app's own rules and matched what the orchestrator expected. There were no discrepancies.

| Fact | Old (28) | New (40) |
|------|----------|----------|
| rows / nodes | 28 | 40 |
| countByStatus to-research / in-progress / recurring / not-eligible-yet / active / applied / declined / not-eligible | 17/3/2/2/1/1/1/1 | 22/3/3/5/1/1/1/4 |
| by501c3 no / yes / unknown (= gate open / gated / unknown) | 12/8/8 | 14/17/9 |
| type Grant / Fellowship / Investment | 26/1/1 | 37/2/1 |
| potentialContributors | 9 | 14 |
| potentialTotal | 296500 | 491500 |
| securedTotal | 20000 | 20000 (unchanged) |
| beams (raw "Yes - or fiscal sponsor") | 4 | 7 (+ new-york-women-s-foundation-early-investment-grants, north-star-fund-nyc-organizing-grants, borealis-philanthropy-just-futures-initiative) |
| tri-state yes (triStateCount) | 8 | 17 |
| pulse | 3 | 4 (+ north-star-fund-nyc-organizing-grants) |
| family edges | 2 | 3 (Ford pair; harry-s-black → bank-of-america-charitable-foundation; bank-of-america-charitable-foundation → bank-of-america-neighborhood-builders) |
| ring counts active/applied/in-progress/to-research/recurring/dim | 1/1/3/17/2/4 | 1/1/3/22/3/10 |
| TBD nodes | 16 | 20 |
| templates pinned ids | 28 | 40 |
| in-progress filter length | 3 | 3 (unchanged) |

## Template coverage at execution time

All 40 rows have a Template link. templates.test.ts pins all 40 ids in `grantsWithTemplates` sort order. Note that `bank-of-america-neighborhood-builders` (funder "Bank of America") sorts before `bank-of-america-charitable-foundation`. The misleading title "exactly the Awesome Foundation Disability Chapter has a template" was renamed to "every tracker row with a Template link, sorted funder → program".

## Deviations from Plan

None. The plan was executed as written. The only extra was cosmetic: I wrapped the derive.test.ts header comment to keep its line length.

## Known Stubs

None.

## Self-Check: PASSED

- Commits 117afb8, 740021b and d317f0c are present in `git log`.
- `EXPECTED_ROWS = 40` is in tools/ingest-grants.mjs, `re-pinned 2026-11-09` is in derive.test.ts, and `EXPECTED_ROWS` is in HOW-TO-UPDATE.md.
