# Phase 1: Deploy Skeleton + Toolchain - Research

**Researched:** 2026-07-04
**Domain:** SvelteKit static-site scaffold + GitHub Pages deploy pipeline (base-path / prerender / .nojekyll / GitHub Actions)
**Confidence:** HIGH — versions pre-verified in STACK.md (npm registry, 2026-07-04); deploy pattern proven by sibling `diversityincludesdisability_three` (live on Pages); base-path/prerender behavior confirmed against official SvelteKit + Tailwind docs.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Stack (research-locked — from `.planning/research/STACK.md`):**
- SvelteKit 2.69 + Svelte 5 (runes) + Vite 8, **TypeScript** (Claude's discretion → prefer TS for tooling).
- `@sveltejs/adapter-static` for full prerender. Node 22 LTS pinned via `.nvmrc`. **pnpm** exclusively (sibling projects hit npm/pnpm lockfile mismatches).
- Tailwind v4 (`@tailwindcss/vite`, CSS-first, **no config file**) for base premium dark styling.
- Self-hosted fonts via `@fontsource-variable` (**Orbitron** display + **Inter** body) — no external font CDN (prerender/offline clean).
- Do **NOT** install Three.js/Threlte/postprocessing/GSAP/papaparse/qrcode/layerchart yet — those land in their owning phases. Keep Phase 1 dependency-light.

**Base-path & Deploy (load-bearing — from `.planning/research/PITFALLS.md`):**
- `paths.base = process.env.BASE_PATH ?? ''` in `svelte.config.js`; CI sets `BASE_PATH=/Eman_dashboard`.
- Every internal link/asset routed through `base` from `$app/paths`. `fallback: '404.html'`. Adapter auto-writes `.nojekyll` (verify it lands in the artifact).
- `trailingSlash: 'always'` (or handled explicitly) to avoid Pages redirect asset breakage.
- GitHub Actions workflow (**NOT** the `gh-pages` npm package) builds with `BASE_PATH=/Eman_dashboard` and publishes to Pages on push to `main`. Repo `wolfwdavid/Eman_dashboard` already exists and is pushed.
- Keep `ssr = true` + `prerender = true` globally (**never** `ssr = false`) so the shell prerenders — the pattern later phases rely on for SSR-safe WebGL.

### Claude's Discretion
- Exact page layout of the skeleton (a branded landing shell with the project title / DID identity is enough), TS-vs-JSDoc (→ chose TS), Tailwind token setup, and repo file layout (`tools/` dir may be stubbed now or created in Phase 2). All infrastructure choices are at Claude's discretion — pure infrastructure phase.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope. (3D, data ingest, QR, HUD all belong to later phases.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **DPLY-01** | The site fully prerenders to static files via `adapter-static` | `svelte.config.js` (adapter-static + `fallback:'404.html'` + `strict:true`) and `+layout.ts` (`prerender=true; ssr=true`). Verify: `build/index.html` + `build/404.html` contain real content. |
| **DPLY-02** | GitHub Pages base path resolves for repo `Eman_dashboard` (all assets/links via `base`), with `.nojekyll` + `404.html` SPA fallback | `paths.base = process.env.BASE_PATH ?? ''`; `base` from `$app/paths` on every link/asset; adapter auto-emits `.nojekyll`; `fallback:'404.html'`. Verify: build-output grep for `/Eman_dashboard/_app/` prefix + zero root-absolute `/_app/`. |
| **DPLY-03** | GitHub Actions workflow builds + publishes to Pages on push to `main` | Full `deploy.yml` below (checkout → pnpm → install → `BASE_PATH` build → upload-pages-artifact → deploy-pages; `pages:write`+`id-token:write`; concurrency). Plus one **manual** setting: Settings → Pages → Source = GitHub Actions. Verify: live `curl` of the github.io URL for 200 + title text. |
</phase_requirements>

## Summary

This is a **pure-infrastructure walking-skeleton phase**. Its entire purpose is to prove the four invisible-failure seams — GitHub Pages **base path**, **prerender/SSR split**, **`.nojekyll`**, and the **GitHub Actions deploy** — end-to-end on the real `https://wolfwdavid.github.io/Eman_dashboard/` URL, *before* any 3D or data code exists. Every later phase re-deploys through this exact pipeline, so getting it right now means base-path/prerender regressions surface immediately instead of buried atop a large Threlte codebase (PITFALLS #12).

The good news: this pattern is **already proven in-workspace**. Sibling `diversityincludesdisability_three` runs an almost-identical SvelteKit + adapter-static + `BASE_PATH` + `pnpm` + GitHub Actions stack live on Pages. This research adapts that proven `deploy.yml` and `svelte.config.js` verbatim (repo name swapped to `Eman_dashboard`, Node pinned to 22 per this project's decision), then layers on Tailwind v4 (CSS-first, no config), self-hosted Orbitron+Inter fonts, and a styled — not blank — dark landing shell so the live URL *visibly* proves CSS + fonts + base-path all resolve on the deployed site.

No version re-research was needed — STACK.md verified every pin against the npm registry today (2026-07-04). The one manual, un-automatable step to flag to the user: **Settings → Pages → Source must be set to "GitHub Actions"** (once), or the workflow deploys succeed but publish nowhere.

**Primary recommendation:** Scaffold with `sv create` (minimal + TS + tailwindcss add-on) via `pnpm dlx`, drop in the exact `svelte.config.js` / `+layout.ts` / `deploy.yml` below, set base off `BASE_PATH`, build once locally with `BASE_PATH=/Eman_dashboard` and grep the output for base-prefixed asset URLs, then push to `main` and confirm the live URL returns 200 with the title text.

## Standard Stack

### Core (install in Phase 1)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sveltejs/kit` | `2.69.1` | App framework, routing, SSG | Static-first meta-framework; first-class prerender + adapter-static. |
| `svelte` | `5.56.4` | UI framework (runes) | `$props`/`$state` are the current idiom; required by later Threlte 8. |
| `vite` | `8.1.3` | Build/dev server | Bundler under SvelteKit. **Needs Node 20.19+ / 22.12+** → pin Node 22. |
| `@sveltejs/adapter-static` | `3.0.10` | Static site generation | Emits pure HTML/JS/CSS for Pages; **auto-writes `.nojekyll`**. |
| `@sveltejs/vite-plugin-svelte` | `7.1.2` | Svelte compile in Vite | Pulled by the template; listed for lockfile clarity. |
| `typescript` | `5.x` (latest) | Types | JSDoc-vs-TS resolved → TS for tooling ergonomics. |
| `tailwindcss` | `4.3.2` | Utility layout + dark theme | v4 CSS-first (`@theme` in CSS), **no `tailwind.config.js`**. |
| `@tailwindcss/vite` | `4.3.2` | Tailwind v4 Vite plugin | v4 integration path (replaces the old PostCSS plugin). |
| `@fontsource-variable/orbitron` | latest | Self-hosted display font (HUD/sci-fi) | Self-host, no Google Fonts CDN — prerender/offline/base-path clean. |
| `@fontsource-variable/inter` | latest | Self-hosted body/data font | High legibility for dense fields. |

### Supporting (dev / test — install now so Wave 0 test infra exists)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `svelte-check` | latest | Type/diagnostics | Run in CI alongside build. |
| `@playwright/test` | `1.61.1` | Smoke test | One test: page boots + title renders under base path. |
| `vitest` | `4.1.9` | Unit tests | Install now (config); real tests land in Phase 2 (parsers). |

### Do NOT install this phase (deferred to owning phases)
`three`, `@threlte/core`, `@threlte/extras`, `postprocessing`, `@types/three` (Phase 3) · `gsap` (Phase 5) · `papaparse`, `zod`, `qrcode`, `@types/*` (Phase 2) · `layerchart` (Phase 4). Keeping Phase 1 dependency-light means the skeleton deploy proves the pipeline, not the libraries.

**Installation:**
```bash
# 1. Scaffold (see Scaffold Commands below) — this adds kit/svelte/vite/adapter + tailwind
# 2. Fonts (runtime deps)
pnpm add @fontsource-variable/orbitron @fontsource-variable/inter
# 3. Test tooling (dev deps)
pnpm add -D @playwright/test@1.61.1 vitest@4.1.9 svelte-check
```

**Version verification:** Already done — STACK.md verified all pins against the npm registry `/latest` on 2026-07-04 (today). Do **not** re-query; trust STACK.md. Fonts are `latest` (fontsource is append-only, no breaking pins needed).

### Alternatives Considered
| Instead of | Could Use | Tradeoff (why NOT here) |
|------------|-----------|-------------------------|
| GitHub Actions deploy | `gh-pages` npm package | Loses CI reproducibility + the prebuild data-gate (Phase 2); churns a `gh-pages` branch. CONTEXT locks Actions. |
| adapter-static | adapter-auto | adapter-auto masks base-path/prerender bugs on Vercel-style SSR; the whole point of Phase 1 is to expose them on Pages. |
| Tailwind v4 CSS-first | Tailwind v3 + `tailwind.config.js` + PostCSS | v4 is the current path; no config file to maintain. |
| Self-hosted fontsource | Google Fonts `<link>` | CDN request breaks offline + adds base-path/CSP friction on Pages. |

## Architecture Patterns

### Recommended Project Structure (Phase 1 slice)
```
Eman_dashboard/
├── .github/workflows/deploy.yml   # build + publish to Pages
├── .nvmrc                          # "22"
├── .npmrc                          # engine-strict + auto-install-peers
├── .gitattributes                  # LF for .ts/.js/.json/.css/.csv (Windows CRLF guard)
├── svelte.config.js                # adapter-static + base from BASE_PATH
├── vite.config.ts                  # tailwindcss() + sveltekit()
├── package.json
├── static/
│   └── favicon.png                 # (adapter auto-emits .nojekyll into build/)
├── src/
│   ├── app.html
│   ├── app.css                     # @import "tailwindcss"; @theme tokens; @fontsource imports
│   ├── app.d.ts
│   └── routes/
│       ├── +layout.ts              # prerender = true; ssr = true; trailingSlash = 'always'
│       ├── +layout.svelte          # imports app.css, renders {@render children()}
│       └── +page.svelte            # the styled dark landing shell (title/DID identity)
├── tests/
│   └── smoke.spec.ts               # Playwright: page boots + title text present
├── playwright.config.ts
├── data/                           # (already exists — consumed Phase 2, untouched here)
└── .planning/                      # (already exists)
```
Note: `.planning/`, `data/`, and `CLAUDE.md` **already exist** in the repo. `sv create .` into a non-empty directory prompts a "directory not empty — continue?" confirmation (the sibling projects had the same `.planning/` situation and scaffolded fine). Plan for this: either answer the prompt, or scaffold into a temp dir and copy `src/`, `static/`, config files, and `package.json` over.

### Pattern 1: Base path off an env var (dev = root, CI = subpath)
**What:** `paths.base = process.env.BASE_PATH ?? ''` — empty locally (root), `/Eman_dashboard` in CI.
**When to use:** any GitHub Pages *project* site (served from `/<repo>/`, not a domain root).
**Why it's the whole ballgame:** localhost serves from root so root-absolute URLs work; Pages serves from `/Eman_dashboard/` so the *same* URLs 404. Driving base off env keeps dev ergonomic while CI produces correct subpath URLs. This is PITFALLS #2 — "the #1 killer for this stack."

```js
// svelte.config.js — VERBATIM (adapted from proven sibling diversityincludesdisability_three)
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * GitHub Pages serves this project from a subpath
 * (https://wolfwdavid.github.io/Eman_dashboard/).
 * The CI workflow sets BASE_PATH so every internal link/asset resolves.
 * Locally BASE_PATH is empty, so dev/preview run at the root.
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html', // SPA fallback so unknown paths resolve on Pages (DPLY-02)
      precompress: false,
      strict: true
    }),
    paths: {
      base: process.env.BASE_PATH ?? '' // '' locally, '/Eman_dashboard' in CI
    },
    // Fail the build if a prerendered link points somewhere that 404s.
    prerender: {
      handleHttpError: 'fail',
      handleMissingId: 'fail'
    }
  }
};

export default config;
```

### Pattern 2: prerender=true + ssr=true (never ssr=false)
**What:** In the root layout, both flags on. The shell prerenders to real static HTML; SSR stays on so that prerendered HTML has real content.
**When to use:** always for this project — it is the pattern Phase 3's SSR-safe WebGL relies on (client-only-mount just the `<Canvas>`, never globally disable SSR).
**Why ssr must stay true:** with `ssr=false`, adapter-static emits an empty `<div>` shell (SvelteKit issue #14471) and you lose the prerendered dashboard chrome + SEO. Phase 1 has no WebGL yet, but establishing `ssr=true` now bakes the correct baseline so no one "fixes" a future `window is not defined` error by reaching for `ssr=false`.

```ts
// src/routes/+layout.ts  (TypeScript)
export const prerender = true;    // fully static — every route → HTML at build time
export const ssr = true;          // keep SSR so pages prerender WITH real content
export const trailingSlash = 'always'; // directory-style URLs (/about/) — no Pages redirect surprises
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
```

### Pattern 3: Route every internal link/asset through `base`
**What:** `import { base } from '$app/paths';` then prefix every internal `href`/`src` with `{base}`.
**When to use:** every internal navigation link, `<img>`, favicon, and (later) every Three.js loader URL.
**Why:** SvelteKit only rewrites `base` for URLs it controls via `$app/paths`. Hand-written `/foo` bypasses it and 404s on the subpath.

```svelte
<!-- in +page.svelte / app.html -->
<script lang="ts">
  import { base } from '$app/paths';
</script>
<a href="{base}/">Home</a>
<link rel="icon" href="{base}/favicon.png" />
```
For the favicon in `app.html`, use `%sveltekit.assets%` (SvelteKit substitutes the base automatically):
```html
<link rel="icon" href="%sveltekit.assets%/favicon.png" />
```

### Tailwind v4 wiring (CSS-first, no config file)
**vite.config.ts** — `tailwindcss()` MUST come before `sveltekit()`:
```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()]
});
```

**src/app.css** — the single import + design tokens via `@theme` + self-hosted fonts:
```css
@import "tailwindcss";

/* Self-hosted variable fonts (no external CDN) */
@import "@fontsource-variable/orbitron";
@import "@fontsource-variable/inter";

@theme {
  --font-display: "Orbitron Variable", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Inter Variable", ui-sans-serif, system-ui, sans-serif;

  /* Dark premium palette (starter tokens — refine per ui-ux-pro-max UI-SPEC) */
  --color-void: #05060a;       /* page background */
  --color-panel: #0d1018;      /* glass panel base */
  --color-glow: #38e8ff;       /* crystal cyan accent */
  --color-gold: #ffcf6b;       /* active/secured accent */
}

/* Base premium dark background so the deployed URL visibly proves CSS loaded */
html, body {
  background: radial-gradient(ellipse at top, #0b1020 0%, var(--color-void) 60%);
  color: #e8ecf4;
  font-family: var(--font-body);
  min-height: 100%;
}
h1, h2, .display { font-family: var(--font-display); }
```
No `tailwind.config.js` is created or needed (confirmed against Tailwind's SvelteKit v4 guide). The `sv` `tailwindcss` add-on wires `@tailwindcss/vite` + the `@import "tailwindcss"` line automatically — verify those two, then add the `@theme` + `@fontsource` lines by hand.

### The styled landing shell (acceptance signal)
The CONTEXT "Specific Ideas" note requires a **styled, not blank** page: dark premium background + project title ("Eman_dashboard" / DID grant command center) using Orbitron display + Inter body. This is the visual acceptance signal — if the deployed URL shows the dark gradient + Orbitron title, then CSS + fonts + base-path all resolved on Pages (not just localhost). Keep it a single `+page.svelte` — no 3D, no data.

### Anti-Patterns to Avoid
- **`export const ssr = false`** to simplify — emits an empty shell, discards prerendered content (PITFALLS #1/#3, anti-pattern #1). Never in this project.
- **Root-absolute URLs** (`/logo.png`, `href="/"`, CSS `url(/...)`) — 404 on the subpath. Always `{base}/…` or Vite-import the asset.
- **`base` with a trailing slash or wrong case** — must be exactly `/Eman_dashboard` (leading slash, no trailing, case-matches repo).
- **npm/npx in this pnpm repo** — creates a competing `package-lock.json` and phantom-dep resolution differences (PITFALLS #15). pnpm exclusively.
- **Case-mismatched imports** — `'$lib/Foo.svelte'` for `foo.svelte` works on Windows, 404s in Linux CI. Match filename case exactly; the Actions build (Linux) will catch it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SvelteKit project scaffold | Hand-assemble `app.html`/config/tsconfig | `sv create` (official CLI) | Correct tsconfig, `.svelte-kit` types, app.html, and add-on wiring for free. |
| Tailwind PostCSS pipeline | Manual PostCSS + autoprefixer config | `@tailwindcss/vite` | v4's Vite plugin is the supported path; zero config file. |
| Pages publish mechanism | Custom `git push` to `gh-pages` branch / `gh-pages` npm pkg | `actions/upload-pages-artifact` + `actions/deploy-pages` | Official, handles the artifact tar (preserves `_app/`), OIDC deploy, no branch churn. |
| `.nojekyll` emission | Manually create/commit `static/.nojekyll` | adapter-static auto-writes it | Adapter emits `build/.nojekyll` on every build; just **verify** it lands (belt-and-suspenders: a `static/.nojekyll` is harmless if you want double insurance). |
| Base-path URL rewriting | String-concat base everywhere by hand | `base` from `$app/paths` + `%sveltekit.assets%` | SvelteKit rewrites the URLs it controls; use its helpers, don't reinvent. |
| Font hosting | Download + host Google Fonts manually | `@fontsource-variable/*` | Self-hosted, versioned, Vite-fingerprinted, base-resolved automatically. |

**Key insight:** Every custom-tooling instinct in this project belongs to Phase 2 (the CSV normalizers). Phase 1 is deliberately *off-the-shelf* — the deploy plumbing is a solved problem; the risk is misconfiguration, not missing tools.

## Common Pitfalls

*(This phase OWNS PITFALLS #2, #4, #5, and #15 from `.planning/research/PITFALLS.md`. It also establishes the `ssr=true` baseline that de-risks #1/#3 for Phase 3.)*

### Pitfall 1: Base-path 404s (PITFALLS #2 — the #1 killer)
**What goes wrong:** Blank/black page on Pages, DevTools Network full of 404s missing the `/Eman_dashboard/` segment; "MIME type text/html" errors for `.js`/`.css` (a 404 HTML page served instead of the asset). Works perfectly on localhost.
**Why it happens:** Root-absolute URLs and non-`$app/paths` links bypass base rewriting; or `base` has a trailing slash / wrong case.
**How to avoid:** `base` off `BASE_PATH`; `{base}/…` or `%sveltekit.assets%` on every asset/link; exact repo-case `/Eman_dashboard`. **Then grep the build output** (see Validation Architecture).
**Warning signs:** Green localhost, broken Pages; 404s all missing `/Eman_dashboard/`.

### Pitfall 2: Missing `.nojekyll` → `_app/` silently dropped (PITFALLS #4)
**What goes wrong:** Jekyll ignores `_`-prefixed dirs; SvelteKit's `_app/` (all JS/CSS chunks) 404s — blank shell, zero styling.
**Why it happens:** Jekyll is on by default for Pages; nothing warns you.
**How to avoid:** adapter-static auto-emits `build/.nojekyll` — **verify it's present after build.** The `upload-pages-artifact` tar path also bypasses the underscore issue, but keep `.nojekyll` as belt-and-suspenders.
**Warning signs:** Everything under `/_app/` 404s; content but no CSS/JS; works in local `preview` (no Jekyll) but not Pages.

### Pitfall 3: No SPA fallback → deep-link/refresh 404 (PITFALLS #5)
**What goes wrong:** Refreshing or sharing a non-root URL returns GitHub's generic 404.
**How to avoid:** `fallback: '404.html'` in the adapter (already in the config above). For Phase 1 there's only `/`, so this is preventive — but it's a DPLY-02 acceptance criterion, so wire it now and verify `build/404.html` exists.

### Pitfall 4: Pages Source not set to "GitHub Actions" (deploy silently publishes nowhere)
**What goes wrong:** The workflow runs green, `deploy-pages` succeeds, but nothing appears at the URL — because Pages is still set to "Deploy from a branch" (or disabled).
**How to avoid:** **Manual one-time step — FLAG TO USER:** Repo → Settings → Pages → Build and deployment → Source = **GitHub Actions**. Or automate via the API (see below). This is the single most common "why isn't my site live" cause and cannot be done from the workflow itself.
**gh CLI automation (optional):**
```bash
gh api -X POST repos/wolfwdavid/Eman_dashboard/pages \
  -f build_type=workflow 2>/dev/null \
  || gh api -X PUT repos/wolfwdavid/Eman_dashboard/pages -f build_type=workflow
```

### Pitfall 5: Windows/pnpm/CI parity (PITFALLS #15)
**What goes wrong:** Local (Windows, case-insensitive FS) build passes; Linux CI fails on `Cannot find module` from an import-case mismatch, or an accidental `package-lock.json` appears.
**How to avoid:** pnpm exclusively; commit `pnpm-lock.yaml`; `.nvmrc` = `22`; match import casing to filenames; `.gitattributes` for LF. The Actions build IS Linux — it will catch case bugs before they hit users.

## Code Examples

### Full `.github/workflows/deploy.yml` (DPLY-03)
Adapted verbatim from the proven sibling `diversityincludesdisability_three`; Node pinned to 22 per this project's decision (sibling used 24 — both satisfy Vite 8's 22.12+ floor). `BASE_PATH` derives from the repo name, so it's automatically `/Eman_dashboard`.
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# Allow one concurrent deployment; let in-progress runs finish.
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        env:
          # GitHub Pages serves the project at /<repo-name>/ → /Eman_dashboard
          BASE_PATH: /${{ github.event.repository.name }}
        run: pnpm run build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Scaffold commands (Windows / pnpm)
```bash
# From the repo root (which already contains .planning/, data/, CLAUDE.md).
# `sv` is the current official CLI (replaces the deprecated `create-svelte`).
# Non-empty dir → sv will ask to confirm; proceed. Choose minimal + TS + tailwindcss.
pnpm dlx sv create . --template minimal --types ts --add tailwindcss --install pnpm

# If the non-empty-dir prompt is a problem, scaffold in a temp dir and copy over:
#   pnpm dlx sv create ../_eman_scaffold --template minimal --types ts --add tailwindcss --install pnpm
#   cp -r ../_eman_scaffold/{src,static,svelte.config.js,vite.config.ts,tsconfig.json,package.json,.npmrc} .

# Then add runtime fonts + test tooling:
pnpm add @fontsource-variable/orbitron @fontsource-variable/inter
pnpm add -D @playwright/test@1.61.1 vitest@4.1.9 svelte-check
pnpm exec playwright install chromium
```
`--add tailwindcss` runs the Tailwind add-on (wires `@tailwindcss/vite` in `vite.config.ts` + `@import "tailwindcss"` in `app.css`). Verify those two edits, then hand-add the `@theme` tokens + `@fontsource` imports shown above. (Flag names verified against the official `sv create` docs; if the interactive prompt is easier on Windows, run `pnpm dlx sv create .` bare and pick: Template=minimal, Type checking=TypeScript, Add-ons=tailwindcss.)

### `.nvmrc`, `.npmrc`, `.gitattributes`
```
# .nvmrc
22
```
```
# .npmrc  (matches proven sibling)
engine-strict=true
auto-install-peers=true
```
```
# .gitattributes  (Windows CRLF guard — PITFALLS #15)
* text=auto eol=lf
*.png binary
*.woff2 binary
```

### Local production-parity check
```bash
# Build WITH the CI base path, then preview. (Without BASE_PATH, base='' and you
# will NOT see the subpath prefixes — you MUST set it to validate base handling.)
BASE_PATH=/Eman_dashboard pnpm build
pnpm preview
```
On Windows PowerShell the inline env-var syntax differs — use:
```powershell
$env:BASE_PATH="/Eman_dashboard"; pnpm build; pnpm preview
```
What to check in `pnpm preview`: the dark gradient + Orbitron title render, and DevTools Network shows asset URLs prefixed with `/Eman_dashboard/_app/…` (not root `/_app/…`). Then inspect the `build/` folder directly (greps below) — the folder contents are the ground truth that gets uploaded to Pages.

## Runtime State Inventory

> This is a greenfield scaffold phase, not a rename/refactor. Included briefly because the repo already exists on GitHub with prior state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore; `data/grants.csv` is a static file consumed in Phase 2, untouched here. | None |
| Live service config | **GitHub Pages Source setting** on `wolfwdavid/Eman_dashboard` — must be set to "GitHub Actions" (lives in repo Settings UI, not git). | Manual one-time set (or `gh api` — see Pitfall 4). FLAG TO USER. |
| OS-registered state | None. | None |
| Secrets/env vars | `BASE_PATH` is injected by the workflow at build time (not a stored secret). No repo secrets needed — `id-token: write` + Pages env handle auth via OIDC. | None |
| Build artifacts | Repo currently has only `.planning/`, `data/`, `CLAUDE.md`, `.git` — no `node_modules`, `build/`, or lockfile yet. `sv create` into a non-empty dir will prompt. | Scaffold handles it; commit `pnpm-lock.yaml`. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm create svelte@latest` / `create-svelte` | `sv create` (`pnpm dlx sv create`) | 2024 (sv CLI GA) | Use `sv`, not `create-svelte` (deprecated). |
| Tailwind v3 + `tailwind.config.js` + PostCSS | Tailwind v4 CSS-first via `@tailwindcss/vite` + `@theme` | Tailwind v4 (2025) | No config file; tokens live in CSS. |
| Svelte 4 `export let` / stores | Svelte 5 runes (`$props`, `$state`) | Svelte 5 (2024) | Layout uses `let { children } = $props()` + `{@render children()}`. |
| `gh-pages` branch / npm package | `actions/deploy-pages` + `upload-pages-artifact` (OIDC) | GitHub Pages Actions GA (2023) | No branch push; artifact tar preserves `_app/`. |

**Deprecated/outdated:**
- `create-svelte` → replaced by `sv create`.
- `svelte-adapter-static` PostCSS-era Tailwind guides → use `@tailwindcss/vite`.
- Any tutorial setting `ssr = false` for static export → wrong for this project (loses prerendered content).

## Open Questions

1. **`sv create` into a non-empty repo directory**
   - What we know: `.planning/`, `data/`, `CLAUDE.md` already exist; sibling projects scaffolded successfully alongside `.planning/`.
   - What's unclear: whether current `sv` prompts or errors on a non-empty dir non-interactively.
   - Recommendation: run interactively (`pnpm dlx sv create .`) and confirm the prompt, or scaffold to a temp dir and copy `src/`, `static/`, and config files over. Low risk either way.

2. **Node 22 vs 24 in CI**
   - What we know: project decision pins Node 22 LTS; the proven sibling `deploy.yml` used Node 24 and works.
   - What's unclear: nothing blocking — both exceed Vite 8's 22.12+ floor.
   - Recommendation: use Node 22 to match `.nvmrc` (single source of truth); revisit only if a dep needs newer.

## Validation Architecture

*(nyquist_validation = true in config.json → this section is REQUIRED.)*

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright `@playwright/test` 1.61.1 (smoke) + shell/grep build-output assertions; vitest 4.1.9 installed for Phase 2 |
| Config file | `playwright.config.ts` — **Wave 0** (does not exist yet) |
| Quick run command | `BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs` (build-output greps, < 10s after build) |
| Full suite command | `pnpm build && pnpm exec playwright test` (build + smoke against `pnpm preview`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DPLY-01 | Full prerender: `build/index.html` + `build/404.html` exist and contain the title text (not an empty shell) | build-output grep | `test -f build/index.html && test -f build/404.html && grep -q "Eman_dashboard" build/index.html` | ❌ Wave 0 (`tools/verify-build.mjs`) |
| DPLY-02a | Base path: every `_app` asset URL is prefixed `/Eman_dashboard/`; **zero** root-absolute `/_app/` refs | build-output grep (build made WITH `BASE_PATH`) | `! grep -rIoE '(href\|src)="/_app/' build/ && grep -rq "/Eman_dashboard/_app/" build/` | ❌ Wave 0 |
| DPLY-02b | `.nojekyll` present in build output | file check | `test -f build/.nojekyll` | ❌ Wave 0 |
| DPLY-02c | SPA fallback `404.html` emitted | file check | `test -f build/404.html` | ❌ Wave 0 |
| DPLY-03 | Live deploy: Pages URL returns 200 + title text | live curl (post-deploy) | `curl -fsSL https://wolfwdavid.github.io/Eman_dashboard/ \| grep -q "Eman_dashboard"` | ❌ Wave 0 (manual/CI, needs live URL) |
| (visual) | Styled shell: dark bg + Orbitron title render under base path | Playwright smoke | `pnpm exec playwright test` (asserts `h1` text + a computed non-transparent bg / font-family) | ❌ Wave 0 (`tests/smoke.spec.ts`) |

### Sampling Rate
- **Per task commit:** `BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs` — the build-output greps are the fast, deterministic gate for DPLY-01/02.
- **Per wave merge:** full build + `pnpm exec playwright test` (smoke) + `pnpm exec svelte-check`.
- **Phase gate:** all build-output checks green, smoke green, **and** the live `curl` returns 200 with the title text after the first successful Actions deploy → then `/gsd:verify-work`.

### Which checks are automatable vs. require the live URL
- **Fully automatable (build-output greps, no network):** DPLY-01 (prerender files + content), DPLY-02a/b/c (base-prefix grep, `.nojekyll`, `404.html`). These run against the local `BASE_PATH=/Eman_dashboard` build — **must** set `BASE_PATH` locally or the greps see `base=''` and give a false pass.
- **Automatable but needs a browser (Playwright):** the styled-shell smoke (title text + font/bg render) against `pnpm preview`.
- **Requires the live Pages URL (manual or post-deploy CI):** DPLY-03 end-to-end — only a real `curl https://wolfwdavid.github.io/Eman_dashboard/` proves `.nojekyll`, base-path, and the Actions publish all worked together on the real host. Base-path 404s are invisible on localhost (PITFALLS #2), so this live check is the true acceptance signal for the phase.

### Wave 0 Gaps
- [ ] `tools/verify-build.mjs` — build-output assertions for DPLY-01/02 (prerender files, base-prefix grep, `.nojekyll`, `404.html`); exit non-zero on any miss. (A committed custom verification tool — aligns with the project's "build custom tools" directive.)
- [ ] `playwright.config.ts` — `webServer: { command: 'pnpm preview', url: 'http://localhost:4173' }`, chromium project.
- [ ] `tests/smoke.spec.ts` — asserts the landing shell renders (title text + Orbitron font-family / dark bg present).
- [ ] Framework install: `pnpm add -D @playwright/test@1.61.1 vitest@4.1.9 svelte-check && pnpm exec playwright install chromium`.
- [ ] (optional) A `verify:live` npm script wrapping the `curl` check for post-deploy confirmation.

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — version-locked manifest (npm registry verified 2026-07-04): kit 2.69.1, svelte 5.56.4, vite 8.1.3, adapter-static 3.0.10, tailwindcss + @tailwindcss/vite 4.3.2, playwright 1.61.1, vitest 4.1.9.
- `.planning/research/PITFALLS.md` — base-path (#2), `.nojekyll` (#4), SPA fallback (#5), Windows/pnpm/CI parity (#15), SSR/WebGL baseline (#1/#3).
- `.planning/research/ARCHITECTURE.md` — deploy architecture, build order (deploy-first), `ssr=true` mandate (#14471).
- Sibling `diversityincludesdisability_three` — live-on-Pages `deploy.yml` + `svelte.config.js` + `.npmrc` (proven in-workspace pattern, copied verbatim).
- SvelteKit official docs — adapter-static / single-page-apps / page-options: https://svelte.dev/docs/kit/adapter-static , https://svelte.dev/docs/kit/single-page-apps
- Tailwind CSS official — SvelteKit v4 install guide (verified 2026-07-04): https://tailwindcss.com/docs/installation/framework-guides/sveltekit
- Svelte CLI docs — `sv create` flags (verified 2026-07-04): https://svelte.dev/docs/cli/sv-create

### Secondary (MEDIUM confidence)
- SvelteKit issue #14471 — `ssr=true` required or prerender emits an empty shell.
- SvelteKit issues #4528 / #10358 — `paths.base` + adapter-static 404 / subfolder asset behavior.

### Tertiary (LOW confidence)
- None — every claim in this phase is backed by an official doc or the proven sibling deploy.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — pins pre-verified in STACK.md against npm today; fonts are stable append-only packages.
- Architecture / config files: **HIGH** — `svelte.config.js` + `deploy.yml` copied from a live sibling; Tailwind v4 + `+layout` patterns confirmed against official docs.
- Pitfalls: **HIGH** — all four owned pitfalls verified against SvelteKit docs + the actual Pages-deploy failure modes catalogued in PITFALLS.md.
- Scaffold exact flags: **MEDIUM** — `sv create` flag names verified against docs, but non-empty-dir behavior on Windows may need the interactive prompt (Open Question #1).

**Research date:** 2026-07-04
**Valid until:** ~2026-08-04 (30 days — stack is stable/pinned; only `sv` CLI flags or Pages Action versions could drift).
