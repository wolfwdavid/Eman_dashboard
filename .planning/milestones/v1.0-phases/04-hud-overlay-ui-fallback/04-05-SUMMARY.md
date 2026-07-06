# Plan 04-05 Summary — Interactive UAT (checkpoint)

**Status:** complete — all UAT items verified against the LIVE deploy (https://wolfwdavid.github.io/Eman_dashboard/) via Playwright-driven interaction + screenshot passes (orchestrator-verified, not blind-approved)
**Date:** 2026-07-06

## UAT Results

| Item | Requirement | Result | Evidence |
|------|-------------|--------|----------|
| Node click → detail rail slides in with all 9 fields, status pill, amount+raw, deadline, gate badge, fit, Next Action CTA, "Open funder site ↗" | DETL-01/02/03 | ✅ | uat-5-detail.png — NYC Office for Prevention of Hate Crimes rail; camera focused the selected cyan crystal |
| Pipeline drawer opens with 4 charts: status bar (17/3/2/2/1/1/1/1 Σ28), secured $20,000 vs potential $296,500, deadline timeline, 501c3 gate 12/8/8 + fiscal-sponsor note | PIPE-01..04 | ✅ | uat-2-drawer.png |
| Filter chips (status/gate/type + counts) dim non-matching scene crystals; "In progress 3" left only the 3 cyan nodes bright | PIPE-05 | ✅ | uat-6-filter.png |
| QR SHARE panel: two white-plate QR tiles (Visit DID / Support-Tracker) + sites.js swap note | QRUI-01/02 | ✅ | uat-3-qr.png |
| Esc deselect closes the rail; background-miss deselect wired | DETL-01 | ✅ | uat-detail.mjs report `railClosed: true` |
| Console errors across all interactions | — | ✅ zero | all run reports |

## Deploy incident resolved during this checkpoint

The b36f715 deploy failed twice with `Deployment failed, try again later` (Pages API `status: null` — wedged provisioning, NOT an artifact problem; build job green, artifact clean 97 files/3.8MB). Fixed by **deleting and recreating the Pages site** (`gh api -X DELETE .../pages` → `POST build_type=workflow`) and re-running the workflow → success. If this recurs: same remedy.

## UAT tooling added (committed)

- `tools/uat-overlay.mjs` — drives drawer/QR/canvas interactions + screenshots on the live URL
- `tools/uat-detail.mjs` — grid-sweep node click → detail-rail assert + Esc deselect
- `tools/uat-filter.mjs` — applies a status filter and captures the dimmed scene

## Cosmetic notes carried to Phase 5

1. Open detail rail overlaps the top-right PipelineReadout (z/layout collision) — restack or auto-hide readout while rail is open.
2. Deadline line renders twice when human-readable text equals the raw string — suppress the raw subtext when identical.
3. Expanded drawer covers the SceneTitle — consider max-height or title fade while expanded.
