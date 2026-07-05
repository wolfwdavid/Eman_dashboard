---
phase: 02-data-pipeline-custom-tools
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - tools/normalize/status.mjs
  - tools/normalize/status.test.mjs
  - tools/normalize/slug.mjs
  - tools/ingest-grants.mjs
  - src/lib/data/grants.generated.json
  - src/lib/data/index.ts
  - tools/aggregates.mjs
  - tools/aggregates.test.mjs
autonomous: true
requirements: [DATA-01, DATA-04]
must_haves:
  truths:
    - "`parseStatus` maps all 8 raw status strings to the fixed enum + label; 'Not eligible (yet)' matches BEFORE 'Not eligible'"
    - "`parse501c3` maps every 501c3 string to the yes/no/unknown tri-state while preserving requires501c3Raw"
    - "`node tools/ingest-grants.mjs` reads data/grants.csv, asserts exactly 28 rows, and emits src/lib/data/grants.generated.json with 28 typed Grant records"
    - "securedTotal === 20000 (NY Community Trust only); potentialTotal === 296500 with the recommended basis"
    - "Hey Helen (declined), TD Bank/Truist (not-eligible), 37 Angels (equity), and NY Community Trust (received) are ALL excluded from potentialTotal"
  artifacts:
    - path: "tools/normalize/status.mjs"
      provides: "parseStatus + parse501c3 pure normalizers"
      exports: ["parseStatus", "parse501c3"]
    - path: "tools/ingest-grants.mjs"
      provides: "CSV → typed JSON ingest tool (papaparse, BOM strip, 28-row assert, emit)"
    - path: "src/lib/data/grants.generated.json"
      provides: "the 28 typed Grant records the app compiles against (no runtime fetch)"
    - path: "src/lib/data/index.ts"
      provides: "barrel: typed grants export + re-export of types"
      contains: "export const grants"
    - path: "tools/aggregates.mjs"
      provides: "pure selectors securedTotal/potentialTotal/countByStatus/by501c3"
      exports: ["securedTotal", "potentialTotal", "countByStatus", "by501c3"]
  key_links:
    - from: "tools/ingest-grants.mjs"
      to: "tools/normalize/amount.mjs, deadline.mjs, status.mjs, slug.mjs"
      via: "import normalizers"
      pattern: "import.*from.*normalize"
    - from: "tools/ingest-grants.mjs"
      to: "tools/schema.mjs"
      via: "GrantSchema.safeParse before emit"
      pattern: "safeParse"
    - from: "src/lib/data/index.ts"
      to: "src/lib/data/grants.generated.json"
      via: "import raw json"
      pattern: "grants.generated.json"
---

<objective>
Complete the data pipeline: the status/501c3/slug normalizers, the `ingest-grants.mjs` tool that turns the 28-row CSV into `src/lib/data/grants.generated.json`, the `index.ts` barrel the app imports, and the pure aggregate selectors that prove the headline numbers (`securedTotal === 20000`, `potentialTotal === 296500`).

Purpose: This produces the actual typed dataset (DATA-01) and the last two normalizers (DATA-04), plus the selectors that later HUD panels (Phase 4) recompute under filters. The generated JSON is committed so diffs are inspectable.
Output: `tools/normalize/status.mjs`(+test), `tools/normalize/slug.mjs`, `tools/ingest-grants.mjs`, `src/lib/data/grants.generated.json`, `src/lib/data/index.ts`, `tools/aggregates.mjs`(+test).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# READ FIRST — status/501c3 maps + aggregate tables are the SPEC.
@.planning/phases/02-data-pipeline-custom-tools/02-RESEARCH.md
@.planning/research/ARCHITECTURE.md
@data/grants.csv

# From 02-01 (consumed here — do NOT redefine):
@src/lib/data/types.ts
@tools/schema.mjs
@tools/normalize/amount.mjs
@tools/normalize/deadline.mjs

<interfaces>
<!-- Consumed from Plan 02-01 — already on disk: -->
<!-- tools/normalize/amount.mjs → export function parseAmount(raw): GrantAmount -->
<!-- tools/normalize/deadline.mjs → export function parseDeadline(raw): GrantDeadline -->
<!-- tools/schema.mjs → export const GrantSchema (zod v4) -->
<!-- src/lib/data/types.ts → export interface Grant + enums -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: parseStatus + parse501c3 + slug normalizers with unit tests (DATA-04)</name>
  <files>tools/normalize/status.mjs, tools/normalize/status.test.mjs, tools/normalize/slug.mjs</files>
  <read_first>
    - 02-RESEARCH.md "parseStatus — 8 raw → enum (DATA-04)" (lines ~263-276)
    - 02-RESEARCH.md "parse501c3 — string → tri-state (DATA-04)" (lines ~278-294) incl. Open Q2/Q3
    - 02-RESEARCH.md "Slug algorithm (recommended)" (line ~305)
    - data/grants.csv (the literal Status and 501(c)(3) Required column values)
  </read_first>
  <behavior>
    Write `tools/normalize/status.test.mjs` FIRST. Assert exactly:

    parseStatus(raw) → { status, statusLabel }:
    | raw | status | statusLabel |
    |---|---|---|
    | `Active funder` | active | "Active funder" |
    | `In progress` | in-progress | "In progress" |
    | `To research` | to-research | "To research" |
    | `Recurring` | recurring | "Recurring" |
    | `Applied` | applied | "Applied" |
    | `Declined` | declined | "Declined" |
    | `Not eligible` | not-eligible | "Not eligible" |
    | `Not eligible (yet)` | not-eligible-yet | "Not eligible (yet)" |
    CRITICAL: `Not eligible (yet)` MUST be tested/matched BEFORE `Not eligible` (substring order). Any UNMAPPED status string MUST throw (do NOT default to a fallback enum) — add a test that `parseStatus('Bogus')` throws.

    parse501c3(raw) → { requires501c3, requires501c3Raw }:
    | raw (examples) | requires501c3 |
    |---|---|
    | `No - they are 501(c)(3); potential fiscal sponsor` | no |
    | `No` | no |
    | `No (intermediary funder)` | no |
    | `Yes - or fiscal sponsor` | yes |
    | `Yes (required)` | yes |
    | `Likely yes` | yes  (Open Q2 — conservative) |
    | `Unknown` | unknown |
    Rules: `/^no\b/i`→no; `/^yes\b/i` or contains `(required)` or `or fiscal sponsor`→yes; `/^likely/i`→yes; `/^unknown/i` or empty→unknown. requires501c3Raw always preserves the original string.

    slug(cell) test: `slug('Ford Foundation - JustFilms Documentary Production')` === `'ford-foundation-justfilms-documentary-production'`; `slug('37 Angels')` === `'37-angels'`.
  </behavior>
  <action>
    Implement:
    - `tools/normalize/status.mjs` exporting pure `parseStatus(raw)` (8-entry map, ordered so `Not eligible (yet)` is checked before `Not eligible`; throw on unmapped) and `parse501c3(raw)` (regex rules above; keep requires501c3Raw).
    - `tools/normalize/slug.mjs` exporting pure `slug(cell)`:
      `cell.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')`.
    All pure and importable.
  </action>
  <verify>
    <automated>pnpm exec vitest run tools/normalize/status.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tools/normalize/status.test.mjs` exits 0
    - `node -e "import('./tools/normalize/status.mjs').then(m=>{const a=m.parseStatus('Not eligible (yet)');process.exit(a.status==='not-eligible-yet'?0:1)})"` exits 0
    - `node -e "import('./tools/normalize/status.mjs').then(m=>{try{m.parseStatus('Bogus');process.exit(1)}catch{process.exit(0)}})"` exits 0 (unmapped throws)
    - `node -e "import('./tools/normalize/status.mjs').then(m=>{const a=m.parse501c3('Likely yes');process.exit(a.requires501c3==='yes'&&a.requires501c3Raw==='Likely yes'?0:1)})"` exits 0
    - `node -e "import('./tools/normalize/slug.mjs').then(m=>process.exit(m.slug('37 Angels')==='37-angels'?0:1))"` exits 0
  </acceptance_criteria>
  <done>parseStatus (8 enum, yet-before-eligible, throw-on-unmapped), parse501c3 (tri-state + raw), and slug all pass their unit tests.</done>
</task>

<task type="auto">
  <name>Task 2: ingest-grants.mjs — CSV → typed grants.generated.json + index.ts barrel (DATA-01)</name>
  <files>tools/ingest-grants.mjs, src/lib/data/grants.generated.json, src/lib/data/index.ts</files>
  <read_first>
    - 02-RESEARCH.md "Tool 1 — Ingest + Normalize" (lines ~298-305) and "CSV structural handling" / Pitfall 4
    - 02-RESEARCH.md "Export path so components need no runtime fetch" (lines ~183-192)
    - tools/verify-build.mjs (mirror this custom-tool style: shebang, node:fs, clear PASS/FAIL, process.exit)
    - data/grants.csv (Type column: `Investment (not grant)` must map to `Investment`)
  </read_first>
  <action>
    Create `tools/ingest-grants.mjs` (pure Node ESM, mirror verify-build.mjs style):
      1. Read the CSV path from `process.env.GRANTS_CSV ?? 'data/grants.csv'` as UTF-8 (env override lets 02-04's integration test point at the bad fixture).
      2. Strip BOM: `text = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text`.
      3. `Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() })` (import papaparse).
      4. Assert `data.length === 28` → else print error + `process.exit(1)` (catches ghost row / shredded columns).
      5. For each row: trim every field; `--` or `''` → null; split `Funder / Program` on the FIRST ` - ` → funder/program (no ` - ` → program=null); `slug()` the FULL "Funder / Program" cell for `id`; map Type (`Investment (not grant)` → `Investment`, else pass through `Grant`/`Grant/Fellowship`); run parseAmount(Amount), parseDeadline(Deadline), parseStatus(Status), parse501c3(501(c)(3) Required). Build the full Grant record (fit=Fit/Eligibility, link=Link, nextAction).
      6. Validate EACH record with `GrantSchema.safeParse` (import from tools/schema.mjs); collect failures with row index + funder + `result.error.issues`; if ANY fail, print all and `process.exit(1)` BEFORE writing (so a bad run never clobbers the good JSON). Also assert no duplicate `id`.
      7. On success, write `src/lib/data/grants.generated.json` (pretty-printed, 28 records) to the path `process.env.GRANTS_OUT ?? 'src/lib/data/grants.generated.json'`. Print a PASS summary.
    Create `src/lib/data/index.ts` barrel:
      ```ts
      import raw from './grants.generated.json';
      import type { Grant } from './types';
      export const grants = raw as Grant[];
      export * from './types';
      ```
    Then run `node tools/ingest-grants.mjs` to emit the committed JSON.
  </action>
  <verify>
    <automated>node tools/ingest-grants.mjs && node -e "import('fs').then(fs=>{const g=JSON.parse(fs.readFileSync('src/lib/data/grants.generated.json','utf8'));const ids=new Set(g.map(x=>x.id));process.exit(g.length===28&&ids.size===28?0:1)})"</automated>
  </verify>
  <acceptance_criteria>
    - `node tools/ingest-grants.mjs` exits 0 and prints a success/PASS summary
    - `node -e "const g=require('./src/lib/data/grants.generated.json');process.exit(g.length===28?0:1)"` exits 0 (exactly 28 records)
    - `node -e "const g=require('./src/lib/data/grants.generated.json');const nyct=g.find(x=>x.funder.includes('NY Community Trust'));process.exit(nyct.amount.isReceived&&nyct.amount.avg===20000&&nyct.status==='active'?0:1)"` exits 0
    - `node -e "const g=require('./src/lib/data/grants.generated.json');const a=g.find(x=>x.funder.includes('37 Angels'));process.exit(a.type==='Investment'&&a.amount.isEquity?0:1)"` exits 0
    - `grep -q "process.env.GRANTS_CSV" tools/ingest-grants.mjs && grep -q "safeParse" tools/ingest-grants.mjs && grep -q "0xFEFF" tools/ingest-grants.mjs`
    - `grep -q "export const grants" src/lib/data/index.ts`
  </acceptance_criteria>
  <done>ingest emits a 28-record, unique-id, schema-valid grants.generated.json; index.ts exports typed grants; CSV path is env-overridable for the 02-04 gate test.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: aggregates.mjs selectors + tests — securedTotal/potentialTotal/counts (DATA-01/04)</name>
  <files>tools/aggregates.mjs, tools/aggregates.test.mjs</files>
  <read_first>
    - 02-RESEARCH.md "Derived Aggregates (where they live + exact numbers)" (lines ~342-371) — the potentialTotal 9-row basis table is the spec
    - 02-RESEARCH.md "aggregates.test.mjs" example block (lines ~519-530)
  </read_first>
  <behavior>
    Write `tools/aggregates.test.mjs` FIRST, loading the real generated dataset (`src/lib/data/grants.generated.json`). Assert:
      - `securedTotal(grants) === 20000` (NY Community Trust only) — HARD assert.
      - `countByStatus(grants)` deep-equals `{ 'to-research':17, 'in-progress':3, recurring:2, 'not-eligible-yet':2, active:1, applied:1, declined:1, 'not-eligible':1 }`; sum === 28.
      - `potentialTotal(grants) === 296500` (recommended basis: estimate = avg ?? max ?? min, over the 9 contributing rows: Harry S. Black 10000, Ford JustFilms 125000, Ford NYC 100000, Ben & Jerry's 20000, Third Wave 20000, Awesome 1000, Giving Joy 500, NYC Office 10000, NYC Commission 10000).
      - EXCLUSION membership asserts (the point of the test): the potential contributor set does NOT include Hey Helen (declined), TD Bank or Truist (not-eligible*), 37 Angels (equity), or NY Community Trust (isReceived → secured, never double-counted).
      - `by501c3(grants)` sums to 28.
  </behavior>
  <action>
    Implement `tools/aggregates.mjs` exporting pure selectors over `Grant[]`:
      - `securedTotal(grants)` = Σ (amount.avg ?? single figure) where `amount.isReceived`.
      - `potentialTotal(grants)` = Σ estimate(g) over rows where NOT isReceived, NOT isEquity, status ∉ {declined, not-eligible, not-eligible-yet}, and estimate is non-null; estimate = `amount.avg ?? amount.max ?? amount.min`.
      - `countByStatus(grants)` = group-count by status.
      - `by501c3(grants)` = group-count by requires501c3.
      - (optional) `potentialContributors(grants)` returning the contributing rows so the membership exclusion asserts are clean.
    Partition by RULE in the selector, never in a view. No magic numbers baked into the JSON.
  </action>
  <verify>
    <automated>pnpm exec vitest run tools/aggregates.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tools/aggregates.test.mjs` exits 0
    - `node -e "import('./tools/aggregates.mjs').then(m=>{const g=require('./src/lib/data/grants.generated.json');process.exit(m.securedTotal(g)===20000?0:1)})"` exits 0
    - `node -e "import('./tools/aggregates.mjs').then(m=>{const g=require('./src/lib/data/grants.generated.json');process.exit(m.potentialTotal(g)===296500?0:1)})"` exits 0
    - `node -e "import('./tools/aggregates.mjs').then(m=>{const g=require('./src/lib/data/grants.generated.json');const c=m.countByStatus(g);process.exit(c['to-research']===17&&Object.values(c).reduce((a,b)=>a+b,0)===28?0:1)})"` exits 0
    - `grep -q "isReceived" tools/aggregates.mjs && grep -q "isEquity" tools/aggregates.mjs` (exclusions implemented by rule)
  </acceptance_criteria>
  <done>securedTotal===20000 and potentialTotal===296500 with declined/not-eligible/equity/received all provably excluded; countByStatus sums to 28.</done>
</task>

</tasks>

<verification>
- `pnpm exec vitest run tools` — status, aggregates green (amount/deadline from 02-01 still green).
- `node tools/ingest-grants.mjs` emits 28-record grants.generated.json; ids unique; schema-valid.
- Aggregates key off the REAL generated dataset (not hand-rolled fixtures).
</verification>

<success_criteria>
- DATA-04: status→8-enum (yet-before-eligible, throw-on-unmapped) + 501c3 tri-state (raw preserved).
- DATA-01: ingest tool produces the typed grants.generated.json (28 records, unique ids) the app imports with no runtime fetch; index.ts barrel exports typed `grants`.
- securedTotal===20000, potentialTotal===296500, countByStatus sums 28; declined/not-eligible/equity/received excluded from potential.
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-pipeline-custom-tools/02-02-SUMMARY.md`
</output>
