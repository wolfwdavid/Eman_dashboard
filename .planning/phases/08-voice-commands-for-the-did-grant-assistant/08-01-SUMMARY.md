---
phase: 08-voice-commands-for-the-did-grant-assistant
plan: 01
subsystem: voice
tags: [voice, grammar, fuzzy-match, vitest, pure-ts]
requires: []
provides:
  - "parse(raw, ctx) -> Intent pure command grammar (src/lib/voice/commands.ts)"
  - "nextDeadlines / nextDeadlinesText / securedText / formatLongDate (src/lib/voice/facts.ts)"
affects: [08-04, 08-06, 08-07]
tech-stack:
  added: []
  patterns: ["injected clock", "IDF-weighted token matcher", "closed-vocabulary tables"]
key-files:
  created:
    - src/lib/voice/commands.ts
    - src/lib/voice/commands.test.ts
    - src/lib/voice/facts.ts
    - src/lib/voice/facts.test.ts
  modified: []
decisions:
  - "Tests that pin dollar totals read the pinned aggregates (20,000 / 491,500), not the stale 296,500 in the plan"
  - "Within a pending did-you-mean pool the matcher opens at LOW (0.55) with margin, since the options were already offered"
  - "Generic-only queries (e.g. 'open foundation') return chat rather than an arbitrary did-you-mean"
metrics:
  tasks: 3
  files: 4
  tests: "111 voice tests; 283 total unit tests"
---

# Phase 8 Plan 01: Voice command grammar and facts Summary

Pure, browser-free voice logic: a precedence-ordered command parser with an IDF-weighted fuzzy funder matcher, plus deterministic deadline and secured-total fact phrases.

## What was built

- `facts.ts`: `nextDeadlines(grants, now, n=3)` (local-date compare, excludes passed, past-dated and declined/not-eligible/not-eligible-yet rows, sorted by date then funder), `nextDeadlinesText`, `securedText`, `formatLongDate` (string split, no Date parsing). The clock is injected everywhere.
- `commands.ts`: `normalize`, `parse`, exported tables (`FILTER_VALUES`, `STATUS_SYNONYMS`, `GATE_SYNONYMS`, `TYPE_SYNONYMS`, `PANEL_PHRASES`, `FACT_PHRASES`, `RESET_PHRASES`, `CLOSE_PHRASES`, `ORDINALS`, `CANCEL_PHRASES`, `FUNDER_ALIASES`), constants `HIGH`/`LOW`/`MARGIN`, `optionLabel`, and the `Intent`/`Ctx`/`PendingOption` types exactly as in the plan interface block. Precedence: pending follow-up, system phrases, filters, navigate, chat.
- Matcher: idf-weighted token coverage (0.7 query + 0.3 candidate), prefix / edit-distance / consonant-skeleton similarity, joined-token merging ("third wave" ~ "thirdwave"), same-funder family rule (Ford, Third Wave, Borealis always ask), margin rule for near-ties (Bank of America yields 3 options), 6-token cap and question-word guard.

## Verification

- `pnpm exec vitest run src/lib/voice`: 2 files, 111 tests pass.
- `pnpm test:unit`: 15 files, 283 tests pass.
- `pnpm check`: 0 errors, 1 pre-existing warning in ChatWidget.svelte (not touched).
- 100 parses against the 40-row dataset run in a few ms.

## Deviations from Plan

**1. [Rule 1 - Bug in plan expectation] Stale potential total**
- **Found during:** Task 1
- **Issue:** Plan/behavior expects `'$20,000 secured so far, out of $296,500 potential.'`, but `potentialTotal(grants)` is 491,500 since 12 rows were added (aggregates.test.ts is already re-pinned to 491,500).
- **Fix:** `securedText` is computed from the aggregates (so it matches the HUD); the test asserts `'$20,000 secured so far, out of $491,500 potential.'` and also pins both totals. The literal `$296,500` string from the acceptance criteria therefore does not appear in the tests.
- **Commit:** 9265f4b

**2. [Rule 3 - Blocking] Worktree base reset**
- Worktree HEAD was at 3179c44; reset to the specified base 598370e per the startup check before any work.

No other deviations. Test string literals `'Next deadlines:'`, `'No dated deadlines are coming up.'` are present in facts.test.ts. The plan's "Ford Foundation: JustFilms" label style is produced as `Ford Foundation: JustFilms Documentary Production` (full program text).

## Known Stubs

None.

## Threat Flags

None. Filter values are validated against `FILTER_VALUES` (T-08-01); open-grant ids come only from the injected grants array (T-08-02); navigate remainder is capped at 6 tokens before scoring (T-08-03).

## Commits

- 9265f4b feat(08-01): add voice facts selectors for deadlines and secured total
- deabf25 feat(08-01): add voice command grammar with closed vocabularies and precedence parser
- 9a8360b feat(08-01): add IDF fuzzy funder matcher, navigate intent and did-you-mean

## Self-Check: PASSED

All four source files and this summary exist; the three commits are present in git log.
