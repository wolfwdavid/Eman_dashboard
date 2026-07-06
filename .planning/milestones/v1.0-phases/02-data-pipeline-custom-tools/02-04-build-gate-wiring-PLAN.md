---
phase: 02-data-pipeline-custom-tools
plan: 04
type: execute
wave: 3
depends_on: [02, 03]
files_modified:
  - tools/validate.test.mjs
  - package.json
autonomous: true
requirements: [DATA-05]
must_haves:
  truths:
    - "The zod GrantSchema rejects a bad enum and a bad URL (unit) — safeParse(...).success === false"
    - "Running ingest against data/__fixtures__/grants.bad.csv exits non-zero with a row-level error (integration)"
    - "Running ingest against the real data/grants.csv exits 0 and writes 28 records"
    - "`pnpm build` chains build:data && build:qr && vite build; a malformed CSV makes `pnpm build` exit non-zero; reverting makes it pass"
    - "pnpm build:data runs the validator BEFORE vite build (pnpm does NOT auto-run prebuild — the chain is explicit with &&)"
  artifacts:
    - path: "tools/validate.test.mjs"
      provides: "unit (schema rejects bad enum/URL, dup-id) + integration (spawn ingest on bad fixture → exit 1) tests"
    - path: "package.json"
      provides: "explicitly-chained build/dev scripts wiring the data + qr tools before vite"
      contains: "build:data && pnpm build:qr && vite build"
  key_links:
    - from: "tools/validate.test.mjs"
      to: "tools/ingest-grants.mjs"
      via: "spawnSync with GRANTS_CSV=data/__fixtures__/grants.bad.csv"
      pattern: "grants.bad.csv"
    - from: "package.json build script"
      to: "tools/ingest-grants.mjs + tools/generate-qr.mjs"
      via: "&& chain before vite build"
      pattern: "build:data.*build:qr.*vite build"
---

<objective>
Harden and prove the build gate (DATA-05): unit tests that the zod schema rejects malformed records, an integration test that spawns the ingest tool against the 28-row bad-CSV fixture and asserts a non-zero exit, and the explicit `package.json` build-script chain that runs the data + QR tools before `vite build` — so bad data can never reach production.

Purpose: DATA-05 — the validator fails the build on a malformed row. This is the last gate before the phase is done. It depends on the ingest tool (02-02) and the QR tool (02-03) both existing, because the final `build` chain invokes both.
Output: `tools/validate.test.mjs`, and the wired `package.json` scripts.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# READ FIRST — build wiring (pnpm prebuild trap) + validate.test spec.
@.planning/phases/02-data-pipeline-custom-tools/02-RESEARCH.md

# Consumed here (already on disk from earlier plans):
@tools/schema.mjs
@tools/ingest-grants.mjs
@package.json

<interfaces>
<!-- From 02-01: tools/schema.mjs → export const GrantSchema (zod v4, safeParse). -->
<!-- From 02-01: data/__fixtures__/grants.bad.csv (28 rows, one Link = 'not-a-url'). -->
<!-- From 02-02: tools/ingest-grants.mjs reads process.env.GRANTS_CSV ?? 'data/grants.csv', validates via GrantSchema, exits 1 on failure. -->
<!-- From 02-03: tools/generate-qr.mjs emits qr.generated.js. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: validate.test.mjs — schema unit rejections + bad-CSV integration gate (DATA-05)</name>
  <files>tools/validate.test.mjs</files>
  <read_first>
    - 02-RESEARCH.md "Tool 3 — Validator / Build Gate" (lines ~321-326) and "validate.test.mjs" example (lines ~532-540)
    - 02-RESEARCH.md Pitfall 7 (zod 4 API — errors on `.issues`)
    - tools/schema.mjs, tools/ingest-grants.mjs, data/__fixtures__/grants.bad.csv
  </read_first>
  <behavior>
    Write `tools/validate.test.mjs` (vitest, node env) asserting:
      UNIT (import GrantSchema from tools/schema.mjs — build a minimal valid record object, then mutate one field per case):
        - `GrantSchema.safeParse({ ...valid, status: 'bogus' }).success === false`
        - `GrantSchema.safeParse({ ...valid, link: 'not-a-url' }).success === false`
        - `GrantSchema.safeParse({ ...valid, requires501c3: 'maybe' }).success === false`
        - `GrantSchema.safeParse(valid).success === true`
        - On a failure, `result.error.issues` is a non-empty array (zod v4 shape).
      INTEGRATION (node:child_process spawnSync):
        - `spawnSync('node', ['tools/ingest-grants.mjs'], { env: { ...process.env, GRANTS_CSV: 'data/__fixtures__/grants.bad.csv', GRANTS_OUT: '<tmp path>' } }).status === 1` (bad fixture → non-zero; write to a throwaway GRANTS_OUT so the real JSON is never touched — though validation exits before write anyway).
        - `spawnSync('node', ['tools/ingest-grants.mjs']).status === 0` (real CSV → exit 0).
  </behavior>
  <action>
    Implement `tools/validate.test.mjs` covering the unit + integration behavior above. For the "minimal valid record", construct an object matching the Grant shape (all required fields present, valid enum values, a real https link, amount/deadline sub-objects). Use `spawnSync` from `node:child_process`; point GRANTS_CSV at the bad fixture for the negative case.
  </action>
  <verify>
    <automated>pnpm exec vitest run tools/validate.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tools/validate.test.mjs` exits 0
    - `GRANTS_CSV=data/__fixtures__/grants.bad.csv node tools/ingest-grants.mjs; test $? -ne 0` (bad fixture makes ingest exit non-zero)
    - `node tools/ingest-grants.mjs; test $? -eq 0` (real CSV exits 0)
    - `grep -q "grants.bad.csv" tools/validate.test.mjs && grep -q "spawnSync" tools/validate.test.mjs && grep -q ".issues" tools/validate.test.mjs`
  </acceptance_criteria>
  <done>Schema rejects bad enum/URL/tri-state (unit); ingest exits 1 on the bad fixture and 0 on the real CSV (integration); all green.</done>
</task>

<task type="auto">
  <name>Task 2: Wire the explicit build chain in package.json + prove the gate fails the build (DATA-05)</name>
  <files>package.json</files>
  <read_first>
    - 02-RESEARCH.md "Build wiring (package.json) — ⚠ do NOT trust pnpm `prebuild`" (lines ~327-340) and Pitfall 6
    - package.json (current scripts — keep dev/preview/check/verify:* intact)
  </read_first>
  <action>
    Edit `package.json` `scripts` to chain the data + QR tools explicitly with `&&` (pnpm does NOT run `pre`/`post` lifecycle scripts by default — an explicit chain is the recommended, unambiguous path). Add/replace:
      ```jsonc
      "build:data": "node tools/ingest-grants.mjs",
      "build:qr":   "node tools/generate-qr.mjs",
      "build":      "pnpm build:data && pnpm build:qr && vite build",
      "dev":        "pnpm build:data && pnpm build:qr && vite dev",
      "test:unit":  "vitest run"
      ```
    Preserve the existing `preview`, `prepare`, `check`, `check:watch`, `verify:build`, `test:smoke`, `verify:live` scripts unchanged. Do NOT add a `prebuild` hook (it would be silently skipped by pnpm).
    Then PROVE the gate end-to-end:
      1. `pnpm build:data` succeeds on the real CSV (emits grants.generated.json).
      2. Temporarily point build:data at the bad fixture — run `GRANTS_CSV=data/__fixtures__/grants.bad.csv pnpm build:data` and confirm it exits non-zero (the `&&` chain would abort `pnpm build` before `vite build`).
      3. Confirm the real `pnpm build:data` still exits 0 (green on revert).
    (Do not commit any temporary bad-data state — the fixture stays in data/__fixtures__/, the real grants.csv is unchanged.)
  </action>
  <verify>
    <automated>node -e "const s=require('./package.json').scripts;process.exit(s.build==='pnpm build:data && pnpm build:qr && vite build'?0:1)" && pnpm build:data && node -e "process.exit(0)"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "pnpm build:data && pnpm build:qr && vite build" package.json` (explicit chain)
    - `grep -Lq "\"prebuild\"" package.json || ! grep -q "\"prebuild\"" package.json` (no silently-skipped prebuild hook)
    - `pnpm build:data; test $? -eq 0` (real CSV green)
    - `GRANTS_CSV=data/__fixtures__/grants.bad.csv pnpm build:data; test $? -ne 0` (bad data aborts the chain → `pnpm build` would exit non-zero)
    - existing scripts `verify:build`, `test:smoke`, `check` still present in package.json
  </acceptance_criteria>
  <done>build/dev explicitly chain build:data && build:qr before vite; bad CSV makes build:data (and thus `pnpm build`) exit non-zero; real CSV passes; no prebuild hook relied upon.</done>
</task>

</tasks>

<verification>
- `pnpm exec vitest run tools` — full tool suite (amount, deadline, status, aggregates, qr, validate) green.
- `pnpm build:data` exits 0 on real CSV; `GRANTS_CSV=data/__fixtures__/grants.bad.csv pnpm build:data` exits non-zero.
- `package.json` build = `pnpm build:data && pnpm build:qr && vite build` (no reliance on pnpm prebuild).
</verification>

<success_criteria>
- DATA-05: a data validator (zod schema/enum/URL) fails the build when a grant row is malformed — proven by a unit rejection set AND an integration spawn against the bad fixture (exit 1), and wired into an explicitly-chained `pnpm build` so bad data can never ship. Reverting to the real CSV makes the build pass.
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-pipeline-custom-tools/02-04-SUMMARY.md`
</output>
