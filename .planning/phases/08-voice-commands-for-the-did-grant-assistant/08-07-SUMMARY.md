---
phase: 08-voice-commands-for-the-did-grant-assistant
plan: 07
subsystem: voice
tags: [svelte, web-speech, mediarecorder, playwright]
requires: [08-03, 08-06]
provides:
  - push-to-talk mic button and status strip in ChatWidget
  - browser (SpeechRecognition) and server (MediaRecorder + /chat/transcribe) capture paths
  - widget-internal contract micState, capture, cancelCapture, onMic, escapeRules/onPanelKeydown, useServerPath, sessionServer, statusKind, interim, elapsed
  - Playwright helpers installFakeSR, installFakeRecorder, speak
affects: [08-08, 08-09]
key-files:
  modified:
    - src/lib/ChatWidget.svelte
    - src/lib/voice/stt.ts
    - tests/voice.spec.ts
    - playwright.config.ts
metrics:
  tasks: 3
  completed: 2026-11-10
---

# Phase 8 Plan 07: Mic capture in the chat widget Summary

A real 44px toggle mic button (six states) with a non-live status strip, a Web Speech path with the 8 s silence rule, a MediaRecorder + `/chat/transcribe` fallback, per-cause error bubbles and silent cancellation, proven by 14 new Playwright tests.

## Commits
- e698a97: feat(08-07) mic button, status strip, both capture paths (Tasks 1 and 2 share one file and landed together)
- second commit: test(08-07) Playwright coverage and worker limit (Task 3)

## Deviations from Plan

1. [Rule 3] `transcribeBlob` gained an optional `signal` so a cancelled upload is actually aborted (the plan asks for an AbortController but the helper did not accept one). Additive; existing unit tests unchanged and green.
2. [Rule 3] `playwright.config.ts` now sets `workers: 2`. With 19 tests and the default worker count, WebGL boots starved each other and even the pre-existing panels tests timed out. With 2 workers the full suite is stable (39 s).
3. Tasks 1 and 2 were committed together because they edit one tightly coupled file.
4. `.chat-panel` got `tabindex="-1"` plus a svelte-ignore for the Escape `onkeydown` (a11y lint for a dialog with handlers); it is not in the tab order.
5. Processing icon renders both the spinner arc and the three-dot group; CSS swaps them under `prefers-reduced-motion`.

## Known Stubs
None. The privacy notice gate and speaker/settings controls are plans 08/09; `escapeRules` is the ordered list they append to.

## Threat flags
None new. Mitigations T-08-14, 28, 29, 31, 32 implemented (push-to-talk only, all cancel paths stop tracks, 18 s cap, 20 s timeout with abort, single settle point).

## Self-Check: PASSED
Both commits present; 359 unit tests, svelte-check 0 errors, verify-build PASSED, 19 Playwright tests pass.
