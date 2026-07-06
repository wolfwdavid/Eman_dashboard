# Phase 2: Data Pipeline + Custom Tools - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Purpose-built Node build tools turn the 28-row messy `data/grants.csv` into a validated, typed JSON dataset the app compiles against — plus generate the QR assets — with a zod build gate that fails the build on bad data. This is the foundation contract every downstream UI feature (Crystarium nodes, detail view, pipeline overview, filters) binds to. No 3D, no UI, no runtime data fetching — pure build-time data layer + custom tooling.

</domain>

<decisions>
## Implementation Decisions

### Normalized data schema (canonical: `.planning/research/ARCHITECTURE.md`)
- One typed `Grant` record per CSV row with (at minimum): `id` (stable slug from funder name), `funder`, `program`, `type` (Grant | Grant/Fellowship | Investment), `amount` object `{ raw, min, max, avg, isReceived, isTBD, isEquity }`, `deadline` object `{ raw, date (ISO|null), cadence (rolling|annual|invitation|one-time|passed|unknown), note, isPassed }`, `requires501c3` (tri-state: 'yes' | 'no' | 'unknown'), `fit`, `status` (enum), `nextAction`, `link`.
- **Status enum** (normalize the raw strings to a fixed set): `active`, `in-progress`, `to-research`, `recurring`, `applied`, `declined`, `not-eligible`, `not-eligible-yet`. Keep the human label too.
- **Amount parsing** must handle: `"$5,000-$20,000 (avg $10,000)"` (min/max/avg), `"$20,000 (received 2025)"` (isReceived + amount), `"TBD"`/`"Micro (amount TBD)"` (isTBD, numbers null — NOT 0), `"$100,000+"` (min only), `"Large"`/`"Micro"` (qualitative → isTBD), equity row 37 Angels (`isEquity`). NEVER coerce TBD to 0.
- **Deadline parsing** must handle: `"2026-06-30 (decision by Oct 31)"` (date + note), `"Rolling (monthly)"` (cadence=rolling), `"Invitation only"` (cadence=invitation, no date), `"Annual"`, `"2025-12-30 (passed)"` (isPassed=true), `"Check 2026 cycle..."` (unknown). `new Date()` must not be called blindly on these.
- **Derived aggregates** (computed in the tool or a selector, unit-tested): `securedTotal` = sum of `isReceived` amounts (exactly $20,000 = NY Community Trust). `potentialTotal` = sum of parseable amounts EXCLUDING `declined`, `not-eligible`, `not-eligible-yet` statuses AND EXCLUDING the equity (37 Angels) row. Count-by-status. 501c3-gated vs open counts.

### Custom tools (user explicitly requested building custom tools)
- `tools/ingest-grants.mjs` — reads `data/grants.csv` (papaparse for tokenizing quoted-comma fields + BOM strip + drop empty trailing row), applies the amount/deadline/status/501c3 normalizers, emits typed JSON + a `.d.ts`/JSDoc typedef to `src/lib/data/grants.generated.json` (+ types).
- `tools/validate-grants.mjs` (or zod inside ingest) — schema/enum/URL/ISO-date validation; **exits non-zero (fails the build)** on any malformed row, with a row-level error message. Wire into a `prebuild` npm script so `pnpm build` runs it.
- `tools/generate-qr.mjs` — reads a single config module `src/lib/config/sites.js` holding the TWO site URLs (clearly-labeled PLACEHOLDER absolute external URLs, e.g. `https://diversityincludesdisability.org` + a second placeholder — user will swap later), generates QR codes as inline SVG (build-time, absolute external URLs — NOT routed through app `base`). Emits to `src/lib/data/qr.generated.*` or similar.
- Normalizers should be pure, importable functions with **vitest unit tests** covering every literal Amount/Deadline string in the actual 28-row CSV (highest-leverage tests per research).

### Claude's Discretion
- Exact file/dir names within the above scheme, JS-vs-TS-typedef style, whether validation is a separate script or zod inside ingest, the slug algorithm, and the QR SVG styling. All at Claude's discretion — follow ARCHITECTURE.md where it is specific.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1 scaffold: SvelteKit + Vite + pnpm, `tools/verify-build.mjs` pattern (custom Node ESM tool — mirror its style for the new tools), vitest already installed, `prebuild`/build scripts in `package.json`.
- `data/grants.csv` (28 rows) and `data/reference-grant-tracker.html` are present.

### Established Patterns
- Custom Node ESM tools live in `tools/` (established by `tools/verify-build.mjs`). Follow the same no-dependency-bloat, clear-error-exit style.
- pnpm-only; Node 22. Windows local builds need `MSYS_NO_PATHCONV=1` when a `/`-leading env var is passed (only relevant if base-path is involved — QR URLs are absolute so likely N/A).

### Integration Points
- Generated JSON/types land in `src/lib/data/` so Svelte components (Phase 3/4) import them directly (no runtime fetch).
- `package.json` `prebuild` hook runs ingest+validate before `vite build`.
- `src/lib/config/sites.js` is the single swap point for the two QR URLs.

</code_context>

<specifics>
## Specific Ideas

The parser correctness IS the product here — a silent Amount/Deadline mis-parse corrupts the headline "secured vs potential" story the whole dashboard tells. Unit-test against all 28 literal strings; assert `securedTotal === 20000` and that declined/not-eligible/equity rows are excluded from `potentialTotal`. Build must go RED on a deliberately malformed row and GREEN when reverted.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Rendering the data, QR panel UI, and charts are Phase 3/4.)

</deferred>
