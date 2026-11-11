# Phase 8: Voice Commands for the DID Grant Assistant - Context

**Gathered:** 2026-11-10
**Status:** Ready for planning
**Source:** PRD Express Path (`Websites/Eman/plans/voice-commands-plan.md`, private notes repo — its content is reproduced here because that file is outside this repo)

<domain>
## Phase Boundary

Let Eman and visitors operate the dashboard chat assistant hands-free:

1. Speak a question to the chat instead of typing it.
2. Speak a command the dashboard executes instantly, with no LLM round trip.
3. Optionally hear replies and command confirmations read aloud.

Two surfaces change: the dashboard chat widget (`src/lib/ChatWidget.svelte` plus a new `src/lib/voice/` module) and the public chat API of the Python agent (`agent/did_agent/chat_api.py`, one new endpoint). The Telegram bot is unchanged.

What exists today (verified in code):

- `ChatWidget.svelte`: typed text → `POST {BASE}/chat` → poll `GET {BASE}/chat/<job_id>` every 3 s for up to 6 min. `BASE` is discovered at runtime (localhost, else `agent/dashboard/chat-config.json` from GitHub raw). Backed by `PublicAgent`, which answers only from the site-knowledge file. Replies take 10 s to 3 min.
- `agent/did_agent/voice.py`: `transcribe(audio_path, model_name, base_url, api_key)` — hosted OpenAI-compatible Whisper when `WHISPER_BASE_URL` is set, else local faster-whisper. Used today only for Telegram voice notes.
- Dashboard state: `src/lib/state/crystarium.svelte.js` exposes `select(id)`, `deselect()`, `setFilter(axis, value)`, `resetFilters()`. Aggregates (secured/potential, deadlines) live in `src/lib/data/aggregates.ts`. Grant rows: `src/lib/data/grants.generated.json`.

</domain>

<decisions>
## Implementation Decisions

### Owner decisions (locked 2026-11-10: "full saved plan, recommended choices")
- D-01: Scope change approved — this phase ships an accessibility contract for the voice feature even though PROJECT.md excludes accessibility for the rest of the build.
- D-02: Speech-to-text default is the browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`); server Whisper is the fallback when it is unavailable or fails.
- D-03: Full v1 command set (below), not a reduced one.
- D-04: Spoken replies are included in v1, off by default, toggled from the chat header, remembered in `localStorage`.
- D-05: The web `/chat` API stays open (no `CHAT_API_TOKEN`); protection is rate limiting and input limits.
- D-06: Telegram stays as is: voice in, text out.

### Two-tier input (VOICE-02, VOICE-03, VOICE-04)
- D-07: Every transcript goes first to a local command grammar on the client (target under 50 ms). Anything that is not a command is sent to the existing `POST /chat` unchanged.
- D-08: Command intents for v1:
  - filter: "show | only <status | gate | type>" → `setFilter(axis, value)`
  - navigate: "open | show | go to <funder name>" → `select(id)`
  - panels: "open templates", "share", "close"
  - facts: "what's due next", "how much is secured" (read from `aggregates.ts`, no LLM)
  - "reset" / "clear filters" → `resetFilters()`
- D-09: Funder names match fuzzily against `funder` + `program` in `grants.generated.json` (e.g. "open north star" selects the North Star Fund row). Below a confidence threshold, show "Did you mean …?" with two or three choices; "the second one" style follow-ups are allowed. Unmatched speech goes to the chat.
- D-10: The grammar and matcher are a pure module with vitest tests (`src/lib/voice/commands.ts`, `commands.test.ts`): intents, synonyms, thresholds, "did you mean".
- D-11: A separate actions adapter (`src/lib/voice/actions.ts`) maps intents to dashboard state calls and panel opens, with small hooks in `+page.svelte`, `TemplatesPanel`, `QrPanel` as needed.

### Speech-to-text (VOICE-01, VOICE-05)
- D-12: One mic button drives both paths. The widget uses the Web Speech API when `window.SpeechRecognition` (or the webkit prefix) exists; otherwise it records with `MediaRecorder` (webm/opus) and posts to the server.
- D-13: Push-to-talk only. No wake word, no always-on listening.
- D-14: Interim transcript is shown live. Listening stops after 8 s of silence with "I didn't catch that".
- D-15: New `POST /chat/transcribe` in `agent/did_agent/chat_api.py` reuses `voice.transcribe()`. Limits: body capped at about 1 MB / 20 s of audio, 10 requests per minute per IP, non-audio MIME types rejected, same CORS allow-list as `/chat`. pytest coverage for the limits.
- D-16: A one-line notice on first mic use says browser speech recognition sends audio to the browser vendor. A setting can force the server path.

### Spoken replies (VOICE-06)
- D-17: `window.speechSynthesis` reads bot replies and command confirmations (e.g. "Showing 3 recurring grants") when the toggle is on.
- D-18: For questions sent to the LLM, the widget says and shows "Asking the assistant, this can take a minute".
- D-19: `prefers-reduced-motion` applies to the listening animation only, never to speech.

### Accessibility contract (VOICE-07)
- D-20: Mic is a real `<button>`, at least 44 px, keyboard operable (Space/Enter), `aria-pressed`, with a visible "Listening…" state.
- D-21: An `aria-live="polite"` region announces transcripts, command results and replies.
- D-22: Voice adds to existing controls and never replaces them; every command keeps its mouse/keyboard equivalent.

### Verification and docs
- D-23: Playwright smoke test with a mocked `SpeechRecognition`, plus a keyboard-only run. `tools/verify-build.mjs` must still pass unchanged.
- D-24: Docs: `HOW-TO-UPDATE.md` (how to add a command synonym) and `agent/README.md` (transcribe endpoint, Whisper env).
- D-25: Static-site invariants hold: SvelteKit prerender with `adapter-static`, base path `/Eman_dashboard`, no browser-only API touched during SSR (guard `window`, `navigator`, `speechSynthesis`, `MediaRecorder` behind `onMount` or `typeof window` checks).

### Claude's Discretion
- Fuzzy-matching algorithm and thresholds, synonym lists, and how "did you mean" choices are rendered.
- Internal shape of the intent objects and the adapter API.
- Rate-limiter implementation in the stdlib HTTP server (in-memory per-IP window is acceptable).
- Mic/speaker icon styling within the existing chat widget look.
- How the widget stores the "force server STT" and "spoken replies" preferences.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` — Phase 8 goal, owner decisions
- `.planning/REQUIREMENTS.md` — VOICE-01 … VOICE-07
- `.planning/PROJECT.md` — constraints, and the accessibility exception for this phase
- `CLAUDE.md` — stack pins, SSR-safe pattern, GitHub Pages base path

### Dashboard code this phase touches
- `src/lib/ChatWidget.svelte` — the chat widget (mic, recorder, spoken replies go here)
- `src/lib/state/crystarium.svelte.js` — `select`, `deselect`, `setFilter`, `resetFilters`, `ui` state
- `src/lib/data/aggregates.ts`, `src/lib/data/filter.ts`, `src/lib/data/types.ts`, `src/lib/data/index.ts` — data the commands read
- `src/lib/hud/TemplatesPanel.svelte`, `src/lib/hud/QrPanel.svelte`, `src/lib/hud/FilterBar.svelte`, `src/routes/+page.svelte` — panels and filters the commands drive
- `tests/` and `playwright.config.ts` — existing e2e setup; `tools/verify-build.mjs` — build gate

### Agent code this phase touches
- `agent/did_agent/chat_api.py` — public chat HTTP API (add `/chat/transcribe`)
- `agent/did_agent/voice.py` — `transcribe()` to reuse
- `agent/did_agent/config.py` — Whisper settings
- `agent/tests/` — pytest suite (offline)
- `agent/README.md`, `HOW-TO-UPDATE.md` — docs to update

</canonical_refs>

<specifics>
## Specific Ideas

Acceptance criteria from the source plan:

- On Chrome, Edge and Safari: tap mic, say "show recurring grants" → the status filter switches to Recurring within 1 s, the chip updates, and an aria-live message confirms it.
- "Open north star" selects the North Star Fund node and opens its detail panel; "open templates" opens the TEMPLATES list; "reset" clears filters.
- A spoken question lands in the chat as text and is answered by the existing API; the transcript is visible before the reply.
- On Firefox the same button records and transcribes via the server, with the same result.
- Spoken replies can be toggled on and off and the choice persists.
- Keyboard-only and screen-reader users can do all of the above.
- `/chat/transcribe` rejects bodies over 1 MB and more than 10 requests per minute per IP; unit and Playwright suites green; `verify-build` passes.

Risks called out in the source plan: Web Speech API privacy (audio goes to Google/Apple), slow LLM replies, ambiguous funder names ("Ford" matches two rows), iOS Safari needing a user gesture and HTTPS, abuse of the unauthenticated transcribe endpoint.

Concurrent work to be aware of: quick task 261110-vgj is adding a Mon/Wed/Fri sweep to `agent/did_agent/main.py`, `agent/README.md`, `agent/Dockerfile` and `agent/deploy/oracle/docker-compose.yml`. This phase must not rewrite those changes; `agent/README.md` edits should be additive.

</specifics>

<deferred>
## Deferred Ideas

- Wake word / always-on listening.
- Voice on the public `diversityincludesdisability.org` site.
- Spoken (TTS) voice notes on Telegram.
- Voice-driven editing of the tracker (adding or changing grants by voice) — needs auth and confirmation flows.
- UAT session with Eman using a screen reader on phone and laptop — needs her time; tracked as human verification, not a build task.
- Deploying the agent change to the Oracle VM — owner step after review.

</deferred>

---

*Phase: 08-voice-commands-for-the-did-grant-assistant*
*Context gathered: 2026-11-10 via PRD Express Path*
