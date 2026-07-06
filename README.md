# Eman_dashboard — Grant Crystarium

A premium 3D FFXIII-Crystarium grant/funding command center for Diversity Includes Disability.
**Live:** https://wolfwdavid.github.io/Eman_dashboard/

SvelteKit 2 · Svelte 5 (runes) · Threlte 8 / three@0.185.1 (pinned) · postprocessing · GSAP · LayerChart · Tailwind v4 · pnpm.

---

## Pick up on a Mac (or any machine)

```bash
# 1. clone
git clone https://github.com/wolfwdavid/Eman_dashboard.git
cd Eman_dashboard

# 2. Node 22 (matches .nvmrc / engines). With nvm:
nvm install     # reads .nvmrc → 22
nvm use

# 3. pnpm (this repo is pnpm-only — do NOT use npm/yarn)
corepack enable            # ships with Node; gives you pnpm
# or: npm i -g pnpm

# 4. install + run
pnpm install
pnpm dev                   # http://localhost:5173  (runs build:data + build:qr first)
```

> **Mac note:** unlike the Windows dev box, you do **not** need the `MSYS_NO_PATHCONV=1`
> prefix. A local production build that mirrors GitHub Pages is just:
> ```bash
> BASE_PATH=/Eman_dashboard pnpm build && pnpm verify:build
> ```

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` | Local dev server (regenerates data + QR, then Vite) |
| `pnpm test:unit` | 162 unit tests (parsers, aggregates, layout, filters) |
| `pnpm check` | svelte-check (types) |
| `BASE_PATH=/Eman_dashboard pnpm build` | Production build → `build/` (Pages-equivalent) |
| `pnpm verify:build` | Assert deploy invariants on `build/` (base-path, .nojekyll, 404, title) |
| `pnpm preview` | Serve the built site locally |

## Deploying

Push to `main` → GitHub Actions builds with `BASE_PATH=/Eman_dashboard`, runs
`verify-build`, and publishes to GitHub Pages. That's the whole deploy — no manual step.

> If a deploy ever fails instantly with `Deployment failed, try again later` (Pages
> `status: null`), the fix is to recreate the Pages site:
> `gh api -X DELETE repos/wolfwdavid/Eman_dashboard/pages` then
> `gh api -X POST repos/wolfwdavid/Eman_dashboard/pages -f build_type=workflow`, then re-run the workflow.

## Updating the data (non-developer path)

See **[HOW-TO-UPDATE.md](./HOW-TO-UPDATE.md)** — edit `data/grants.csv`, commit, and the
site rebuilds itself. QR target URLs live in `src/lib/config/sites.js`.

## Where things are

```
data/grants.csv                  the source of truth (28 funders)
tools/                           custom build tools: ingest, generate-qr, verify-build, UAT drivers
src/lib/data/                    generated typed dataset + pure selectors (aggregates/filter/format)
src/lib/crystarium/              the 3D scene (layout.js is pure/deterministic; Canvas is browser-gated)
src/lib/state/crystarium.svelte.js   the runes bridge (selected/hovered/filter/cameraFocus)
src/lib/hud/                     the 2D overlay (detail panel, charts, filters, QR, legend)
.planning/                       GSD project docs (roadmap, requirements, phase records, retrospective)
```

## Project status

- **v1.0** shipped (tagged `v1.0`) — Crystarium + data pipeline + HUD.
- **v1.1** — FFXIII graphics overhaul (Phase 6) + mobile-friendly (Phase 6.1), both live.
- **Phase 7** (sound, particles, node leveling, expanded analytics) is roadmapped, not started — see `.planning/ROADMAP.md`.

> Note: the `agent/` directory is a **separate** project (a DID grant-automation bot) that
> happens to share this repo. It has its own setup docs (`agent/OLLAMA-MAC-SETUP.md`,
> `agent/RESUME-MONDAY.md`) and is unrelated to the dashboard build above.
