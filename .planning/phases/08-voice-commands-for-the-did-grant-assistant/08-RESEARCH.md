# Phase 8: Voice Commands for the DID Grant Assistant - Research

**Researched:** 2026-11-10
**Domain:** Browser speech I/O (Web Speech API, MediaRecorder), pure-TS command grammar + fuzzy matching, Svelte 5 shared state, stdlib Python HTTP endpoint
**Confidence:** MEDIUM-HIGH (code shapes verified by reading the repo; browser-API behaviour is mostly `[ASSUMED]` from training, flagged below)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Scope change approved — this phase ships an accessibility contract for the voice feature even though PROJECT.md excludes accessibility for the rest of the build.
- D-02: Speech-to-text default is the browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`); server Whisper is the fallback when it is unavailable or fails.
- D-03: Full v1 command set (below), not a reduced one.
- D-04: Spoken replies are included in v1, off by default, toggled from the chat header, remembered in `localStorage`.
- D-05: The web `/chat` API stays open (no `CHAT_API_TOKEN`); protection is rate limiting and input limits.
- D-06: Telegram stays as is: voice in, text out.
- D-07: Every transcript goes first to a local command grammar on the client (target under 50 ms). Anything that is not a command is sent to the existing `POST /chat` unchanged.
- D-08: Command intents for v1: filter ("show | only <status | gate | type>" -> `setFilter(axis, value)`); navigate ("open | show | go to <funder name>" -> `select(id)`); panels ("open templates", "share", "close"); facts ("what's due next", "how much is secured", read from `aggregates.ts`, no LLM); "reset" / "clear filters" -> `resetFilters()`.
- D-09: Funder names match fuzzily against `funder` + `program` in `grants.generated.json` (e.g. "open north star" selects the North Star Fund row). Below a confidence threshold, show "Did you mean ...?" with two or three choices; "the second one" style follow-ups are allowed. Unmatched speech goes to the chat.
- D-10: The grammar and matcher are a pure module with vitest tests (`src/lib/voice/commands.ts`, `commands.test.ts`): intents, synonyms, thresholds, "did you mean".
- D-11: A separate actions adapter (`src/lib/voice/actions.ts`) maps intents to dashboard state calls and panel opens, with small hooks in `+page.svelte`, `TemplatesPanel`, `QrPanel` as needed.
- D-12: One mic button drives both paths. Web Speech API when `window.SpeechRecognition` (or webkit prefix) exists; otherwise `MediaRecorder` (webm/opus) posted to the server.
- D-13: Push-to-talk only. No wake word, no always-on listening.
- D-14: Interim transcript is shown live. Listening stops after 8 s of silence with "I didn't catch that".
- D-15: New `POST /chat/transcribe` in `agent/did_agent/chat_api.py` reuses `voice.transcribe()`. Body capped at about 1 MB / 20 s of audio, 10 requests per minute per IP, non-audio MIME types rejected, same CORS allow-list as `/chat`. pytest coverage for the limits.
- D-16: A one-line notice on first mic use says browser speech recognition sends audio to the browser vendor. A setting can force the server path.
- D-17: `window.speechSynthesis` reads bot replies and command confirmations when the toggle is on.
- D-18: For questions sent to the LLM, the widget says and shows "Asking the assistant, this can take a minute".
- D-19: `prefers-reduced-motion` applies to the listening animation only, never to speech.
- D-20: Mic is a real `<button>`, at least 44 px, keyboard operable (Space/Enter), `aria-pressed`, with a visible "Listening..." state.
- D-21: An `aria-live="polite"` region announces transcripts, command results and replies.
- D-22: Voice adds to existing controls and never replaces them; every command keeps its mouse/keyboard equivalent.
- D-23: Playwright smoke test with a mocked `SpeechRecognition`, plus a keyboard-only run. `tools/verify-build.mjs` must still pass unchanged.
- D-24: Docs: `HOW-TO-UPDATE.md` (how to add a command synonym) and `agent/README.md` (transcribe endpoint, Whisper env).
- D-25: Static-site invariants hold: SvelteKit prerender with `adapter-static`, base path `/Eman_dashboard`, no browser-only API touched during SSR (guard `window`, `navigator`, `speechSynthesis`, `MediaRecorder` behind `onMount` or `typeof window` checks).

### Claude's Discretion
- Fuzzy-matching algorithm and thresholds, synonym lists, and how "did you mean" choices are rendered.
- Internal shape of the intent objects and the adapter API.
- Rate-limiter implementation in the stdlib HTTP server (in-memory per-IP window is acceptable).
- Mic/speaker icon styling within the existing chat widget look.
- How the widget stores the "force server STT" and "spoken replies" preferences.

### Deferred Ideas (OUT OF SCOPE)
- Wake word / always-on listening.
- Voice on the public `diversityincludesdisability.org` site.
- Spoken (TTS) voice notes on Telegram.
- Voice-driven editing of the tracker (adding or changing grants by voice).
- UAT session with Eman using a screen reader on phone and laptop (human verification, not a build task).
- Deploying the agent change to the Oracle VM (owner step after review).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOICE-01 | Push-to-talk mic, Web Speech API, live transcript, listening state, stop after 8 s silence | Web Speech section; state machine; silence timer (own timer, not engine) |
| VOICE-02 | Instant local commands: filter, reset, TEMPLATES/SHARE, close, next deadlines, secured total | Real state shapes; shared panel state gap; grammar precedence; facts module |
| VOICE-03 | "Open <funder>" fuzzy select, "did you mean" list | Dataset analysis (ambiguous families); IDF-weighted token fuzzy matcher |
| VOICE-04 | Non-command speech -> existing /chat with transcript visible first | ChatWidget `send()` refactor to accept text; "Asking the assistant" status |
| VOICE-05 | No-Web-Speech browsers record + POST /chat/transcribe (1 MB, 10/min/IP, audio MIME) | chat_api.py anatomy; container/extension mapping; handler test pattern |
| VOICE-06 | Spoken replies toggle, off by default, remembered | speechSynthesis quirks; localStorage guard |
| VOICE-07 | Keyboard operable, 44 px, aria-pressed, aria-live, mouse/keyboard parity | A11y pattern; keyboard-only Playwright test |
</phase_requirements>

## Summary

The dashboard side is almost entirely greenfield glue around three facts that the context file does not state. (1) `ui.filter` is a plain `{status, gate, type}` object of strings and `setFilter`/`resetFilters`/`select`/`deselect` are already importable from `src/lib/state/crystarium.svelte.js`, so filter and open-grant commands need zero state changes. (2) **TEMPLATES and SHARE open state is local to each component (`let open = $state(false)`) and is not reachable from outside.** `ChatWidget` is mounted in `src/routes/+layout.svelte`, not in the page, so the actions adapter cannot reach into the panels. A small shared module-level rune store (e.g. `ui.panels = { templates:false, share:false }` or a new `src/lib/state/panels.svelte.js`) that both panels bind to is required, and the panels' existing toggle buttons/Escape handlers must keep working against it (D-22). (3) The Python chat API is a **single-threaded stdlib `HTTPServer`** (not `ThreadingHTTPServer`) with `Access-Control-Allow-Origin: *` (there is no origin allow-list) — so a synchronous Whisper call would block every chat poll, and "same CORS allow-list as /chat" means `*`.

Dataset reality drives the matcher design: 40 rows (not 28), funders that share a name across rows (Ford x2, Third Wave x2, Borealis x2, Bank of America x3 counting "Bank of America Charitable Foundation"/"Neighborhood Builders"/"Harry S. Black ... (Bank of America)"), parentheticals/acronyms (SNF, CEK, Versaic), and punctuation that speech recognizers normalize differently ("Ben & Jerry's", "W.K. Kellogg", "37 Angels", "$10K Grants"). A dependency-free IDF-weighted token matcher with edit-distance tolerance, plus a margin rule for ambiguity, handles all of it in well under 1 ms.

**Primary recommendation:** Build `src/lib/voice/commands.ts` as a pure `parse(transcript, ctx) -> Intent` with injected `{grants, now, pending}`; add one shared panels rune store; refactor `ChatWidget.send()` to `send(text)`; add `/chat/transcribe` using a **per-request temp file whose suffix is derived from the validated Content-Type** (never from the client), and switch the server to `ThreadingHTTPServer` so transcription cannot stall polling.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mic capture + live transcript | Browser | — | Web Speech / MediaRecorder are browser-only; guarded in `onMount` |
| Command grammar + fuzzy match | Browser (pure TS module) | — | Must be <50 ms, no network; tested in vitest (node) |
| Dashboard actions (filter/select/panels) | Browser (rune state) | — | State lives in `crystarium.svelte.js` + new panel store |
| Facts (secured total, next deadlines) | Browser (pure selectors) | — | Reads baked `grants` JSON; clock injected for testability |
| Fallback STT | API / Backend (Python) | Browser (recorder) | Whisper runs in agent; browser only records/uploads |
| Rate limit / size / MIME enforcement | API / Backend | — | Only the server can enforce; client limits are UX only |
| Spoken replies | Browser (speechSynthesis) | — | Local TTS, no server involvement (D-06 keeps Telegram text-only) |
| Live-region announcements | Browser (DOM) | — | aria-live in ChatWidget |
| Static delivery | CDN / Static (GitHub Pages) | — | No runtime change; prerender must stay clean |

## Real Code Shapes (verified by reading the repo)

### `src/lib/state/crystarium.svelte.js` [VERIFIED: file read]
```js
export const ui = $state({ selected: null, hovered: null, cameraFocus: null,
  filter: { status: 'all', gate: 'all', type: 'all' } });
export function setFilter(axis, value) { ui.filter[axis] = value; }   // axis: 'status'|'gate'|'type'
export function resetFilters() { ui.filter = { status:'all', gate:'all', type:'all' }; }
export function select(id) { ui.selected = id; ui.cameraFocus = id; }
export function deselect() { ui.selected = null; ui.cameraFocus = null; }
export function hover(id) { ui.hovered = id; }
```
- It is a `.svelte.js` module: **importing it from vitest (node) requires the Svelte plugin to compile runes.** `commands.ts` must NOT import it; only `actions.ts` does. Test actions with an injected "dashboard" interface (`{setFilter, resetFilters, select, deselect, openPanel, closePanels}`) rather than importing the store in unit tests. `[ASSUMED: vitest picks up the sveltekit() plugin from vite.config.ts, which would also compile it, but do not depend on it]`.
- **Filter allowed values** (from `filter.ts` + `FilterBar.svelte`):
  - `status`: `all | active | in-progress | applied | recurring | to-research | not-eligible-yet | not-eligible | declined`
  - `gate`: `all | open | gated | unknown` (`open` = `requires501c3 === 'no'`, `gated` = `'yes'`, `unknown` = other). Labels in UI: All/Open/Gated/Unknown.
  - `type`: `all | Grant | Fellowship | Investment` (data `Grant/Fellowship` collapses to `Fellowship` via `typeBucket`).
  - Status chips are single-select ("single-isolate"); setting `status` replaces the previous one.
- `ui.selected` drives `DetailPanel` and the `.detail-open` layout classes; `select(id)` is all that "open <funder>" needs. Camera follow is via `cameraFocus` (already set by `select`).
- **Panel gap (critical):** `TemplatesPanel.svelte` has `let open = $state(false)` (local) with `pick(id)` closing it and an Escape handler on `<svelte:window>`; `QrPanel.svelte` has `let open = $state(false)` (local). `ChatWidget` lives in `+layout.svelte` (`<ChatWidget />` after `{@render children()}`), a sibling not a parent. Required change: new shared store, e.g. `src/lib/state/panels.svelte.js`:
  ```js
  export const panels = $state({ templates: false, share: false });
  export function openPanel(name){ panels[name] = true; }
  export function closePanels(){ panels.templates = false; panels.share = false; }
  ```
  Panels replace `open` with `panels.templates` / `panels.share` (keep `aria-expanded`, toggle button and Escape behaviour byte-for-byte). Minimal diff; no `+page.svelte` change is strictly needed (CONTEXT lists it as "as needed"). Do NOT put panel flags into `ui` unless you also keep `ui` typedef docs in sync — either works; a separate module avoids touching the Phase-3 bridge.
- "close" semantic: close panels first; if none open, `deselect()` the grant; if nothing open, say "Nothing to close". Also close the chat? No — leave chat open (the user is in it).

### `src/lib/data/types.ts` / grant fields [VERIFIED]
`Grant { id, funder, program: string|null, type, amount{raw,min,max,avg,isReceived,isTBD,isEquity,isMicro}, deadline{raw,date:'YYYY-MM-DD'|null,cadence,note,isPassed}, requires501c3, requires501c3Raw, fit, status, statusLabel, nextAction, link, template }`.
Fuzzy-match sources: `funder`, `program`, and parenthetical tokens inside `funder` (e.g. `(SNF)`, `(Versaic)`, `(Bank of America)`). `id` is a slug of the whole cell and is also a usable candidate string. `grants` imported from `$lib/data`.

### `src/lib/data/aggregates.ts` [VERIFIED]
Exports: `estimate`, `securedTotal(grants)` (20000 now, NY Community Trust only), `potentialContributors`, `potentialTotal` (296500), `countByStatus`, `by501c3`. **No deadline selector exists.** There is a parity test against `tools/aggregates.mjs`; adding `upcomingDeadlines` there would invite a parity requirement — put it in a new pure file (e.g. `src/lib/voice/facts.ts`) instead. Money formatting: reuse `src/lib/data/format.ts` (exists; check its export name when planning) so spoken "$20,000" matches the HUD; for TTS prefer a spelled phrase ("twenty thousand dollars") — Chrome/Safari read "$20,000" acceptably, so low priority.

### Dataset facts for matcher/facts design [VERIFIED: parsed grants.generated.json, 40 rows]
- Next-deadline reality: only two rows have a future date vs today (2026-11-10): North Star Fund 2026-12-03, Ben & Jerry's 2027-02-18. Three rows have past dates but `isPassed:false`: Harry S. Black (2026-06-30), Ford JustFilms (2026-09-01) — and `isPassed:true` rows: Hey Helen, T7 Summit, Queens Centers. So "what's due next" = rows with `deadline.date >= today`, `!isPassed`, status not in {declined, not-eligible, not-eligible-yet}; sort ascending; read top 3; if none, say so and mention rolling/annual counts. **Inject `now` (Date) into the function** — never call `Date.now()` inside; tests must be deterministic. Parse `YYYY-MM-DD` as local date (split manually) to avoid UTC off-by-one.
- Ambiguous families (must produce "did you mean"): "ford" (2: JustFilms / NYC Good Neighbor), "third wave" (2: Disability Frontlines / Mobilize Power), "borealis" (2: DIF Joy / Just Futures), "bank of america" (3: Charitable Foundation / Neighborhood Builders / Harry S. Black fund), "foundation" alone (many) -> never match on generic words alone.
- Hard-to-recognize names: "Ben & Jerry's", "W.K. Kellogg", "37 Angels", "T7 Summit", "Yield Giving (MacKenzie Scott)", "Skip (YoGovernment, Inc.)", "Stavros Niarchos (SNF)", "CEK", "TD Bank", "Hey Helen", "Tisch". STT will emit e.g. "ben and jerrys", "kellogg", "thirty seven angels", "t 7 summit", "s n f". Normalize: lowercase, `&`->`and`, strip apostrophes/periods/`$`, number-words<->digits for "37"/"t7", split on non-alphanumerics.
- Generic stop-tokens (low IDF automatically, plus explicit list): `the foundation fund grant grants charitable inc program initiative of for`.

## Standard Stack

No new runtime dependencies. This phase deliberately adds zero npm packages and zero pip packages (matches the "build custom tools" directive).

### Core (existing, already pinned)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| svelte (runes) | ^5.56.1 | widget + shared panel store | existing |
| vitest | 4.1.9 | pure-module tests | existing; `pnpm test:unit` |
| @playwright/test | 1.61.1 | e2e with mocked speech | existing; `pnpm test:smoke` |
| pytest | >=8 (8.3.4 present) | endpoint limits tests | `agent/requirements-dev.txt` |
| stdlib `http.server`, `threading`, `tempfile`, `time`, `collections` | py3 | transcribe endpoint | zero new deps |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| hand-rolled matcher | `fuse.js` / `fastest-levenshtein` | extra dep for a 40-string corpus; IDF weighting and ambiguity margin still custom. Not worth it. |
| hand-rolled limiter | `slowapi`/`limits` | not applicable to stdlib server; 25 lines of code |
| `webkitSpeechRecognition` wrapper libs (`react-speech-recognition` etc.) | — | React-only or tiny wrappers; own 80-line wrapper is easier to mock |

**Installation:** none. **Package Legitimacy Audit:** no external packages are recommended in this phase; slopcheck not required. (Packages removed: none. Flagged: none.)

## Architecture Patterns

### System Architecture Diagram
```
 [mic button click/Space/Enter]  (user gesture, required by iOS/Chrome)
        |
        v
  voice/controller (state: idle -> listening -> processing -> idle|error)
        |
   SpeechRecognition available && !forceServer ?
     yes |                               | no / error 'network'|'service-not-allowed'
         v                               v
  Web Speech (interim -> live      MediaRecorder -> Blob (<=20 s, 32 kbps)
  transcript, final result)              |
         |                               v
         |                  POST {BASE}/chat/transcribe (Content-Type = blob mime)
         |                       server: size cap -> MIME check -> rate limit
         |                               -> temp file (suffix from mime) -> voice.transcribe()
         |                               <- {"text": "..."}
         v                               v
              final transcript (shown in chat as user bubble + aria-live)
                         |
                         v
       commands.parse(transcript, {grants, now, pending})   <50 ms, pure
         |                |                 |                |
      command          ambiguous        follow-up         not a command
         |                |           ("the second one")        |
         v                v                 v                   v
  actions.ts       show "Did you mean"   resolve pending     send(text) -> POST /chat
  (setFilter/      choices (buttons +    -> actions           -> poll GET /chat/<id>
   select/panels/  aria-live)                                 "Asking the assistant, this
   facts)                                                       can take a minute"
         |                                                          |
         +----------- confirmation text ----+------ bot reply ------+
                                   |
                       message list + aria-live region
                                   |
                  spoken replies ON?  -> speechSynthesis (cancel, then speak)
```

### Recommended Project Structure
```
src/lib/voice/
├── commands.ts        # pure: normalize, parseIntent, matchFunder, resolveFollowUp
├── commands.test.ts   # vitest: table-driven
├── facts.ts           # pure: nextDeadlines(grants, now, n), securedPhrase(grants), phrasing helpers
├── facts.test.ts
├── actions.ts         # intent -> dashboard calls; takes an injected Dashboard interface
├── stt.ts             # browser: createRecognizer() / createRecorder() wrappers (SSR-safe, onMount-only)
├── tts.ts             # browser: speak(text), cancel(), prefs
└── prefs.ts           # localStorage get/set with try/catch + typeof window guard
src/lib/state/panels.svelte.js   # shared TEMPLATES/SHARE open state
agent/did_agent/chat_api.py      # + /chat/transcribe, _RateLimiter, ThreadingHTTPServer
agent/tests/test_chat_transcribe.py
tests/voice.spec.ts              # Playwright (mock SpeechRecognition / MediaRecorder)
```
`stt.ts`/`tts.ts` must reference `window`/`navigator`/`speechSynthesis`/`MediaRecorder` only inside functions called from `onMount` or event handlers, never at module top level (prerender imports the module). `[CITED: CLAUDE.md CRITICAL PATTERN #1]`

### Pattern 1: Pure intent parser with injected context
```ts
// commands.ts (shape recommendation)
export type Intent =
  | { kind: 'filter'; axis: 'status'|'gate'|'type'; value: string; label: string }
  | { kind: 'reset' }
  | { kind: 'open-grant'; id: string; label: string }
  | { kind: 'did-you-mean'; options: { id: string; label: string }[] }
  | { kind: 'panel'; name: 'templates'|'share' }
  | { kind: 'close' }
  | { kind: 'fact'; fact: 'next-deadlines'|'secured' }
  | { kind: 'cancel-pending' }
  | { kind: 'chat'; text: string };
export interface Ctx { grants: Grant[]; pending?: { id: string; label: string }[] }
export function parse(raw: string, ctx: Ctx): Intent
```
Precedence (first hit wins; this ordering is what prevents "show open" / "open Ford" / "show recurring grants" collisions):
1. **Pending follow-up** (only if `ctx.pending`): ordinals ("first/1st/one/number one", "second/two", "third", "last"), "neither/none/cancel/never mind" -> cancel, or a re-match restricted to the pending options ("the justfilms one"). If nothing matches, drop pending and continue.
2. **System phrases (exact/anchored)**: reset ("reset", "clear filters", "show all", "everything", "clear"), close ("close", "close that", "go back", "dismiss"), panels ("open templates", "templates", "show templates", "share", "open share", "open qr", "show qr"), facts ("what's due next", "next deadline(s)", "what is due", "upcoming deadlines", "how much (is|have we) secured", "secured total", "how much money").
3. **Filter vocabulary (closed set, whole-phrase after the verb)**: verbs `show|only|filter|filter by|just|display`; objects map: status synonyms (`recurring`, `active|active funders`, `in progress`, `applied`, `to research|research`, `declined`, `not eligible yet`, `not eligible|ineligible`), gate (`open|no 501c3|no 501 c 3 required`, `gated|needs 501c3|requires 501c3`, `unknown`), type (`grants`->Grant, `fellowships`->Fellowship, `investments|investment`->Investment). Strip trailing noise words `grants|funders|ones|only`. **Note** "not eligible" vs "not eligible yet": longest-phrase-first matching. **Note** bare "open" must not be a gate filter unless preceded by `show|only|filter` AND followed by end or `grants|funders|ones` — otherwise "open ford" is navigate.
4. **Navigate**: verbs `open|show|go to|select|take me to|find`; remainder (<= 6 tokens after normalization) passed to the matcher. A longer remainder, or one starting with a question word (`how|what|why|when|can|do|does|is|are|tell`), falls through to chat — this is the guard against "show me how to apply to Ford" being hijacked.
5. **Else** `{kind:'chat'}`.

STT quirks to normalize: strip leading "please/hey/okay/can you/could you", trailing punctuation, numerals `5/five`, "501 c 3 / 501(c)(3) / five oh one c three".

### Pattern 2: IDF-weighted fuzzy funder matcher (dependency-free)
Algorithm (tune with the test table, do not hard-code magic outside constants at top of file):
1. Build once per grants array (memoize with a WeakMap): for each grant, candidate token sets `A=funder+program` tokens (normalized, parentheticals included), plus `B=funder only`, plus acronym tokens in parentheses.
2. Corpus document frequency over rows -> `idf(t)=ln((N+1)/(df+1))+1`; generic stop-tokens get weight x0.2.
3. For a query token `q` and candidate token `c`, similarity `s(q,c)`: 1 if equal; 0.92 if one is a prefix of the other (len>=3); else `1 - lev(q,c)/max(len)` accepted only if >=0.75 (so "kellog"~"kellogg", "boreal"~"borealis", "thirdwave"/"third wave" handled by also trying the joined bigram); plus a cheap phonetic key (drop vowels except first, collapse repeats) equality gives 0.8 — enough for "jerrys"/"jerry's" after normalization and "nstar"/"north star" misses.
4. `queryCoverage = Σ idf(q)·max_c s(q,c) / Σ idf(q)` ; `candCoverage = Σ idf(c)·max_q s(q,c) / Σ idf(c)` over the *funder-only* tokens (so saying just "ford" fully covers the funder). Score per candidate set = `0.7·queryCoverage + 0.3·candCoverage`; grant score = max over its candidate sets.
5. Decision (constants): `HIGH=0.82`, `LOW=0.55`, `MARGIN=0.08`.
   - best >= HIGH and (second-best *from a different funder or program* <= best − MARGIN) -> `open-grant`.
   - best >= LOW and (ambiguous or best < HIGH) -> `did-you-mean` with top 3 distinct rows (`program ?? funder` labels; for same-funder rows show "Ford Foundation: JustFilms").
   - best < LOW -> no match: if verb was `open|go to` say "I couldn't find that funder" ONLY when the remainder is short and chat is not better; per D-09 "Unmatched speech goes to the chat", so return `chat`.
   - Same-funder family rule: if the query fully matches a funder name but not a program, and that funder has >1 row -> always `did-you-mean` (Ford, Third Wave, Borealis, Bank of America) regardless of score.
6. Performance: 40 rows x ~6 tokens — microseconds. Target <50 ms is trivially met; assert `< 5 ms` loosely in a test using `performance.now()` over 100 parses (not a flaky tight bound).

Reference test table (must be in `commands.test.ts`): "open north star"->north-star-fund-nyc-organizing-grants; "open ben and jerrys"->ben-jerry-s-...; "go to kellogg"->w-k-kellogg-foundation; "show snf"->stavros-niarchos-foundation-snf; "open ford"->did-you-mean(2); "open bank of america"->did-you-mean(3 of 3); "open the third wave mobilize"->mobilize-power-fund; "open foundation"->did-you-mean or chat (never a confident single pick); "open thirty seven angels"->37-angels; "show recurring grants"->filter status=recurring (NOT navigate); "show open grants"->filter gate=open; "open templates"->panel; "how much is secured"->fact; "what is the deadline for ford"->chat.

### Pattern 3: Shared panel store + adapter
`actions.ts` exports `createActions(dash: Dashboard, data: {grants, now})` returning `run(intent): { speak: string }`; the real `Dashboard` object is assembled in `ChatWidget` from `crystarium.svelte.js` + `panels.svelte.js`. The returned string is both appended to the chat as a bot message, written to the aria-live region, and (if enabled) spoken. Confirmation strings are pure and unit-tested ("Showing 3 recurring grants" — count with `matchesFilter` from `filter.ts` against the *new* filter state, computed in the adapter before/after apply).

### Anti-Patterns to Avoid
- **Reading `ui.filter` right after `setFilter` expecting DOM updates** — runes update synchronously; fine, but count with `matchesFilter(g, nextFilter)` so tests don't need the store.
- **Putting the panel `open` flags in the page or in the ChatWidget** — ChatWidget is in the layout; use a shared module store.
- **Using the engine's own end-of-speech as the 8 s rule** — Chrome ends sooner and iOS differs; run your own timer (below).
- **Setting `export const ssr = false`** — forbidden (CLAUDE.md).
- **Trusting client filename/extension on upload** — derive suffix from validated MIME map only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio decoding in Python | custom container parsing / duration probing | `voice.transcribe()` (hosted Whisper API or faster-whisper+PyAV) | already handles both; just give it a correctly-suffixed file |
| Speech recognition grammar bias | custom STT | `SpeechRecognition.phrases` where supported (optional enhancement) | `grammars` is deprecated/no-op `[CITED: developer.mozilla.org/docs/Web/API/SpeechRecognition]` |
| TTS | audio generation | `window.speechSynthesis` | D-17 |
| Rate-limit store | Redis/limits lib | deque-per-IP with lock + periodic prune | single process, stdlib server |

**Key insight:** the hand-rolled parts are only the grammar and matcher (small, pure, fully testable). Everything else is a thin wrapper over platform APIs.

## Web Speech API practicalities

Items marked `[ASSUMED]` come from training knowledge and MUST be spot-checked in the manual browser matrix (Wave "manual checks"); MDN confirms only what is cited.

- **Constructor:** `const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition` evaluated inside `onMount`/handler. MDN lists the feature as "Limited availability" (not Baseline) `[CITED: MDN SpeechRecognition]`. Chrome/Edge/Safari expose it (Chrome and Safari historically via the `webkit` prefix) `[ASSUMED]`; **Firefox does not ship it** `[ASSUMED]` -> this is exactly the MediaRecorder fallback path (VOICE-05).
- **Settings:** `continuous=false`, `interimResults=true`, `lang='en-US'` (make `document.documentElement.lang`-derived), `maxAlternatives=1`. Defaults: continuous false, interimResults false `[CITED: MDN]`.
- **Events to wire:** `onresult` (concat `event.results` from `resultIndex`; `isFinal` marks the last), `onerror` (`event.error`), `onend` (always fires after start, even after errors; treat as the single place to return to `idle`), `onspeechstart`/`onaudiostart` (optional, to cancel the silence timer).
- **Error codes** (`no-speech`, `aborted`, `audio-capture`, `network`, `not-allowed`, `service-not-allowed`, `bad-grammar`, `language-not-supported`) are named in the spec; MDN's SpeechRecognition page confirms the list only as spec-defined `[CITED: MDN, error list deferred to spec]`. Recommended mapping:
  | code | user message | action |
  |------|--------------|--------|
  | `no-speech` | "I didn't catch that" | idle (this is also the 8 s path) |
  | `not-allowed` / `service-not-allowed` | "Microphone or speech service is blocked. Check browser permissions, or type instead." | do NOT silently fall back to server (privacy + would re-prompt); offer the server path via the setting |
  | `network` | "Browser speech service unreachable, trying server transcription" | **auto fall back to MediaRecorder path** (D-02 "or fails") — but only if the mic permission was already granted |
  | `audio-capture` | "No microphone found" | idle |
  | `aborted` | silent (user cancel) | idle |
  | `language-not-supported` | message | idle |
- **Silence rule (8 s):** start a `setTimeout(8000)` on `start`; clear it on first `onresult`/`onspeechstart`; restart a shorter post-speech timer if you want, but the required behaviour is: no speech within 8 s -> `recognition.abort()` + "I didn't catch that". Because Chrome often ends non-continuous sessions on its own shortly after speech stops `[ASSUMED]`, `onend` after a final result is the normal success path; guard with a `gotFinal` flag so `onend` without a result = "I didn't catch that" exactly once (avoid double announcement from timer + `no-speech`).
- **Interim -> final:** show interim text in the live line (aria-live **off** for interim to avoid spamming screen readers; announce only the final transcript — a polite region updating every word is hostile). Commit the final transcript to the message list.
- **Gesture & HTTPS:** `start()` must be called synchronously from the click/keydown handler (iOS Safari and Chrome require a user gesture and a secure context; `localhost` counts as secure) `[ASSUMED]`. Never `await` anything (fetch, config load) before `start()`. On iOS Safari the feature requires Siri/Dictation to be enabled; otherwise `service-not-allowed` `[ASSUMED]` -> message above. GitHub Pages is HTTPS, so fine.
- **Privacy notice (D-16):** Chrome/Edge send audio to a vendor server; `processLocally` exists but support is limited `[CITED: MDN]`. Show notice once (localStorage flag) before the first start. Settings checkbox "Always use server transcription" (stores `did.voice.forceServer`).
- **One recognizer at a time:** if `listening`, mic click = `stop()` (toggle, `aria-pressed` reflects state). Call `abort()` on component destroy and on `visibilitychange` hidden.
- **Do not speak while listening:** `speechSynthesis.cancel()` on mic start, otherwise the recognizer hears the bot (feedback loop).

### MediaRecorder fallback
- `getUserMedia({audio:true})` must also be started from the gesture handler (a pending permission prompt consumed the gesture on Safari; call it first thing) `[ASSUMED]`.
- **Container reality differs from CONTEXT D-12's "webm/opus":** Chrome/Edge record `audio/webm;codecs=opus`; **Firefox records `audio/ogg;codecs=opus`** (or webm in recent versions); **Safari records `audio/mp4` (AAC)** `[ASSUMED, verify in manual matrix]`. Choose with `MediaRecorder.isTypeSupported` in order `['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4']`, falling back to the recorder default, and send `blob.type` as the request `Content-Type` verbatim.
- Cap: `new MediaRecorder(stream, { audioBitsPerSecond: 32000 })` (hint, may be ignored) and auto-stop at 18 s; at 32 kbps 20 s is ~80 KB, far below the 1 MB cap; at Safari's AAC rates it is still < 1 MB `[ASSUMED]`. Stop all tracks (`stream.getTracks().forEach(t=>t.stop())`) on end so the browser's mic indicator turns off.
- Hosted Whisper accepts `flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm`, 25 MB max on Groq free tier `[CITED: console.groq.com/docs/speech-to-text]`. So webm/ogg/mp4 all pass. The docs do not say whether the extension is validated; the existing `voice.py` comment says the API sniffs the container from the filename extension `[CITED: agent/did_agent/voice.py comment]` -> **the temp file suffix must match the real container**.
- Local faster-whisper decodes through PyAV (`av` wheel), which bundles FFmpeg libs, so webm/ogg/mp4 decode without a separate ffmpeg binary `[ASSUMED]`; `voice.py` docstring says local mode "needs the av wheel and ffmpeg installed" — treat as required on that path and document it in `agent/README.md`.

## `/chat/transcribe` — chat_api.py anatomy and fit

**Structure [VERIFIED: file read]**
- stdlib `http.server.HTTPServer` (single-threaded!) + `BaseHTTPRequestHandler`, handler class built by `_make_handler(agent, settings)`, closed over `token`. Server started by `start()` in a daemon thread; binds `chat_api_host:chat_api_port` (default 127.0.0.1:8080; 0.0.0.0 when hosted).
- Routing is manual string compare: `do_POST` rejects anything but `/chat` with `send_error(404)` (that line must be extended to route `/chat/transcribe`). `do_GET` treats any `chat/...` path as a job id poll — `POST /chat/transcribe` does not collide with GET but `GET /chat/transcribe` would hit job lookup (404 JSON); harmless.
- Body read: `length = int(headers["Content-Length"])`, `json.loads(rfile.read(length))` — **no size cap exists today** (existing exposure on `/chat`; optionally cap it as a low-risk hardening, but out of scope unless trivial).
- CORS: `_cors_headers()` sends `Access-Control-Allow-Origin: *`, methods `GET, POST, OPTIONS`, headers `Content-Type, Authorization`. There is no allow-list; "same CORS allow-list" = reuse `_cors_headers()`. A `Content-Type: audio/webm` POST is a non-simple request -> preflight `OPTIONS` already answered 204 with those headers; `Content-Type` is allowed. Good, nothing to add.
- Auth: `/chat` does the `CHAT_API_TOKEN` check inline (skipped for `trycloudflare.com` Host). Per D-05 the token stays unset; still **reuse the same check** for `/chat/transcribe` (extract into a `_authorized()` helper so behaviour is identical).
- Responses: `_json_response(code, dict)`.
- Client IP: `self.client_address[0]` is `127.0.0.1` behind the Cloudflare tunnel/Docker proxy, which would make all users share one bucket. Use `CF-Connecting-IP` (then first `X-Forwarded-For`) **only when the peer address is loopback/private**, else the socket address. Document this.

**Required behaviours and order (cheap checks first, before reading the body):**
1. Route + auth.
2. Parse `Content-Type` -> base type lowercase, strip params; must be in allow-map else **415**. Allow-map: `audio/webm->.webm`, `audio/ogg->.ogg`, `audio/opus->.ogg`, `audio/mp4->.mp4`, `audio/x-m4a|audio/m4a->.m4a`, `audio/mpeg|audio/mp3->.mp3`, `audio/wav|audio/x-wav|audio/wave->.wav`, `audio/aac->.aac` (aac is not in Groq's list; omit or transcode — recommend omit), `audio/flac->.flac`. Note Safari may send `audio/mp4;codecs=mp4a.40.2`.
3. Rate limit (before reading body so abusers pay nothing): 10 per 60 s per IP -> **429** with `Retry-After`. Count attempts, including rejected-by-size, to stop probing floods? Count after MIME pass to keep tests simple; decide in plan, test both.
4. `Content-Length` must be present (no chunked support in `BaseHTTPRequestHandler`) and `0 < n <= 1_048_576` else **411/400/413**; reject on the header **before** `rfile.read`. If 413 is sent without reading the body, set `self.close_connection = True` to avoid desynced keep-alive.
5. Read exactly `n` bytes, write to `tempfile.mkstemp(suffix=ext)`, `try/finally os.unlink`.
6. Call `voice.transcribe(path, settings.whisper_model, settings.whisper_base_url, settings.whisper_api_key)` (blocking; exceptions -> **502/500** JSON `{"error": "Transcription failed"}`, log with `log.exception`, never echo internals).
7. Return `200 {"text": "..."}`; empty text -> `200 {"text": ""}` so the client shows "I didn't catch that".
8. 20 s cap: the server cannot cheaply know duration for webm; the byte cap + client auto-stop are the enforcement. Do not add ffprobe. State this explicitly in the README ("about 20 s").

**Threading hazard [VERIFIED by reading `start()`]:** `HTTPServer` handles one request at a time. Local Whisper `base` on CPU can take several seconds; during that time every chat poll and the dashboard static GETs stall. Change `HTTPServer` -> `ThreadingHTTPServer` (same module, `daemon_threads = True`). `_JOBS`/`_HISTORY` are plain dicts mutated from threads already (agent worker threads), and each key is written atomically under the GIL, so no new locking beyond the limiter's own `threading.Lock`. Also serialize Whisper itself with a module lock or semaphore (`threading.BoundedSemaphore(1..2)`) so concurrent uploads cannot OOM a small VM; busy -> 503.

**Limiter sketch (stdlib):**
```python
class _RateLimiter:
    def __init__(self, limit=10, window=60.0, clock=time.monotonic):
        self._limit, self._window, self._clock = limit, window, clock
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
    def allow(self, key: str) -> bool:
        now = self._clock()
        with self._lock:
            q = self._hits.setdefault(key, deque())
            while q and now - q[0] >= self._window: q.popleft()
            if len(q) >= self._limit: return False
            q.append(now)
            if len(self._hits) > 5000:           # opportunistic prune: bounded memory
                for k in [k for k, d in self._hits.items() if not d or now - d[-1] >= self._window]:
                    self._hits.pop(k, None)
            return True
```
Injectable `clock` -> tests advance time without sleeping.

**Test pattern (offline pytest, no new deps):** start a real server on port 0 in a thread:
```python
from types import SimpleNamespace
settings = SimpleNamespace(chat_api_token="", chat_api_host="127.0.0.1", chat_api_port=0, whisper_model="base", whisper_base_url="", whisper_api_key="")
srv = ThreadingHTTPServer(("127.0.0.1", 0), chat_api._make_handler(agent=object(), settings=settings))
```
`_make_handler` only touches `settings.chat_api_token` at build time and the transcribe settings per request, so `SimpleNamespace` suffices (avoids constructing the heavy `Settings` dataclass). `monkeypatch.setattr(chat_api.voice, "transcribe", fake)` — requires `chat_api` to `from did_agent import voice` (module attribute, not `from ... import transcribe`) so the patch takes effect. Use `http.client.HTTPConnection` to send raw bodies. Cases: 200 happy path (asserts temp file suffix `.webm`, file deleted afterward), 415 for `text/plain` and `application/json`, 413 for 1 MB + 1, 429 on the 11th request, window reset via injected clock, CORS header present on all error responses, preflight 204, 502 when transcribe raises, token enforced when set. `chat_api` imports `did_agent.llm.client.Agent` at import time — existing tests already import `did_agent` so imports resolve; confirm in Wave 0 that `import did_agent.chat_api` works with only `requirements-dev.txt` + app requirements installed.

**In-flux files:** `main.py`, `agent/README.md`, `agent/Dockerfile`, `agent/deploy/oracle/docker-compose.yml` are being edited by quick task 261110-vgj. This phase touches `agent/README.md` only additively (append a "Voice transcription endpoint" section at a clearly separate location, no reflow of existing text). `main.py` already wires `voice.transcribe` for Telegram (lines ~201-205) and calls `chat_api.start(agent, settings)`; the new endpoint needs **no** `main.py` change — avoid touching it. Whisper env vars already exist in `config.py`: `WHISPER_MODEL`, `WHISPER_BASE_URL`, `WHISPER_API_KEY` (falls back to `LLM_API_KEY`) `[VERIFIED: config.py]`. The Dockerfile may or may not install ffmpeg/faster-whisper — read-only check during planning; document, do not edit.

## speechSynthesis practicalities `[ASSUMED]` unless noted
- Guard: `typeof window !== 'undefined' && 'speechSynthesis' in window`; hide the speaker toggle if absent.
- **Voices load asynchronously** (Chrome): `getVoices()` may return `[]` until `voiceschanged` fires; speak without setting `utterance.voice` (browser default for `utterance.lang='en-US'`) and optionally pick an English voice if already loaded. Don't block on it.
- **Cancel before speak:** call `speechSynthesis.cancel()` then `speak()` so replies don't queue behind stale text; also cancel when the toggle goes off, on mic start, and on panel close.
- **Chrome ~15 s cutoff on long utterances** (desktop Chrome with network voices stops mid-utterance, and `onend` may not fire): split text into sentence chunks (<= ~200 chars) and queue them; avoid the pause/resume keep-alive hack. LLM replies can be long — also truncate spoken reply at ~600 chars with "...see the chat for the rest" to be kind to listeners.
- Autoplay: speech must be user-initiated at least once on some browsers; because the toggle is a user click and replies come later, Safari/iOS may refuse speech for a reply that arrives after a 3-minute poll. Mitigate: on toggle-on, speak a short "Spoken replies on" utterance inside the click handler to unlock the engine.
- Don't read markdown/URLs: strip `[text](url)`, bare URLs, and `*`/`#` before speaking.
- **D-19:** `prefers-reduced-motion` only disables the CSS pulse on the mic; never gate TTS on it.
- Screen-reader users: spoken replies + aria-live can double-announce. Keep the toggle off by default (D-04) and note it in the help text.

## Accessibility contract (VOICE-07)
- Mic: `<button type="button" aria-pressed={listening} aria-label="Voice input: push to talk">`, min 44x44 CSS px (the current send button is 36 px — the mic needs `min-width/min-height: 44px`; widen the input row accordingly), visible text/glyph change to "Listening..." with a non-colour cue. Native button gives Enter/Space free. Do not use `onpointerdown` as the sole trigger — use `onclick` so keyboard works. Add an optional `Escape` while listening to cancel.
- Live region: one persistent `<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">` rendered whether or not messages exist (regions created on demand are often not announced). Write to it: final transcript ("You said: show recurring grants"), command confirmation, "Asking the assistant...", and the bot reply. Interim text goes to a visible but non-live element. Clear/replace text rather than append to avoid long reads.
- The chat panel is `role="dialog"` already; on open, keep focus management minimal but ensure the mic is reachable in tab order after the text input and before Send.
- Did-you-mean choices render as real `<button>`s (focusable, labelled) so keyboard users can pick without voice.
- Existing mouse/keyboard equivalents stay: filter chips, TEMPLATES/SHARE toggles, node selection — the shared panel store keeps their handlers intact.
- `tabindex` and focus ring: use `:focus-visible` outline consistent with the widget (`#1f6fb2`).

## Chat integration (VOICE-04, D-18)
- Current `send()` reads `inputVal`, posts, polls `GET /chat/<id>` every 3 s up to 120x (6 min). Refactor to `send(text = inputVal)`; voice calls `send(transcript)` after pushing the user bubble itself (transcript visible before the reply; avoid duplicating the user bubble — move the bubble-push inside `send` and have commands push their own bubble + bot confirmation).
- `busy` currently blocks Send while a reply is pending; a spoken command during a pending LLM reply should still run locally (commands never need the API) — only the `chat` fallthrough is blocked while `busy`; say "Still waiting for the last answer".
- Replace the "Thinking..." typing bubble text with "Asking the assistant, this can take a minute" when initiated via voice (and the announcement).
- API base: `BASE` is discovered asynchronously (`loadConfig()` fire-and-forget); the transcribe path must use the same `BASE` at call time (read the variable when uploading, not at module init). The mocked Playwright tests must stub both `http://127.0.0.1:8080/**` and the `raw.githubusercontent.com` config fetch.
- `msg.from` types in use: `bot`, `user`, `typing`. Add `system` or reuse `bot` for command confirmations; keep CSS classes in sync.

## Common Pitfalls

### Pitfall 1: Panel state unreachable from the voice adapter
**What goes wrong:** "open templates" does nothing because `open` is local to `TemplatesPanel`.
**How to avoid:** shared `panels.svelte.js` store, both panels bind to it. Verify mouse toggle and Escape still work (Playwright keyboard test).
**Warning signs:** adapter has to query the DOM or dispatch synthetic clicks.

### Pitfall 2: `show recurring grants` hijacked by navigate (or `open ford` by gate "open")
**How to avoid:** precedence order above; closed-vocabulary filter before fuzzy navigate; gate-`open` only with filter verbs; table-driven tests for the collision cases.

### Pitfall 3: Question hijacked as a command
**What goes wrong:** "show me how to apply to Ford" selects Ford.
**How to avoid:** remainder length <= 6 tokens, no leading question word, else chat.

### Pitfall 4: Double "I didn't catch that"
**What goes wrong:** own 8 s timer, `no-speech` error, and `onend` all fire.
**How to avoid:** single `finish(reason)` function guarded by a `settled` flag; timers cleared there.

### Pitfall 5: Prerender breaks
**What goes wrong:** top-level `window`/`localStorage`/`speechSynthesis` in a module imported by the layout crashes `vite build` prerender; `verify:build` check #6 then fails.
**How to avoid:** all browser access inside functions invoked from `onMount`/handlers; `prefs.ts` wraps `localStorage` in `typeof window` + try/catch (Safari private mode throws). Run `pnpm build` (with `BASE_PATH`) in CI/verification, then `pnpm verify:build`.

### Pitfall 6: Single-threaded server stalls
**What goes wrong:** transcription blocks chat polling.
**How to avoid:** `ThreadingHTTPServer` + bounded semaphore around Whisper.

### Pitfall 7: Wrong temp-file suffix
**What goes wrong:** hosted Whisper rejects/garbles `.ogg` filename holding an mp4 payload.
**How to avoid:** suffix from the validated MIME map; never from client.

### Pitfall 8: Rate limit keyed by proxy IP
**What goes wrong:** all users share `127.0.0.1` behind Cloudflare/Docker -> 10/min globally.
**How to avoid:** trusted-proxy header handling as described; test with and without header.

### Pitfall 9: Unclear "today" in deadline facts
**What goes wrong:** tests flake or read stale deadlines; the dataset has non-`isPassed` rows with dates already past.
**How to avoid:** inject `now`; filter by `date >= today` AND `!isPassed` AND eligible status.

### Pitfall 10: Mic stays on / feedback loop
**How to avoid:** stop tracks after recording; cancel TTS when listening starts.

## Code Examples

### Recognizer wrapper (SSR-safe, single settle point)
```ts
// stt.ts — only call from onMount/handlers. Source: MDN SpeechRecognition API surface.
export function getSR(): (new () => any) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export function listen(opts: {
  onInterim(t: string): void; onFinal(t: string): void; onFail(code: string): void; silenceMs?: number;
}) {
  const SR = getSR()!; const r = new SR();
  r.lang = document.documentElement.lang || 'en-US';
  r.continuous = false; r.interimResults = true; r.maxAlternatives = 1;
  let settled = false, got = false;
  const done = (fn: () => void) => { if (settled) return; settled = true; clearTimeout(t); fn(); };
  const t = setTimeout(() => { try { r.abort(); } catch {} done(() => opts.onFail('no-speech')); }, opts.silenceMs ?? 8000);
  r.onresult = (e: any) => {
    clearTimeout(t); got = true;
    let text = '', final = false;
    for (let i = e.resultIndex; i < e.results.length; i++) { text += e.results[i][0].transcript; final ||= e.results[i].isFinal; }
    final ? done(() => opts.onFinal(text.trim())) : opts.onInterim(text);
  };
  r.onerror = (e: any) => done(() => opts.onFail(e.error));
  r.onend = () => done(() => opts.onFail(got ? 'no-final' : 'no-speech'));
  r.start();                       // MUST be in the user-gesture call stack
  return { stop: () => r.stop(), abort: () => r.abort() };
}
```
Note: collecting interim text across calls should accumulate by index (above resets per event; simplest correct form is to join all `event.results` each time).

### Server transcribe core
```python
_AUDIO_EXT = {"audio/webm": ".webm", "audio/ogg": ".ogg", "audio/opus": ".ogg", "audio/mp4": ".mp4",
              "audio/x-m4a": ".m4a", "audio/m4a": ".m4a", "audio/mpeg": ".mp3", "audio/mp3": ".mp3",
              "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/wave": ".wav", "audio/flac": ".flac"}
_MAX_AUDIO_BYTES = 1_048_576

def _handle_transcribe(self):
    ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
    ext = _AUDIO_EXT.get(ctype)
    if not ext: return self._json_response(415, {"error": "Unsupported media type"})
    if not _limiter.allow(self._client_ip()):
        return self._json_response(429, {"error": "Too many requests"})   # + Retry-After
    try: n = int(self.headers.get("Content-Length", ""))
    except ValueError: return self._json_response(411, {"error": "Content-Length required"})
    if n <= 0: return self._json_response(400, {"error": "Empty body"})
    if n > _MAX_AUDIO_BYTES:
        self.close_connection = True
        return self._json_response(413, {"error": "Audio too large (max 1 MB)"})
    data = self.rfile.read(n)
    fd, path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(fd, "wb") as fh: fh.write(data)
        text = voice.transcribe(path, settings.whisper_model, settings.whisper_base_url, settings.whisper_api_key)
        self._json_response(200, {"text": text})
    except Exception:
        log.exception("transcribe failed"); self._json_response(502, {"error": "Transcription failed"})
    finally:
        try: os.unlink(path)
        except OSError: pass
```

### Playwright: mocked SpeechRecognition
```ts
// tests/voice.spec.ts
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class FakeSR {
      continuous = false; interimResults = false; lang = ''; maxAlternatives = 1;
      onresult: any; onerror: any; onend: any;
      static last: FakeSR | null = null;
      start() { FakeSR.last = this; (window as any).__srStarted = ((window as any).__srStarted ?? 0) + 1; }
      stop() { setTimeout(() => this.onend?.({}), 0); }
      abort() { setTimeout(() => this.onend?.({}), 0); }
    }
    (window as any).SpeechRecognition = FakeSR;
    (window as any).__say = (text: string) => {            // test drives the "user speech"
      const sr = FakeSR.last!;
      const res: any = [{ transcript: text }]; res.isFinal = true;
      sr.onresult?.({ resultIndex: 0, results: [res] });
      sr.onend?.({});
    };
  });
  // The widget probes http://127.0.0.1:8080 then raw.githubusercontent.com on load; stub both.
  await page.route('http://127.0.0.1:8080/**', r => r.abort());
  await page.route('https://raw.githubusercontent.com/**', r => r.fulfill({ json: { api_url: 'http://127.0.0.1:8080' } }));
});
test('say "show recurring grants"', async ({ page }) => {
  await page.goto('/Eman_dashboard/');
  await page.getByTitle('Chat with DID assistant').click();
  await page.getByRole('button', { name: /voice input/i }).click();
  await page.evaluate(() => (window as any).__say('show recurring grants'));
  await expect(page.getByRole('status')).toContainText(/recurring/i);
  await expect(page.getByRole('button', { name: 'Recurring' })).toHaveClass(/active/);
});
```
Notes: `addInitScript` runs before page scripts, so the constructor exists when `onMount` evaluates it. Mock route order: Playwright matches the most recently registered route first, so register specific `/chat` and `/chat/transcribe` routes after the generic one. For the server-path test, add an init script that `delete`s both `SpeechRecognition` and `webkitSpeechRecognition` and replaces `navigator.mediaDevices.getUserMedia` + `window.MediaRecorder` with fakes (class with `start/stop`, `ondataavailable`, `onstop`, `static isTypeSupported = () => true`); then `page.route('**/chat/transcribe', route => route.fulfill({json:{text:'open templates'}}))`. Alternative for Chromium: launch args `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` + `permissions: ['microphone']`, which exercises the real `MediaRecorder` (more realistic, still deterministic) — recommend the real-recorder variant for one test and the pure fake for the rest. Assert the request: `page.waitForRequest(r => r.url().endsWith('/chat/transcribe'))` and check `r.headers()['content-type']` starts with `audio/`.
The WebGL canvas may fail headless; the page falls back to `FallbackList` (RESL-01), which still calls `select(id)` into `DetailPanel` — assertions should target DOM (detail panel heading, filter chip `.active`, panel `aria-expanded`), never canvas pixels. Existing `webServer` serves the prebuilt `build/` via `vite preview` — **voice changes only appear after `pnpm build`**; Playwright does not rebuild.
Keyboard-only run: `page.keyboard.press('Tab')` loop to focus the chat toggle (or `focus()` then `Enter`), Tab to the mic, `Space` to start, `__say`, assert `aria-pressed` toggles and the live region text; then `Tab` to a did-you-mean button and `Enter`.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `webkitSpeechRecognition` only | unprefixed `SpeechRecognition` also exposed in newer Chromium; MDN documents `processLocally`, `phrases`, `available()/install()` `[CITED: MDN]` | feature-detect both names; treat on-device options as optional enhancements, not dependencies |
| Grammar lists (`SpeechGrammarList`) | removed/no-op; use `phrases` biasing where supported `[CITED: MDN]` | don't ship grammars |

## Runtime State Inventory
Not a rename/refactor/migration phase — omitted. (New persisted state is only two `localStorage` keys: spoken-replies flag, force-server flag, plus a one-time notice flag; all optional and try/catch-guarded.)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | vitest/playwright/build | yes | v24.18.0 (project pins 22 via `.nvmrc`; engines >=22) | — |
| pnpm | all JS scripts | yes (project standard; `node_modules` present) | — | — |
| Python (via uv) | pytest | yes: `python --version` is shimmed to `uv run python`; pytest 8.3.4 importable | — | `uv run pytest` |
| Chromium for Playwright | smoke tests | `[ASSUMED]` installed (existing smoke test); verify with `pnpm exec playwright --version` | 1.61.1 | `pnpm exec playwright install chromium` |
| Real mic / Chrome / Safari / Firefox | manual matrix | human only | — | named manual checks |
| Whisper backend (Groq key or faster-whisper+av) | live transcribe | not verified, not needed for automated tests (fake `voice.transcribe`) | — | monkeypatch in pytest; live check is owner step (deploy deferred) |

**Missing with no fallback:** none for automated verification.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (JS unit) | vitest 4.1.9; no `test` block in `vite.config.ts` (defaults: `**/*.{test,spec}.?(c\|m)[jt]s`; Playwright specs live in `tests/*.spec.ts` — **vitest default include would also match `*.spec.ts`**, so confirm in Wave 0 that `vitest run` does not try to execute `tests/smoke.spec.ts`; if it does, add `test.include: ['src/**/*.test.ts','tools/**/*.test.mjs']` — currently `pnpm test:unit` passes with that file present, so it is presumably already excluded or ignored; re-verify after adding `tests/voice.spec.ts`) |
| Framework (E2E) | @playwright/test 1.61.1, chromium project, serves prebuilt `build/` through `vite preview` on :4173 |
| Framework (Python) | pytest >=8 (8.3.4 present), tests in `agent/tests/` |
| Quick run | `pnpm test:unit` ; `uv run pytest agent/tests -q` (run from repo root or `agent/`; confirm cwd/pythonpath in Wave 0) |
| Full suite | `pnpm check && pnpm test:unit && BASE_PATH=/Eman_dashboard pnpm build && pnpm verify:build && pnpm test:smoke` plus `uv run pytest agent/tests` |
| Scripts (package.json) | `test:unit`=`vitest run`, `verify:build`=`node tools/verify-build.mjs`, `test:smoke`=`playwright test`, `check`=`svelte-kit sync && svelte-check --tsconfig ./tsconfig.json`, `build`=`pnpm build:data && pnpm build:qr && vite build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOICE-01 | Mic starts recognizer, interim shown, final committed, 8 s silence -> "I didn't catch that", `aria-pressed` toggles | Playwright (fake SR) + vitest for timer logic using fake timers on `stt.ts` | `pnpm test:smoke -g "voice"` ; `pnpm test:unit` | no, Wave 0 |
| VOICE-01 | Real browser mic/Chrome-Edge-Safari behaviour, iOS gesture | manual (M1: Chrome, M2: Edge, M3: Safari macOS, M4: iOS Safari) | — | n/a |
| VOICE-02 | Intent parsing for filter/reset/panels/close/facts incl. synonyms and precedence | vitest table | `pnpm test:unit -- src/lib/voice/commands.test.ts` | no, Wave 0 |
| VOICE-02 | Facts: secured total ($20,000), next deadlines with injected `now` | vitest | `pnpm test:unit -- src/lib/voice/facts.test.ts` | no, Wave 0 |
| VOICE-02 | Actions adapter calls correct dashboard methods; confirmation strings ("Showing N recurring grants") | vitest with fake `Dashboard` | `pnpm test:unit -- src/lib/voice/actions.test.ts` | no, Wave 0 |
| VOICE-02 | End-to-end: "show recurring grants" updates the chip; "open templates" expands panel; "reset" clears; "close" closes | Playwright | `pnpm test:smoke -g "voice commands"` | no, Wave 0 |
| VOICE-03 | Fuzzy table (north star, ben and jerrys, kellogg, snf, 37 angels); ambiguous families -> did-you-mean; follow-ups "the second one"; generic-word guard; question-not-navigate guard | vitest | same `commands.test.ts` | no, Wave 0 |
| VOICE-03 | "open north star" opens detail panel in the fallback/real UI | Playwright | `pnpm test:smoke -g "open north star"` | no, Wave 0 |
| VOICE-04 | Non-command transcript -> bubble appears, then `POST /chat` called with that text unchanged, "Asking the assistant" shown | Playwright with `page.route('**/chat')` | `pnpm test:smoke -g "question"` | no, Wave 0 |
| VOICE-05 | MIME allow/deny, 1 MB cap (413), rate limit 11th -> 429 and window reset, temp file suffix + cleanup, CORS headers on errors, token enforced, upstream failure -> 502, XFF/CF header handling | pytest (real server on port 0, fake `voice.transcribe`, injected clock) | `uv run pytest agent/tests/test_chat_transcribe.py -q` | no, Wave 0 |
| VOICE-05 | Client falls back when `SpeechRecognition` absent: records, posts `audio/*` to `/chat/transcribe`, uses returned text | Playwright (Chromium fake media flags or fake MediaRecorder) | `pnpm test:smoke -g "server fallback"` | no, Wave 0 |
| VOICE-05 | Real Firefox record -> transcribe; real Safari mp4 container accepted by the deployed Whisper backend | manual (M5: Firefox, M6: Safari) | — | n/a |
| VOICE-06 | Toggle default off, persists in `localStorage` across reload, `speechSynthesis.speak` called with confirmation/reply when on (spy via init script), `cancel()` before speak | Playwright (spy on `speechSynthesis`) + vitest for chunking/strip-markdown helpers | `pnpm test:smoke -g "spoken replies"` ; `pnpm test:unit` | no, Wave 0 |
| VOICE-06 | Audible output, long reply not cut off at ~15 s in Chrome | manual (M7) | — | n/a |
| VOICE-07 | Mic is a `<button>`, bounding box >= 44x44, `aria-pressed`, keyboard-only flow (Tab/Space/Enter/Escape), live region exists and receives transcript/result/reply; existing controls (filter chips, TEMPLATES/SHARE toggles, Escape on templates) still work | Playwright (keyboard + `boundingBox`) | `pnpm test:smoke -g "keyboard"` | no, Wave 0 |
| VOICE-07 | Screen reader (VoiceOver/NVDA) announcement quality | manual / deferred UAT (M8) per CONTEXT | — | n/a |
| D-25 | Prerender still clean, base path intact, no browser API at SSR | build gate | `BASE_PATH=/Eman_dashboard pnpm build && pnpm verify:build` | exists |

### Sampling Rate
- **Per task commit:** `pnpm test:unit` (and `uv run pytest agent/tests -q` for agent tasks)
- **Per wave merge:** `pnpm check && pnpm test:unit`, plus `BASE_PATH=/Eman_dashboard pnpm build && pnpm verify:build && pnpm test:smoke` once the widget wiring lands
- **Phase gate:** full suite green + manual matrix M1-M7 recorded in the verification file; M8 stays deferred

### Wave 0 Gaps
- [ ] `src/lib/voice/commands.test.ts`, `facts.test.ts`, `actions.test.ts` — VOICE-02/03
- [ ] `tests/voice.spec.ts` — fake `SpeechRecognition`, fake `MediaRecorder`/fake-media flags, `speechSynthesis` spy, route stubs for `127.0.0.1:8080` and raw.githubusercontent.com — VOICE-01/04/05/06/07
- [ ] `agent/tests/test_chat_transcribe.py` — VOICE-05
- [ ] Confirm `pnpm test:unit` ignores `tests/*.spec.ts`; confirm `uv run pytest agent/tests` import path works from repo root (note `agent/tests` has no `conftest.py`; imports `did_agent` so cwd or `pythonpath` must be `agent/`)
- [ ] Framework installs: none needed

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (D-05: open endpoint by decision) | existing optional `CHAT_API_TOKEN` check reused unchanged |
| V3 Session Management | no | — |
| V4 Access Control | partial | endpoint is public; blast radius limited by rate limit + size cap + no side effects beyond Whisper cost |
| V5 Input Validation | yes | MIME allow-map, `Content-Length` bounds, suffix from map, no client filename use, transcript length cap before `/chat` (cap spoken input to ~500 chars client-side) |
| V6 Cryptography | no | HTTPS terminates at Cloudflare/GitHub Pages |
| V12 Files and Resources | yes | `mkstemp` in OS temp dir, unlink in `finally`, never serve uploads |
| V13 API | yes | CORS `*` is existing posture; consistent JSON errors; 413/415/429 |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cost/DoS via unauthenticated Whisper uploads | Denial of Service / Elevation of cost | 1 MB cap, 10/min/IP, bounded concurrency (semaphore), reject before reading body |
| `X-Forwarded-For` / `CF-Connecting-IP` spoofing to dodge limit | Spoofing | honour these headers only when the socket peer is loopback/private (i.e. behind our own proxy/tunnel); else use socket address |
| Limiter memory growth from many IPs | DoS | bounded dict with opportunistic prune |
| Path traversal / extension injection via filename | Tampering | ignore client names; suffix from fixed map |
| Declared `Content-Length` larger than body (slow-loris style hang) | DoS | set socket timeout on the handler (`timeout = 30` class attribute on `BaseHTTPRequestHandler`) |
| Transcript text rendered as HTML | XSS | render via Svelte text interpolation (already `{msg.text}`), never `{@html}` for chat/transcripts; do not interpolate transcripts into selectors |
| Command injection through grammar (speech -> state) | Tampering | closed vocabulary for filter values (validated against allowed sets before `setFilter`); `select(id)` only with ids from the `grants` array |
| Privacy: audio to browser vendor | Information disclosure | D-16 notice + force-server option; server path audio goes to the configured Whisper backend (document in README) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Firefox lacks SpeechRecognition; Chrome/Edge/Safari have it (webkit prefix on some) | Web Speech | fallback path trigger logic; mitigated by feature detection, not browser sniffing |
| A2 | Error code semantics/behaviour (`no-speech` timing, `service-not-allowed` on iOS without Dictation) | Web Speech | wrong user messaging; verify in manual matrix M3/M4 |
| A3 | Chrome ends non-continuous recognition shortly after speech stops; iOS needs gesture + HTTPS | Web Speech | silence timer double-fires; guarded by single settle function |
| A4 | MediaRecorder containers: Chrome webm/opus, Firefox ogg/opus, Safari mp4/aac | MediaRecorder | MIME map too narrow -> 415 for real clients; mitigated by wide allow-map; verify M5/M6 |
| A5 | PyAV bundles FFmpeg libs so local faster-whisper decodes webm/mp4 without system ffmpeg | MediaRecorder | local-mode failures; `voice.py` docstring says ffmpeg is needed, so document it |
| A6 | Hosted OpenAI-compatible endpoints sniff container by filename extension | Transcribe | suffix mismatch; mitigated by deriving suffix from MIME |
| A7 | speechSynthesis quirks (voices async, ~15 s Chrome cutoff, Safari needs gesture) | speechSynthesis | long replies cut off; mitigated by chunking + unlock utterance; verify M7 |
| A8 | `vitest run` currently ignores `tests/*.spec.ts` | Validation | unit run fails when `voice.spec.ts` added; check in Wave 0 |
| A9 | Playwright Chromium already installed locally | Environment | one-time install |
| A10 | Real `MediaRecorder` with `--use-fake-device-for-media-stream` works headless in Chromium | Playwright | fall back to the pure JS fake |
| A11 | Matcher thresholds (HIGH 0.82 / LOW 0.55 / MARGIN 0.08) | Pattern 2 | wrong picks; the test table is the tuning harness — adjust constants until table passes, then freeze |

## Open Questions

1. **Is `agent/dashboard` or the Dockerfile providing ffmpeg/faster-whisper for the deployed agent?**
   - Known: Whisper env vars exist; hosted mode needs only `WHISPER_BASE_URL`. Dockerfile is in flux (quick task).
   - Unclear: which backend the Oracle VM will run.
   - Recommendation: document both in README; do not edit Dockerfile; automated tests fake `voice.transcribe`.
2. **Should rejected requests (413/415) count toward the 10/min limit?**
   - Recommendation: count every request that passes the cheap MIME check (including 413), so large-body probing is throttled; test it.
3. **"Share" semantics:** CONTEXT lists panels "open templates", "share", "close"; "share" = open the SHARE (QR) panel. Confirm no collision with "show/share <funder>" — handled by anchored phrase match.
4. **Where the "force server transcription" setting and spoken-reply toggle live in the UI** (chat header icon + overflow?) — Claude's discretion; recommend two small header buttons with `aria-pressed` and text labels.
5. **Auto-fallback on Web Speech `network` error** might re-prompt for mic permission via getUserMedia; acceptable, but show the message first.

## Sources

### Primary (HIGH confidence)
- Repository files read in this session: `src/lib/state/crystarium.svelte.js`, `src/lib/data/{types,aggregates,filter,index}.ts`, `src/lib/data/grants.generated.json` (parsed, 40 rows), `src/lib/ChatWidget.svelte`, `src/lib/hud/{TemplatesPanel,QrPanel,FilterBar}.svelte`, `src/routes/{+page,+layout}.svelte`, `agent/did_agent/{chat_api,voice,config}.py`, `tests/smoke.spec.ts`, `playwright.config.ts`, `package.json`, `tools/verify-build.mjs`, `.planning/config.json`
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition — properties, events, defaults, limited availability, `processLocally`, `phrases`, deprecated `grammars`
- https://console.groq.com/docs/speech-to-text — supported formats (`flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm`), 25 MB free-tier limit

### Secondary (MEDIUM confidence)
- none beyond the above (error-code list deferred by MDN to the spec; not re-fetched)

### Tertiary (LOW confidence — training knowledge, flagged `[ASSUMED]`)
- Browser-specific behaviour of SpeechRecognition on iOS/Chrome, MediaRecorder default containers per browser, speechSynthesis Chrome 15 s cutoff and async voices, PyAV bundled FFmpeg. All routed to the manual verification matrix.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all tools verified present
- Code shapes / integration points: HIGH — read directly (including the panel-state gap and single-threaded server)
- Architecture / matcher design: MEDIUM — sound, thresholds need tuning against the test table
- Browser API behaviour: MEDIUM-LOW — mostly training knowledge; covered by explicit manual checks
- Pitfalls: MEDIUM-HIGH

**Research date:** 2026-11-10
**Valid until:** 2026-12-10 (Web Speech support landscape moves slowly; repo shapes valid until the in-flight agent changes merge)
