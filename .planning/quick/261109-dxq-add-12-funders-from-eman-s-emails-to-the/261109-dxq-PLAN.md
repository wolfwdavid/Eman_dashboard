---
phase: quick-261109-dxq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
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
autonomous: true
requirements: [QUICK-261109-dxq]

must_haves:
  truths:
    - "The tracker holds 40 rows (28 original + 12 funders from Eman's emails) and `node tools/ingest-grants.mjs` prints PASSED"
    - "Every dataset-pinned unit test asserts the verified 40-row facts and `pnpm test:unit` is fully green"
    - "templates.test.ts pins exactly the ids that have a Template link, in grantsWithTemplates sort order"
    - "HOW-TO-UPDATE.md tells Eman that adding/removing rows requires bumping EXPECTED_ROWS and re-pinning the tests (or asking David)"
    - "`pnpm check` shows 0 errors, the BASE_PATH build exits 0, and `node tools/verify-build.mjs` prints PASSED"
  artifacts:
    - path: "data/grants.csv"
      provides: "40-row grant tracker"
    - path: "tools/ingest-grants.mjs"
      provides: "Row-count guard"
      contains: "EXPECTED_ROWS = 40"
    - path: "src/lib/crystarium/derive.test.ts"
      provides: "Re-pinned beam/pulse/family counts"
      contains: "re-pinned 2026-11-09"
    - path: "HOW-TO-UPDATE.md"
      provides: "Row-count guard note for Eman"
      contains: "EXPECTED_ROWS"
  key_links:
    - from: "data/grants.csv"
      to: "src/lib/data/grants.generated.json"
      via: "node tools/ingest-grants.mjs (regenerate)"
      pattern: "EXPECTED_ROWS"
    - from: "src/lib/crystarium/derive.test.ts"
      to: "src/lib/crystarium/layout.js"
      via: "computeLayout(grants.generated.json)"
      pattern: "computeLayout"
---

<objective>
Land the 12 funders Eman emailed (already appended to data/grants.csv in the working tree, rows 29-40) and re-pin the unit tests that assert facts about the old 28-row dataset to the verified 40-row facts. Document the row-count guard so it stops being a silent trap for Eman.

Purpose: the dashboard must show every funder Eman has surfaced, and the test suite must keep checking real-dataset facts (not hand-rolled), now for 40 rows.
Output: 3 local commits (data, tests, docs). NOT pushed.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@data/grants.csv
@tools/ingest-grants.mjs
@src/lib/data/aggregates.ts
@src/lib/data/filter.ts
@src/lib/crystarium/layout.js
@HOW-TO-UPDATE.md

Project root (run every command from here; shell cwd resets between calls):
`C:/Users/Mkaru/Documents/Hello_World/hugginface_profile/Websites/Eman/Eman_dashboard`

Environment rules (MANDATORY):
- Every pnpm call needs `--config.verify-deps-before-run=false` (otherwise ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY).
- Bare `python` is blocked by a hook — use `node -e` (preferred) or `uv run --no-project python`.
- Keep files LF.
- Commit messages describe the change only: NO Claude/AI mention, NO Co-Authored-By trailer. Do NOT push. Do NOT touch .planning/ROADMAP.md or .planning/STATE.md.

<interfaces>
Rules the tests check (from the codebase):

src/lib/crystarium/layout.js
- `isPulse(g)` = concrete one-time deadline: `g.deadline.cadence === 'one-time' && !g.deadline.isPassed && !NEVER_PULSE.has(g.status)` (read the full line above it — re-derive, do not assume "date && !isPassed").
- `isBeamTarget(g)` = raw 501(c)(3) string === 'Yes - or fiscal sponsor' (NOT the tri-state).
- Family edges: `FAMILY_PARENTS = ['Ford Foundation', 'Bank of America']`, funder SUBSTRING match, grouped in dataset order, then CHAINED: a group of N ids yields N-1 edges `{from: ids[i], to: ids[i+1]}`. So Ford pair = 1 edge, BofA family of 3 = 2 edges, total 3.
  The chain order follows grants.generated.json order — harry-s-black-allon-fuller-fund-bank-of-america → bank-of-america-charitable-foundation should still be adjacent (old rows precede new); verify, and the existing "includes the BofA pair" test must still hold. Add one assertion for the new link bank-of-america-charitable-foundation ↔ bank-of-america-neighborhood-builders.
- Spine edges connect ring members; tests check endpoints exist (count-free) — should not need changes.

src/lib/data/templates.ts
- `grantsWithTemplates(list)` keeps non-blank `template`, sorts by funder then program (null → ''), localeCompare.

Expected 40-row facts (from orchestrator; RE-DERIVE each before pinning):
- rows 40; countByStatus active 1, in-progress 3, to-research 22, recurring 3, applied 1, declined 1, not-eligible 4, not-eligible-yet 5
- by501c3 / gate: no 14 (open), yes 17 (gated), unknown 9
- type: Grant 37, Fellowship 2, Investment 1
- potentialContributors 14, potentialTotal 491500; securedTotal 20000 (unchanged)
- beams 7: 4 old BEAM_IDS + new-york-women-s-foundation-early-investment-grants, north-star-fund-nyc-organizing-grants, borealis-philanthropy-just-futures-initiative
- pulse 4: 3 old PULSE_IDS + north-star-fund-nyc-organizing-grants
- family edges 3; TBD nodes 20
- tri-state "yes" count in derive.test.ts (currently `triStateCount` 8) → re-derive (expected 17 if it counts by501c3 yes)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verify and commit the 40-row data</name>
  <files>data/grants.csv, src/lib/data/grants.generated.json, tools/ingest-grants.mjs</files>
  <action>
The three files are ALREADY edited in the working tree (uncommitted). Do not re-author them; verify and commit.
1. `git status --short` — confirm exactly these three files are modified (plus nothing unexpected; if anything else is dirty, leave it out of the commit and note it in the SUMMARY).
2. `node tools/ingest-grants.mjs` → must print `ingest-grants: PASSED` with 40 rows. This regenerates grants.generated.json; if `git diff --stat` then changes the JSON further (e.g. Template links landed in the CSV from the parallel upload), that is expected — the regenerated JSON is what gets committed.
3. With a `node -e` script reading src/lib/data/grants.generated.json: assert length 40; for the 12 new rows (indices 28-39) print id, status, link, template; assert each status is in the enum the ingest uses (active, in-progress, to-research, recurring, applied, declined, not-eligible, not-eligible-yet) and each link starts with `https://`. Confirm the 12 funders match the list: T7 Summit, Draper Richards Kaplan, Impact Funding Solutions, New York Women's Foundation, North Star Fund, Third Wave Fund Mobilize Power Fund, Rockefeller Foundation, Borealis Just Futures Initiative, Bank of America Neighborhood Builders, Skip (YoGovernment), Queens Centers for Progress, Barr Foundation.
4. Confirm LF line endings on the CSV (`file data/grants.csv` or `node -e` check for `\r`). If CRLF crept in, convert to LF and re-run step 2.
5. `git add data/grants.csv src/lib/data/grants.generated.json tools/ingest-grants.mjs` then `git commit -m "data: add 12 funders from Eman's emails (40 rows)"`.
  </action>
  <verify>
    <automated>node tools/ingest-grants.mjs && node -e "const g=require('./src/lib/data/grants.generated.json');if(g.length!==40)process.exit(1);if(!g.slice(28).every(x=>/^https:\/\//.test(x.link)))process.exit(2);console.log('ok')" && git log -1 --pretty=%s</automated>
  </verify>
  <done>Ingest PASSED with 40 rows, 12 new rows have enum statuses and https links, and the commit "data: add 12 funders from Eman's emails (40 rows)" holds exactly the three data files.</done>
</task>

<task type="auto">
  <name>Task 2: Re-pin the dataset tests to the verified 40-row facts</name>
  <files>tools/aggregates.test.mjs, src/lib/data/aggregates.test.ts, src/lib/data/filter.test.ts, src/lib/crystarium/derive.test.ts, src/lib/crystarium/layout.test.ts, src/lib/data/templates.test.ts</files>
  <action>
1. Baseline: `pnpm --config.verify-deps-before-run=false test:unit` — record the failing assertions (expect ~19 across the first 5 files, plus possibly templates.test.ts if Template links have landed).
2. Re-derive every fact with a scratch `node` script (put it in the session scratchpad, not the repo) that imports grants.generated.json and applies the SAME rules as the app: read `NON_POTENTIAL_STATUSES` and the potential/secured sums in src/lib/data/aggregates.ts, `gateBucket`/`typeBucket` in src/lib/data/filter.ts, and `isPulse`/`isBeamTarget`/`deriveFamilies` in src/lib/crystarium/layout.js (layout.js is plain JS — import `computeLayout` directly and count `edges` by kind, nodes with `pulse`, `beamTarget`, `amount.isTBD`). Compare with the expected facts in <interfaces>; if any differ, the derived value wins — note the discrepancy in the SUMMARY.
3. Update each pinned expectation to the derived value. Keep the tests' intent (real dataset, not fixtures):
   - tools/aggregates.test.mjs: 28 → 40 (length, Σ countByStatus, Σ by501c3), the countByStatus deep-equal object, any by501c3/potential/secured literals.
   - src/lib/data/aggregates.test.ts: describe/it titles "(Σ28)", "17/3/2/2/1/1/1/1", "no 12 / yes 8 / unknown 8" and their literals; potentialTotal/contributor-count literals (secured stays 20000).
   - src/lib/data/filter.test.ts: gate 12/8/8 → 14/17/9; type 26/1/1 → 37/2/1; the header comment's counts; the in-progress `toHaveLength(3)` stays if still 3. The bucket spot-checks on specific ids should still pass — leave them.
   - src/lib/crystarium/derive.test.ts: extend BEAM_IDS (7) and PULSE_IDS (4) with the new ids; beams 4 → 7 (title "exactly 4 beams ... would give 8" → re-derived numbers); triStateCount and rawCount re-derived; pulse 3 → 4; family 2 → 3 with title "Ford pair + BofA family of 3 (chained → 2 edges)"; keep the Ford-pair and BofA-pair tests and ADD a test asserting the bank-of-america-charitable-foundation ↔ bank-of-america-neighborhood-builders edge (either direction). Update the header comment's "(beam=4, pulse=3, family=2)" and "28-record".
   - src/lib/crystarium/layout.test.ts: nodes 28 → 40, ring-count sum 28 → 40, any per-ring literals in the "buckets ... into the status-funnel rings" test, EXPECTED_TBD 16 → 20 (keep the data-note comment, update it), header comment "28-record".
   - src/lib/data/templates.test.ts: rename the misleading test title (e.g. "real dataset: every tracker row with a Template link, sorted funder → program") and pin the id list produced by `grantsWithTemplates(grants)` — generate it with the scratch script (sort by funder, then program ?? '', localeCompare — or import the helper's logic verbatim) and paste it. If all 40 Template cells are filled, pin all 40; if some are still empty, pin exactly the ids that have links and record which rows lacked a Template in the SUMMARY.
4. On EVERY changed number/list add a trailing one-line comment `// re-pinned 2026-11-09 after 12 rows were added`. Update "28-row"/"28 records" to 40 only in assertion-related comments/titles in these 6 files; do NOT touch prose comments in tools/normalize/*.test.mjs (those tests still pass).
5. `pnpm --config.verify-deps-before-run=false test:unit` → all green. Do not weaken any assertion (no `toBeGreaterThan` replacing exact counts, no deleted tests).
6. `git add` the 6 test files; `git commit -m "test: re-pin dataset facts for the 40-row tracker"`.
  </action>
  <verify>
    <automated>pnpm --config.verify-deps-before-run=false test:unit && grep -c "re-pinned 2026-11-09" src/lib/crystarium/derive.test.ts src/lib/crystarium/layout.test.ts src/lib/data/filter.test.ts src/lib/data/aggregates.test.ts tools/aggregates.test.mjs src/lib/data/templates.test.ts</automated>
  </verify>
  <done>All unit tests pass; every re-pinned value was derived from grants.generated.json using the app's own rules and carries the re-pin comment; family-edge test asserts 3 edges including the new BofA link; templates test pins the exact linked-id list; commit created.</done>
</task>

<task type="auto">
  <name>Task 3: Document the row-count guard and run the full verify</name>
  <files>HOW-TO-UPDATE.md</files>
  <action>
1. In HOW-TO-UPDATE.md, directly after the paragraph "If a row is malformed (bad link, unknown status), the build **fails on purpose** ..." add a short plain-language paragraph for Eman, e.g.: "**Adding or removing a row?** The build also checks the number of rows on purpose. When the row count changes, `EXPECTED_ROWS` in `tools/ingest-grants.mjs` must be bumped to the new count and the dataset tests re-pinned — or just ask David to do it." Keep the doc's existing tone and formatting; LF endings.
2. `pnpm --config.verify-deps-before-run=false check` → 0 errors (the 1 pre-existing `messagesEl` warning is acceptable; any NEW warning/error must be fixed or reported).
3. `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm --config.verify-deps-before-run=false build` → exit 0.
4. `node tools/verify-build.mjs` → PASSED.
5. If the build regenerated any tracked file (e.g. grants.generated.json or QR output) run `git status --short`; a diff there means Task 1's commit was stale — re-run ingest, amend nothing, and make a separate commit "data: regenerate grants.generated.json" only if the content genuinely differs, noting it in the SUMMARY.
6. `git add HOW-TO-UPDATE.md`; `git commit -m "docs: note the row-count guard and test re-pin when grants are added"`. Do NOT push.
  </action>
  <verify>
    <automated>pnpm --config.verify-deps-before-run=false check && MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm --config.verify-deps-before-run=false build && node tools/verify-build.mjs && grep -n "EXPECTED_ROWS" HOW-TO-UPDATE.md</automated>
  </verify>
  <done>HOW-TO-UPDATE.md explains the row-count guard; check has 0 errors; build exits 0; verify-build PASSED; docs commit created; working tree clean; nothing pushed.</done>
</task>

</tasks>

<verification>
- `git log --oneline -3` shows the data, test, and docs commits in that order, none mentioning AI tools and none with Co-Authored-By.
- `git status --short` is clean; `git status -sb` shows the branch ahead of origin (not pushed).
- `node tools/ingest-grants.mjs` PASSED (40), `pnpm test:unit` green, `pnpm check` 0 errors, build exit 0, verify-build PASSED.
</verification>

<success_criteria>
- 40 grants committed; the 12 emailed funders are present with valid status and https links.
- No unit test asserts a 28-row fact anymore; all re-pinned values are rule-derived and annotated.
- Eman's how-to documents the EXPECTED_ROWS guard.
</success_criteria>

<output>
After completion, create `.planning/quick/261109-dxq-add-12-funders-from-eman-s-emails-to-the/261109-dxq-SUMMARY.md` (include: derived facts vs orchestrator expectations, Template coverage at execution time, commit hashes).
</output>
