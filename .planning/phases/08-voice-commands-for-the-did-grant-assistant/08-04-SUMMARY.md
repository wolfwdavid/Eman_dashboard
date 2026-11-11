---
phase: 08-voice-commands-for-the-did-grant-assistant
plan: 04
subsystem: voice
tags: [svelte5-runes, voice, dashboard-adapter, playwright]
requires: [08-01, 08-03]
provides:
  - panels rune store (templates/share) usable outside the panels
  - createActions(dash, data) pure intent adapter with exact UI-SPEC copy
  - dashboard object wired to crystarium and panels stores
affects: [08-06]
tech-stack:
  patterns: [injected Dashboard interface, module-level $state store]
key-files:
  created:
    - src/lib/state/panels.svelte.js
    - src/lib/voice/dashboard.svelte.js
    - src/lib/voice/actions.ts
    - src/lib/voice/actions.test.ts
    - tests/panels.spec.ts
  modified:
    - src/lib/hud/TemplatesPanel.svelte
    - src/lib/hud/QrPanel.svelte
requirements-completed: [VOICE-02, VOICE-03, VOICE-07]
completed: 2026-11-10
---

# Phase 8 Plan 04: Panel store and actions adapter Summary

TEMPLATES and SHARE open state now lives in a shared rune store, and a pure `createActions` adapter turns every non-chat intent into dashboard calls plus the exact UI-SPEC confirmation string.

## Tasks

1. Shared panels store, panel refactor, Dashboard object, parity spec - f2a3f1c
2. actions.ts adapter and tests - f4b0341

## Notes

- `openPanel` ignores names other than templates/share (T-08-19); open-grant selects only ids present in grants (T-08-02); filter values re-checked against FILTER_VALUES (T-08-01).
- Panel markup, classes and styles are untouched; only `open` became `panels.templates` / `panels.share` plus header comments.
- `securedText` is not hard-coded; the spec example figure is stale and the test checks the format against live aggregates.

## Deviations from Plan

- Test data note: the grant type "Fellowship" bucket comes from data type `Grant/Fellowship`; synthetic grants use that.
- `dashboard.svelte.js` (task 1) references the `Dashboard` type from `actions.ts` (task 2) via JSDoc; both were present before `pnpm check` ran.
- On Windows Git Bash, `BASE_PATH=/Eman_dashboard` is mangled into a Windows path unless `MSYS_NO_PATHCONV=1` is exported before `pnpm build`.

## Deferred Issues

- `tests/smoke.spec.ts` "landing shell renders under base path with title" fails: it expects the `<h1>` to contain "Eman_dashboard" but the page h1 is "GRANT CRYSTARIUM" (src/lib/hud/SceneTitle.svelte). Pre-existing, unrelated to this plan; not changed. The new panels.spec.ts tests (2) pass.
- `pnpm check` reports one pre-existing ChatWidget.svelte warning (`messagesEl` not `$state`).

## Self-Check: PASSED
