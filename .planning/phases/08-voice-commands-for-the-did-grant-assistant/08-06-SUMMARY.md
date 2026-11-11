---
phase: 08-voice-commands-for-the-did-grant-assistant
plan: 06
subsystem: voice
tags: [svelte5, router, live-region, playwright]
requires: [08-01, 08-03, 08-04]
provides:
  - src/lib/voice/router.ts (createRouter, capTranscript, isEmptyUtterance, RouteResult)
  - ChatWidget text pipeline (askAssistant, handleUtterance, choose, cancelChoices, collapseRule)
  - tests/voice.spec.ts helpers (stubNetwork, openChat)
affects: [08-07, 08-08, 08-09]
key-files:
  created: [src/lib/voice/router.ts, src/lib/voice/router.test.ts, tests/voice.spec.ts]
  modified: [src/lib/ChatWidget.svelte]
requirements-completed: [VOICE-02, VOICE-03, VOICE-04, VOICE-07]
completed: 2026-11-10
---

# Phase 8 Plan 06: Router and widget text pipeline Summary

A pure transcript router (command / choices / question / busy) feeds a refactored chat widget with a persistent live region, confirmation and "Did you mean" bubbles, and the one-surface collapse rule; typed questions still POST to /chat unchanged.

## Tasks

1. router.ts and tests - d73aeae
2. ChatWidget.svelte text pipeline, live region, bubbles, palette tokens - b0290cb
3. tests/voice.spec.ts helpers and typed-question regression - 6c1f86c

## Deviations from Plan

- `handleUtterance` is defined but not yet called: the mic that invokes it arrives in plan 07. The Playwright spec therefore covers the typed path and the live region only; the voice branches are covered by router.test.ts.
- The Windows Git Bash quirk applies: `export MSYS_NO_PATHCONV=1` before building with `BASE_PATH=/Eman_dashboard`.
- Worktree started behind the stated base; reset to 4744cb1 per the branch check.

## Verification

- `pnpm test:unit`: 21 files, 359 tests passed
- `pnpm check`: 0 errors, 1 warning (pre-existing `messagesEl`)
- build + `pnpm verify:build`: verify-build: PASSED
- `pnpm test:smoke`: 5 passed (smoke 1, panels 2, voice 2)

## Known Stubs

None. `micEl` is bound-state placeholder until plan 07 renders the mic; `focusMic` falls back to the input.

## Self-Check: PASSED
