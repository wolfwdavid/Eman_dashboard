---
phase: 01-deploy-skeleton-toolchain
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
  - svelte.config.js
  - vite.config.ts
  - tsconfig.json
  - .nvmrc
  - .npmrc
  - .gitattributes
  - .gitignore
  - tools/verify-build.mjs
  - playwright.config.ts
  - tests/smoke.spec.ts
autonomous: true
requirements: [DPLY-01, DPLY-02]
must_haves:
  truths:
    - "pnpm install runs clean and commits a pnpm-lock.yaml (no package-lock.json)"
    - "svelte.config.js drives paths.base off process.env.BASE_PATH and uses adapter-static with fallback:'404.html'"
    - "The Nyquist verification harness (tools/verify-build.mjs + playwright.config.ts + tests/smoke.spec.ts) exists before the shell it verifies is built"
  artifacts:
    - path: "package.json"
      provides: "Pinned toolchain (kit 2.69, svelte 5.56, vite 8.1, adapter-static 3.0.10, tailwind 4.3.2), fonts, test deps, pnpm scripts"
      contains: "@sveltejs/adapter-static"
    - path: "svelte.config.js"
      provides: "adapter-static + base-from-env + 404 fallback + prerender fail-on-error"
      contains: "process.env.BASE_PATH"
    - path: "vite.config.ts"
      provides: "Tailwind v4 plugin ordered before sveltekit()"
      contains: "tailwindcss()"
    - path: "tools/verify-build.mjs"
      provides: "Build-output assertions: index.html/404.html/.nojekyll exist, base-prefixed _app, zero root-absolute /_app/"
      contains: "/Eman_dashboard/_app/"
    - path: "playwright.config.ts"
      provides: "Smoke runner against pnpm preview at :4173"
      contains: "webServer"
    - path: "tests/smoke.spec.ts"
      provides: "Smoke test asserting the landing title renders under base path"
      contains: "Eman_dashboard"
    - path: ".nvmrc"
      provides: "Node 22 pin"
      contains: "22"
  key_links:
    - from: "svelte.config.js"
      to: "process.env.BASE_PATH"
      via: "paths.base assignment"
      pattern: "base:\\s*process\\.env\\.BASE_PATH"
    - from: "vite.config.ts"
      to: "@tailwindcss/vite"
      via: "plugins array (tailwindcss before sveltekit)"
      pattern: "tailwindcss\\(\\).*sveltekit\\(\\)"
---

<objective>
Scaffold the SvelteKit + Svelte 5 + Tailwind v4 project with the exact pinned toolchain, wire the load-bearing base-path/adapter-static config, and author the Nyquist verification harness (build-output assertions + Playwright smoke) BEFORE any page content exists.

Purpose: Establish a reproducible pnpm/Node-22 toolchain and the config that de-risks GitHub Pages base-path failures — plus the test harness that later waves must turn green. This is the foundation every later phase re-deploys through.
Output: A buildable (default-scaffold) SvelteKit app, all committed config files, and a committed verification harness.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-deploy-skeleton-toolchain/01-RESEARCH.md
@.planning/phases/01-deploy-skeleton-toolchain/01-VALIDATION.md
@.planning/research/STACK.md
@.planning/research/PITFALLS.md

<reference_implementation>
Sibling project `../diversityincludesdisability_three` runs this EXACT stack live on GitHub Pages. Its proven files (read them, then adapt repo name → Eman_dashboard, Node → 22):
- ../diversityincludesdisability_three/svelte.config.js  (base-from-env, adapter-static, fallback:'404.html', strict:true, prerender fail)
- ../diversityincludesdisability_three/vite.config.js     (plugin ordering)
- ../diversityincludesdisability_three/playwright.config.js (webServer → pnpm preview at :4173)
- ../diversityincludesdisability_three/.npmrc              (engine-strict + auto-install-peers)
- ../diversityincludesdisability_three/package.json        (scripts, engines)
</reference_implementation>

<critical_notes>
- pnpm EXCLUSIVELY. Never run npm/npx (creates a competing package-lock.json — PITFALLS #15). If a package-lock.json appears, delete it.
- The repo root already contains `.planning/`, `data/`, `CLAUDE.md`, `tasks/`. `sv create .` into a non-empty dir prompts "directory not empty — continue?"; proceed. If it refuses non-interactively, scaffold into a temp dir (`../_eman_scaffold`) and copy `src/`, `static/`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `package.json`, `.npmrc` over.
- Do NOT install three/@threlte/postprocessing/gsap/papaparse/zod/qrcode/layerchart — those belong to later phases. Dependency-light skeleton only.
- Pins are pre-verified in STACK.md (npm registry, 2026-07-04). Do NOT re-query versions.
</critical_notes>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold SvelteKit + pin toolchain + write config files</name>
  <files>package.json, pnpm-lock.yaml, svelte.config.js, vite.config.ts, tsconfig.json, .nvmrc, .npmrc, .gitattributes, .gitignore</files>
  <read_first>
    - .planning/phases/01-deploy-skeleton-toolchain/01-RESEARCH.md (Scaffold commands; svelte.config.js verbatim; .nvmrc/.npmrc/.gitattributes blocks)
    - .planning/research/STACK.md (version pins table)
    - ../diversityincludesdisability_three/svelte.config.js (proven reference)
    - ../diversityincludesdisability_three/.npmrc
    - ../diversityincludesdisability_three/package.json (scripts/engines pattern)
  </read_first>
  <action>
    From the repo root, scaffold with the official CLI using pnpm (non-empty dir — confirm the prompt; or temp-dir + copy per critical_notes):
    ```
    pnpm dlx sv create . --template minimal --types ts --add tailwindcss --install pnpm
    ```
    `--add tailwindcss` wires `@tailwindcss/vite` in vite config + `@import "tailwindcss"` in app.css. Verify both landed.

    Then add runtime fonts + test tooling (dev):
    ```
    pnpm add @fontsource-variable/orbitron @fontsource-variable/inter
    pnpm add -D @playwright/test@1.61.1 vitest@4.1.9 svelte-check
    pnpm exec playwright install chromium
    ```

    Overwrite **svelte.config.js** with this VERBATIM content (adapted from the proven sibling; repo → Eman_dashboard):
    ```js
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
        prerender: {
          handleHttpError: 'fail',
          handleMissingId: 'fail'
        }
      }
    };

    export default config;
    ```

    Ensure **vite.config.ts** has the Tailwind plugin BEFORE sveltekit():
    ```ts
    import { sveltekit } from '@sveltejs/kit/vite';
    import { defineConfig } from 'vite';
    import tailwindcss from '@tailwindcss/vite';

    export default defineConfig({
      plugins: [tailwindcss(), sveltekit()]
    });
    ```

    Create **.nvmrc**:
    ```
    22
    ```
    Create **.npmrc**:
    ```
    engine-strict=true
    auto-install-peers=true
    ```
    Create **.gitattributes**:
    ```
    * text=auto eol=lf
    *.png binary
    *.woff2 binary
    ```
    Ensure **.gitignore** covers: `node_modules`, `/build`, `/.svelte-kit`, `/package`, `.env`, `.env.*`, `/test-results`, `/playwright-report`, `vite.config.ts.timestamp-*`.

    In **package.json**: set `"engines": { "node": ">=22" }`, `"type": "module"`, and add scripts:
    `"verify:build": "node tools/verify-build.mjs"`,
    `"test:smoke": "playwright test"`,
    `"verify:live": "curl -fsSL https://wolfwdavid.github.io/Eman_dashboard/ | grep -q Eman_dashboard"`.
    Keep the scaffold's `dev`/`build`/`preview` scripts.

    Delete any `package-lock.json` if one appears. Commit `pnpm-lock.yaml`.
  </action>
  <acceptance_criteria>
    - `test -f package.json && test -f pnpm-lock.yaml && ! test -f package-lock.json`
    - `grep -q "process.env.BASE_PATH" svelte.config.js`
    - `grep -q "fallback: '404.html'" svelte.config.js`
    - `grep -q "adapter-static" package.json`
    - vite.config.ts matches `tailwindcss().*sveltekit()` order: `grep -Eq "tailwindcss\(\).*sveltekit\(\)" vite.config.ts` (plugins on one array; if multiline, tailwindcss line precedes sveltekit line)
    - `grep -q "@fontsource-variable/orbitron" package.json && grep -q "@fontsource-variable/inter" package.json`
    - `grep -q "@playwright/test" package.json && grep -q "vitest" package.json`
    - `! grep -q '"three"' package.json && ! grep -q "@threlte" package.json && ! grep -q "gsap" package.json` (deferred deps NOT installed)
    - `cat .nvmrc` is exactly `22`; `.npmrc` contains `engine-strict=true`; `.gitattributes` contains `eol=lf`
    - `grep -q "verify:build" package.json`
    - `BASE_PATH=/Eman_dashboard pnpm build` exits 0 and produces `build/index.html` (default scaffold page is fine at this stage)
  </acceptance_criteria>
  <verify>
    <automated>BASE_PATH=/Eman_dashboard pnpm build && test -f build/index.html && grep -q "process.env.BASE_PATH" svelte.config.js</automated>
  </verify>
  <done>Project scaffolded with pinned toolchain; svelte.config.js/vite.config.ts/.nvmrc/.npmrc/.gitattributes/.gitignore written; fonts + test deps installed; default scaffold builds under BASE_PATH; pnpm-lock.yaml committed, no package-lock.json.</done>
</task>

<task type="auto">
  <name>Task 2: Author the Nyquist verification harness (build-output assertions + Playwright smoke)</name>
  <files>tools/verify-build.mjs, playwright.config.ts, tests/smoke.spec.ts</files>
  <read_first>
    - .planning/phases/01-deploy-skeleton-toolchain/01-VALIDATION.md (Per-Task Verification Map + Wave 0 Requirements)
    - .planning/phases/01-deploy-skeleton-toolchain/01-RESEARCH.md (Validation Architecture; Test map DPLY-01/02 grep commands)
    - ../diversityincludesdisability_three/playwright.config.js (proven webServer pattern)
    - .planning/research/PITFALLS.md (Pitfall 2 base-path grep; Pitfall 4 .nojekyll; Pitfall 5 404.html)
  </read_first>
  <action>
    Create **tools/verify-build.mjs** — a committed custom build-output assertion tool (aligns with the project's "build custom tools" directive). Pure ESM using node:fs. It must, against the `build/` dir:
    1. Assert `build/index.html` exists.
    2. Assert `build/404.html` exists (SPA fallback — DPLY-02).
    3. Assert `build/.nojekyll` exists (Jekyll guard — DPLY-02).
    4. Recursively read every `.html`/`.css`/`.js` under `build/` and FAIL if any contains a root-absolute `_app` reference — i.e. matches `href="/_app/`, `src="/_app/`, or `url(/_app/` (a root-absolute `/_app/` means base was NOT applied → guaranteed Pages 404).
    5. Assert at least one occurrence of `/Eman_dashboard/_app/` exists across the build (proves BASE_PATH was applied — you MUST build with `BASE_PATH=/Eman_dashboard` for this to pass).
    6. Assert `build/index.html` contains the string `Eman_dashboard` (title text — DPLY-01 real content, not an empty shell). NOTE: this check goes green only once Plan 01-02 ships the landing shell; that is expected.
    Print a checklist with pass/fail per check; `process.exit(1)` on ANY failure, `0` on all-pass.

    Reference implementation shape:
    ```js
    import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
    import { join } from 'node:path';

    const BUILD = 'build';
    let failed = false;
    const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failed = true; };

    const walk = (dir, exts) => {
      const out = [];
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) out.push(...walk(p, exts));
        else if (exts.some((x) => p.endsWith(x))) out.push(p);
      }
      return out;
    };

    check(existsSync(join(BUILD, 'index.html')), 'build/index.html exists');
    check(existsSync(join(BUILD, '404.html')), 'build/404.html exists (SPA fallback)');
    check(existsSync(join(BUILD, '.nojekyll')), 'build/.nojekyll exists');

    const files = existsSync(BUILD) ? walk(BUILD, ['.html', '.css', '.js']) : [];
    const rootAbs = /(href|src)="\/_app\/|url\(\/_app\//;
    const offenders = files.filter((f) => rootAbs.test(readFileSync(f, 'utf8')));
    check(offenders.length === 0, `zero root-absolute /_app/ refs (offenders: ${offenders.join(', ') || 'none'})`);

    const based = files.some((f) => readFileSync(f, 'utf8').includes('/Eman_dashboard/_app/'));
    check(based, 'at least one /Eman_dashboard/_app/ ref (BASE_PATH applied)');

    const idx = existsSync(join(BUILD, 'index.html')) ? readFileSync(join(BUILD, 'index.html'), 'utf8') : '';
    check(idx.includes('Eman_dashboard'), 'index.html contains title text "Eman_dashboard"');

    process.exit(failed ? 1 : 0);
    ```

    Create **playwright.config.ts** (adapt the sibling; TS; base path in URL):
    ```ts
    import { defineConfig, devices } from '@playwright/test';
    const PORT = 4173;
    export default defineConfig({
      testDir: './tests',
      fullyParallel: true,
      forbidOnly: !!process.env.CI,
      retries: 0,
      reporter: process.env.CI ? 'github' : 'list',
      use: { baseURL: `http://localhost:${PORT}` },
      projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
      webServer: {
        command: `pnpm exec vite preview --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000
      }
    });
    ```
    NOTE: `vite preview` serves the built app under the base path used at build time. Build with `BASE_PATH=/Eman_dashboard` before running smoke so the served path is `/Eman_dashboard/`.

    Create **tests/smoke.spec.ts** — asserts the deployed shell renders (goes green in 01-02 once the landing shell exists):
    ```ts
    import { expect, test } from '@playwright/test';

    test('landing shell renders under base path with title', async ({ page }) => {
      await page.goto('/Eman_dashboard/');
      // Title text proves CSS/fonts/base-path all resolved.
      await expect(page.locator('h1')).toContainText('Eman_dashboard');
      // Body has a non-transparent dark background (proves app.css loaded).
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    });
    ```
  </action>
  <acceptance_criteria>
    - `test -f tools/verify-build.mjs && node --check tools/verify-build.mjs` (valid ESM)
    - `grep -q "/Eman_dashboard/_app/" tools/verify-build.mjs` (base-prefix assertion present)
    - `grep -q ".nojekyll" tools/verify-build.mjs && grep -q "404.html" tools/verify-build.mjs`
    - `grep -Eq "href.\\)=.\\)./_app/|/_app/" tools/verify-build.mjs` (root-absolute offender regex present)
    - `test -f playwright.config.ts && grep -q "webServer" playwright.config.ts && grep -q "4173" playwright.config.ts`
    - `test -f tests/smoke.spec.ts && grep -q "/Eman_dashboard/" tests/smoke.spec.ts && grep -q "Eman_dashboard" tests/smoke.spec.ts`
    - Running `node tools/verify-build.mjs` against the current (default-scaffold) build exits NON-zero AND prints a `FAIL` line for the title check (proves the tool actually asserts, rather than passing vacuously)
  </acceptance_criteria>
  <verify>
    <automated>node --check tools/verify-build.mjs && test -f playwright.config.ts && test -f tests/smoke.spec.ts && grep -q "/Eman_dashboard/_app/" tools/verify-build.mjs</automated>
  </verify>
  <done>The verification harness exists and is syntactically valid: verify-build.mjs enforces base-prefix + .nojekyll + 404.html + title, playwright.config.ts serves the built site, smoke.spec.ts asserts the shell. The harness is authored before the shell it verifies (Nyquist Wave 0).</done>
</task>

</tasks>

<verification>
- `BASE_PATH=/Eman_dashboard pnpm build` exits 0; `build/index.html` and `build/.nojekyll` present.
- `node --check tools/verify-build.mjs` passes; the tool exits non-zero against the default scaffold (title check fails as expected — proves it asserts).
- `pnpm-lock.yaml` committed; no `package-lock.json`; deferred deps (three/threlte/gsap) absent from package.json.
- `svelte.config.js` base off `process.env.BASE_PATH`; `vite.config.ts` orders `tailwindcss()` before `sveltekit()`.
</verification>

<success_criteria>
Pinned SvelteKit/Svelte5/Tailwind-v4 toolchain scaffolded with pnpm + Node 22, load-bearing base-path/adapter-static config in place, and the Nyquist verification harness authored and committed — ready for the landing shell (01-02) to turn it green.
</success_criteria>

<output>
After completion, create `.planning/phases/01-deploy-skeleton-toolchain/01-01-SUMMARY.md`
</output>
