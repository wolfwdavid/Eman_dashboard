# Phase 8 - Manual Checks and Owner Follow-ups

Everything below needs a real browser, a real microphone, the deployed agent or Eman herself. None of it has been run. Every Result cell is "not run" until a human fills it in.

## Manual browser matrix

| ID | Check | Requirement | Steps | Expected | Result |
|----|-------|-------------|-------|----------|--------|
| M1 | Chrome desktop | VOICE-01, VOICE-02 | Open the deployed dashboard, open the chat, tap the mic, allow the microphone, say "show recurring grants" | Filter switches within 1 s and the Recurring chip becomes active; reply is announced | not run |
| M2 | Edge desktop | VOICE-01, VOICE-02 | Same as M1 | Same as M1 | not run |
| M3 | Safari macOS | VOICE-01, VOICE-02 | Same as M1; also note the first-use gesture requirement and the privacy notice shown on the first mic press | Command works; privacy notice appears once and can be accepted or switched to server recognition | not run |
| M4 | iOS Safari | VOICE-01, VOICE-02 | Same as M1 over HTTPS; repeat with Dictation turned off in iOS settings | Command works; with Dictation off the widget reports `service-not-allowed` with a helpful message instead of failing silently | not run |
| M5 | Firefox | VOICE-05 | Mic records (no browser recognition), the audio is posted to the agent, speak a command | Server transcribes and the transcript matches what was said; the command runs | not run |
| M6 | Safari with server speech recognition forced | VOICE-05 | Voice settings, tick "Use server speech recognition", speak a command | The mp4 container is accepted by the deployed Whisper backend and the transcript appears | not run |
| M7 | Spoken replies | VOICE-06 | Turn the speaker toggle on, ask a long question, listen | Reply is audible and a long answer is read to the end without Chrome's roughly 15 s cutoff | not run |
| M8 | VoiceOver and NVDA announcement quality | VOICE-07 | With a screen reader, use the mic, hear the transcript, result and assistant reply announced | One polite announcement per event, no interim transcript read aloud, nothing announced twice | not run (deferred UAT with Eman) |

## Owner follow-ups (not build tasks)

| Follow-up | Detail | Status |
|-----------|--------|--------|
| Redeploy the agent on the Oracle VM | `git pull`, rebuild, restart as described in `agent/README.md`. The VM does not have `/chat/transcribe` yet. | not run |
| Confirm a working speech-to-text backend on the VM | Either `WHISPER_BASE_URL` / `WHISPER_MODEL` / `WHISPER_API_KEY` for a hosted endpoint, or local faster-whisper with `av` and ffmpeg installed. It is unknown whether the VM currently has either. | not run |
| Run the README curl check | Post a short audio sample to `/chat/transcribe` as documented in `agent/README.md` | expect 200; not run |
| Confirm the tunnel forwards `CF-Connecting-IP` | Needed so the per-IP rate limit on `/chat/transcribe` is per visitor, not one shared bucket | not run |
| Schedule the UAT with Eman | Include a screen-reader pass (M8) and the real-device checks | not run |

## Automated vs manual

| Requirement | Automated coverage | Still manual |
|-------------|--------------------|--------------|
| VOICE-01 | `tests/voice.spec.ts`: "voice commands: show recurring grants", "voice silence", "voice cancel", "voice mic: unavailable", "voice notice" group; vitest recognizer/timer tests in `src/lib/voice/` | M1-M4 (real microphone and vendor speech service) |
| VOICE-02 | vitest `src/lib/voice/commands.test.ts`, `facts.test.ts`, `actions.test.ts`; `voice.spec.ts` "voice commands: templates, reset, close" | M1-M4 |
| VOICE-03 | vitest `commands.test.ts` fuzzy and did-you-mean tables; `voice.spec.ts` "voice commands: open north star", "voice commands: did you mean" | none |
| VOICE-04 | `voice.spec.ts` "question: spoken question goes to /chat unchanged", "typed question goes to /chat unchanged and is announced" | none |
| VOICE-05 | `agent/tests/test_chat_transcribe.py` (MIME, size cap, rate limit, temp files, CORS, upstream failure, forwarded IP); `voice.spec.ts` "server fallback" tests and "voice settings" tests | M5, M6 and the Oracle VM follow-ups |
| VOICE-06 | `voice.spec.ts` "spoken replies" group (toggle default and persistence, speak and cancel calls, truncation, chat-closed rule); vitest `tts.test.ts` | M7 (audible output) |
| VOICE-07 | `voice.spec.ts` "keyboard: full flow without a pointer", "keyboard: existing controls still work", "keyboard: mic button semantics", "voice a11y: prerendered HTML", "voice a11y: live region content rules", "voice mobile" and "voice reduced motion" tests | M8 (screen-reader announcement quality) |
| D-25 (prerender, base path) | `BASE_PATH=/Eman_dashboard pnpm build` then `pnpm verify:build` (unchanged); "voice a11y: prerendered HTML" | none |
