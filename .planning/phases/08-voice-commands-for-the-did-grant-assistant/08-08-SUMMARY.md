---
phase: 08-voice-commands-for-the-did-grant-assistant
plan: 08
subsystem: voice
tags: [svelte, privacy-notice, settings, playwright]
requires: [08-03, 08-07]
provides:
  - first-use privacy notice shown before any capture (browser and server variants)
  - voice settings disclosure strip with persisted force-server checkbox
  - .chat-head-actions header group (settings, close last)
  - startCapture() extracted from onMic(); escapeRules extended with notice and settings rules
affects: [08-09]
key-files:
  modified:
    - src/lib/ChatWidget.svelte
    - tests/voice.spec.ts
metrics:
  tasks: 2
  completed: 2026-11-10
---

# Phase 8 Plan 08: Privacy notice and voice settings Summary

The first mic press on each speech path now shows a one-line privacy notice instead of capturing; "Start listening" remembers the choice and starts capture in the same click, and "Use the server instead" sets `did.voice.forceServer`, remembers both notices and records through the server. A header settings button opens an inline disclosure strip with the "Use server speech recognition" checkbox.

## What was built

- `onMic()` computes the path, checks `PREF_KEYS.noticeBrowser`/`noticeServer` plus a per-page-load `noticeSeenSession` fallback, and shows the notice (focus to "Start listening", settings strip closed) without starting. `startCapture()` is synchronous and holds the old start branch.
- `acceptAndStart()` / `useServerAndStart()` persist the flags and call `startCapture()` in the same handler, then focus the mic. The secondary button renders only on the browser variant and only when recording is possible.
- Settings strip (`#voice-settings`): native checkbox, checked and disabled when the browser has no SpeechRecognition, help lines from `COPY`. `forceServer` is read in `onMount` and written on change. The button is not rendered when the mic is unavailable.
- `escapeRules` gained (3) hide notice without remembering, focus mic and (4) close settings, focus settings button. The `open` effect also clears both when the chat closes.
- Header: title ellipsis, `.chat-head-actions` wrapper, scoped `.chat-settings` styles; the close button is unchanged and last.
- `hasSR`/`hasRec` became `$state` because the strip template reads them.

## Tests

7 new Playwright tests (notice x4, settings x3); `installFakeRecorder` now also exposes `window.__recStarted`. All 19 prior tests pass unchanged.

## Deviations from Plan

None in behaviour. Minor: the "Use the server instead" button additionally requires `hasRec`, since offering it without a recorder would dead-end.

## Self-Check: PASSED

Commits b54c467 and b975459 exist; no focus trap or `{@html}` added; `build/index.html` contains no `chat-settings` or `voice-notice`.
