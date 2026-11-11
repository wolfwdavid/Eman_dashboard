---
phase: 8
slug: voice-commands-for-the-did-grant-assistant
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-10
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `08-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 (JS unit) · @playwright/test 1.61.1 (E2E, chromium, serves prebuilt `build/`) · pytest 8 (agent, offline) |
| **Config file** | `vite.config.ts` / `vitest.config.ts`, `playwright.config.ts`; `agent/tests/` has no conftest |
| **Quick run command** | `pnpm test:unit` (dashboard) · `cd agent && .venv/Scripts/python.exe -m pytest -q tests` (agent) |
| **Full suite command** | `pnpm check && pnpm test:unit && BASE_PATH=/Eman_dashboard pnpm build && pnpm verify:build && pnpm test:smoke` plus the agent pytest command |
| **Estimated runtime** | ~15 s quick · ~3 min full |

---

## Sampling Rate

- **After every task commit:** `pnpm test:unit` (and the agent pytest command for agent tasks)
- **After every plan wave:** `pnpm check && pnpm test:unit`; once widget wiring lands also `BASE_PATH=/Eman_dashboard pnpm build && pnpm verify:build && pnpm test:smoke`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; the requirement → check mapping below is fixed.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| VOICE-01 | Mic starts recognizer, interim shown, final committed, 8 s silence → "I didn't catch that", `aria-pressed` toggles | Playwright (fake SpeechRecognition) + vitest fake timers | `pnpm test:smoke -g "voice"` · `pnpm test:unit` | ❌ W0 | ⬜ pending |
| VOICE-02 | Intent parsing for filter/reset/panels/close/facts incl. synonyms and precedence | vitest table | `pnpm test:unit -- src/lib/voice/commands.test.ts` | ❌ W0 | ⬜ pending |
| VOICE-02 | Facts: secured total, next deadlines with injected `now` | vitest | `pnpm test:unit -- src/lib/voice/facts.test.ts` | ❌ W0 | ⬜ pending |
| VOICE-02 | Actions adapter calls the right dashboard methods; confirmation strings | vitest with fake dashboard | `pnpm test:unit -- src/lib/voice/actions.test.ts` | ❌ W0 | ⬜ pending |
| VOICE-02 | "show recurring grants" updates the chip; "open templates" opens; "reset" clears; "close" closes | Playwright | `pnpm test:smoke -g "voice commands"` | ❌ W0 | ⬜ pending |
| VOICE-03 | Fuzzy table; duplicate-funder families → did-you-mean; "the second one"; question-not-navigate guard | vitest | `pnpm test:unit -- src/lib/voice/commands.test.ts` | ❌ W0 | ⬜ pending |
| VOICE-03 | "open north star" opens the detail panel | Playwright | `pnpm test:smoke -g "open north star"` | ❌ W0 | ⬜ pending |
| VOICE-04 | Non-command transcript → bubble, then `POST /chat` with that text, "Asking the assistant" shown | Playwright with route stub | `pnpm test:smoke -g "question"` | ❌ W0 | ⬜ pending |
| VOICE-05 | MIME allow/deny (415), 1 MB cap (413), 11th request → 429 and window reset, temp-file suffix + cleanup, CORS on errors, upstream failure → 502, forwarded-IP handling | pytest (server on port 0, fake `voice.transcribe`, injected clock) | `cd agent && .venv/Scripts/python.exe -m pytest -q tests/test_chat_transcribe.py` | ❌ W0 | ⬜ pending |
| VOICE-05 | Client falls back when SpeechRecognition is absent: records, posts audio, uses returned text | Playwright (fake MediaRecorder) | `pnpm test:smoke -g "server fallback"` | ❌ W0 | ⬜ pending |
| VOICE-06 | Toggle default off, persists across reload, `speechSynthesis.speak` called when on, `cancel()` before speak | Playwright (spy) + vitest for chunking helpers | `pnpm test:smoke -g "spoken replies"` · `pnpm test:unit` | ❌ W0 | ⬜ pending |
| VOICE-07 | Mic is a `<button>` ≥ 44×44, `aria-pressed`, keyboard-only flow, live region receives transcript/result/reply; existing controls still work | Playwright (keyboard + boundingBox) | `pnpm test:smoke -g "keyboard"` | ❌ W0 | ⬜ pending |
| D-25 | Prerender clean, base path intact, no browser API at SSR | build gate | `BASE_PATH=/Eman_dashboard pnpm build && pnpm verify:build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/voice/commands.test.ts`, `facts.test.ts`, `actions.test.ts` — VOICE-02/03
- [ ] `tests/voice.spec.ts` — fake `SpeechRecognition`, fake `MediaRecorder`, `speechSynthesis` spy, route stubs for `127.0.0.1:8080` and the raw.githubusercontent.com config fetch — VOICE-01/04/05/06/07
- [ ] `agent/tests/test_chat_transcribe.py` — VOICE-05
- [x] Confirm `pnpm test:unit` does not pick up `tests/*.spec.ts`; pin `test.include` if it does (done: explicit include list pinned, `src/lib/voice/**/*.test.ts` added)
- [ ] No framework installs needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real mic capture in Chrome, Edge, Safari macOS, iOS Safari (M1–M4) | VOICE-01 | Needs a real microphone and vendor speech service | On the deployed dashboard, tap mic, say "show recurring grants"; filter switches within 1 s |
| Firefox record → server transcribe; Safari mp4 accepted by the deployed Whisper backend (M5–M6) | VOICE-05 | Needs real browsers and the live agent | In Firefox and Safari with server STT forced, speak a command; transcript appears |
| Audible spoken reply, long reply not cut off (M7) | VOICE-06 | Audio output cannot be asserted headlessly | Turn the speaker toggle on, ask a long question, listen to the end |
| Screen-reader announcement quality with VoiceOver/NVDA (M8) | VOICE-07 | Needs Eman's UAT session | Deferred to UAT per CONTEXT |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
