---
phase: 02-data-pipeline-custom-tools
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - vitest.config.ts
  - src/lib/data/types.ts
  - tools/schema.mjs
  - tools/normalize/amount.mjs
  - tools/normalize/amount.test.mjs
  - tools/normalize/deadline.mjs
  - tools/normalize/deadline.test.mjs
  - data/__fixtures__/grants.bad.csv
autonomous: true
requirements: [DATA-02, DATA-03]
must_haves:
  truths:
    - "`parseAmount` turns every one of the 18 distinct CSV amount strings into the exact typed struct in the rule table"
    - "`parseAmount('TBD')` returns min/max/avg all null (NEVER 0) — the coerce-to-0 regression is guarded by an anti-assertion"
    - "`parseDeadline` turns every one of the 20 distinct CSV deadline strings into the exact typed struct; no bare `new Date(wholeString)` is ever called"
    - "`parseDeadline('2025-12-30 (passed)')` is the ONLY string that yields isPassed=true; '2027-02-18 (2026 cycle passed)' yields isPassed=false"
    - "`pnpm exec vitest run tools/normalize` passes"
  artifacts:
    - path: "tools/normalize/amount.mjs"
      provides: "pure parseAmount(raw) → GrantAmount struct"
      exports: ["parseAmount"]
    - path: "tools/normalize/deadline.mjs"
      provides: "pure parseDeadline(raw) → GrantDeadline struct"
      exports: ["parseDeadline"]
    - path: "tools/schema.mjs"
      provides: "zod GrantSchema — single source of truth for record shape (used by ingest gate in 02-04)"
      exports: ["GrantSchema"]
    - path: "src/lib/data/types.ts"
      provides: "canonical Grant / GrantAmount / GrantDeadline / enum types"
      contains: "export interface Grant"
    - path: "vitest.config.ts"
      provides: "node-env vitest config including tools/**/*.test.mjs"
    - path: "data/__fixtures__/grants.bad.csv"
      provides: "28-row copy of grants.csv with one malformed field for the 02-04 build-gate integration test"
  key_links:
    - from: "tools/normalize/amount.test.mjs"
      to: "tools/normalize/amount.mjs"
      via: "import { parseAmount }"
      pattern: "import.*parseAmount.*from.*amount"
    - from: "tools/schema.mjs"
      to: "zod"
      via: "import { z } from 'zod'"
      pattern: "from 'zod'"
---

<objective>
Lay the Phase-2 foundation: install the three permitted build-time deps, stand up the vitest node-env config, define the canonical `Grant` type + its zod mirror (the single source of truth every downstream tool validates against), and build the two highest-leverage normalizers — `parseAmount` and `parseDeadline` — each unit-tested against every literal string in the real 28-row `data/grants.csv`.

Purpose: Parser correctness IS the product. A silent amount/deadline mis-parse corrupts the headline "secured vs. potential" story every Crystarium/HUD feature binds to. These two normalizers + the schema are the contract Plans 02-02 and 02-04 consume.
Output: Installed deps, `vitest.config.ts`, `src/lib/data/types.ts`, `tools/schema.mjs`, `tools/normalize/amount.mjs`(+test), `tools/normalize/deadline.mjs`(+test), and `data/__fixtures__/grants.bad.csv`.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# READ FIRST — the rule tables below are the SPEC. Copy the literal string→struct rows verbatim.
@.planning/phases/02-data-pipeline-custom-tools/02-RESEARCH.md
@.planning/phases/02-data-pipeline-custom-tools/02-CONTEXT.md
@.planning/research/ARCHITECTURE.md
@data/grants.csv
@tools/verify-build.mjs

<interfaces>
<!-- Canonical Grant type (from 02-RESEARCH.md "The Grant Type"). types.ts must export these verbatim; schema.mjs must mirror them. -->

```typescript
export type GrantType = 'Grant' | 'Grant/Fellowship' | 'Investment';
export type GrantStatus =
  | 'active' | 'in-progress' | 'to-research' | 'recurring'
  | 'applied' | 'declined' | 'not-eligible' | 'not-eligible-yet';
export type Cadence =
  | 'rolling' | 'annual' | 'invitation' | 'one-time' | 'passed' | 'unknown';
export type Requires501c3 = 'yes' | 'no' | 'unknown';

export interface GrantAmount {
  raw: string;
  min: number | null;
  max: number | null;
  avg: number | null;
  isReceived: boolean;
  isTBD: boolean;
  isEquity: boolean;
  isMicro: boolean;
}
export interface GrantDeadline {
  raw: string;
  date: string | null;      // ISO "YYYY-MM-DD" when a concrete leading date exists
  cadence: Cadence;
  note: string | null;
  isPassed: boolean;
}
export interface Grant {
  id: string;
  funder: string;
  program: string | null;
  type: GrantType;
  amount: GrantAmount;
  deadline: GrantDeadline;
  requires501c3: Requires501c3;
  requires501c3Raw: string;
  fit: string;
  status: GrantStatus;
  statusLabel: string;
  nextAction: string | null;
  link: string;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install deps + vitest config + canonical types + zod schema + bad-CSV fixture</name>
  <files>package.json, vitest.config.ts, src/lib/data/types.ts, tools/schema.mjs, data/__fixtures__/grants.bad.csv</files>
  <read_first>
    - 02-RESEARCH.md "Standard Stack" (exact versions) and "The Grant Type" (lines ~131-181) and "Build-gate validation (zod 4)" example (lines ~423-435)
    - package.json (current scripts/deps — vitest@4.1.9 already present)
    - .npmrc (engine-strict, auto-install-peers already set)
    - data/grants.csv (source to copy for the fixture)
  </read_first>
  <action>
    1. Install the ONLY three permitted deps + their types as devDependencies (all build-time only). Run exactly:
       `pnpm add -D papaparse@5.5.4 zod@4.4.3 qrcode@1.5.4 @types/papaparse@5.5.2 @types/qrcode@1.5.6`
       Do NOT add three/threlte/gsap/layerchart — those are later phases.

    2. Create `vitest.config.ts` at repo root:
       ```ts
       import { defineConfig } from 'vitest/config';
       export default defineConfig({
         test: {
           environment: 'node',
           include: ['tools/**/*.test.mjs', 'src/lib/data/**/*.test.ts']
         }
       });
       ```
       (node env — the normalizers are pure `.mjs`, no Svelte/jsdom needed. Keep this config separate from vite.config.ts.)

    3. Create `src/lib/data/types.ts` exporting the canonical types VERBATIM from the <interfaces> block above (GrantType, GrantStatus, Cadence, Requires501c3, GrantAmount, GrantDeadline, Grant). This is the type the app imports in Phase 3/4.

    4. Create `tools/schema.mjs` — a zod v4 mirror of the Grant type, the single source of truth for record shape. ⚠ zod 4 API (training data assumes v3): use top-level `z.url()` (NOT `z.string().url()`); enums via `z.enum([...])`. Structure:
       ```js
       import { z } from 'zod';
       export const GrantAmountSchema = z.object({
         raw: z.string(),
         min: z.number().nullable(), max: z.number().nullable(), avg: z.number().nullable(),
         isReceived: z.boolean(), isTBD: z.boolean(), isEquity: z.boolean(), isMicro: z.boolean()
       });
       export const GrantDeadlineSchema = z.object({
         raw: z.string(),
         date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
         cadence: z.enum(['rolling','annual','invitation','one-time','passed','unknown']),
         note: z.string().nullable(), isPassed: z.boolean()
       });
       export const GrantSchema = z.object({
         id: z.string().min(1),
         funder: z.string().min(1),
         program: z.string().nullable(),
         type: z.enum(['Grant','Grant/Fellowship','Investment']),
         amount: GrantAmountSchema,
         deadline: GrantDeadlineSchema,
         requires501c3: z.enum(['yes','no','unknown']),
         requires501c3Raw: z.string(),
         fit: z.string(),
         status: z.enum(['active','in-progress','to-research','recurring','applied','declined','not-eligible','not-eligible-yet']),
         statusLabel: z.string(),
         nextAction: z.string().nullable(),
         link: z.url()
       });
       ```

    5. Create the build-gate fixture `data/__fixtures__/grants.bad.csv`: copy `data/grants.csv` byte-for-byte (all 28 rows + header), then change ONLY the "Hey Helen Grant" row's final Link field from `https://www.heyhelen.com` to `not-a-url`. This is a well-formed 28-row CSV whose one malformed record trips the zod `z.url()` gate — consumed by the 02-04 integration test. Keep row count at 28 so ingest's 28-row assert is not what fires.
  </action>
  <verify>
    <automated>node -e "import('zod').then(m=>console.log('zod', typeof m.z.url==='function' ? 'v4-ok':'WRONG-API')); import('./tools/schema.mjs').then(m=>console.log('schema', typeof m.GrantSchema.safeParse==='function'?'ok':'fail'))"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c '"papaparse": "5.5.4"\|"zod": "4.4.3"\|"qrcode": "1.5.4"' package.json` shows all three pinned deps present
    - `grep -q "environment: 'node'" vitest.config.ts && grep -q "tools/\*\*/\*.test.mjs" vitest.config.ts`
    - `grep -q "export interface Grant" src/lib/data/types.ts && grep -q "isReceived" src/lib/data/types.ts && grep -q "isPassed" src/lib/data/types.ts`
    - `grep -q "z.url()" tools/schema.mjs` (zod-4 idiom — must NOT contain `z.string().url()`)
    - `grep -c "^\"" data/__fixtures__/grants.bad.csv` equals 29 (1 header + 28 rows) AND `grep -q "not-a-url" data/__fixtures__/grants.bad.csv`
  </acceptance_criteria>
  <done>Three deps pinned; vitest node config present; types.ts + schema.mjs define the canonical shape (zod v4 `z.url()`); 28-row bad fixture exists with exactly one bad Link.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: parseAmount normalizer + unit tests over all 18 literal strings (DATA-02)</name>
  <files>tools/normalize/amount.mjs, tools/normalize/amount.test.mjs</files>
  <read_first>
    - 02-RESEARCH.md "parseAmount — full rule table (DATA-02)" (lines ~194-227) — this table IS the spec
    - 02-RESEARCH.md "amount.test.mjs" example block (lines ~483-494)
  </read_first>
  <behavior>
    Write `tools/normalize/amount.test.mjs` FIRST. One `expect` case per literal string below (raw → exact struct). Fields not shown default to false; unshown numbers are null. Every case also asserts `isReceived/isTBD/isEquity/isMicro` explicitly.

    | raw string | min | max | avg | isReceived | isTBD | isEquity | isMicro |
    |---|---|---|---|---|---|---|---|
    | `$20,000 (received 2025)` | 20000 | 20000 | 20000 | true | false | false | false |
    | `$5,000-$20,000 (avg $10,000)` | 5000 | 20000 | 10000 | false | false | false | false |
    | `~$50,000-$200,000` | 50000 | 200000 | 125000 | false | false | false | false |
    | `$100,000+` | 100000 | null | null | false | false | false | false |
    | `Up to $30,000 (avg $20,000)` | null | 30000 | 20000 | false | false | false | false |
    | `$5,000-$35,000 (2-year)` | 5000 | 35000 | 20000 | false | false | false | false |
    | `$1,000` | 1000 | 1000 | 1000 | false | false | false | false |
    | `Micro (amount TBD)` | null | null | null | false | true | false | true |
    | `$500 (micro)` | 500 | 500 | 500 | false | false | false | true |
    | `Up to $10,000 (community); $1,000/youth project` | null | 10000 | 10000 | false | false | false | false |
    | `Up to $10,000` | null | 10000 | 10000 | false | false | false | false |
    | `$2,000-$6,000` | 2000 | 6000 | 4000 | false | false | false | false |
    | `TBD (includes AI access)` | null | null | null | false | true | false | false |
    | `$10,000` | 10000 | 10000 | 10000 | false | false | false | false |
    | `Fellowship support` | null | null | null | false | true | false | false |
    | `TBD` | null | null | null | false | true | false | false |
    | `Large` | null | null | null | false | true | false | false |
    | `Equity investment` | null | null | null | false | true | true | false |

    ANTI-ASSERTION (guards the coerce-to-0 regression): `expect(parseAmount('TBD').min).toBeNull()` and `.max`/`.avg` toBeNull — assert they are `!== 0`. Same for `Large`, `Equity investment`.
  </behavior>
  <action>
    Implement `tools/normalize/amount.mjs` exporting pure `parseAmount(raw)` → `{ raw, min, max, avg, isReceived, isTBD, isEquity, isMicro }` so ALL 18 cases + anti-assertions pass. Deterministic derivation rules:
      1. Extract all `\$\s?[\d,]+` tokens; strip `$`/`,`; parse to number.
      2. `(received ...)` present → isReceived=true; single figure → min=max=avg.
      3. `(avg $X)` present → avg = that explicit value (overrides midpoint).
      4. Two-figure range `A-B` (no explicit avg) → min=A, max=B, avg=round((A+B)/2).
      5. `Up to $X` / max-only (one figure, no min) → max=X, min=null, avg=X. For `Up to $10,000 (community); $1,000/youth project` take the figure right after "Up to" as max and ignore trailing figures → max=10000, avg=10000.
      6. `+` suffix (`$100,000+`) → min=X, max=null, avg=null.
      7. Zero numeric tokens → all numbers null, isTBD=true. `Equity investment` also isEquity=true. `/micro/i` present → isMicro=true.
      8. NEVER return 0 for a missing number — absence is `null`.
    Keep it pure and importable (no fs, no side effects).
  </action>
  <verify>
    <automated>pnpm exec vitest run tools/normalize/amount.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tools/normalize/amount.test.mjs` exits 0 with 18+ passing cases
    - `grep -q "toBeNull" tools/normalize/amount.test.mjs` (TBD→null anti-assertion present)
    - `node -e "import('./tools/normalize/amount.mjs').then(m=>{const a=m.parseAmount('TBD');process.exit(a.min===null&&a.max===null&&a.avg===null&&a.isTBD?0:1)})"` exits 0
    - `node -e "import('./tools/normalize/amount.mjs').then(m=>{const a=m.parseAmount('$20,000 (received 2025)');process.exit(a.isReceived&&a.avg===20000?0:1)})"` exits 0
    - `node -e "import('./tools/normalize/amount.mjs').then(m=>{const a=m.parseAmount('Equity investment');process.exit(a.isEquity&&a.isTBD&&a.min===null?0:1)})"` exits 0
  </acceptance_criteria>
  <done>parseAmount satisfies all 18 literal-string cases and the null-not-0 anti-assertions; vitest green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: parseDeadline normalizer + unit tests over all 20 literal strings (DATA-03)</name>
  <files>tools/normalize/deadline.mjs, tools/normalize/deadline.test.mjs</files>
  <read_first>
    - 02-RESEARCH.md "parseDeadline — full rule table (DATA-03)" (lines ~229-261) — spec
    - 02-RESEARCH.md "Extract-ISO-then-classify (parseDeadline core)" code example (lines ~400-420)
    - 02-RESEARCH.md Open Question 1 (why '2027-02-18 (2026 cycle passed)' is NOT isPassed)
  </read_first>
  <behavior>
    Write `tools/normalize/deadline.test.mjs` FIRST. One case per literal string below → exact `{ date, cadence, note, isPassed }` (raw is echoed input).

    | raw string | date | cadence | note | isPassed |
    |---|---|---|---|---|
    | `Annual relationship` | null | annual | "relationship" | false |
    | `2026-06-30 (decision by Oct 31)` | 2026-06-30 | one-time | "decision by Oct 31" | false |
    | `2026-09-01` | 2026-09-01 | one-time | null | false |
    | `Check 2026 cycle (awards Dec-Feb)` | null | unknown | "Check 2026 cycle (awards Dec-Feb)" | false |
    | `2027-02-18 (2026 cycle passed)` | 2027-02-18 | one-time | "2026 cycle passed" | false |
    | `Invitation only` | null | invitation | null | false |
    | `Rolling (monthly)` | null | rolling | "monthly" | false |
    | `Rolling (monthly review)` | null | rolling | "monthly review" | false |
    | `Cycle open (2026)` | null | unknown | "Cycle open (2026)" | false |
    | `Opens ~Oct 31-Nov 30; awards Dec` | null | unknown | "Opens ~Oct 31-Nov 30; awards Dec" | false |
    | `Opens ~Oct 2026` | null | unknown | "Opens ~Oct 2026" | false |
    | `Ongoing (recheck 2026-03-01)` | null | rolling | "recheck 2026-03-01" | false |
    | `Reapply Jan 2026` | null | unknown | "Reapply Jan 2026" | false |
    | `2025-12-30 (passed)` | 2025-12-30 | passed | "passed" | true |
    | `Annual` | null | annual | null | false |
    | `TBD` | null | unknown | null | false |
    | `Rolling` | null | rolling | null | false |
    | `Open calls` | null | unknown | "Open calls" | false |
    | `2025 cycle (recheck)` | null | unknown | "2025 cycle (recheck)" | false |
    | `--` | null | unknown | null | false |

    KEY ASSERTIONS: `parseDeadline('2025-12-30 (passed)').isPassed === true` is the ONLY isPassed:true; `parseDeadline('2027-02-18 (2026 cycle passed)').isPassed === false` (Open Q1). No test may pass a whole raw string to `new Date`.
  </behavior>
  <action>
    Implement `tools/normalize/deadline.mjs` exporting pure `parseDeadline(raw)` → `{ raw, date, cadence, note, isPassed }`. Derivation:
      1. Trim. `--` or empty → `{ date:null, cadence:'unknown', note:null, isPassed:false }`.
      2. Match a LEADING `^(\d{4}-\d{2}-\d{2})` → `date` (regex first — NEVER `new Date(wholeString)`).
      3. `isPassed = /\(passed\)$/.test(trimmed)` — the parenthetical must be EXACTLY `(passed)` (only Hey Helen). '(2026 cycle passed)' does NOT match.
      4. Cadence: isPassed → `passed`; else leading ISO date → `one-time`; else `/rolling|ongoing/i` → `rolling`; `/annual/i` → `annual`; `/invitation/i` → `invitation`; else `unknown`.
      5. note: when a leading date exists, note = the `(...)` parenthetical content (or null). When NO leading date: for pure-keyword strings that map cleanly to a cadence with no extra words (`Annual`, `Rolling`, `Invitation only`, `TBD`) → note=null EXCEPT `Rolling (monthly)`→"monthly", `Rolling (monthly review)`→"monthly review", `Annual relationship`→"relationship"; for `unknown`-cadence descriptive strings the note is the full trimmed raw. Tune `note` to match the table EXACTLY (the table is the spec).
    Keep pure and importable.
  </action>
  <verify>
    <automated>pnpm exec vitest run tools/normalize/deadline.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tools/normalize/deadline.test.mjs` exits 0 with 20+ passing cases
    - `node -e "import('./tools/normalize/deadline.mjs').then(m=>{const a=m.parseDeadline('2025-12-30 (passed)'),b=m.parseDeadline('2027-02-18 (2026 cycle passed)');process.exit(a.isPassed===true&&a.date==='2025-12-30'&&b.isPassed===false&&b.date==='2027-02-18'?0:1)})"` exits 0
    - `node -e "import('./tools/normalize/deadline.mjs').then(m=>{const a=m.parseDeadline('2026-06-30 (decision by Oct 31)');process.exit(a.date==='2026-06-30'&&a.cadence==='one-time'&&a.note==='decision by Oct 31'?0:1)})"` exits 0
    - `node -e "import('./tools/normalize/deadline.mjs').then(m=>{const a=m.parseDeadline('--');process.exit(a.date===null&&a.cadence==='unknown'&&a.note===null?0:1)})"` exits 0
    - `! grep -q "new Date(" tools/normalize/deadline.mjs` (no blind Date construction on raw strings — exits non-zero if the forbidden string is present)
  </acceptance_criteria>
  <done>parseDeadline satisfies all 20 literal-string cases; only '(passed)' → isPassed; leading-ISO extracted by regex; vitest green.</done>
</task>

</tasks>

<verification>
- `pnpm exec vitest run tools/normalize` — all amount + deadline cases green.
- `node -e "import('./tools/schema.mjs')..."` — schema loads, zod v4 `z.url()` present.
- `data/__fixtures__/grants.bad.csv` exists with 28 rows and one `not-a-url` Link (fixture for 02-04).
- No three/threlte/gsap/layerchart added to package.json.
</verification>

<success_criteria>
- DATA-02: parseAmount → typed struct for all 18 literal amount strings; TBD/Large/Equity → null numbers (never 0).
- DATA-03: parseDeadline → typed struct for all 20 literal deadline strings; only `(passed)` yields isPassed; no blind `new Date`.
- Canonical `Grant` type (types.ts) + zod mirror (schema.mjs) exist as the shared contract for 02-02/02-04.
- vitest node config + 28-row bad-CSV fixture in place for downstream plans.
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-pipeline-custom-tools/02-01-SUMMARY.md`
</output>
