# Architecture Research

**Domain:** Premium 3D grant/funding command-center dashboard (SvelteKit static site → GitHub Pages, Threlte/Three.js Crystarium navigation, build-time CSV ingest)
**Researched:** 2026-07-04
**Confidence:** HIGH (stack + deploy verified against current docs; Crystarium layout is an original design decision, MEDIUM)

---

## Executive Summary

This is a **build-time-baked static SPA-with-prerender**. There is no server and no runtime data fetch: 28 messy CSV rows are transformed into a typed JSON module at build time by purpose-built Node tools, and the SvelteKit app imports that module directly. The single hard architectural boundary is the **SSR/WebGL seam** — the Threlte `<Canvas>` (WebGL) must never execute on the server/prerender pass, while everything else (HUD, data, SEO shell) *should* prerender. Get that boundary right and the rest is conventional SvelteKit.

Three subsystems: (1) a **build-time data/tooling pipeline** (`tools/`) that owns CSV→JSON, validation-as-build-gate, and QR asset generation; (2) a **3D scene subsystem** (Threlte) that owns the Crystarium grid, camera, and postprocessing; (3) a **2D HUD subsystem** (plain Svelte 5) layered over the canvas that owns detail/overview/QR/legend panels. State (selection, hover, filter, camera focus) lives in a shared runes module bridging subsystems 2 and 3.

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  BUILD TIME  (Node, runs before `vite build`)                        │
│                                                                      │
│   data/grants.csv ──► tools/ingest ──► normalize ──► validate ──►    │
│                          │                              │(gate)      │
│                          │                              ▼            │
│                          │                        FAIL BUILD on      │
│                          │                        bad enum/URL/date  │
│                          ▼                                           │
│                 src/lib/data/grants.generated.json  (+ .d.ts)        │
│                                                                      │
│   config/sites.js ──► tools/qr ──► static/qr/site-a.svg, site-b.svg  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ (import at compile time)
┌──────────────────────────────▼───────────────────────────────────────┐
│  APP  (SvelteKit, adapter-static, ssr=true + prerender=true)          │
│                                                                        │
│   ┌────────────────────────  +page.svelte  ───────────────────────┐   │
│   │                                                                │   │
│   │   2D HUD LAYER (SSR-safe, prerendered) — plain Svelte 5        │   │
│   │   ┌──────────┐ ┌──────────────┐ ┌─────────┐ ┌──────────┐       │   │
│   │   │ Detail   │ │ Pipeline     │ │ QR      │ │ Legend / │       │   │
│   │   │ Panel    │ │ Overview     │ │ Panel   │ │ Filters  │       │   │
│   │   └────┬─────┘ └──────┬───────┘ └────┬────┘ └────┬─────┘       │   │
│   │        │              │              │           │             │   │
│   │        └──────────────┴───► crystarium.svelte.js ◄────┐        │   │
│   │                         (runes: selected/hover/filter) │        │   │
│   │                                    ▲                   │        │   │
│   │  ─────────────────── SSR / WebGL BOUNDARY ──────────── │ ────    │   │
│   │        {#if browser} or onMount                        │        │   │
│   │   3D SCENE LAYER (browser-only) — Threlte              │        │   │
│   │   ┌─────────────────────────────────────────────────┐ │        │   │
│   │   │ <Canvas>                                        │ │        │   │
│   │   │   CameraRig · Lights · Bloom(postprocessing)    │─┘        │   │
│   │   │   CrystariumScene                               │          │   │
│   │   │     ├─ layout.js (data → node positions)        │          │   │
│   │   │     ├─ {#each nodes} <CrystalNode/>             │          │   │
│   │   │     └─ {#each edges} <CrystalPath/>             │          │   │
│   │   └─────────────────────────────────────────────────┘          │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                               │ `vite build` → static/ HTML+JS
                               ▼
        GitHub Actions ──► gh-pages branch / Pages ──► live site (base=/Eman_dashboard)
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `tools/ingest` | Parse CSV, normalize messy amount/deadline/501c3 strings into typed fields | Node script, `papaparse` or `csv-parse` + custom parsers |
| `tools/validate` | Enforce schema/enum/URL/date correctness; **exit non-zero on bad data** | Node script, `zod` schema (single source of truth) |
| `tools/qr` | Turn two config URLs into `.svg` assets (or a data module) | Node script, `qrcode` lib |
| `grants.generated.json` | The single typed dataset the app consumes | Generated artifact in `src/lib/data/` |
| `crystarium/layout.js` | Deterministic node/edge positions from data (pure function) | Pure module, no Three.js import — returns plain coords |
| `CrystariumScene` | Assemble nodes + paths + camera + bloom inside `<Canvas>` | Threlte component |
| `CrystalNode` / `CrystalPath` | One funder node / one edge; visual state from data | Threlte components |
| `crystarium.svelte.js` | Shared UI state (selected, hovered, filter, cameraFocus) | Svelte 5 runes module (`$state`) |
| HUD panels | Read state + data, render 2D dashboard, dispatch selection | Plain Svelte 5, HTML/CSS/SVG (no WebGL) |
| `config/sites.js` | Two QR URLs + deploy base path | Plain JS config module |

---

## Recommended Project Structure

```
Eman_dashboard/
├── data/
│   ├── grants.csv                  # SOURCE OF TRUTH (28 funders) — hand-edited
│   └── reference-grant-tracker.html
├── tools/                          # ← custom build tools (Node, not shipped)
│   ├── ingest.mjs                  # CSV → normalized records
│   ├── normalize/
│   │   ├── amount.mjs              # "$5,000-$20,000 (avg $10,000)" → {min,max,avg,...}
│   │   ├── deadline.mjs            # "Rolling (monthly)" → {date,cadence,note}
│   │   └── status.mjs              # label → status enum + 501c3 tri-state
│   ├── schema.mjs                  # zod schema = SINGLE SOURCE OF TRUTH for shape
│   ├── validate.mjs                # runs schema, fails build on error
│   ├── qr.mjs                      # config URLs → static/qr/*.svg
│   └── build-data.mjs             # orchestrator: ingest→validate→emit json + d.ts
├── src/
│   ├── lib/
│   │   ├── data/
│   │   │   ├── grants.generated.json   # ← emitted artifact (gitignored or committed)
│   │   │   └── grants.d.ts             # ← emitted TS types (from zod)
│   │   ├── config/
│   │   │   └── sites.js            # two QR URLs + base path
│   │   ├── crystarium/
│   │   │   ├── layout.js           # PURE: data → {nodes:[{id,pos}], edges:[...]}
│   │   │   ├── CrystariumScene.svelte
│   │   │   ├── CrystalNode.svelte
│   │   │   ├── CrystalPath.svelte
│   │   │   ├── CameraRig.svelte
│   │   │   └── postprocessing.js   # bloom pass config
│   │   ├── state/
│   │   │   └── crystarium.svelte.js # runes: selected/hover/filter/focus
│   │   ├── hud/
│   │   │   ├── DetailPanel.svelte
│   │   │   ├── PipelineOverview.svelte
│   │   │   ├── QrPanel.svelte
│   │   │   └── Legend.svelte
│   │   └── util/
│   │       └── stats.js            # totals-by-status, secured-vs-potential (pure)
│   └── routes/
│       ├── +layout.js             # export const prerender = true; ssr = true
│       └── +page.svelte           # composes HUD + browser-gated Canvas
├── static/
│   ├── .nojekyll                   # required for /_app assets on Pages
│   └── qr/                         # generated QR assets
├── .github/workflows/deploy.yml    # build + publish to Pages
├── svelte.config.js                # adapter-static + base path from env
├── vite.config.js
└── package.json                    # prebuild hook wires tools into build
```

### Structure Rationale

- **`tools/` is outside `src/`:** build-time-only Node code; never bundled into the client. Keeps the SSR/WebGL app free of Node-only deps (`fs`, `papaparse`).
- **`layout.js` imports NO Three.js:** it returns plain `{x,y,z}` numbers. This keeps the layout algorithm unit-testable and outside the WebGL boundary, so it can even run during SSR if needed.
- **`state/crystarium.svelte.js` is the only shared mutable state:** both the 3D scene and the 2D HUD import it. This is the bridge across the SSR/WebGL seam.
- **`grants.generated.json` in `src/lib/data`** (not `static/`): importing it lets Vite tree-shake/typecheck and inlines it into the bundle — no runtime `fetch`, which is exactly what a prerendered static site wants. (`static/` would force a runtime fetch and a loading state.)

---

## Normalized Grant Data Schema

Defined once in `tools/schema.mjs` (zod), which emits both the runtime validator and `grants.d.ts`.

```typescript
type GrantType = 'grant' | 'grant-fellowship' | 'investment';

type GrantStatus =
  | 'active'         // "Active funder"
  | 'in-progress'    // "In progress"
  | 'applied'        // "Applied"
  | 'recurring'      // "Recurring"
  | 'to-research'    // "To research"
  | 'not-eligible-yet' // "Not eligible (yet)"
  | 'not-eligible'   // "Not eligible"
  | 'declined';      // "Declined"

type Requires501c3 =
  | 'yes'            // hard requirement
  | 'fiscal-sponsor-ok' // "Yes - or fiscal sponsor"
  | 'no'
  | 'likely'         // "Likely yes"
  | 'unknown';

type Cadence =
  | 'annual' | 'rolling' | 'monthly'
  | 'one-time' | 'invitation' | 'unknown';

interface Grant {
  id: string;              // slug of funder, e.g. "ford-foundation-justfilms"
  funder: string;          // "Ford Foundation"
  program: string | null;  // "JustFilms Documentary Production" (split on " - ")
  type: GrantType;

  // amount (parsed from messy strings)
  amountRaw: string;       // original, always kept for display/audit
  amountMin: number | null;
  amountMax: number | null;
  amountAvg: number | null; // explicit "(avg $X)" or midpoint fallback
  amountReceived: number | null; // "(received 2025)" → 20000
  received: boolean;       // has money actually landed
  amountTBD: boolean;      // "TBD" / unknown amount

  // deadline (parsed from messy strings)
  deadlineRaw: string;
  deadlineDate: string | null; // ISO "2026-06-30" when a concrete date exists
  cadence: Cadence;
  deadlineNote: string | null; // "decision by Oct 31", "2026 cycle passed"

  requires501c3: Requires501c3;
  fit: string;             // Fit/Eligibility prose
  status: GrantStatus;
  nextAction: string | null; // "--" → null
  link: string;            // validated http(s) URL
}
```

**Parsing rules the ingest tool must implement (all sourced from the actual 28 rows):**

| Raw pattern | Normalized result |
|-------------|-------------------|
| `$5,000-$20,000 (avg $10,000)` | min 5000, max 20000, avg 10000 |
| `$20,000 (received 2025)` | amountReceived 20000, received true, min/max/avg 20000 |
| `Up to $30,000 (avg $20,000)` | min null, max 30000, avg 20000 |
| `~$50,000-$200,000` | min 50000, max 200000, avg 125000 (midpoint) |
| `$100,000+` | min 100000, max null, avg null |
| `TBD` / `Micro (amount TBD)` / `Large` | amountTBD true, numbers null |
| `2026-06-30 (decision by Oct 31)` | date 2026-06-30, cadence one-time, note "decision by Oct 31" |
| `Rolling (monthly)` / `Rolling` | date null, cadence rolling/monthly |
| `Invitation only` | cadence invitation |
| `Annual` / `Annual relationship` | cadence annual |
| `2025-12-30 (passed)` | date 2025-12-30, note "passed" (drives an "expired" visual) |
| `Yes - or fiscal sponsor` | requires501c3 `fiscal-sponsor-ok` |
| `Likely yes` | `likely`; `Unknown` → `unknown` |

---

## Custom Tools (the three the user requested)

All live in `tools/`, are pure Node ESM (`.mjs`), and are wired via `package.json`. They run **before** `vite build` so the app only ever sees clean, typed data.

### Tool 1 — CSV Ingest + Normalizer (`tools/ingest.mjs` + `normalize/`)
- **Input:** `data/grants.csv`
- **Does:** parse CSV (`papaparse`), split funder/program, run the amount/deadline/status/501c3 normalizers, slugify ids, coerce `--` → null.
- **Output:** in-memory array of `Grant` records (handed to validate → emit).

### Tool 2 — QR Generator (`tools/qr.mjs`)
- **Input:** `src/lib/config/sites.js` (the two URLs).
- **Does:** render each URL to an SVG via `qrcode` (SVG for crisp scaling + themable stroke to match the dark/glow palette).
- **Output:** `static/qr/site-a.svg`, `static/qr/site-b.svg`. Idempotent — regenerates whenever config changes. (Alternative: emit a `qr.generated.js` data module of inline SVG strings so the panel needs no asset fetch; recommended for a fully-inlined static bundle.)

### Tool 3 — Data Validator (`tools/validate.mjs`) — the build gate
- **Input:** normalized records + `schema.mjs` (zod).
- **Checks:** every field matches schema; `status`/`type`/`cadence`/`requires501c3` are valid enum members; `link` is a well-formed http(s) URL; `deadlineDate` parses as a real ISO date; no duplicate `id`.
- **Behavior:** on any failure, print the offending row + reason and `process.exit(1)` — **this fails the build**, so bad CSV can never reach production.

### Build wiring (`package.json`)

```jsonc
{
  "scripts": {
    "build:data": "node tools/build-data.mjs",   // ingest → validate → emit json + d.ts
    "build:qr":   "node tools/qr.mjs",
    "prebuild":   "npm run build:data && npm run build:qr",
    "build":      "vite build",
    "dev":        "npm run build:data && npm run build:qr && vite dev"
  }
}
```

`prebuild` runs automatically before `build` (npm lifecycle). `dev` runs the tools once up front. Data changes = re-run `build:data` (or restart dev). This guarantees the app compiles against validated data and never ships a broken enum or dead URL.

---

## Crystarium Layout Algorithm (design decision)

**Goal:** deterministic 3D positions computed purely from the data so the grid looks like an FFXIII Crystarium — a central core with radial branches of crystal nodes joined by glowing paths — and so status/amount/deadline are legible from *shape* before any click.

**Chosen approach: status-sectored radial branches wrapped onto a shallow dome (sphere cap).** Pure function in `layout.js`, no randomness, no Three.js.

```
Algorithm computePositions(grants):
  1. hub at origin (0,0,0)  — the DID core crystal
  2. group grants by `status` → S ordered clusters
       order = pipeline flow: active, in-progress, applied, recurring,
               to-research, not-eligible-yet, not-eligible, declined
  3. assign each cluster a sector angle  θ_s = s * (2π / S)
  4. within a cluster, sort nodes by amountAvg desc (bigger = closer to core,
       gives the "unlock outward" feel), tie-break by deadlineDate asc
  5. for node i in cluster s:
       tier   = i + 1                      // 1..n along the branch
       radius = R0 + tier * TIER_STEP      // distance from core
       jitter = (i % 2) * SPREAD           // slight ± around θ_s so branches fan
       angle  = θ_s + jitter
       // wrap onto a dome: elevation grows with radius (sphere-cap feel)
       elev   = radius * DOME_CURVE
       x = radius * cos(angle)
       z = radius * sin(angle)
       y = elev + amountBump(node)         // taller crystal = bigger grant
  6. edges:
       - hub → first node of each cluster (branch root path)
       - node[i] → node[i+1] within a cluster (sequential Crystarium path)
       - optional cross-links: same-funder programs (Ford×2, BofA×2) get a
         faint bridge edge to show relatedness
```

**Visual encodings (read straight from data → material/scale):**
- **Node scale** ← `amountAvg` (log-scaled; TBD/unknown = small neutral crystal).
- **Node color/material** ← `status` (active = warm gold glow; in-progress = cyan pulse; declined/not-eligible = dim/desaturated).
- **Node glow intensity / pulse** ← deadline proximity from `deadlineDate` (soon = urgent bloom; rolling = steady low glow; passed = greyed).
- **501c3 gate** ← a ring/halo or edge-tint on `requires501c3 === 'yes'` nodes (the org is 501c3-pending, so this axis matters).

**Why this over a Fibonacci sphere:** a pure Fibonacci sphere scatters nodes evenly but destroys the *branch* semantics that make a Crystarium readable. Sectoring by status preserves "pipeline as shape," and the dome wrap gives genuine 3D depth without losing the radial legibility. Determinism (no RNG) means the grid is stable across builds — the same CSV always yields the same constellation, which is important for user muscle memory.

**Confidence: MEDIUM** — this is an original design, not a cited pattern; tunable constants (`R0`, `TIER_STEP`, `DOME_CURVE`, `SPREAD`) will need visual iteration in the polish phase.

---

## Architectural Patterns

### Pattern 1: The SSR/WebGL Boundary (the critical one)
**What:** Keep `ssr = true` and `prerender = true` (required by adapter-static — with `ssr=false` you ship an empty shell and lose the HUD/SEO). The **HUD + data prerender on the server**; the **Threlte `<Canvas>` is browser-only**.
**How:** guard the Canvas so WebGL never runs server-side:

```svelte
<script>
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  let mounted = $state(false);
  onMount(() => (mounted = true));
</script>

<PipelineOverview />   <!-- prerendered, visible instantly -->
{#if browser && mounted}
  <CrystariumCanvas />  <!-- WebGL, browser only -->
{/if}
```
**Trade-off:** the 3D scene isn't in the prerendered HTML (fine — it's an interactive canvas, not content), but the dashboard data and layout are, so the page is useful even before WebGL boots and degrades gracefully on WebGL-less clients.

### Pattern 2: Build-time data baking (no runtime fetch)
**What:** `import grants from '$lib/data/grants.generated.json'` — the dataset is compiled into the bundle.
**When:** small, static, build-owned datasets (28 rows). 
**Trade-off:** re-deploy to update data (acceptable — CSV is hand-edited), but zero loading states, zero fetch failures, perfect for prerender.

### Pattern 3: Runes state module as cross-subsystem bridge
**What:** a single `crystarium.svelte.js` exporting `$state` for `selected`, `hovered`, `filter`, `cameraFocus`. Both the 3D nodes (write on click/hover) and the HUD panels (read to render detail) import it.
**When:** you need shared reactive state across a component tree split by a lazy boundary. Preferable to Svelte context here because the Canvas is conditionally mounted — a plain module import survives mount/unmount cleanly.

```js
// state/crystarium.svelte.js
export const ui = $state({ selected: null, hovered: null, filter: 'all', cameraFocus: null });
export function select(id) { ui.selected = id; ui.cameraFocus = id; }
```

**Trade-off:** module-level `$state` is effectively a singleton — fine for a single-page dashboard, would need rethinking for multi-instance reuse (not a concern here).

---

## Data Flow

### Build-time flow (once, before deploy)
```
grants.csv → ingest → normalize(amount/deadline/status) → validate(zod, GATE)
   → emit grants.generated.json + grants.d.ts
sites.js → qr → static/qr/*.svg
```

### Runtime interaction flow (in browser)
```
[import grants.json] → layout.js computes {nodes,edges}
        ↓
   CrystariumScene renders CrystalNodes + CrystalPaths
        ↓  (user clicks a node)
   CrystalNode → select(id) → ui.selected/ui.cameraFocus (runes)
        ↓ (reactive)
   ┌── CameraRig eases toward focused node
   └── DetailPanel renders that grant's full record
   Legend/Filter → ui.filter → nodes dim/highlight; PipelineOverview recomputes stats
```

---

## Config-Driven QR + Site Config

`src/lib/config/sites.js` is the single place both the QR tool (build) and the QR panel (runtime) read:

```js
export const sites = [
  { id: 'a', label: 'Main Site',  url: 'https://example.org' },   // TODO: finalize
  { id: 'b', label: 'Donate',     url: 'https://example.org/give' } // TODO: finalize
];
export const base = process.env.BASE_PATH ?? '/Eman_dashboard';
```
Dropping the real URLs in later + re-running `build:qr` regenerates the codes with **no code change** — satisfies the "swappable config" constraint.

---

## GitHub Pages Deploy Architecture (recommended)

- **Adapter:** `@sveltejs/adapter-static` with a `fallback` omitted (full prerender) — every route is a real HTML file.
- **Base path:** `svelte.config.js` reads `process.env.BASE_PATH` → `kit.paths.base`. Repo is `Eman_dashboard`, so production base = `/Eman_dashboard`; dev = `''`. Use `base` from `$app/paths` for all internal asset/link URLs (including QR `<img>` src).
- **Prerender:** `export const prerender = true; export const ssr = true;` in `+layout.js`. `ssr=true` is **mandatory** — with `ssr=false` adapter-static writes an empty shell and the prerendered HUD/SEO vanish (confirmed: SvelteKit issue #14471).
- **`.nojekyll`:** put an empty `static/.nojekyll` so Pages doesn't strip the `_app/` (underscore) asset directory. Without it the site loads blank.
- **Publish mechanism — recommend GitHub Actions** (not the `gh-pages` npm package): a `deploy.yml` that runs `npm ci → npm run build → actions/upload-pages-artifact → actions/deploy-pages`, triggered on push to `main`. Reasons over `gh-pages` pkg: build runs in CI (reproducible, no local Node drift), `prebuild` tools + validator run on the server so **bad data blocks deploy automatically**, and no committed `gh-pages` branch churn. Set `BASE_PATH=/Eman_dashboard` as a workflow env.

---

## Suggested BUILD ORDER (dependency graph — primary output)

```
(1) Scaffold + Deploy Skeleton
        │  (proves the pipeline end-to-end first: risk-down deploy early)
        ▼
(2) Data Pipeline + Custom Tools  ──────────┐
        │  (produces the typed dataset)      │ (QR tool ships here too)
        ▼                                     │
(3) 3D Crystarium Scene  ◄──── consumes typed data + layout.js
        │
        ▼
(4) HUD / Overlay UI  ◄──── consumes data (panels) + scene (selection state)
        │
        ▼
(5) Polish / Animation / Perf
```

1. **Scaffold + Deploy Skeleton** — SvelteKit + adapter-static, `svelte.config.js` base-path-from-env, `+layout.js` prerender/ssr, `static/.nojekyll`, GitHub Actions `deploy.yml`. **Deliverable: a blank styled page live on `https://<user>.github.io/Eman_dashboard`.** *Do deploy first* — it de-risks the single most failure-prone thing (Pages base path + `.nojekyll`) before any real work exists.
2. **Data Pipeline + Custom Tools** — `schema.mjs` (zod), ingest + normalizers, validator gate, `build-data.mjs` emitting `grants.generated.json` + `grants.d.ts`, QR tool + `sites.js`, `prebuild` wiring. **Deliverable: `npm run build` produces validated typed data; bad CSV fails the build.** Depends on (1)'s repo; unblocks everything downstream.
3. **3D Crystarium Scene** — Threlte `<Canvas>` behind the browser guard, `layout.js` (pure), `CrystalNode`, `CrystalPath`, `CameraRig`, bloom postprocessing. Encodes status/amount/deadline visually. **Deliverable: the navigable sphere grid rendering all 28 nodes.** Depends on (2)'s data + schema.
4. **HUD / Overlay UI** — `crystarium.svelte.js` runes state, `DetailPanel`, `PipelineOverview` (totals/secured-vs-potential/timeline/501c3-gated), `QrPanel`, `Legend`/filters, click→select→camera-focus wiring. **Deliverable: clicking a node drills into its detail; dashboard stats read.** Depends on (2) data + (3) scene selection events.
5. **Polish / Animation / Perf** — Crystarium unlock/activation animations, glow/bloom tuning, camera easing, deadline-urgency pulses, layout-constant tuning, responsive HUD, load/perf pass. **Deliverable: the "premium" feel.** Depends on all prior.

**Ordering rationale:** deploy-first (1) kills the highest-risk unknown early; data (2) is the contract every UI piece binds to, so it must precede scene and HUD; the 3D scene (3) precedes HUD (4) because selection/hover events originate in the scene and the HUD consumes them; polish (5) is last by definition. (2) and the QR tool are grouped because they share the `tools/` + `prebuild` infrastructure.

---

## Anti-Patterns

### Anti-Pattern 1: Disabling SSR to "fix" WebGL errors
**What people do:** hit a `window is not defined` prerender error from Three.js and set `ssr = false` globally.
**Why it's wrong:** adapter-static then emits an empty shell — the prerendered HUD, stats, and SEO content all disappear.
**Instead:** keep `ssr=true`; gate only the `<Canvas>` with `{#if browser}` / `onMount`. The 2D dashboard still prerenders.

### Anti-Pattern 2: Runtime CSV fetch
**What people do:** put `grants.csv`/JSON in `static/` and `fetch()` it on mount.
**Why it's wrong:** adds a loading state, a failure mode, and un-typed data to a site whose whole premise is build-time-baked static data.
**Instead:** emit JSON into `src/lib/data` and `import` it — inlined, typed, tree-shaken.

### Anti-Pattern 3: Importing Three.js inside `layout.js`
**What people do:** return `THREE.Vector3` objects from the layout module.
**Why it's wrong:** couples the pure, testable positioning math to the WebGL boundary and drags Three.js toward SSR.
**Instead:** `layout.js` returns plain `{x,y,z}` numbers; the Threlte component turns them into scene objects.

### Anti-Pattern 4: Validating data in the app instead of at build time
**What people do:** defensively handle malformed grants in Svelte components.
**Why it's wrong:** scatters null-checks everywhere and lets bad data ship silently.
**Instead:** one zod gate in `tools/validate.mjs` that fails the build; components trust the typed contract.

---

## Integration Points

### External Services
| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub Pages | Actions workflow → `deploy-pages` | needs `BASE_PATH` env + `.nojekyll` |
| (none at runtime) | — | fully static; no APIs, DB, or auth |

### Internal Boundaries
| Boundary | Communication | Notes |
|----------|---------------|-------|
| `tools/` ↔ app | file artifact (`grants.generated.json` + `d.ts`) | one-way, build-time only |
| 3D scene ↔ HUD | shared runes module (`crystarium.svelte.js`) | the only cross-boundary mutable state |
| `layout.js` ↔ scene | pure return value (`{nodes,edges}`) | no Three.js in layout |
| `config/sites.js` ↔ qr tool + QR panel | shared config import | single source for the two URLs |

---

## Sources

- SvelteKit adapter-static / prerender / ssr requirement — https://svelte.dev/docs/kit/adapter-static and https://github.com/sveltejs/kit/issues/14471 (HIGH — official docs + maintainer issue confirming `ssr=true` needed for prerender)
- SvelteKit page options (`prerender`, `ssr`, base path) — https://svelte.dev/docs/kit/page-options (HIGH)
- Threlte 8 adopts Svelte 5 runes — https://threlte.xyz/blog/threlte-8/ (HIGH — official release post)
- Threlte core — https://threlte.xyz/ and https://www.npmjs.com/package/@threlte/core (HIGH)
- Three.js current (~r185, WebGPU zero-config since r171) — https://github.com/mrdoob/three.js/releases (HIGH)
- Svelte 5 runes reference — https://svelte.dev/blog/runes (HIGH)
- Crystarium sphere-grid layout — original design decision (MEDIUM, needs visual iteration)

---
*Architecture research for: premium 3D grant command-center dashboard (SvelteKit static + Threlte)*
*Researched: 2026-07-04*
