---
phase: 01-deploy-skeleton-toolchain
plan: 01
subsystem: infra
tags: [sveltekit, svelte5, tailwindcss-v4, adapter-static, github-pages, pnpm, playwright, vitest, base-path]

# Dependency graph
requires: []
provides:
  - "Pinned SvelteKit 2.69 / Svelte 5.56 / Vite 8.1 / adapter-static 3.0.10 / Tailwind v4.3 toolchain (pnpm, Node >=22)"
  - "svelte.config.js: base-off-BASE_PATH, relative:false absolute asset URLs, adapter-static + 404 fallback, prerender fail-on-error"
  - "vite.config.ts: @tailwindcss/vite ordered before sveltekit()"
  - "src/routes/+layout.ts: prerender=true, ssr=true, trailingSlash=always"
  - "static/.nojekyll (Pages Jekyll guard — adapter-static 3.0.10 does NOT auto-emit it)"
  - "tools/verify-build.mjs — build-output verifier (index/404/.nojekyll, zero root-absolute /_app/, base-prefixed /Eman_dashboard/_app/, real <title>/<h1> title text)"
  - "playwright.config.ts + tests/smoke.spec.ts — smoke harness against vite preview :4173 under base path"
affects: [01-02-landing-shell, 01-03-github-actions-deploy, phase-2-data-pipeline, phase-3-crystarium]

# Tech tracking
tech-stack:
  added: ["@sveltejs/kit@2.69.1", "svelte@5.56.4", "vite@8.1.3", "@sveltejs/adapter-static@3.0.10", "tailwindcss@4.3.2", "@tailwindcss/vite@4.3.2", "@fontsource-variable/orbitron", "@fontsource-variable/inter", "@playwright/test@1.61.1", "vitest@4.1.9", "svelte-check"]
  patterns: ["base-path-off-env (process.env.BASE_PATH ?? '')", "adapter-static SPA fallback (404.html)", "prerender=true + ssr=true (never ssr=false)", "custom build-output verifier tool", "Nyquist Wave-0 harness authored before the shell it verifies"]

key-files:
  created:
    - svelte.config.js
    - vite.config.ts
    - src/routes/+layout.ts
    - static/.nojekyll
    - tools/verify-build.mjs
    - playwright.config.ts
    - tests/smoke.spec.ts
    - .nvmrc
    - .npmrc
    - .gitattributes
    - .gitignore
  modified:
    - package.json

key-decisions:
  - "Set paths.relative=false so assets emit absolute /Eman_dashboard/_app/ URLs — makes the DPLY-02 base-prefix grep meaningful (relative './_app/' default is unverifiable)"
  - "Added static/.nojekyll (belt-and-suspenders) because adapter-static 3.0.10 does not auto-write it, contrary to the research note"
  - "Restored classic svelte.config.js layout: the current sv template puts kit config in vite.config.ts; moved it to svelte.config.js per the plan/proven-sibling pattern"
  - "verify-build.mjs title check targets <title>/<h1> element text, not a naive whole-file includes() — required because relative:false makes 'Eman_dashboard' appear in asset URLs"

patterns-established:
  - "Local builds on Windows Git Bash must prefix MSYS_NO_PATHCONV=1 (BASE_PATH=/Eman_dashboard would otherwise mangle to a C:/ path); CI (Linux) is unaffected"
  - "Wave-0 verification harness authored before content; title check FAILs on the scaffold by design and 01-02 turns it green"

requirements-completed: [DPLY-01, DPLY-02]

# Metrics
duration: 13min
completed: 2026-07-04
---

# Phase 1 Plan 01: Scaffold + Toolchain + Test Infra Summary

**Pinned SvelteKit 5 + Tailwind v4 static toolchain (pnpm/Node 22) with base-path-from-env adapter-static config and a custom Nyquist build-verifier that greps the build output for GitHub Pages base-path safety.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-04T22:02:06Z
- **Completed:** 2026-07-04T22:14:52Z
- **Tasks:** 2
- **Files modified:** 12 (created) + 1 (package.json)

## Accomplishments
- Scaffolded a buildable SvelteKit app with the exact pinned stack (kit 2.69.1, svelte 5.56.4, vite 8.1.3, adapter-static 3.0.10, tailwind 4.3.2), pnpm-lock committed, zero package-lock.json.
- Wired the load-bearing GitHub Pages config: base off `process.env.BASE_PATH`, `relative:false` absolute asset URLs, `fallback:'404.html'`, prerender fail-on-error, `+layout.ts` (prerender/ssr/trailingSlash), and `static/.nojekyll`.
- `BASE_PATH=/Eman_dashboard pnpm build` produces `build/` with `index.html`, `404.html`, `.nojekyll`, base-prefixed `/Eman_dashboard/_app/` assets, and zero root-absolute `/_app/` refs.
- Authored the Wave-0 verification harness (`tools/verify-build.mjs` + `playwright.config.ts` + `tests/smoke.spec.ts`) before the shell it verifies; the tool correctly PASSes 5 structural checks and FAILs the title check against the default scaffold (exit 1) — proving it asserts non-vacuously. `pnpm run check` (svelte-check) is clean (0 errors/0 warnings).

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold SvelteKit + pin toolchain + write config files** - `975b62f` (chore)
2. **Task 2: Author the Nyquist verification harness** - `d442fd9` (test)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `svelte.config.js` - adapter-static, base off BASE_PATH, relative:false, 404 fallback, prerender fail-on-error
- `vite.config.ts` - tailwindcss() before sveltekit()
- `src/routes/+layout.ts` - prerender=true, ssr=true, trailingSlash='always'
- `static/.nojekyll` - Pages Jekyll guard (not auto-emitted by adapter-static 3.0.10)
- `tools/verify-build.mjs` - custom build-output verifier (DPLY-01/02 assertions)
- `playwright.config.ts` - smoke runner against vite preview :4173
- `tests/smoke.spec.ts` - landing shell renders under /Eman_dashboard/ base path
- `.nvmrc` / `.npmrc` / `.gitattributes` / `.gitignore` - Node 22 pin, engine-strict, LF guard, ignores
- `package.json` - name/engines>=22, adapter-static, fonts, test deps, verify/test scripts

## Decisions Made
- **paths.relative=false:** emit absolute `/Eman_dashboard/_app/` URLs so the DPLY-02 base-prefix grep is meaningful. The SvelteKit default (`relative:true`) emits `./_app/` relative paths where `/Eman_dashboard/_app/` never literally appears, making the plan's verifier check #5 impossible to satisfy.
- **static/.nojekyll added:** adapter-static 3.0.10 does not auto-write `.nojekyll` (verified against the adapter source); the research note claiming it does is outdated for this version. The research itself endorses a `static/.nojekyll` belt-and-suspenders.
- **verify-build.mjs title check hardened:** targets `<title>`/`<h1>` element text rather than a whole-file `includes('Eman_dashboard')`, because with `relative:false` the string appears in asset URLs and would pass vacuously — violating Task 2 acceptance criterion #7.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Modern `sv` template moved kit config into vite.config.ts; no svelte.config.js**
- **Found during:** Task 1 (Scaffold)
- **Issue:** `sv create` (CLI v0.16.1) scaffolds the newer layout where kit config lives inside the `sveltekit()` vite plugin and there is no `svelte.config.js`. The plan, its acceptance greps, and the proven sibling all require a `svelte.config.js` driving `paths.base` off `BASE_PATH`.
- **Fix:** Wrote `svelte.config.js` (plan-verbatim + `relative:false`) holding the kit config, and reset `vite.config.ts` to the clean `[tailwindcss(), sveltekit()]` plugin array.
- **Files modified:** svelte.config.js, vite.config.ts
- **Verification:** `BASE_PATH=/Eman_dashboard pnpm build` succeeds; `svelte-kit sync`/`svelte-check` clean.
- **Committed in:** 975b62f

**2. [Rule 3 - Blocking] No index.html without prerender=true**
- **Found during:** Task 1 (build acceptance)
- **Issue:** With `adapter-static` + `fallback:'404.html'` and no `prerender`, the build emitted only `404.html` — no `build/index.html`, failing Task 1's acceptance criterion.
- **Fix:** Added `src/routes/+layout.ts` with `prerender=true; ssr=true; trailingSlash='always'` (research Pattern 2 — the correct load-bearing baseline).
- **Files modified:** src/routes/+layout.ts
- **Verification:** `build/index.html` now present (3–4 KB, real content).
- **Committed in:** 975b62f

**3. [Rule 3 - Blocking] .nojekyll not auto-emitted; base-prefix URLs not present by default**
- **Found during:** Task 1 (build-output inspection)
- **Issue:** (a) `build/.nojekyll` was absent — adapter-static 3.0.10 does not write it. (b) Default `relative:true` emitted `./_app/` relative paths, so the required `/Eman_dashboard/_app/` prefix never appeared.
- **Fix:** Added `static/.nojekyll`; set `paths.relative=false` in svelte.config.js.
- **Files modified:** static/.nojekyll, svelte.config.js
- **Verification:** `build/.nojekyll` present; `grep -o '/Eman_dashboard/_app/'` matches; zero root-absolute `/_app/`.
- **Committed in:** 975b62f

**4. [Rule 1 - Bug] verify-build title check would pass vacuously under relative:false**
- **Found during:** Task 2 (harness authoring)
- **Issue:** The plan's reference `idx.includes('Eman_dashboard')` passes even on the scaffold because `relative:false` puts "Eman_dashboard" in every asset URL — defeating Task 2 acceptance criterion #7 (tool must FAIL the title check on the scaffold).
- **Fix:** Title check now extracts `<title>`/`<h1>` element text and asserts the string there, not anywhere in the file.
- **Files modified:** tools/verify-build.mjs
- **Verification:** Against the default scaffold the tool prints `FAIL index.html renders title text...` and exits 1, with the other 5 checks PASS.
- **Committed in:** d442fd9

---

**Total deviations:** 4 auto-fixed (all Rule 3 blocking / Rule 1 bug — required to satisfy the plan's own acceptance criteria)
**Impact on plan:** All fixes were necessary to make the build produce the artifacts the plan asserts and to make the verifier assert non-vacuously. No scope creep; deferred deps (three/threlte/gsap) remain uninstalled.

## Issues Encountered
- **Windows Git Bash MSYS path mangling:** `BASE_PATH=/Eman_dashboard pnpm build` failed with "base ... must be a root-relative path" because MSYS rewrote `/Eman_dashboard` to `C:/Program Files/Git/Eman_dashboard`. Resolved locally by prefixing `MSYS_NO_PATHCONV=1`. CI runs on Linux and is unaffected — no code change needed, but documented for anyone building locally on Windows.
- **`sv create --add` non-interactive syntax:** the tailwindcss add-on prompts for sub-plugins; resolved with `tailwindcss="plugins:none"` and `--no-dir-check` and scaffolding into a temp dir then copying (`sv create` refused the interactive non-empty-dir prompt).

## User Setup Required
None — no external service configuration in this plan. (GitHub Pages Source = "GitHub Actions" is flagged for Plan 01-03.)

## Next Phase Readiness
- Toolchain, base-path config, and the verification harness are in place and committed. The verifier's title check is intentionally RED — **Plan 01-02** ships the styled dark landing shell (Orbitron title / DID grant command center) with app.css/fonts and turns the harness green on a `BASE_PATH` build.
- **Reminder for local Windows builds:** prefix `MSYS_NO_PATHCONV=1` before `BASE_PATH=...`.

## Self-Check: PASSED

All 14 created/modified files present on disk; no package-lock.json; both task commits (975b62f, d442fd9) found in git history.

---
*Phase: 01-deploy-skeleton-toolchain*
*Completed: 2026-07-04*
