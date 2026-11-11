---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: FFXIII Fidelity
status: in-progress
stopped_at: Phase 8 (voice commands) built and review-fixed on main; awaiting manual browser checks M1-M8, push, and agent redeploy
last_updated: "2026-11-11T05:40:00.000Z"
progress:
  total_phases: 8
  completed_phases: 6
  total_plans: 29
  completed_plans: 29
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** The Crystarium sphere grid makes the entire grant pipeline legible and navigable at a glance — funder status, funding amount, and deadline urgency are all readable from the shape and glow of the grid before a single click.
**Current focus:** Phase 08 Voice Commands — built (10/10 plans), code review fixes applied, automated gate green (444 unit, 54 Playwright, 119 agent tests). Pending: manual browser matrix M1–M8, push to GitHub Pages, redeploy the agent to the Oracle VM. Phase 07 Immersion & Analytics still not started.

## Current Position

Phase: 08
Plan: 10/10 executed — VERIFICATION status human_needed (see 08-MANUAL-CHECKS.md)

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: — min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 13 | 2 tasks | 13 files |
| Phase 01 P02 | 14min | 2 tasks | 7 files |
| Phase 01-deploy-skeleton-toolchain P03 | 8 | 3 tasks | 1 files |
| Phase 02 P01 | 9 | 3 tasks | 10 files |
| Phase 02 P03 | 4 | 2 tasks | 4 files |
| Phase 02 P02 | 11min | 3 tasks | 8 files |
| Phase 02 P04 | 8min | 2 tasks | 3 files |
| Phase 03 P01 | 11 | 2 tasks | 7 files |
| Phase 03 P02 | 8 | 2 tasks | 3 files |
| Phase 03 P03 | 30 | 2 tasks | 10 files |
| Phase 03 P04 | 25min | 2 tasks | 5 files |
| Phase 04 P01 | 13 | 3 tasks | 14 files |
| Phase 04-hud-overlay-ui-fallback P02 | 9 | 2 tasks | 1 files |
| Phase 04 P03 | 20 | 3 tasks | 7 files |
| Phase 04 P04 | 8 | 3 tasks | 3 files |
| Phase 05 P01 | 18 | 3 tasks | 5 files |
| Phase 05 P02 | 16min | 3 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: **Deploy-first, data-as-contract** build order (both ARCHITECTURE.md and PITFALLS.md converge on it) — Phase 1 ships a real Pages skeleton before any 3D.
- Roadmap: QR-code generation TOOL (DATA-06) lives in Phase 2 (build tool); QR panel UI (QRUI-01/02) lives in Phase 4.
- Stack: pin `three@0.185.1` (postprocessing peer constraint <0.186), Node 22 LTS, pnpm exclusively.
- [Phase 01]: paths.relative=false: emit absolute /Eman_dashboard/_app/ URLs so the DPLY-02 base-prefix grep is verifiable (SvelteKit default relative './_app/' is not)
- [Phase 01]: static/.nojekyll added manually — adapter-static 3.0.10 does not auto-emit it (research note outdated)
- [Phase 01]: 01-02: app.css owns Tailwind+@fontsource+@theme, imported via +layout.svelte; favicon via %sveltekit.assets% (base-safe)
- [Phase 01]: 01-02: explicit body background-color (not just gradient) + playwright webServer BASE_PATH so preview serves the subpath — verify-build + smoke green
- [Phase 01-deploy-skeleton-toolchain]: CI pnpm pinned to 11 to match local toolchain (pnpm-workspace.yaml allowBuilds: is pnpm 10+; pnpm 9 errored 'packages field missing or empty')
- [Phase 01-deploy-skeleton-toolchain]: Pages source set to GitHub Actions via gh api build_type=workflow (automated, no manual UI step)
- [Phase 02]: isPassed is the exact literal '(passed)' marker only (clock-independent); '2027-02-18 (2026 cycle passed)' stays isPassed=false (Open Q1)
- [Phase 02]: Amount normalizers return null (never 0) for TBD/qualitative amounts; avg = explicit (avg $X) else range midpoint
- [Phase 02]: 02-03: QR targets are absolute external URLs; generator asserts startsWith('http') AND no /Eman_dashboard/ base prefix (Pitfall 5)
- [Phase 02]: 02-03: sites.js is the single swap point; second URL is an explicit REPLACE-ME placeholder; re-run generate-qr.mjs after swap (no component change)
- [Phase 02]: by501c3 = 12 no / 8 yes / 8 unknown — parser is source of truth (asserted sum=28, not a hardcoded count); 02-RESEARCH's 11-no hand-count omitted 37 Angels
- [Phase 02]: Grant id = slug of full 'Funder / Program' cell; potentialTotal basis = avg ?? max ?? min over 9 rows = 296500; securedTotal=20000 hard-locked
- [Phase 02]: 02-04: build gate wired as explicit pnpm build:data && build:qr && vite build chain (pnpm skips prebuild) — bad CSV fails the build; validate.test.mjs proves it (unit + spawnSync integration)
- [Phase 02]: 02-04: qrCodes re-exported from $lib/data barrel (deferred cross-plan wiring closed) — Phase 4 QR panel import ready
- [Phase 03]: 03-01: three pinned exact 0.185.1 (no caret) — postprocessing 6.39.2 peer ceiling <0.186
- [Phase 03]: 03-01: postprocessing added to vite ssr.noExternal so prerender resolves the ESM (Pitfall B)
- [Phase 03]: 03-01: tokens.ts is numeric-hex source of truth for Three materials; UI-SPEC @theme CSS is the DOM twin (keep in lock-step)
- [Phase 03]: Beam targets derived from requires501c3Raw (exactly 4), not tri-state requires501c3==='yes' (which yields 8)
- [Phase 03]: Deadline pulse set is clock-free (cadence+isPassed+status) → exactly 3; a live Date check would break determinism
- [Phase 03]: 03-03: Canvas kept autoRender=false (03-04 composer contract) + temporary in-Scene render task so 28 crystals render now
- [Phase 03]: 03-03: SSR-safe WebGL boundary owned — Canvas dynamic-imported behind {#if browser && mounted}; HUD prerenders; build+verify-build green
- [Phase 03]: Bloom EffectComposer is the single render authority (autoRender=false + renderStage); temp 03-03 render task removed
- [Phase 03]: Deadline pulse membership stays the clock-free node.pulse set (3 nodes); live Date drives cosmetic amplitude band only
- [Phase 04]: 04-01: FilterState axes typed as plain string (DOM-origin values) — resolves setFilter/svelte-check union friction; allowed values documented
- [Phase 04]: 04-01: added $lib resolve alias to vitest.config.ts so data tests import the barrel as the app does (bare vitest has no SvelteKit plugin)
- [Phase 04]: 04-01: filter-dim folded into CrystalNode useTask (opacity+emissive x0.15) + handler-guard raycast; nodes dimmed never deleted so funnel layout stays stable
- [Phase 04-hud-overlay-ui-fallback]: 04-02: DetailPanel consumes real format.ts API (tone/sponsorHint), not the plan prose's token/hint; sponsorHint→gold 'NY Community Trust may sponsor' line
- [Phase 04-hud-overlay-ui-fallback]: 04-02: color-mix(var(--node-hue) N%) for pill/badge/link tints keeps token discipline (no new hex/alpha tokens); single --node-hue prop echoes selected crystal across header/pill/CTA/link
- [Phase 04]: Chart C uses deterministic urgency-bucket colouring (cDomain/cRange) instead of a bespoke overlay to meet the <30d-urgent/passed-ash contract
- [Phase 04]: Background-click deselect wired via onpointermissed on the geometry-less scene Group (never in initialHits → fires on every click, before dispatch); no DOM/3D catch layer, canvas raycast intact
- [Phase 04]: Shipped optional WebGL-probe 2D fallback (RESL-01) — client-only probe swaps FallbackList for Canvas; reuses DetailPanel + format helpers; never blocks the build gate
- [Phase 05]: 05-02: rawRedundant(text,raw) pure trim-equal predicate guards both AMOUNT+DEADLINE subtext; PipelineReadout auto-hides via class:hidden (opacity/translateX, SSR-visible); drawer capped on inner .grid (60vh) so .charts slide stays intact
- [Phase 05]: 05-01: AEST-01 awakening driven by ONE gsap-tweened revealProgress scalar (intro.svelte.js runes singleton); nodes read it against a pure rim->center revealRank so the gold origin master lands last; steady state (intro.done) byte-identical to pre-intro, zero per-frame allocations
- [Phase 05]: 05-01: camera intro runs from an $effect waiting on intro.active (not onMount) because Threlte children mount before the parent Scene calls startIntro; cameraFocus effect early-returns during intro; any pointerdown skips to settled

### Pending Todos

None yet.

### Blockers/Concerns

- **SSR-safe WebGL** (Phase 3): Three.js must never run during prerender — gate Canvas behind browser flag; never `ssr=false`. Load-bearing failure point.
- **GitHub Pages base-path** (Phase 1): the #1 killer — every asset/link/texture must route through `base`; fails invisibly (green on localhost, broken on deploy).
- **Crystarium layout** (Phase 3/5): original design (MEDIUM confidence); tunable constants need visual iteration — flagged for research-phase.
- **Two QR URLs not finalized:** ship absolute placeholder https URLs in `config/sites.js`; swap later with zero code change.
- **Sensitive-field exposure:** confirm all displayed fields (esp. Next Action notes) are public-safe before shipping; never commit raw Notion source / creds.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261029-jaq | Fix scorer 501c3 fixation: derive actionable_now from bucket, drop legal lines from OPEN_NOW prompt, add unit test | 2026-10-29 | 730a300 | [261029-jaq-fix-scorer-501c3-fixation-derive-actiona](./quick/261029-jaq-fix-scorer-501c3-fixation-derive-actiona/) |
| 261109-ayp | Move the chat bubble beside the SHARE button on desktop so the two widgets no longer overlap | 2026-11-09 | 67547ad | [261109-ayp-move-the-chat-bubble-beside-the-share-bu](./quick/261109-ayp-move-the-chat-bubble-beside-the-share-bu/) |
| 261109-bh2 | Add an optional Template column to grants.csv and a Proposal template button in the grant detail panel | 2026-11-09 | 871fb79 | [261109-bh2-add-an-optional-template-column-to-grant](./quick/261109-bh2-add-an-optional-template-column-to-grant/) |
| fast | Keep detail panel actions clear of the fixed chat bubble and SHARE button (96px bottom padding) | 2026-11-09 | f0ab9e3 | — |
| 261109-bqz | Shift the chat bubble and SHARE widget left of the open grant detail panel on desktop | 2026-11-09 | 50b8c6d | [261109-bqz-shift-the-chat-bubble-and-share-widget-l](./quick/261109-bqz-shift-the-chat-bubble-and-share-widget-l/) |
| 261109-c9g | Add a Templates button under the Grant Crystarium title that lists every grant with a proposal template | 2026-11-09 | e9018d7 | [261109-c9g-add-a-templates-button-under-the-grant-c](./quick/261109-c9g-add-a-templates-button-under-the-grant-c/) |
| fast | Link a proposal template Doc (Drive grants/templates) for all 28 grants; pin the real-data test to 28 ids | 2026-11-09 | c409bad | — |
| fast | Opaque surface for the open Templates list (legend bled through the glass) | 2026-11-09 | a7ffc5f | — |
| 261109-dxq | Add 12 funders from Eman's emails to the tracker (40 rows) and re-pin the dataset tests | 2026-11-09 | d317f0c | [261109-dxq-add-12-funders-from-eman-s-emails-to-the](./quick/261109-dxq-add-12-funders-from-eman-s-emails-to-the/) |
| 261110-vgj | DID bot: Mon/Wed/Fri 6AM ET grant sweep + 8:45AM Telegram summary with draft links (new = not present at the previous sweep); Monday digest weekday fixed (was firing Sunday) | 2026-11-10 | 7f2de2e | [261110-vgj-did-bot-mon-wed-fri-6am-grant-sweep-and-](./quick/261110-vgj-did-bot-mon-wed-fri-6am-grant-sweep-and-/) |
| 261111-fast | Chat history is now per browser session (random id per page load; server store bounded to 500 sessions, 30 min idle expiry; no shared default) | 2026-11-11 | 1358f94 | (fast task, no directory) |

## Session Continuity

Last session: 2026-10-29T18:03:14.075Z
Stopped at: Completed quick task 261029-jaq (scorer actionable_now derived from bucket)
Resume file: None
