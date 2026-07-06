---
phase: 01-deploy-skeleton-toolchain
plan: 02
subsystem: ui
tags: [sveltekit, svelte5, tailwindcss-v4, fontsource, orbitron, inter, base-path, prerender, playwright, github-pages]

# Dependency graph
requires:
  - "01-01: pinned toolchain, svelte.config.js (base off BASE_PATH, relative:false), +layout.ts, verify-build.mjs, playwright.config.ts + tests/smoke.spec.ts, static/.nojekyll"
provides:
  - "src/app.css: Tailwind v4 import + self-hosted Orbitron/Inter fonts + @theme dark tokens + explicit background-color/gradient"
  - "src/routes/+layout.svelte: imports ../app.css, renders {@render children()} (Svelte 5 runes)"
  - "src/routes/+page.svelte: styled dark-premium landing shell (Orbitron Eman_dashboard title, DID Grant Command Center subtitle, Crystarium premise, cyan glow)"
  - "app.html favicon routed through %sveltekit.assets% (base-safe); favicon.svg in static/"
  - "Green DPLY-01/DPLY-02 proof: verify-build.mjs exit 0 (all 6 checks) + Playwright smoke pass against the BASE_PATH=/Eman_dashboard build"
  - "playwright.config.ts webServer sets BASE_PATH so preview serves at the production base path"
affects: [01-03-github-actions-deploy, phase-2-data-pipeline, phase-3-crystarium]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "app.css owns Tailwind import + @fontsource + @theme tokens; imported once via +layout.svelte"
    - "favicon via %sveltekit.assets% in app.html (not a $lib import) — base-safe on the subpath"
    - "explicit background-color (not just gradient image) so computed body bg is non-transparent — visible CSS-loaded signal + smoke assertion"
    - "Playwright webServer must set BASE_PATH so SvelteKit's preview serves at the same subpath the build baked in"

key-files:
  created:
    - src/app.css
    - static/favicon.svg
  modified:
    - src/routes/+layout.svelte
    - src/app.html
    - src/routes/+page.svelte
    - playwright.config.ts
  deleted:
    - src/routes/layout.css

key-decisions:
  - "Reconciled scaffold layout.css → src/app.css (plan/verifier require ../app.css import); moved favicon from $lib import to static/ + %sveltekit.assets% so it is base-safe"
  - "Kept favicon as .svg (the scaffold asset) rather than fabricate a .png — the plan explicitly permits matching the actual file extension"
  - "Split background shorthand into explicit background-color + background-image — the smoke test asserts computed backgroundColor, which a gradient-only shorthand leaves transparent"
  - "playwright.config webServer sets BASE_PATH (default /Eman_dashboard) so the preview server serves the subpath instead of the SPA 404 fallback"

requirements-completed: [DPLY-01, DPLY-02]

# Metrics
duration: 14min
completed: 2026-07-04
---

# Phase 1 Plan 02: Landing Shell + Build Verification Summary

**Styled dark-premium SvelteKit landing shell (Orbitron "Eman_dashboard" title / DID Grant Command Center) whose BASE_PATH=/Eman_dashboard build turns the Wave-1 verification harness fully green — verify-build.mjs (all 6 checks) and the Playwright base-path smoke both pass, proving DPLY-01/DPLY-02 locally.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-04T22:19:23Z
- **Completed:** 2026-07-04T22:33:58Z
- **Tasks:** 2
- **Files:** 2 created, 4 modified, 1 deleted

## Accomplishments
- Wired `src/app.css`: Tailwind v4 `@import`, self-hosted `@fontsource-variable/orbitron` + `/inter`, `@theme` dark tokens (void/panel/glow/gold), and a dark radial-gradient background with an explicit non-transparent `background-color`.
- Rewrote `+layout.svelte` to the Svelte 5 runes shell (`import '../app.css'` + `{@render children()}`); moved the favicon out of a `$lib` import and into `static/favicon.svg`, referenced base-safely via `%sveltekit.assets%` in `app.html`.
- Built the styled — not blank — landing shell (`+page.svelte`): gradient-clipped Orbitron **Eman_dashboard** title, gold "Grant Command Center" subtitle, DID eyebrow, Crystarium premise line, cyan glow halo, and a subtle status pulse (reduced-motion guarded). No 3D, no data, no root-absolute URLs.
- Turned the Wave-1 harness green on the `BASE_PATH=/Eman_dashboard` build: `node tools/verify-build.mjs` exits 0 (all 6 checks PASS, including the title-text check that was RED by design in Wave 1), and the Playwright smoke passes (h1 contains "Eman_dashboard", body background non-transparent under `/Eman_dashboard/`). `pnpm run check` (svelte-check) is clean — 0 errors / 0 warnings.

## Task Commits

Each task was committed atomically:

1. **Task 1: app.css tokens/fonts + layout shell + favicon via base + .nojekyll** - `9c17714` (feat)
2. **Task 2: styled landing shell — verify-build + smoke green** - `921f2e2` (feat)

## Files Created/Modified
- `src/app.css` *(created)* - Tailwind import + Orbitron/Inter self-hosted fonts + `@theme` tokens + explicit `background-color` + radial-gradient
- `static/favicon.svg` *(created)* - favicon copied into static so `%sveltekit.assets%` resolves it base-safely
- `src/routes/+layout.svelte` *(modified)* - Svelte 5 runes shell importing `../app.css`, renders `{@render children()}`
- `src/app.html` *(modified)* - favicon `<link>` routed through `%sveltekit.assets%/favicon.svg`
- `src/routes/+page.svelte` *(modified)* - styled dark landing shell (Orbitron title / DID Grant Command Center)
- `playwright.config.ts` *(modified)* - webServer `env.BASE_PATH` so preview serves at the production subpath
- `src/routes/layout.css` *(deleted)* - replaced by `src/app.css`

## Decisions Made
- **Scaffold `layout.css` → `src/app.css`:** the modern `sv` template put the Tailwind import in `src/routes/layout.css` and imported the favicon via `$lib/assets`. The plan and the verifier's key-link require `+layout.svelte` to `import '../app.css'` and the favicon to route through `%sveltekit.assets%`. Reconciled by creating `src/app.css`, moving the favicon into `static/`, and deleting `layout.css`.
- **Favicon kept as `.svg`:** the scaffold ships `favicon.svg`, not `.png`; the plan explicitly permits matching the actual file extension, so no PNG was fabricated.
- **Explicit `background-color` + `background-image`:** a `background:` shorthand carrying only a `radial-gradient` sets `background-image` and leaves computed `background-color` transparent — which fails the smoke test's `getComputedStyle(body).backgroundColor` assertion. Split into an explicit `background-color: var(--color-void)` plus the gradient image.
- **`+layout.ts` untouched:** Wave 1 already shipped `prerender=true; ssr=true; trailingSlash='always'` with the WHY documented — it already satisfies every Task 1 acceptance grep, so no change was needed (ssr stays true; never false).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scaffold layout differed from the plan's app.css / favicon assumptions**
- **Found during:** Task 1
- **Issue:** The `sv` scaffold used `src/routes/layout.css` (imported as `./layout.css`) and injected the favicon via a `$lib/assets/favicon.svg` import in `<svelte:head>`. The plan, its acceptance greps, and the verifier key-links require `+layout.svelte` to `import '../app.css'` and the favicon to route through `%sveltekit.assets%` in `app.html`.
- **Fix:** Created `src/app.css` (full token/font block), rewrote `+layout.svelte` to the plan-verbatim runes shell, copied the favicon to `static/favicon.svg`, added the `%sveltekit.assets%/favicon.svg` link to `app.html`, and deleted `src/routes/layout.css`.
- **Files modified:** src/app.css, src/routes/+layout.svelte, src/app.html, static/favicon.svg, src/routes/layout.css (deleted)
- **Commit:** 9c17714

**2. [Rule 3 - Blocking] Playwright preview served at '/' instead of the base path → smoke hit the 404 fallback**
- **Found during:** Task 2 (first smoke run)
- **Issue:** SvelteKit re-reads `process.env.BASE_PATH` when configuring the `vite preview` server. The Wave-1 `playwright.config.ts` did not set it, so the spawned preview served the site at `/` while the build baked in `/Eman_dashboard/`; the test's `page.goto('/Eman_dashboard/')` resolved to the SPA 404 fallback (`<h1>We couldn't find that page.</h1>`).
- **Fix:** Added `env: { BASE_PATH: process.env.BASE_PATH ?? '/Eman_dashboard' }` to the webServer config so the preview always serves at the production subpath, self-contained (no caller export required).
- **Files modified:** playwright.config.ts
- **Commit:** 921f2e2

**3. [Rule 1 - Bug] Gradient-only background left computed body backgroundColor transparent**
- **Found during:** Task 2 (second smoke run)
- **Issue:** `background: radial-gradient(...)` sets `background-image` only; `getComputedStyle(document.body).backgroundColor` stayed `rgba(0,0,0,0)`, failing the smoke test's non-transparent-background assertion (the CSS-loaded signal).
- **Fix:** Split into explicit `background-color: var(--color-void)` + `background-image: radial-gradient(...)` in `src/app.css`.
- **Files modified:** src/app.css
- **Commit:** 921f2e2

---

**Total deviations:** 3 auto-fixed (2 Rule 3 blocking, 1 Rule 1 bug — all required to satisfy the plan's own acceptance criteria and turn the harness green). No scope creep; deferred deps (three/threlte/gsap/papaparse/etc.) remain uninstalled.

## Issues Encountered
- **Stale `vite preview` servers on :4173:** Playwright's `reuseExistingServer` (true locally) reused a preview process left running from an earlier failed run, which served a pre-fix build and produced false failures. Resolved operationally by killing the lingering listener on 4173 before the final clean run (via `Get-NetTCPConnection … Stop-Process`). No code change — but a note for local re-runs: ensure no orphan preview is bound to 4173, or set `reuseExistingServer:false`.
- **Windows Git Bash MSYS path mangling (carried from Wave 1):** local builds must prefix `MSYS_NO_PATHCONV=1` before `BASE_PATH=/Eman_dashboard pnpm build`; CI (Linux) is unaffected.

## Verification Evidence
- `MSYS_NO_PATHCONV=1 BASE_PATH=/Eman_dashboard pnpm build` → exit 0; `build/` has `index.html`, `404.html`, `.nojekyll`, base-prefixed `/Eman_dashboard/_app/` assets, zero root-absolute `/_app/` refs.
- `node tools/verify-build.mjs` → **exit 0**, all 6 checks PASS (including the title-text check RED by design in Wave 1).
- `pnpm exec playwright test` → **1 passed** (h1 contains "Eman_dashboard"; body background non-transparent under `/Eman_dashboard/`).
- `pnpm run check` (svelte-check) → 0 errors / 0 warnings.

## User Setup Required
None in this plan. (GitHub Pages Source = "GitHub Actions" remains flagged for Plan 01-03, plus the first live-URL `curl` check that only the real Pages deploy can satisfy.)

## Next Phase Readiness
- The styled landing shell renders and prerenders cleanly; DPLY-01/DPLY-02 are proven locally against a base-path build. The `ssr=true` baseline (for later SSR-safe WebGL) is established and visible.
- **Plan 01-03** wires `.github/workflows/deploy.yml`, sets the Pages Source to GitHub Actions, and confirms the live `https://wolfwdavid.github.io/Eman_dashboard/` URL returns 200 with the Orbitron title — the true phase acceptance signal (base-path 404s are invisible on localhost).
- **Local re-run reminders:** prefix `MSYS_NO_PATHCONV=1` before `BASE_PATH=…`; ensure no orphan `vite preview` is bound to :4173 before the smoke test.

## Self-Check: PASSED

All created/modified files present on disk (`src/app.css`, `static/favicon.svg`, `src/routes/+layout.svelte`, `src/app.html`, `src/routes/+page.svelte`, `playwright.config.ts`); `src/routes/layout.css` confirmed deleted; both task commits (`9c17714`, `921f2e2`) found in git history.

---
*Phase: 01-deploy-skeleton-toolchain*
*Completed: 2026-07-04*
