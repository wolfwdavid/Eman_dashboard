# Phase 2: Data Pipeline + Custom Tools - Research

**Researched:** 2026-07-04
**Domain:** Build-time CSV→typed-JSON ingest, string normalizers (amount/deadline/status/501c3), zod build-gate, build-time QR SVG generation
**Confidence:** HIGH (every rule is grounded in the literal 28-row `data/grants.csv`; versions verified against npm registry today)

## Summary

This phase turns the messy 28-row `data/grants.csv` into one validated, typed, inlined dataset the app compiles against — plus generates QR SVGs — and installs a zod gate that fails `pnpm build` on bad data. **Parser correctness IS the product:** a silent Amount or Deadline mis-parse corrupts the headline "secured vs. potential" story every downstream Crystarium/HUD feature binds to. The single highest-leverage work is a set of pure, importable normalizers unit-tested against every literal string in the CSV.

Three custom Node ESM tools live in `tools/` (mirroring the existing `tools/verify-build.mjs` style): an ingest+normalize tool, a zod validator (the build gate), and a QR generator. They emit `src/lib/data/grants.generated.json` + a `Grant` type and `src/lib/data/qr.generated.js` — imported directly by Svelte (no runtime fetch, no `static/` file, no loading state). papaparse handles RFC-4180 tokenizing (quoted commas); all *semantics* are hand-rolled custom logic; zod validates the transformed records.

**Primary recommendation:** Build the normalizers as pure `.mjs` functions returning **typed structs (never bare numbers, never coerce TBD→0)**, test each against all 28 literal strings first, then wire ingest→validate→emit into an **explicitly chained** `build` script (do NOT rely on pnpm's `prebuild` lifecycle — see Pitfall 6). Assert `securedTotal === 20000` and the potential-exclusion rules in a dedicated aggregates test.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Normalized data schema** (canonical: `.planning/research/ARCHITECTURE.md`):
- One typed `Grant` record per CSV row with (at minimum): `id` (stable slug from funder name), `funder`, `program`, `type` (Grant | Grant/Fellowship | Investment), `amount` object `{ raw, min, max, avg, isReceived, isTBD, isEquity }`, `deadline` object `{ raw, date (ISO|null), cadence (rolling|annual|invitation|one-time|passed|unknown), note, isPassed }`, `requires501c3` (tri-state: 'yes' | 'no' | 'unknown'), `fit`, `status` (enum), `nextAction`, `link`.
- **Status enum** (normalize raw strings to a fixed set): `active`, `in-progress`, `to-research`, `recurring`, `applied`, `declined`, `not-eligible`, `not-eligible-yet`. Keep the human label too.
- **Amount parsing** must handle: `"$5,000-$20,000 (avg $10,000)"` (min/max/avg), `"$20,000 (received 2025)"` (isReceived + amount), `"TBD"`/`"Micro (amount TBD)"` (isTBD, numbers null — NOT 0), `"$100,000+"` (min only), `"Large"`/`"Micro"` (qualitative → isTBD), equity row 37 Angels (`isEquity`). **NEVER coerce TBD to 0.**
- **Deadline parsing** must handle: `"2026-06-30 (decision by Oct 31)"` (date + note), `"Rolling (monthly)"` (cadence=rolling), `"Invitation only"` (cadence=invitation, no date), `"Annual"`, `"2025-12-30 (passed)"` (isPassed=true), `"Check 2026 cycle..."` (unknown). `new Date()` must not be called blindly.
- **Derived aggregates** (computed in the tool or a selector, unit-tested): `securedTotal` = sum of `isReceived` amounts (exactly $20,000 = NY Community Trust). `potentialTotal` = sum of parseable amounts EXCLUDING `declined`, `not-eligible`, `not-eligible-yet` statuses AND EXCLUDING the equity (37 Angels) row. Count-by-status. 501c3-gated vs open counts.

**Custom tools** (user explicitly requested building custom tools):
- `tools/ingest-grants.mjs` — reads `data/grants.csv` (papaparse for quoted-comma tokenizing + BOM strip + drop empty trailing row), applies amount/deadline/status/501c3 normalizers, emits typed JSON + a `.d.ts`/JSDoc typedef to `src/lib/data/grants.generated.json` (+ types).
- `tools/validate-grants.mjs` (or zod inside ingest) — schema/enum/URL/ISO-date validation; **exits non-zero (fails the build)** on any malformed row, with a row-level error message. Wire into a `prebuild` npm script so `pnpm build` runs it.
- `tools/generate-qr.mjs` — reads a single config module `src/lib/config/sites.js` holding the TWO site URLs (clearly-labeled PLACEHOLDER absolute external URLs), generates QR codes as inline SVG (build-time, absolute external URLs — NOT routed through app `base`). Emits to `src/lib/data/qr.generated.*`.
- Normalizers should be pure, importable functions with **vitest unit tests** covering every literal Amount/Deadline string in the actual 28-row CSV.

### Claude's Discretion
- Exact file/dir names within the above scheme, JS-vs-TS-typedef style, whether validation is a separate script or zod inside ingest, the slug algorithm, and the QR SVG styling. All at Claude's discretion — follow ARCHITECTURE.md where it is specific.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope. (Rendering the data, QR panel UI, and charts are Phase 3/4. No 3D, no UI, no runtime data fetching this phase.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **DATA-01** | CSV→typed JSON ingest tool | `tools/ingest-grants.mjs` — papaparse tokenize + BOM strip + greedy-empty-line skip + row-count assert; emits `src/lib/data/grants.generated.json` + `types.ts`. See "Tool 1" + "CSV structural handling". |
| **DATA-02** | Amount normalizer → typed struct, never bare number | `parseAmount(raw)` full rule table over all 18 distinct amount shapes → `{ raw, min, max, avg, isReceived, isTBD, isEquity, isMicro }`. TBD/qualitative → numbers `null`, never 0. |
| **DATA-03** | Deadline normalizer → typed struct | `parseDeadline(raw)` full rule table over all 20 distinct deadline shapes → `{ raw, date, cadence, note, isPassed }`. Extract leading ISO date via regex FIRST, never `new Date(wholeString)`. |
| **DATA-04** | Status enum + 501c3 tri-state | `parseStatus` (8 raw → 8 enum + label) and `parse501c3` (4 shapes → `yes`/`no`/`unknown` + raw kept). Exact maps below. |
| **DATA-05** | Validator fails build on malformed row | `tools/validate-grants.mjs` zod schema; `safeParse` per record; print row + issues + `process.exit(1)`. Wired into an explicitly-chained `build`. See "Tool 3" + "Build wiring". |
| **DATA-06** | QR generator from config module, build-time, absolute external URLs | `tools/generate-qr.mjs` reads `src/lib/config/sites.js` (2 PLACEHOLDER `https://` URLs), `QRCode.toString(url,{type:'svg'})`, emits `src/lib/data/qr.generated.js`. URLs bypass app `base`. See "Tool 2" + Pitfall 5. |
</phase_requirements>

## Standard Stack

### Add this phase (only these three + their types are permitted)
| Library | Version (verified 2026-07-04) | Purpose | Why Standard |
|---------|-------------------------------|---------|--------------|
| `papaparse` | **5.5.4** | RFC-4180 CSV tokenizing (quoted commas, quotes, parentheticals) | The de-facto CSV parser; hand-rolled `split(',')` shreds 10+ quoted-comma rows here. Use ONLY for tokenizing — never for semantics. |
| `zod` | **4.4.3** | Validate normalized records at build; enum/URL/ISO gate | Single source of truth for record shape; `safeParse` gives row-level errors to fail the build. |
| `qrcode` | **1.5.4** | Build-time SVG QR generation | `QRCode.toString(url,{type:'svg'})` → crisp inline SVG, zero client JS, prerenders cleanly. |
| `@types/papaparse` | **5.5.2** (dev) | Types | For JSDoc/TS in tools. |
| `@types/qrcode` | **1.5.6** (dev) | Types | For JSDoc/TS in tools. |

`vitest@4.1.9` is already installed (devDependency). `zod` ships its own types.

**Installation:**
```bash
pnpm add -D papaparse@5.5.4 zod@4.4.3 qrcode@1.5.4 @types/papaparse@5.5.2 @types/qrcode@1.5.6
```
(All build-time only → `-D`. Do NOT add three/threlte/gsap/layerchart this phase.)

**⚠ zod 4 API note (training data likely assumes v3):** In zod **4**, URL validation is the top-level `z.url()` (the chained `z.string().url()` is deprecated). Errors are on `result.error.issues` (array of `{ path, message }`). Use `z.enum([...])`, `z.iso.date()` (zod 4 has `z.iso.date()` for `YYYY-MM-DD`) or a `.regex(/^\d{4}-\d{2}-\d{2}$/)` fallback. Verify the exact helper names against installed zod at implementation time — do not assume v3 idioms.

## Architecture Patterns

### Recommended file layout (extends the ARCHITECTURE.md scheme)
```
data/
  grants.csv                         # SOURCE OF TRUTH (28 rows) — unchanged
  __fixtures__/grants.bad.csv        # malformed row for the build-gate integration test
tools/
  ingest-grants.mjs                  # orchestrator: read CSV → normalize → validate → emit JSON + types
  generate-qr.mjs                    # sites.js → src/lib/data/qr.generated.js
  normalize/
    amount.mjs        + amount.test.mjs
    deadline.mjs      + deadline.test.mjs
    status.mjs        + status.test.mjs      # status + 501c3
    slug.mjs
  schema.mjs                         # zod schema = single source of truth for record shape
  aggregates.mjs    + aggregates.test.mjs    # securedTotal / potentialTotal / counts (pure)
  validate.test.mjs                  # unit: validator throws on bad enum/URL; integration: spawn on bad CSV → exit 1
src/lib/
  config/sites.js                    # the TWO QR URLs (PLACEHOLDER absolute https://) — single swap point
  data/
    grants.generated.json            # emitted dataset (committed; commit_docs=true)
    qr.generated.js                  # emitted { id,label,url,svg }[]
    types.ts                         # canonical Grant interface + enums (mirrors schema.mjs)
    index.ts                         # barrel: typed export of grants + qr + selectors
vitest.config.ts                     # NEW (Wave 0) — node env, includes tools/**/*.test.mjs
```

### Pattern 1: Normalizers return typed structs, never bare values
**What:** each `parseX(raw)` returns an object with explicit flags; numbers are `number | null` (never `0` for "unknown").
**Why:** coercing `"TBD"`/`"Large"`/`"Equity investment"` to `0` silently corrupts totals (Pitfall 2). `null` + a flag lets aggregates *exclude* rather than *understate*.

### Pattern 2: Build-time baking, imported not fetched
**What:** emit into `src/lib/data/` and `import` it; never put data in `static/` and `fetch()` it.
**Why:** inlined, tree-shaken, typed, zero loading state — exactly what a prerendered static site wants. Components (Phase 3/4) do `import { grants } from '$lib/data'`.

### Pattern 3: papaparse tokenizes, custom code owns semantics
**What:** `Papa.parse` only splits rows/fields correctly; every amount/deadline/status meaning is hand-rolled.
**Why:** the "custom tooling" directive means the *normalization* layer, NOT re-implementing CSV quoting (which is a solved problem — see Don't Hand-Roll).

### Anti-Patterns to Avoid
- **`new Date("2026-06-30 (decision by Oct 31)")`** → `Invalid Date`. Extract the leading `YYYY-MM-DD` with a regex first, classify the remainder as `note`.
- **`Number(cell.replace('$',''))`** → `5` for `"$5,000-$20,000"`. Strip `$`/`,` only inside a matched `\$?[\d,]+` token, parse each range side separately.
- **Coercing unparseable amounts to `0`** → silently wrong headline totals. Use `null` + `isTBD`/`isEquity`.
- **Prefixing QR target URLs with `base`** → QR encodes the dashboard itself, not the external site. QR targets are absolute `https://`, bypass `base` entirely (Pitfall 5).
- **`ssr = false` / touching the app** — out of scope; this phase is pure build-time data. Do not modify routes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV tokenizing (quoted commas, quotes, embedded `;`) | `line.split(',')` | `papaparse` `Papa.parse(text,{header:true, skipEmptyLines:'greedy'})` | 10+ rows have commas inside quotes (`"$5,000-$20,000 (avg $10,000)"`, long Fit prose, `"Opens ~Oct 31-Nov 30; awards Dec"`) — naive split shifts every column. |
| Record shape / enum / URL validation | Hand `if` checks scattered in the tool | `zod` schema + `safeParse` | One source of truth, structured row-level errors, and a clean `process.exit(1)` gate. |
| QR matrix / SVG path math | Reed-Solomon + module placement | `qrcode` `toString(url,{type:'svg'})` | QR spec is deceptively complex (error-correction, masking); the lib is battle-tested and SSR-free. |

**Key insight:** "custom tools" here = the **amount/deadline/status/501c3 semantics** and the **build-gate orchestration**, which are genuinely bespoke to this dataset. CSV quoting, schema validation, and QR encoding are solved — wrapping solved problems in hand-rolled code is where this phase would go wrong.

## The Grant Type (canonical, DATA-01)

Define once in `src/lib/data/types.ts`, mirrored by the zod schema in `tools/schema.mjs`. Nested `amount`/`deadline` objects per CONTEXT.

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
  avg: number | null;       // explicit "(avg $X)"; else midpoint of a full range; else null
  isReceived: boolean;      // "(received 2025)" → banked, routes to securedTotal
  isTBD: boolean;           // no numeric amount (TBD / Large / Fellowship support / Micro-only)
  isEquity: boolean;        // 37 Angels — excluded from all grant sums
  isMicro: boolean;         // "micro" / "Micro" flag (discretionary extra)
}

export interface GrantDeadline {
  raw: string;
  date: string | null;      // ISO "YYYY-MM-DD" when a concrete leading date exists
  cadence: Cadence;
  note: string | null;      // parenthetical / window / recheck text preserved verbatim
  isPassed: boolean;        // literal "(passed)" marker — clock-independent (see Open Q1)
}

export interface Grant {
  id: string;               // slug of the full "Funder / Program" cell (unique)
  funder: string;
  program: string | null;   // text after first " - " in the cell, else null
  type: GrantType;
  amount: GrantAmount;
  deadline: GrantDeadline;
  requires501c3: Requires501c3;
  requires501c3Raw: string; // raw kept so a future 4-bucket chart can recover "Likely"/"fiscal sponsor"
  fit: string;
  status: GrantStatus;
  statusLabel: string;      // human label kept ("Active funder", "Not eligible (yet)")
  nextAction: string | null;// "--" → null
  link: string;             // validated http(s) URL
}
```

**Export path so components need no runtime fetch** — `src/lib/data/index.ts`:
```typescript
import raw from './grants.generated.json';
import type { Grant } from './types';
export const grants = raw as Grant[];
export * from './types';
export { qrCodes } from './qr.generated.js';
// optional: re-export selectors from ./aggregates
```
Components: `import { grants } from '$lib/data'`. JSON import is inlined by Vite (SvelteKit enables `resolveJsonModule`). `commit_docs=true` → commit the generated JSON so diffs are inspectable.

## parseAmount — full rule table (DATA-02)

Every **distinct amount shape** in the 28 rows (raw string → struct). `min/max/avg` are `null` unless shown. All keep `raw`.

| # | Literal `Amount` string (rows using it) | min | max | avg | isReceived | isTBD | isEquity | isMicro |
|---|------------------------------------------|-----|-----|-----|-----------|-------|----------|---------|
| 1 | `$20,000 (received 2025)` (NY Community Trust) | 20000 | 20000 | 20000 | **true** | false | false | false |
| 2 | `$5,000-$20,000 (avg $10,000)` (Harry S. Black) | 5000 | 20000 | **10000** (explicit) | false | false | false | false |
| 3 | `~$50,000-$200,000` (Ford JustFilms) | 50000 | 200000 | **125000** (midpoint) | false | false | false | false |
| 4 | `$100,000+` (Ford NYC) | 100000 | **null** | null | false | false | false | false |
| 5 | `Up to $30,000 (avg $20,000)` (Ben & Jerry's) | **null** | 30000 | **20000** (explicit) | false | false | false | false |
| 6 | `$5,000-$35,000 (2-year)` (Third Wave) | 5000 | 35000 | **20000** (midpoint) | false | false | false | false |
| 7 | `$1,000` (Awesome Foundation) | 1000 | 1000 | 1000 | false | false | false | false |
| 8 | `Micro (amount TBD)` (Matriarch) | null | null | null | false | **true** | false | **true** |
| 9 | `$500 (micro)` (Giving Joy) | 500 | 500 | 500 | false | false | false | **true** |
| 10 | `Up to $10,000 (community); $1,000/youth project` (NYC Office) | null | **10000** | 10000 | false | false | false | false |
| 11 | `Up to $10,000` (NYC Commission) | null | 10000 | 10000 | false | false | false | false |
| 12 | `$2,000-$6,000` (Just Thrive) | 2000 | 6000 | **4000** (midpoint) | false | false | false | false |
| 13 | `TBD (includes AI access)` (Brava) | null | null | null | false | **true** | false | false |
| 14 | `$10,000` (Hey Helen) | 10000 | 10000 | 10000 | false | false | false | false |
| 15 | `Fellowship support` (Echoing Green) | null | null | null | false | **true** | false | false |
| 16 | `TBD` (TGR, Tisch, Kellogg, BofA Charitable, Wells Fargo, CEK, Milbank, Borealis, SNF, TD Bank, Truist) | null | null | null | false | **true** | false | false |
| 17 | `Large` (Yield Giving) | null | null | null | false | **true** | false | false |
| 18 | `Equity investment` (37 Angels) | null | null | null | false | true | **true** | false |

**Derivation rules the parser implements (deterministic):**
1. Extract all `\$\s?[\d,]+` tokens; strip `$` and `,`, parse to number.
2. `(received ...)` present → `isReceived=true`, single figure → min=max=avg.
3. `(avg $X)` present → `avg` = that explicit value (overrides midpoint).
4. Range `A-B` (two figures, no explicit avg) → min=A, max=B, avg = round((A+B)/2).
5. `Up to $X` / max-only (one figure, no min) → max=X, min=null, avg=X (used as the single estimate).
6. `+` suffix (`$100,000+`) → min=X, max=null, avg=null (open-ended, no upper estimate).
7. Zero numeric tokens (`TBD`, `Large`, `Fellowship support`, `Micro (amount TBD)`, `Equity investment`) → all numbers `null`, `isTBD=true`. `Equity investment` also `isEquity=true`. `micro`/`Micro` (case-insensitive) → `isMicro=true`.
8. **Never return `0` for a missing number.** `0` is a valid grant amount would be wrong here — absence is `null`.

## parseDeadline — full rule table (DATA-03)

Every **distinct deadline shape** (raw → struct). `date` = leading ISO only; everything else → `note`. Cadence uses the CONTEXT-locked 6-value enum; window/open/reapply/cycle strings funnel to `unknown` with the text preserved in `note`.

| # | Literal `Deadline` string (rows) | date (ISO) | cadence | note | isPassed |
|---|----------------------------------|-----------|---------|------|----------|
| 1 | `Annual relationship` (NY Community Trust) | null | `annual` | "relationship" | false |
| 2 | `2026-06-30 (decision by Oct 31)` (Harry S. Black) | `2026-06-30` | `one-time` | "decision by Oct 31" | false |
| 3 | `2026-09-01` (Ford JustFilms) | `2026-09-01` | `one-time` | null | false |
| 4 | `Check 2026 cycle (awards Dec-Feb)` (Ford NYC) | null | `unknown` | "Check 2026 cycle (awards Dec-Feb)" | false |
| 5 | `2027-02-18 (2026 cycle passed)` (Ben & Jerry's) | `2027-02-18` | `one-time` | "2026 cycle passed" | **false** (see Open Q1) |
| 6 | `Invitation only` (Third Wave) | null | `invitation` | null | false |
| 7 | `Rolling (monthly)` (Awesome) | null | `rolling` | "monthly" | false |
| 8 | `Rolling (monthly review)` (Matriarch) | null | `rolling` | "monthly review" | false |
| 9 | `Cycle open (2026)` (Giving Joy) | null | `unknown` | "Cycle open (2026)" | false |
| 10 | `Opens ~Oct 31-Nov 30; awards Dec` (NYC Office) | null | `unknown` | "Opens ~Oct 31-Nov 30; awards Dec" | false |
| 11 | `Opens ~Oct 2026` (NYC Commission) | null | `unknown` | "Opens ~Oct 2026" | false |
| 12 | `Ongoing (recheck 2026-03-01)` (Just Thrive) | null | `rolling` | "recheck 2026-03-01" (embedded date preserved) | false |
| 13 | `Reapply Jan 2026` (Brava) | null | `unknown` | "Reapply Jan 2026" | false |
| 14 | `2025-12-30 (passed)` (Hey Helen) | `2025-12-30` | `passed` | "passed" | **true** |
| 15 | `Annual` (Echoing Green) | null | `annual` | null | false |
| 16 | `TBD` (TGR, Tisch, BofA Charitable, Wells Fargo, CEK, Milbank) | null | `unknown` | null | false |
| 17 | `Rolling` (Kellogg, SNF, 37 Angels) | null | `rolling` | null | false |
| 18 | `Open calls` (Yield Giving) | null | `unknown` | "Open calls" | false |
| 19 | `2025 cycle (recheck)` (Borealis) | null | `unknown` | "2025 cycle (recheck)" | false |
| 20 | `--` (TD Bank, Truist) | null | `unknown` | null | false |

**Derivation rules:**
1. Trim. `--` or empty → `{ date:null, cadence:'unknown', note:null, isPassed:false }`.
2. Match a **leading** `^\d{4}-\d{2}-\d{2}` → `date`. The remainder inside `(...)` → `note`.
3. `isPassed = /\(passed\)$/.test(trimmedRaw)` — i.e. the parenthetical is *exactly* `(passed)`. Only Hey Helen matches. (Clock-independent → deterministic tests. See Open Q1 for why `(2026 cycle passed)` is NOT isPassed.)
4. Cadence keyword scan on the remainder: contains `passed` (exact) → `passed`; `Rolling`/`Ongoing` → `rolling`; `Annual` → `annual`; `Invitation` → `invitation`; a leading ISO date → `one-time`; otherwise → `unknown`.
5. Extract any embedded `\d{4}-\d{2}-\d{2}` in a `recheck`/`Ongoing` note into `note` (optionally a discretionary `recheckDate` field — allowed by Claude's Discretion).

## parseStatus — 8 raw → enum (DATA-04)

| Raw `Status` string | enum `status` | `statusLabel` (kept) | count |
|---------------------|---------------|----------------------|-------|
| `Active funder` | `active` | "Active funder" | 1 |
| `In progress` | `in-progress` | "In progress" | 3 |
| `To research` | `to-research` | "To research" | 17 |
| `Recurring` | `recurring` | "Recurring" | 2 |
| `Applied` | `applied` | "Applied" | 1 |
| `Declined` | `declined` | "Declined" | 1 |
| `Not eligible` | `not-eligible` | "Not eligible" | 1 |
| `Not eligible (yet)` | `not-eligible-yet` | "Not eligible (yet)" | 2 |

Match `Not eligible (yet)` **before** `Not eligible` (substring order matters). Total = 28. Any unmapped status must **fail the build** (do not default to a fallback enum).

## parse501c3 — string → tri-state (DATA-04)

Locked tri-state `'yes' | 'no' | 'unknown'`. Keep `requires501c3Raw`.

| Raw `501(c)(3) Required` string (rows) | tri-state | count |
|----------------------------------------|-----------|-------|
| `No - they are 501(c)(3); potential fiscal sponsor` (NYCT) | `no` | 1 |
| `No` (Third Wave, Awesome, Matriarch, Giving Joy, NYC Office, NYC Commission, Just Thrive, Hey Helen, Echoing Green) | `no` | 9 |
| `No (intermediary funder)` (Borealis) | `no` | 1 |
| `Yes - or fiscal sponsor` (Harry Black, Ford×2, Ben & Jerry's) | `yes` | 4 |
| `Yes (required)` (TD Bank) | `yes` | 1 |
| `Likely yes` (BofA Charitable, Wells Fargo, SNF) | **`yes`** (see Open Q2) | 3 |
| `Unknown` (Brava, TGR, Tisch, Kellogg, Yield, CEK, Milbank, Truist) | `unknown` | 8 |

**Rule:** `/^no\b/i → no` (11); `/^yes\b/i` or contains `(required)` or `or fiscal sponsor` → `yes`; `/^likely/i → yes` (conservative — treat likely-gated as gated for the "pursuable while 501c3-pending" filter); `/^unknown/i` or empty → `unknown`. Tri-state split → **no: 11, yes: 8, unknown: 8** (raw 4-bucket for a future chart: No 12 · Yes 5 · Likely 3 · Unknown 8 — recoverable from `requires501c3Raw`).

> Note: `no` = 11 here vs FEATURES' "No 12" because NYCT's `No - they are 501(c)(3)…` and Borealis' `No (intermediary funder)` are both `no` (11 rows total start with "No"). FEATURES counted 12 "No" — recount: rows with a "No…" string = NYCT, Third Wave, Awesome, Matriarch, Giving Joy, NYC Office, NYC Commission, Just Thrive, Hey Helen, Echoing Green, Borealis = **11**. FEATURES' "12" double-counts; the CSV yields **11 `no` / 5 strict-yes / 3 likely / 8 unknown = 27**… (see Open Q3 — reconcile the count before asserting).

## Custom Tools

### Tool 1 — Ingest + Normalize (`tools/ingest-grants.mjs`, DATA-01)
- Read `data/grants.csv` as UTF-8; **strip BOM**: `text = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text`.
- `Papa.parse(text, { header: true, skipEmptyLines: 'greedy' })` — `greedy` drops the trailing empty/whitespace row. Optionally `transformHeader: h => h.trim()`.
- **Assert `data.length === 28`** after parse → else `process.exit(1)` (catches ghost row / shredded columns, Pitfall from PITFALLS #11).
- For each row: trim every field; `--`/`""` → `null`; split `Funder / Program` on first ` - ` → `funder`/`program`; slug the **full cell** for `id` (guarantees uniqueness for the two Ford + BofA rows); map `Type` (`Investment (not grant)` → `Investment`); run `parseAmount`/`parseDeadline`/`parseStatus`/`parse501c3`.
- Hand records to the zod validator; on success emit `src/lib/data/grants.generated.json` (pretty-printed) and ensure `types.ts` exists. Optionally compute aggregates into the emit or leave them to `aggregates.mjs` selectors (recommend selectors, imported by both tool tests and app).

**Slug algorithm (recommended):** `cell.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')`. E.g. `Ford Foundation - JustFilms Documentary Production` → `ford-foundation-justfilms-documentary-production`; `37 Angels` → `37-angels`. Validator asserts no duplicate `id`.

### Tool 2 — QR Generator (`tools/generate-qr.mjs`, DATA-06)
- `src/lib/config/sites.js` (the single swap point):
  ```js
  // PLACEHOLDER absolute external URLs — swap when finalized, then re-run build. No code change.
  export const sites = [
    { id: 'main',    label: 'Visit DID',          url: 'https://diversityincludesdisability.org' },
    { id: 'support', label: 'Support / Tracker',  url: 'https://diversityincludesdisability.org/support' }
  ];
  ```
- For each site: `const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })`.
- **Validate each `url.startsWith('http')`** → else `process.exit(1)` (Pitfall 5: a relative/base-prefixed target is a build failure).
- Emit `src/lib/data/qr.generated.js`: `export const qrCodes = [{ id, label, url, svg }, …]`.
- **Why QR bypasses `base`:** the QR encodes the *external destination* (`https://…`), not an internal app route — prefixing `base` (`/Eman_dashboard/…`) would make scans open the dashboard/404. The emitted SVG is inlined into the bundle (not a fetched `static/` asset), so app `base` is irrelevant to it. Keep QR entirely out of the funder-node data.

### Tool 3 — Validator / Build Gate (`tools/schema.mjs` + validation, DATA-05)
- zod schema mirrors the `Grant` type: `status`/`type`/`cadence`/`requires501c3` as `z.enum`; `link` as `z.url()` (zod 4); `deadline.date` as `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()`; amount numbers `z.number().nullable()`; `id` non-empty.
- Per record `schema.safeParse(record)`; collect failures with row index + funder + `result.error.issues`. If any failure: print all, then `process.exit(1)`.
- Also assert **no duplicate `id`** and **record count 28**.
- **This is what fails `pnpm build`** — the ingest tool runs before `vite build`.

### Build wiring (package.json) — ⚠ do NOT trust pnpm `prebuild`
CONTEXT mentions a `prebuild` hook, but **pnpm does not run `pre`/`post` lifecycle scripts by default** (`enable-pre-post-scripts` is off unless set). Use an **explicit chained build** so the gate always runs:
```jsonc
{
  "scripts": {
    "build:data": "node tools/ingest-grants.mjs",     // read → normalize → validate → emit JSON
    "build:qr":   "node tools/generate-qr.mjs",        // sites.js → qr.generated.js
    "build":      "pnpm build:data && pnpm build:qr && vite build",
    "dev":        "pnpm build:data && pnpm build:qr && vite dev",
    "test:unit":  "vitest run"
  }
}
```
`&&` short-circuits: a non-zero exit from `build:data` (bad CSV) aborts before `vite build` → `pnpm build` exits non-zero. (Alternative: add `.npmrc` `enable-pre-post-scripts=true` and keep a `prebuild` — but explicit chaining is unambiguous and the recommended path.)

## Derived Aggregates (where they live + exact numbers)

Put in `tools/aggregates.mjs` as **pure selectors** over `Grant[]`, imported by both the tool tests and (later) the app HUD — not baked as magic numbers into the JSON. (Emitting a small `summary` block into the JSON is optional/discretionary; the selectors are the source of truth so the app can recompute under filters in Phase 4.)

| Aggregate | Rule | Expected value |
|-----------|------|----------------|
| `securedTotal` | Σ `amount.avg` (or the single figure) where `amount.isReceived` | **20000** (NY Community Trust only) — **hard assert** |
| `potentialTotal` | Σ estimate over rows that are: **not** `isReceived`, **not** `isEquity`, status ∉ {declined, not-eligible, not-eligible-yet}, and have a numeric estimate | **296500** with the basis below (contingent — see note) |
| `countByStatus` | group by `status` | to-research 17 · in-progress 3 · recurring 2 · not-eligible-yet 2 · active 1 · applied 1 · declined 1 · not-eligible 1 |
| `by501c3` (tri-state) | group by `requires501c3` | no 11 · yes 8 · unknown 8 (reconcile per Open Q3 before asserting) |
| `unknownAmountCount` | live, non-equity, all-null numbers | 13 (informational) |

**potentialTotal basis (deterministic):** estimate = `avg` if non-null; else `max` if non-null; else `min`. The **9 contributing rows**:

| Funder | estimate |
|--------|----------|
| Harry S. Black (avg) | 10000 |
| Ford JustFilms (midpoint) | 125000 |
| Ford NYC (`$100,000+` → min) | 100000 |
| Ben & Jerry's (avg) | 20000 |
| Third Wave (midpoint) | 20000 |
| Awesome Foundation | 1000 |
| Giving Joy | 500 |
| NYC Office (`Up to $10,000` → max) | 10000 |
| NYC Commission (`Up to $10,000` → max) | 10000 |
| **Total** | **296500** |

**Explicitly EXCLUDED from potentialTotal** (the exclusions the tests must prove): NY Community Trust $20,000 (`isReceived` → secured, not potential — avoids the double-count in Pitfall 10); Hey Helen $10,000 (`declined`); Just Thrive $2,000–$6,000 (`not-eligible-yet`); TD Bank & Truist (`not-eligible-yet`/`not-eligible`, TBD anyway); 37 Angels (`isEquity`); all `isTBD` rows (no numeric estimate).

> `potentialTotal === 296500` is **basis-dependent** (change midpoint↔max↔min and it moves). CONTEXT firmly locks only `securedTotal === 20000` and the *exclusion rules* — assert those two things hard. Assert `potentialTotal` against whatever the implemented basis yields (recommend 296500 with the basis above), and add explicit assertions that Hey Helen's 10000, TD/Truist, and 37 Angels are **absent** from the sum. FEATURES' "~$300K–$400K+" is consistent with 296500.

## Common Pitfalls (this phase OWNS these)

### Pitfall 1: Amount parsing silently corrupts totals (PITFALLS #8)
**Wrong:** `Number(cell.replace('$',''))` → `5` for `"$5,000-$20,000"`; TBD→`0`; received $20k lands in "potential".
**Avoid:** typed struct; strip `$`/`,` only inside a matched token; `null` (not 0) for unknown; `isReceived` routes to secured. **Warning sign:** "secured" ≠ exactly $20,000; totals change when rows are reordered.

### Pitfall 2: Deadline `new Date(wholeString)` → Invalid Date / everything urgent (PITFALLS #9)
**Wrong:** feed `"2026-06-30 (decision by Oct 31)"` to `Date` → Invalid; default to now → all urgent; passed dates → "0 days = max urgency".
**Avoid:** regex the leading ISO first; `isPassed` for the literal `(passed)`; non-fixed cadences map to neutral. **Warning sign:** Hey Helen (declined, passed) reads as most-urgent.

### Pitfall 3: Totals double-count / mix equity / count ineligible (PITFALLS #10)
**Avoid:** partition by `isReceived` / status / `isEquity` by RULE, in the transform, not the view. **Warning sign:** total jumps when 37 Angels is included; potential includes Truist/TD/Hey Helen.

### Pitfall 4: CSV structural traps — quoted commas, `--`, trailing row, BOM (PITFALLS #11)
**Avoid:** papaparse (`header:true`, `skipEmptyLines:'greedy'`); strip a leading BOM (U+FEFF); `--`/`""`→null; **assert 28 rows**; trim all fields. **Warning sign:** a Status cell shows a fragment of an Amount (columns shifted); 29 nodes; first-column key lookup returns `undefined` (BOM).

### Pitfall 5: QR baked with base-relative / wrong URLs (PITFALLS #13)
**Avoid:** absolute `https://` from `sites.js`; never prefix `base`; validate `startsWith('http')` at build. **Warning sign:** scanning a QR opens the dashboard or a 404; target contains `/Eman_dashboard/`.

### Pitfall 6: pnpm skips `prebuild`
**Avoid:** explicit chained `build` script with `&&` (above). **Warning sign:** `vite build` runs but the validator never fired; stale/absent `grants.generated.json`.

### Pitfall 7: zod 4 ≠ zod 3 API
**Avoid:** `z.url()` not `z.string().url()`; errors on `.issues`. Verify helper names against the installed 4.4.3. **Warning sign:** `.url is not a function` / deprecation warnings.

## Code Examples

### Extract-ISO-then-classify (parseDeadline core)
```js
// tools/normalize/deadline.mjs
export function parseDeadline(raw) {
  const s = (raw ?? '').trim();
  if (!s || s === '--') return { raw: s, date: null, cadence: 'unknown', note: null, isPassed: false };
  const dateMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : null;
  const paren = s.match(/\(([^)]*)\)/)?.[1] ?? null;
  const isPassed = /\(passed\)$/.test(s);            // exact "(passed)" only — Hey Helen
  let cadence = 'unknown';
  if (isPassed) cadence = 'passed';
  else if (date) cadence = 'one-time';
  else if (/rolling|ongoing/i.test(s)) cadence = 'rolling';
  else if (/annual/i.test(s)) cadence = 'annual';
  else if (/invitation/i.test(s)) cadence = 'invitation';
  const note = date ? (paren ?? null) : (s.includes(' ') || paren ? (paren ?? s) : null);
  return { raw: s, date, cadence, note, isPassed };
}
```
*(Illustrative — the tests below are the spec; tune `note` derivation to match the rule table exactly.)*

### Build-gate validation (zod 4)
```js
// tools/schema.mjs
import { z } from 'zod';
export const GrantSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['Grant', 'Grant/Fellowship', 'Investment']),
  status: z.enum(['active','in-progress','to-research','recurring','applied','declined','not-eligible','not-eligible-yet']),
  requires501c3: z.enum(['yes','no','unknown']),
  link: z.url(),                                     // zod 4 top-level
  deadline: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), /* … */ }),
  // …amount numbers z.number().nullable(), etc.
});
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `zod` v3 `z.string().url()` | zod **4** `z.url()`, errors on `.issues` | 4.4.3 is current; training-era v3 idioms warn/break |
| npm auto-runs `prebuild` | pnpm gates `pre`/`post` behind `enable-pre-post-scripts` | chain explicitly with `&&` |
| Runtime CSV `fetch` | Build-time bake → `import` inlined JSON | zero loading state; typed; prerender-friendly |

## Open Questions

1. **`isPassed` for `2027-02-18 (2026 cycle passed)`.** The note says a cycle passed, but the primary date (2027-02-18) is future and Ben & Jerry's status is `in-progress` (NextAction: "Prep LOI for next cycle").
   - Recommendation: `isPassed = false` here (string-derived from the *exact* `(passed)` marker → only Hey Helen). Keep `isPassed` **clock-independent** for deterministic tests; compute runtime "expired/urgent" glow separately by comparing `deadline.date` to `Date.now()` in Phase 3. Preserve "2026 cycle passed" in `note`.
2. **`Likely yes` → tri-state.** No `likely` in the locked enum.
   - Recommendation: map `Likely yes → 'yes'` (conservative: treat as gated for the "pursuable while 501c3-pending" filter). Preserve `requires501c3Raw` so Phase 4's 4-bucket chart can split "Likely" back out.
3. **501c3 `no` count: 11 vs FEATURES' 12.** Recounting the CSV, exactly 11 rows start with "No" (NYCT + 9 bare "No" + Borealis "No (intermediary funder)"). FEATURES states 12. 11 no + 5 strict-yes + 3 likely + 8 unknown = 27, not 28 — one row is unaccounted in a naive recount.
   - Recommendation: the planner/impl must **derive** `by501c3` from the parser over all 28 rows and assert the *computed* result (do not hardcode FEATURES' hand-count). Likely resolution: 11 `no`, and the "missing" row is because FEATURES lumped a borderline string differently. The test should snapshot the actual distribution and sum to 28; treat the parser output as truth, then update FEATURES if it disagrees.

## Validation Architecture

`workflow.nyquist_validation` is `true` → this section applies.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest **4.1.9** (already a devDependency) |
| Config file | **none yet — Wave 0 gap** (`vitest.config.ts`, `environment: 'node'`, `include: ['tools/**/*.test.mjs','src/lib/data/**/*.test.ts']`) |
| Quick run command | `pnpm vitest run tools/normalize` |
| Full suite command | `pnpm test:unit` (`vitest run`) |

The normalizers are pure `.mjs` in `tools/` → **node** environment, no Svelte/jsdom needed. A dedicated `vitest.config.ts` keeps tool tests isolated from the SvelteKit vite config.

### Phase Requirements → Test Map
| Req | Behavior | Test type | Automated command | File |
|-----|----------|-----------|-------------------|------|
| DATA-01 | 28 rows parse; BOM stripped; trailing row dropped; ids unique | integration | `pnpm vitest run tools/validate.test.mjs` | ❌ Wave 0 |
| DATA-02 | `parseAmount` over all 18 literal strings → exact struct | unit | `pnpm vitest run tools/normalize/amount.test.mjs` | ❌ Wave 0 |
| DATA-03 | `parseDeadline` over all 20 literal strings → exact struct | unit | `pnpm vitest run tools/normalize/deadline.test.mjs` | ❌ Wave 0 |
| DATA-04 | `parseStatus` (8) + `parse501c3` (7 shapes) → enum/tri-state | unit | `pnpm vitest run tools/normalize/status.test.mjs` | ❌ Wave 0 |
| DATA-05 | validator throws on bad enum/URL; bad-CSV → tool exit 1 | unit+integration | `pnpm vitest run tools/validate.test.mjs` | ❌ Wave 0 |
| DATA-05 | aggregates: `securedTotal===20000`, exclusions hold | unit | `pnpm vitest run tools/aggregates.test.mjs` | ❌ Wave 0 |
| DATA-06 | QR: each `sites` url absolute; non-http → exit 1; SVG emitted | unit+integration | `pnpm vitest run tools/qr.test.mjs` | ❌ Wave 0 |

**All of these are automatable. None are manual-only.**

### Concrete test-case tables

**`amount.test.mjs`** — one case per row in the parseAmount table (18 shapes). Examples:
```
'$5,000-$20,000 (avg $10,000)' → {min:5000,max:20000,avg:10000,isReceived:false,isTBD:false,isEquity:false}
'$20,000 (received 2025)'      → {min:20000,max:20000,avg:20000,isReceived:true,isTBD:false}
'$100,000+'                    → {min:100000,max:null,avg:null}
'Up to $30,000 (avg $20,000)'  → {min:null,max:30000,avg:20000}
'TBD'                          → {min:null,max:null,avg:null,isTBD:true}
'Micro (amount TBD)'           → {min:null,max:null,avg:null,isTBD:true,isMicro:true}
'Equity investment'            → {isEquity:true,isTBD:true,min:null}
'Large'                        → {isTBD:true,min:null}
```
Plus an **anti-assertion**: `parseAmount('TBD').min !== 0` and `!== 0 for max/avg` (guards the coerce-to-0 regression).

**`deadline.test.mjs`** — one case per row in the parseDeadline table (20 shapes). Examples:
```
'2026-06-30 (decision by Oct 31)' → {date:'2026-06-30',cadence:'one-time',note:'decision by Oct 31',isPassed:false}
'Rolling (monthly)'               → {date:null,cadence:'rolling',note:'monthly'}
'Invitation only'                 → {date:null,cadence:'invitation'}
'Annual'                          → {date:null,cadence:'annual'}
'2025-12-30 (passed)'             → {date:'2025-12-30',cadence:'passed',isPassed:true}
'2027-02-18 (2026 cycle passed)'  → {date:'2027-02-18',isPassed:false}   // Open Q1
'Check 2026 cycle (awards Dec-Feb)'→ {date:null,cadence:'unknown'}
'--'                              → {date:null,cadence:'unknown',note:null}
```

**`status.test.mjs`** — 8 status + 7 501c3 shapes:
```
'Not eligible (yet)' → 'not-eligible-yet'   (assert matched BEFORE 'not-eligible')
'Not eligible'       → 'not-eligible'
'Active funder'      → 'active'
'Yes - or fiscal sponsor' → '501c3: yes'
'Likely yes'         → '501c3: yes'          // Open Q2
'No (intermediary funder)' → '501c3: no'
'Unknown'            → '501c3: unknown'
```

**`aggregates.test.mjs`** (over the real generated dataset):
```
securedTotal === 20000                                   // hard
countByStatus == {to-research:17,in-progress:3,recurring:2,not-eligible-yet:2,active:1,applied:1,declined:1,not-eligible:1}
sum(countByStatus) === 28
potentialTotal === 296500                                // basis-dependent (recommended basis)
grants.find(g=>g.funder.includes('Hey Helen')) NOT in potential contributors   // declined excluded
grants.find(g=>g.funder.includes('37 Angels')) NOT in potential contributors   // equity excluded
grants.find(g=>g.funder.includes('Truist')/'TD Bank') NOT in potential         // not-eligible excluded
NYCT not in potential contributors (isReceived → secured only)                  // no double-count
by501c3 sums to 28
```

**`validate.test.mjs`** (the build gate, DATA-05):
```
unit:        GrantSchema.safeParse({...valid, status:'bogus'}).success === false
unit:        GrantSchema.safeParse({...valid, link:'not-a-url'}).success === false
unit:        duplicate id detection throws
integration: spawnSync('node',['tools/ingest-grants.mjs'], {env: BAD_CSV}) .status === 1
             (point the tool at data/__fixtures__/grants.bad.csv — a row with a bad enum/URL)
integration: normal run exits 0 and writes src/lib/data/grants.generated.json with 28 records
```

### Sampling Rate
- **Per task commit:** `pnpm vitest run tools/normalize` (the parser tests — fastest, highest-value).
- **Per wave merge:** `pnpm test:unit` (full unit suite incl. aggregates + validator).
- **Phase gate:** `pnpm test:unit` green AND `pnpm build` succeeds (proves the gate is wired) AND a deliberately-malformed CSV makes `pnpm build:data` exit non-zero, reverting to green.

### Wave 0 Gaps
- [ ] `vitest.config.ts` — node env, include `tools/**/*.test.mjs`
- [ ] `data/__fixtures__/grants.bad.csv` — one row with a bad enum/URL for the build-gate integration test
- [ ] `tools/normalize/amount.test.mjs`, `deadline.test.mjs`, `status.test.mjs` — cover DATA-02/03/04
- [ ] `tools/aggregates.test.mjs` — DATA-05 totals/exclusions
- [ ] `tools/validate.test.mjs` — DATA-01/05 gate (unit + spawn integration)
- [ ] `tools/qr.test.mjs` — DATA-06 (absolute-URL guard + SVG emit)
- [ ] Framework install: `pnpm add -D papaparse@5.5.4 zod@4.4.3 qrcode@1.5.4 @types/papaparse@5.5.2 @types/qrcode@1.5.6` (vitest already present)

## Sources

### Primary (HIGH)
- `data/grants.csv` (28 rows) — every literal Amount/Deadline/Status/501c3 string transcribed into the rule tables above.
- `.planning/research/ARCHITECTURE.md` — canonical schema, tool definitions, parse-rule seed table, build wiring.
- `.planning/research/FEATURES.md` — status/501c3 distributions, secured-vs-potential story.
- `.planning/research/PITFALLS.md` — CSV traps #8/#9/#10/#11/#13 (this phase owns them).
- `.planning/research/STACK.md` + `CLAUDE.md` — papaparse 5.5.4 / zod / qrcode 1.5.4, build-time-bake pattern.
- `tools/verify-build.mjs`, `package.json`, `svelte.config.js` — existing custom-tool style + base-path config.
- npm registry (`npm view`, 2026-07-04): papaparse 5.5.4, zod 4.4.3, qrcode 1.5.4, @types/papaparse 5.5.2, @types/qrcode 1.5.6.

### Secondary (MEDIUM)
- pnpm `enable-pre-post-scripts` behavior (recommend explicit chaining regardless).
- zod 4 API (`z.url()`, `.issues`) — verify against installed 4.4.3 at implementation time.

## Metadata

**Confidence breakdown:**
- Standard stack / versions: HIGH — verified against npm today; only 3 permitted deps.
- Parse rule tables (amount/deadline/status/501c3): HIGH — enumerated directly from the literal CSV.
- Aggregate numbers: HIGH for `securedTotal` (20000) and `countByStatus`; MEDIUM for `potentialTotal` (basis-dependent, 296500 recommended) and `by501c3` (Open Q3 count reconciliation).
- Validation architecture: HIGH — vitest present, tests map 1:1 to literal strings.

**Research date:** 2026-07-04
**Valid until:** ~2026-08-04 (stable; zod 4 minor and pnpm lifecycle behavior are the only fast-moving bits).
