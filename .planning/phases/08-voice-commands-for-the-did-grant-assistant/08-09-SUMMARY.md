---
phase: 08-voice-commands-for-the-did-grant-assistant
plan: 09
subsystem: ui
tags: [svelte, speechSynthesis, accessibility, playwright]
requires:
  - phase: 08-08
    provides: escapeRules list, header action group, collapseChat
provides:
  - isSpeaking() in tts.ts
  - Speaker toggle (aria-pressed, persisted) and single say() gate for all spoken output
  - 44px touch targets at <=768px and short-viewport rules
affects: [08-10]
tech-stack:
  added: []
  patterns: ["single say() gate: speech only while chat open, except the collapse confirmation"]
key-files:
  modified:
    - src/lib/voice/tts.ts
    - src/lib/voice/tts.test.ts
    - src/lib/ChatWidget.svelte
    - tests/voice.spec.ts
key-decisions:
  - "Escape rule 2 (stop speech) sits between capture-cancel and the privacy notice rule"
  - "Assistant error bubbles from /chat are spoken too, like voice error bubbles"
requirements-completed: [VOICE-06, VOICE-07]
duration: 25min
completed: 2026-11-10
---

# Phase 8 Plan 09: Spoken Replies and Mobile Polish Summary

Speaker toggle in the chat header with a single `say()` gate that speaks confirmations, did-you-mean prompts, errors, the asking string and assistant replies, plus 44px touch targets at 768px and below.

## Tasks
1. isSpeaking, speaker toggle, spoken-output wiring - d44b8e0
2. Mobile and short-viewport CSS (added media blocks only) - 7d62ae5
3. Playwright coverage (10 new spoken/layout tests) - 2d32af9

## Deviations from Plan
- Test 2 sends `reset` before `show gated` because the recurring filter left no gated grants. Send button located by `.chat-send` (its accessible name is the glyph, not "Send"). Both are test-only adjustments.
- One run of the pre-existing test "voice settings: force server speech recognition" timed out waiting for the settings button after a reload; it passed on the next full run (36/36). Treated as a timing flake, not changed.

## Known Stubs
None.

## Self-Check: PASSED
Commits d44b8e0, 7d62ae5, 2d32af9 exist; 361 unit tests, check 0 errors, 36 smoke tests pass.
