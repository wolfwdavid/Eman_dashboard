---
phase: 01-deploy-skeleton-toolchain
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/routes/+layout.ts
  - src/routes/+layout.svelte
  - src/routes/+page.svelte
  - src/app.css
  - src/app.html
  - static/.nojekyll
  - static/favicon.png
autonomous: true
requirements: [DPLY-01, DPLY-02]
must_haves:
  truths:
    - "A styled dark premium landing page renders with an Orbitron display title (not a blank/unstyled shell)"
    - "BASE_PATH=/Eman_dashboard build output prefixes every _app asset with /Eman_dashboard/ and has zero root-absolute /_app/ refs"
    - "build/.nojekyll and build/404.html are emitted"
    - "tools/verify-build.mjs and the Playwright smoke test both pass against the BASE_PATH build"
  artifacts:
    - path: "src/routes/+layout.ts"
      provides: "prerender=true, ssr=true (WHY documented), trailingSlash='always'"
      contains: "export const ssr = true"
    - path: "src/routes/+layout.svelte"
      provides: "imports app.css, renders children via Svelte 5 runes"
      contains: "@render children()"
    - path: "src/app.css"
      provides: "Tailwind import + @theme tokens + self-hosted Orbitron/Inter fonts + dark background"
      contains: "@import \"tailwindcss\""
    - path: "src/routes/+page.svelte"
      provides: "Styled dark landing shell with Orbitron title / DID grant command center"
      min_lines: 20
    - path: "static/.nojekyll"
      provides: "Belt-and-suspenders Jekyll guard"
  key_links:
    - from: "src/routes/+layout.svelte"
      to: "src/app.css"
      via: "import '../app.css'"
      pattern: "import '\\.\\./app\\.css'"
    - from: "src/app.css"
      to: "@fontsource-variable/orbitron"
      via: "@import"
      pattern: "@fontsource-variable/orbitron"
    - from: "src/app.html"
      to: "favicon"
      via: "%sveltekit.assets% base substitution"
      pattern: "%sveltekit.assets%"
---

<objective>
Build the styled dark-premium landing shell (Orbitron title, DID grant command center identity) and wire the prerender/SSR/base-path options, then prove the whole DPLY-01/DPLY-02 contract locally by turning the Wave-1 verification harness green.

Purpose: This is the visible acceptance signal for the phase — a deployed URL showing the dark gradient + Orbitron title proves CSS + fonts + base-path all resolve (not just on localhost). It also establishes the ssr=true baseline that later phases' SSR-safe WebGL depends on.
Output: A styled, prerendering landing page whose BASE_PATH build passes verify-build.mjs and the Playwright smoke test.
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
@.planning/research/PITFALLS.md

<interfaces>
From Plan 01-01 (already on disk — use directly, no exploration):
- svelte.config.js: paths.base = process.env.BASE_PATH ?? '' ; adapter-static fallback:'404.html'
- tools/verify-build.mjs: asserts build/index.html, build/404.html, build/.nojekyll, base-prefixed /Eman_dashboard/_app/, zero root-absolute /_app/, and index.html contains "Eman_dashboard"
- tests/smoke.spec.ts: navigates to /Eman_dashboard/, expects h1 to contain "Eman_dashboard" and a non-transparent body background
- playwright.config.ts: webServer runs `vite preview` at :4173
- package.json scripts: `verify:build`, `test:smoke`
</interfaces>

<critical_notes>
- NEVER set `export const ssr = false`. With adapter-static that emits an empty shell and discards prerendered content (SvelteKit #14471). Keep ssr=true; document WHY inline.
- Every internal link/asset MUST route through `base` from `$app/paths`, or `%sveltekit.assets%` in app.html. Root-absolute URLs (`/foo`, `href="/"`, `url(/...)`) 404 on the subpath (PITFALLS #2, the #1 killer).
- You MUST build with `BASE_PATH=/Eman_dashboard` to validate base handling. Without it, base='' and the greps give a false pass. On PowerShell: `$env:BASE_PATH="/Eman_dashboard"; pnpm build`. On bash: `BASE_PATH=/Eman_dashboard pnpm build`.
- No 3D, no data, no external font CDN. Self-hosted fonts only.
</critical_notes>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire prerender/SSR/base options + app.css tokens/fonts + layout + .nojekyll</name>
  <files>src/routes/+layout.ts, src/routes/+layout.svelte, src/app.css, src/app.html, static/.nojekyll</files>
  <read_first>
    - .planning/phases/01-deploy-skeleton-toolchain/01-RESEARCH.md (Pattern 2 +layout.ts; Tailwind v4 app.css block; Pattern 3 %sveltekit.assets% favicon)
    - src/routes/+layout.svelte (scaffold default — replace)
    - src/app.css (scaffold default from tailwind add-on — extend)
    - src/app.html (scaffold default — edit favicon line)
    - .planning/research/PITFALLS.md (Pitfall 1/3 ssr=true mandate; Pitfall 4 .nojekyll)
  </read_first>
  <action>
    Create **src/routes/+layout.ts** VERBATIM (document WHY ssr stays true):
    ```ts
    export const prerender = true;    // fully static — every route → HTML at build time
    export const ssr = true;          // keep SSR so pages prerender WITH real content.
                                      // NEVER set ssr=false: adapter-static would emit an empty
                                      // shell (SvelteKit #14471) and later phases' SSR-safe WebGL
                                      // relies on this baseline (browser-gate the Canvas, not SSR).
    export const trailingSlash = 'always'; // directory-style URLs — no Pages redirect surprises
    ```

    Replace **src/routes/+layout.svelte** with the Svelte 5 runes shell:
    ```svelte
    <script lang="ts">
      import '../app.css';
      let { children } = $props();
    </script>

    {@render children()}
    ```

    Extend **src/app.css** so it reads (keep the tailwind add-on's `@import "tailwindcss"` line, add the rest):
    ```css
    @import "tailwindcss";

    /* Self-hosted variable fonts (no external CDN) */
    @import "@fontsource-variable/orbitron";
    @import "@fontsource-variable/inter";

    @theme {
      --font-display: "Orbitron Variable", ui-sans-serif, system-ui, sans-serif;
      --font-body: "Inter Variable", ui-sans-serif, system-ui, sans-serif;

      --color-void: #05060a;
      --color-panel: #0d1018;
      --color-glow: #38e8ff;
      --color-gold: #ffcf6b;
    }

    html, body {
      background: radial-gradient(ellipse at top, #0b1020 0%, var(--color-void) 60%);
      color: #e8ecf4;
      font-family: var(--font-body);
      min-height: 100%;
    }
    h1, h2, .display { font-family: var(--font-display); }
    ```

    Edit **src/app.html**: the favicon `<link>` MUST use `%sveltekit.assets%` (SvelteKit substitutes the base):
    ```html
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    ```
    Keep a `favicon.png` at `static/favicon.png` (the scaffold provides one; if it's `favicon.svg`, update the href extension to match the actual file).

    Create an empty **static/.nojekyll** (belt-and-suspenders; adapter also auto-emits it into build/).
  </action>
  <acceptance_criteria>
    - `grep -q "export const prerender = true" src/routes/+layout.ts`
    - `grep -q "export const ssr = true" src/routes/+layout.ts` AND `! grep -q "ssr = false" src/routes/+layout.ts`
    - `grep -q "trailingSlash = 'always'" src/routes/+layout.ts`
    - `grep -q "import '../app.css'" src/routes/+layout.svelte && grep -q "@render children()" src/routes/+layout.svelte`
    - `grep -q '@import "tailwindcss"' src/app.css && grep -q "@fontsource-variable/orbitron" src/app.css && grep -q "@fontsource-variable/inter" src/app.css`
    - `grep -q "@theme" src/app.css && grep -q "radial-gradient" src/app.css`
    - `grep -q "%sveltekit.assets%" src/app.html`
    - `test -f static/.nojekyll`
  </acceptance_criteria>
  <verify>
    <automated>grep -q "export const ssr = true" src/routes/+layout.ts && ! grep -q "ssr = false" src/routes/+layout.ts && grep -q "@fontsource-variable/orbitron" src/app.css && test -f static/.nojekyll</automated>
  </verify>
  <done>Root layout sets prerender+ssr+trailingSlash (ssr=true documented), app.css imports Tailwind + self-hosted Orbitron/Inter + dark tokens/gradient, app.html favicon routes through %sveltekit.assets%, static/.nojekyll present.</done>
</task>

<task type="auto">
  <name>Task 2: Build the styled landing shell and turn the verification harness green</name>
  <files>src/routes/+page.svelte</files>
  <read_first>
    - .planning/phases/01-deploy-skeleton-toolchain/01-RESEARCH.md (The styled landing shell — acceptance signal)
    - .planning/phases/01-deploy-skeleton-toolchain/01-CONTEXT.md (Specific Ideas: styled not blank, project title / DID grant command center)
    - src/routes/+page.svelte (scaffold default — replace)
    - tools/verify-build.mjs (the assertions this task must satisfy)
    - tests/smoke.spec.ts (the smoke expectations this task must satisfy)
  </read_first>
  <action>
    Replace **src/routes/+page.svelte** with a styled dark-premium landing shell. Requirements:
    - An `<h1>` containing the exact text `Eman_dashboard` (the smoke test + verify-build.mjs assert this string), rendered in the Orbitron display font.
    - A subtitle identifying it as the DID grant command center (e.g. "Diversity Includes Disability — Grant Command Center").
    - A short line establishing the Crystarium premise (e.g. "A Crystarium sphere-grid view of the funding pipeline — coming online.").
    - Use Tailwind utility classes for layout (full-height flex-center column, generous spacing, subtle glow accent using the `--color-glow`/`--color-gold` tokens via arbitrary values or a small `<style>` block).
    - If you add ANY internal link or asset, route it through `base`:
      ```svelte
      <script lang="ts">
        import { base } from '$app/paths';
      </script>
      ```
      Do NOT use root-absolute `href="/..."` or `src="/..."`. (Phase 1 has no nav, so this may be unused — but if present, it must use base.)
    - No 3D, no data fetch, no images loaded by absolute path.

    Then run the full local production-parity verification (bash syntax; PowerShell equivalent: `$env:BASE_PATH="/Eman_dashboard"; pnpm build`):
    ```
    BASE_PATH=/Eman_dashboard pnpm build
    node tools/verify-build.mjs        # must exit 0 — all checks PASS now
    pnpm exec playwright test          # smoke: h1 contains Eman_dashboard, dark bg
    ```
    Fix any base-path offenders the tool reports (root-absolute `/_app/` → indicates a link/asset bypassing base). Iterate until both are green.
  </action>
  <acceptance_criteria>
    - `grep -q "Eman_dashboard" src/routes/+page.svelte` and an `<h1>` element is present
    - `src/routes/+page.svelte` uses `base` from `$app/paths` for any internal href/src, OR contains no internal href/src at all: `! grep -Eq '(href|src)="/[^/]' src/routes/+page.svelte` (no root-absolute internal URLs)
    - After `BASE_PATH=/Eman_dashboard pnpm build`: `test -f build/index.html && test -f build/404.html && test -f build/.nojekyll`
    - `grep -q "Eman_dashboard" build/index.html` (real prerendered content — DPLY-01)
    - Zero root-absolute _app refs: `! grep -rIED 'href="/_app/\|src="/_app/' build/` (verify-build.mjs enforces this)
    - `grep -rq "/Eman_dashboard/_app/" build/` (base applied — DPLY-02)
    - `node tools/verify-build.mjs` exits 0 (all checks pass)
    - `pnpm exec playwright test` passes (smoke green)
  </acceptance_criteria>
  <verify>
    <automated>BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs && pnpm exec playwright test</automated>
  </verify>
  <done>Styled dark landing shell with Orbitron "Eman_dashboard" title renders; BASE_PATH build emits base-prefixed assets + .nojekyll + 404.html + real title content; verify-build.mjs and Playwright smoke both green — DPLY-01 and DPLY-02 proven locally.</done>
</task>

</tasks>

<verification>
- `BASE_PATH=/Eman_dashboard pnpm build && node tools/verify-build.mjs` → exit 0 (index.html, 404.html, .nojekyll present; base-prefixed _app; zero root-absolute /_app/; title text present).
- `pnpm exec playwright test` → smoke green (title + dark bg render under /Eman_dashboard/).
- `+layout.ts` has ssr=true (never false); app.css imports Tailwind + self-hosted fonts; favicon via %sveltekit.assets%.
</verification>

<success_criteria>
A styled — not blank — dark premium landing page with the Orbitron project title renders and prerenders cleanly; the BASE_PATH build passes every DPLY-01/DPLY-02 build-output assertion and the Playwright smoke test locally, establishing the ssr=true baseline for later phases.
</success_criteria>

<output>
After completion, create `.planning/phases/01-deploy-skeleton-toolchain/01-02-SUMMARY.md`
</output>
