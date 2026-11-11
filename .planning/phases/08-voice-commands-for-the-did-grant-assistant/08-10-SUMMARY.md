---
phase: 08-voice-commands-for-the-did-grant-assistant
plan: 10
subsystem: testing
tags: [playwright, accessibility, keyboard, prerender]
requires:
  - phase: 08-09
    provides: final widget DOM, speaker toggle, mobile rules
provides:
  - Keyboard-only and prerender/live-region Playwright tests
  - 08-MANUAL-CHECKS.md (M1-M8 and owner follow-ups, all not run)
  - Hydration-safe chat opening in the voice spec helpers
affects: []
tech-stack:
  added: []
  patterns: ["retry the chat-toggle click until the panel exists (prerendered button, handler attached on hydrate)"]
key-files:
  created:
    - .planning/phases/08-voice-commands-for-the-did-grant-assistant/08-MANUAL-CHECKS.md
  modified:
    - tests/voice.spec.ts
key-decisions:
  - "Flake cause: a click on the prerendered chat toggle before hydration is lost; fixed in the test helper, no Playwright retries added"
requirements-completed: [VOICE-01, VOICE-02, VOICE-03, VOICE-04, VOICE-05, VOICE-06, VOICE-07]
duration: 40min
completed: 2026-11-11
---

# Phase 8 Plan 10: Keyboard, Accessibility and Phase Gate Summary

Five new Playwright tests prove keyboard-only operation and the prerender/live-region rules; the full gate is green and the human-only checks are written down as not run.

## Tasks
1. Keyboard-only and prerender/a11y tests (plus flake fix) - 1de04de
2. Full gate and 08-MANUAL-CHECKS.md - e39e927

## Gate results
- `pnpm check`: 0 errors, 1 warning (pre-existing ChatWidget `messagesEl`)
- `pnpm test:unit`: 361 passed
- `BASE_PATH=/Eman_dashboard pnpm build` then `pnpm verify:build`: PASSED (tool unchanged)
- `pnpm test:smoke`: 41 passed, three consecutive full runs
- agent pytest: 85 passed
- Changed files for the plan: only tests/voice.spec.ts and the manual checks file; verify-build.mjs, agent main.py, Dockerfile, deploy/, lockfile untouched; no test hooks in src/.

## Deviations from Plan
- **[Rule 1 - Bug] Flaky "voice settings: force server speech recognition".** Root cause: the chat toggle is prerendered, so a click issued before Svelte hydrates (most likely right after `page.reload()`) is dropped and the panel never opens, so the settings button never appears. Fixed in the test helper: new `clickChatToggle` retries the click inside `expect(...).toPass` until `.chat-panel` is visible, used by `openChat` and all reload paths. The flake never reproduced in the 3 full runs plus targeted runs afterwards, so the fix rests on the diagnosis rather than a red-to-green reproduction.
- The live-region test uses the interim phrase "open the pipel" instead of "show rec", because "show rec" is a substring of the committed "You said: show recurring grants" text and made the not-contain assertion fail for the wrong reason.

## Not verified
M1-M8, the Oracle VM redeploy (the VM lacks /chat/transcribe; whether it has a Whisper backend or ffmpeg is unknown), the CF-Connecting-IP check and the UAT with Eman are all "not run" in 08-MANUAL-CHECKS.md.

## Known Stubs
None.

## Self-Check: PASSED
Commits 1de04de and e39e927 exist; files present; no forbidden strings in commit messages.
