---
phase: 08-voice-commands-for-the-did-grant-assistant
verified: 2026-11-11T00:00:00Z
status: human_needed
score: 7/7 requirements wired and covered by automated tests; real-device behaviour unverified
gaps: []
human_verification:
  - test: "M1/M2 Chrome and Edge desktop: tap mic, allow mic, say 'show recurring grants'"
    expected: "Filter switches within 1 s, Recurring chip active, reply announced"
    why_human: "Tests use a simulated SpeechRecognition; real mic and vendor speech service cannot be exercised"
  - test: "M3/M4 Safari macOS and iOS Safari (also iOS with Dictation off)"
    expected: "Command works; privacy notice once; service-not-allowed gives the helpful message"
    why_human: "Real browser and device behaviour"
  - test: "M5 Firefox and M6 Safari with forced server recognition"
    expected: "Audio recorded, posted to /chat/transcribe, transcript matches, mp4 accepted by Whisper backend"
    why_human: "Real MediaRecorder and a deployed Whisper backend; agent not yet deployed to the VM"
  - test: "M7 spoken replies"
    expected: "Audible; long reply read to end without Chrome ~15 s cutoff"
    why_human: "Audible output"
  - test: "M8 VoiceOver and NVDA"
    expected: "One polite announcement per event, interim not read, nothing twice"
    why_human: "Screen-reader quality"
  - test: "Owner follow-ups: redeploy agent to Oracle VM, confirm STT backend, README curl check, CF-Connecting-IP forwarding"
    expected: "POST /chat/transcribe returns 200 live; per-visitor rate limit"
    why_human: "Deployment has not happened"
---

# Phase 8 Verification

**Goal:** Hands-free operation of the assistant and dashboard via push-to-talk, local commands, spoken questions to POST /chat, Web Speech first with server /chat/transcribe fallback, optional spoken replies, keyboard + aria-live, no wake word.
**Status:** human_needed (no code gaps found)

## Requirement coverage (code evidence)

| Req | Wiring found | Status |
|-----|--------------|--------|
| VOICE-01 | ChatWidget mic button (aria-pressed on listening) calls `listen()` (stt.ts, `continuous=false`, 8000 ms silence default); interim shown in `.voice-status`; privacy notice gate | Wired; real mic needs human |
| VOICE-02 | `commands.parse` -> `router.route` -> `actions.run` -> `dashboard.svelte.js` / shared `panels` store; TemplatesPanel and QrPanel read `panels.*`; facts.ts supplies deadlines and secured total (used by actions.ts) | Wired |
| VOICE-03 | Fuzzy matcher with HIGH/LOW/MARGIN thresholds and aliases; router returns `choices`, widget renders did-you-mean buttons, `choose()`/`cancelChoices()` run actions | Wired |
| VOICE-04 | Router `chat` intent -> `askAssistant(text)` after `pushUser`; transcript shown first; capped at 500 chars; busy guard | Wired |
| VOICE-05 | `startRecording` + `transcribeBlob` to `${BASE}/chat/transcribe` (20 s timeout); server: 1 MB cap (413 without reading), MIME allow-map (415), 10/min/IP limiter (429), temp file removed before reply, `voice.transcribe` reuse, 2 concurrent slots; post-merge body drain for small rejected uploads present | Wired; live backend unverified |
| VOICE-06 | `tts.ts` speak/cancel/chunk, pref default off persisted via prefs.ts, `truncateReply` 600 chars used by `assistantLive`; speaker toggle `aria-pressed` | Wired; audibility needs human |
| VOICE-07 | Single `role=status aria-live=polite` region, mic `aria-pressed`, `aria-describedby`, existing mouse/keyboard controls untouched | Wired; screen reader needs human |

## Specific checks

- Stubs/dead code: none found. Every export of `src/lib/voice/*` is consumed (pickMimeType by startRecording, nextDeadlinesText/securedText by actions, truncateReply by assistantLive). Only nit: a stale comment in ChatWidget "wired in a later plan" above `handleUtterance` (it is wired).
- Copy vs UI-SPEC: sampled 11 strings from `copy.ts`; all appear verbatim in 08-UI-SPEC.md; `copy.test.ts` pins them.
- SSR: browser APIs (`window`, `navigator`, `localStorage`, `speechSynthesis`, `document`) are only reached inside `onMount`, event handlers, or `typeof`/`globalThis` guards; `collapseRule` evaluates matchMedia at event time. Prior build and `verify:build` pass.
- `{@html}`: none in ChatWidget, voice/*, TemplatesPanel.
- Wake word / always-on: none. `continuous=false`, push-to-talk only, capture cancelled on chat close, tab hidden, Escape.
- TBD/FIXME/XXX markers: none in modified source (only `isTBD` data fields in tests).
- Tests re-run: `pnpm test:unit` 361 passed. Other suite results (check, build, smoke, pytest) taken from orchestrator, not re-run.
- Auth note: transcribe client sends no Authorization header, identical to existing /chat client; server skips the token check on trycloudflare hosts. Consistent with existing behaviour.

## Gaps

None blocking. REQUIREMENTS.md still marks VOICE-01..07 as Pending checkboxes; update after human UAT.

## Human verification required

M1-M8 in 08-MANUAL-CHECKS.md plus the owner deployment follow-ups (listed in frontmatter). None has been run.
