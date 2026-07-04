---
phase: 01-deploy-skeleton-toolchain
plan: 03
type: execute
wave: 3
depends_on: [02]
files_modified:
  - .github/workflows/deploy.yml
autonomous: false
requirements: [DPLY-03]
user_setup:
  - service: github-pages
    why: "The workflow can only publish once the repo's Pages source is set to GitHub Actions (one-time repo setting, not code)"
    dashboard_config:
      - task: "Set Pages Source = GitHub Actions"
        location: "github.com/wolfwdavid/Eman_dashboard → Settings → Pages → Build and deployment → Source = GitHub Actions (or `gh api -X POST repos/wolfwdavid/Eman_dashboard/pages -f build_type=workflow`)"
must_haves:
  truths:
    - "Pushing to main triggers a GitHub Actions workflow that builds with BASE_PATH=/Eman_dashboard and publishes to Pages"
    - "The repo's Pages source is set to GitHub Actions"
    - "The live https://wolfwdavid.github.io/Eman_dashboard/ URL returns 200 with the styled title and no 404s in the network tab"
  artifacts:
    - path: ".github/workflows/deploy.yml"
      provides: "build + deploy jobs; pages:write + id-token:write; BASE_PATH from repo name; upload-pages-artifact + deploy-pages; concurrency"
      contains: "actions/deploy-pages@v4"
  key_links:
    - from: ".github/workflows/deploy.yml"
      to: "BASE_PATH build"
      via: "env BASE_PATH: /${{ github.event.repository.name }}"
      pattern: "BASE_PATH:\\s*/\\$\\{\\{\\s*github.event.repository.name"
    - from: ".github/workflows/deploy.yml (build job)"
      to: "deploy job"
      via: "upload-pages-artifact path: build → deploy-pages"
      pattern: "upload-pages-artifact"
---

<objective>
Add the GitHub Actions workflow that builds with the correct base path and publishes to GitHub Pages on push to main, set the one-time Pages source, and prove the whole pipeline end-to-end on the real live URL — the true acceptance signal that base-path/.nojekyll/prerender all work together on the real host.

Purpose: Close DPLY-03 and confirm DPLY-01/DPLY-02 survive a real Pages deploy (base-path 404s are invisible on localhost — PITFALLS #2). Every later phase re-deploys through this pipeline.
Output: A committed deploy.yml, Pages configured, and a verified-live styled site.
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

<reference_implementation>
Sibling `../diversityincludesdisability_three/.github/workflows/deploy.yml` runs this exact deploy live on Pages. The research already adapted it verbatim (Node → 22). Reuse the research block below directly.
</reference_implementation>

<critical_notes>
- Repo `wolfwdavid/Eman_dashboard` already exists and is pushed. The default branch is `main`.
- `BASE_PATH` derives from `${{ github.event.repository.name }}` → automatically `/Eman_dashboard`. Do NOT hardcode it wrong-cased.
- The Pages "Source = GitHub Actions" setting CANNOT be done from the workflow. It is a one-time repo setting — automate via `gh api` if authed, otherwise it is a human checkpoint. Without it the workflow runs green but publishes nowhere (PITFALLS Pitfall 4).
- `permissions: pages: write, id-token: write` and the `github-pages` environment are required for OIDC deploy.
</critical_notes>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write the GitHub Actions deploy workflow</name>
  <files>.github/workflows/deploy.yml</files>
  <read_first>
    - .planning/phases/01-deploy-skeleton-toolchain/01-RESEARCH.md (Full deploy.yml under "Code Examples")
    - ../diversityincludesdisability_three/.github/workflows/deploy.yml (proven live reference)
  </read_first>
  <action>
    Create **.github/workflows/deploy.yml** VERBATIM (from research; Node pinned to 22):
    ```yaml
    name: Deploy to GitHub Pages

    on:
      push:
        branches: [main]
      workflow_dispatch:

    permissions:
      contents: read
      pages: write
      id-token: write

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
    Verify `pnpm-lock.yaml` is committed (the workflow uses `--frozen-lockfile`; a stale/missing lockfile fails CI).
  </action>
  <acceptance_criteria>
    - `test -f .github/workflows/deploy.yml`
    - `grep -q "pages: write" .github/workflows/deploy.yml && grep -q "id-token: write" .github/workflows/deploy.yml`
    - `grep -q "BASE_PATH: /\${{ github.event.repository.name }}" .github/workflows/deploy.yml`
    - `grep -q "actions/upload-pages-artifact@v3" .github/workflows/deploy.yml && grep -q "actions/deploy-pages@v4" .github/workflows/deploy.yml`
    - `grep -q "branches: \[main\]" .github/workflows/deploy.yml`
    - `grep -q "node-version: 22" .github/workflows/deploy.yml`
    - `grep -q "group: pages" .github/workflows/deploy.yml` (concurrency)
    - `test -f pnpm-lock.yaml`
  </acceptance_criteria>
  <verify>
    <automated>test -f .github/workflows/deploy.yml && grep -q "id-token: write" .github/workflows/deploy.yml && grep -q "actions/deploy-pages@v4" .github/workflows/deploy.yml && grep -q "node-version: 22" .github/workflows/deploy.yml</automated>
  </verify>
  <done>deploy.yml committed: build job installs pnpm + Node 22, builds with BASE_PATH from repo name, uploads the build artifact; deploy job publishes via deploy-pages with pages:write + id-token:write + concurrency.</done>
</task>

<task type="auto">
  <name>Task 2: Set Pages source, push to main, confirm the Actions run and live URL</name>
  <files>(no files — CI/CLI actions: gh api, git push, gh run watch, curl)</files>
  <read_first>
    - .planning/phases/01-deploy-skeleton-toolchain/01-RESEARCH.md (Pitfall 4 gh CLI automation; verify:live curl)
    - .planning/phases/01-deploy-skeleton-toolchain/01-VALIDATION.md (Manual-Only Verifications)
  </read_first>
  <action>
    1. Set the Pages source to GitHub Actions (attempt automation first):
       ```
       gh api -X POST repos/wolfwdavid/Eman_dashboard/pages -f build_type=workflow 2>/dev/null \
         || gh api -X PUT repos/wolfwdavid/Eman_dashboard/pages -f build_type=workflow
       ```
       If `gh` is not authenticated / the call fails, STOP and flag it as a human step (see the checkpoint task): Settings → Pages → Build and deployment → Source = GitHub Actions.
    2. Commit and push the phase to `main` (this triggers the workflow):
       ```
       git add -A && git commit -m "feat(01): deploy skeleton — SvelteKit + Pages pipeline"
       git push origin main
       ```
    3. Watch the run to completion:
       ```
       gh run watch --exit-status || gh run list --limit 1
       ```
    4. Once the run succeeds, verify the live URL returns 200 with the title text:
       ```
       curl -fsSL https://wolfwdavid.github.io/Eman_dashboard/ | grep -q Eman_dashboard
       ```
       (Pages may take 30-60s to propagate after the first deploy; retry the curl a few times.)
  </action>
  <acceptance_criteria>
    - `gh run list --limit 1` shows the "Deploy to GitHub Pages" workflow with conclusion `success`
    - `curl -fsSL https://wolfwdavid.github.io/Eman_dashboard/ | grep -q Eman_dashboard` exits 0 (live site serves the styled title)
    - `curl -fsSL https://wolfwdavid.github.io/Eman_dashboard/ | grep -q "/Eman_dashboard/_app/"` (base-prefixed assets on the live host — DPLY-02 proven on real Pages)
    - `gh api repos/wolfwdavid/Eman_dashboard/pages --jq .build_type` returns `workflow`
  </acceptance_criteria>
  <verify>
    <automated>gh run list --limit 1 && curl -fsSL https://wolfwdavid.github.io/Eman_dashboard/ | grep -q Eman_dashboard</automated>
  </verify>
  <done>Pages source = GitHub Actions; push to main triggered a successful workflow run; the live github.io/Eman_dashboard/ URL returns 200 with the styled title and base-prefixed assets.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human confirms the live styled site with no 404s</name>
  <files>(no files — human visual + network-tab verification of the live Pages URL)</files>
  <action>Human-in-the-loop verification only: the executor presents the live URL and the human confirms the styled render and zero 404s per the how-to-verify steps below. No files are edited in this task.</action>
  <what-built>
    A GitHub Actions pipeline deployed the styled SvelteKit landing shell to the real GitHub Pages URL. `deploy.yml` builds with BASE_PATH=/Eman_dashboard and publishes via deploy-pages; Task 2 set the Pages source and confirmed the run + a live curl.
  </what-built>
  <how-to-verify>
    1. Open https://wolfwdavid.github.io/Eman_dashboard/ in a browser.
    2. Confirm you see a STYLED dark-premium page (radial dark gradient background) with the Orbitron "Eman_dashboard" title and the DID grant command center subtitle — NOT a blank/white/unstyled page.
    3. Open DevTools → Network tab, hard-refresh (Ctrl+Shift+R), and confirm ZERO 404s — every `_app/…` asset request is 200 and its URL includes the `/Eman_dashboard/` segment.
    4. (Required — ROADMAP success criterion) Visit a deep path like https://wolfwdavid.github.io/Eman_dashboard/nope/ and confirm it falls back via the app's own 404.html (styled, with the Eman_dashboard title) rather than GitHub's raw generic 404 page. This proves the SPA `fallback: '404.html'` works on the real host.
    If the Pages source was not auto-set by `gh api`, set it now: repo Settings → Pages → Source = GitHub Actions, then re-run the workflow (Actions tab → Deploy → Re-run) and re-check.
  </how-to-verify>
  <resume-signal>Type "approved" if the styled site loads with no 404s, or describe what you see (blank page / 404s / wrong assets).</resume-signal>
  <verify>
    <automated>curl -fsSL https://wolfwdavid.github.io/Eman_dashboard/ | grep -q Eman_dashboard</automated>
  </verify>
  <done>Human has confirmed the live https://wolfwdavid.github.io/Eman_dashboard/ page renders styled (dark gradient + Orbitron title) with zero 404s in the network tab.</done>
</task>

</tasks>

<verification>
- `.github/workflows/deploy.yml` present with pages:write + id-token:write, BASE_PATH from repo name, upload-pages-artifact + deploy-pages, concurrency, Node 22.
- Latest "Deploy to GitHub Pages" run conclusion = success.
- `curl https://wolfwdavid.github.io/Eman_dashboard/` returns 200 with title text and base-prefixed `/Eman_dashboard/_app/` assets.
- Human confirms the live styled page with zero 404s in the network tab.
</verification>

<success_criteria>
Pushing to main builds and publishes the styled skeleton to GitHub Pages automatically; the live https://wolfwdavid.github.io/Eman_dashboard/ URL serves the dark premium landing shell with correct base-path assets and no 404s — DPLY-01, DPLY-02, and DPLY-03 all proven end-to-end on the real host.
</success_criteria>

<output>
After completion, create `.planning/phases/01-deploy-skeleton-toolchain/01-03-SUMMARY.md`
</output>
