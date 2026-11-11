---
phase: 08-voice-commands-for-the-did-grant-assistant
reviewed: 2026-11-11T05:30:21Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/lib/ChatWidget.svelte
  - src/lib/voice/commands.ts
  - src/lib/voice/facts.ts
  - src/lib/voice/actions.ts
  - src/lib/voice/router.ts
  - src/lib/voice/stt.ts
  - src/lib/voice/tts.ts
  - src/lib/voice/prefs.ts
  - src/lib/voice/copy.ts
  - src/lib/voice/dashboard.svelte.js
  - src/lib/state/panels.svelte.js
  - src/lib/hud/TemplatesPanel.svelte
  - src/lib/hud/QrPanel.svelte
  - agent/did_agent/chat_api.py
  - agent/did_agent/sweep.py
  - agent/did_agent/main.py
findings:
  critical: 4
  warning: 14
  info: 4
  total: 22
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-11-11T05:30:21Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Four findings are BLOCKER tier: two break the stated protections of the public
`/chat/transcribe` endpoint, one sends audio to the browser vendor after the user chose the
server, and one creates duplicate Google Doc drafts.

Each finding says how it was established. "Reproduced" means a read-only probe was run against
the real modules (scripts kept outside the repo, no source file modified). "Traced" means it
follows from reading the code and was not executed.

Areas checked and found sound:

- **Sweep state file:** the write is atomic (`mkstemp` in the same directory, then
  `os.replace`); a corrupt, missing or wrong-shape file degrades to `None` in both loaders; both
  jobs take the date from `datetime.now(tz)`; the state directory is a named volume in compose.
- **Weekday numbering:** `MON_WED_FRI = (1, 3, 5)` is correct for python-telegram-bot 22.x
  (0 = Sunday).
- **Regex injection:** transcripts never reach a `RegExp` constructor. `aliasify` builds
  patterns only from the constant `FUNDER_ALIASES` keys.
- **Long input:** capped at 500 characters and 6 navigate tokens.
- **Prerender safety:** `prefs.ts`, `tts.ts` and `stt.ts` resolve browser globals lazily.
- **Temp file:** the suffix comes only from the allow-map and the file is unlinked before the
  reply on every path.
- **Escape propagation:** the panel handler stops the event before the window-level listeners
  in `DetailPanel` and `TemplatesPanel` see it.

## Critical Issues

### CR-01 (BLOCKER): Two slow uploads hold both Whisper slots indefinitely; the "30 s timeout" is per socket read

**File:** `agent/did_agent/chat_api.py:153`, `agent/did_agent/chat_api.py:307-313`
**Issue:** `timeout = 30` is a per-`recv` socket timeout, not a handler deadline. The Whisper
slot is acquired at line 307, before the body is read at line 313. A client that declares
`Content-Length: 1000000` and sends one byte every few seconds never trips the timeout and keeps
its slot for as long as it likes. Two such connections take both slots, and every other visitor
gets 503. Two requests are well inside the 10 per minute limit, so the limiter does not help.
**Verified by:** Reproduced. Two connections trickling 1 byte per 5 s; an honest 3-byte upload
got `503 Server busy, try again` at t=2 s and again at t=40 s.
**Fix:** Read the body before taking a slot, under a total deadline:
```python
deadline = time.monotonic() + 10
buf = bytearray()
while len(buf) < n:
    left = deadline - time.monotonic()
    if left <= 0:
        self.close_connection = True
        self._json_response(408, {"error": "Upload too slow"})
        return
    self.connection.settimeout(left)
    chunk = self.rfile.read1(min(65536, n - len(buf)))
    if not chunk:
        break
    buf += chunk
if not whisper_slots.acquire(blocking=False):
    self._json_response(503, {"error": "Server busy, try again"})
    return
```
Apply the same deadline in `_drain_body` (lines 218-225), which has the same per-read weakness
and ties up a thread per slow rejected upload.

### CR-02 (BLOCKER): Rate limit is bypassed with a forged `CF-Connecting-IP` header behind Caddy

**File:** `agent/did_agent/chat_api.py:133-137`
**Issue:** `client_ip` prefers `CF-Connecting-IP` whenever the socket peer is loopback or
private. In the deployed topology (`agent/deploy/oracle/docker-compose.yml`, host networking;
`agent/deploy/oracle/Caddyfile`, plain `reverse_proxy 127.0.0.1:7860`) the peer is always
`127.0.0.1`, and Caddy forwards client-supplied `CF-Connecting-IP` unchanged. Any client can
send a different value per request and get a fresh 10-request bucket each time, so the per-IP
limit does not exist for an attacker. Each forged value also adds a limiter key (see WR-07).
**Verified by:** Reproduced.
`client_ip("127.0.0.1", {"CF-Connecting-IP": "203.0.113.77", "X-Forwarded-For": "198.51.100.9"})`
returns `203.0.113.77`. The Caddyfile has no `header_up -CF-Connecting-IP`.
**Fix:** Make the trusted header a deployment setting instead of trying both. Either of:
```python
# config: CLIENT_IP_HEADER = "X-Forwarded-For" (Caddy) | "CF-Connecting-IP" (cloudflared) | ""
if settings.client_ip_header == "CF-Connecting-IP": ...   # only then read it
```
or strip it at the proxy:
```
reverse_proxy 127.0.0.1:7860 {
	header_up -CF-Connecting-IP
}
```
The config route is safer because it does not depend on the Caddyfile staying in sync.

### CR-03 (BLOCKER): "Use the server instead" still sends audio to the browser vendor when localStorage is unavailable

**File:** `src/lib/ChatWidget.svelte:298`, `src/lib/ChatWidget.svelte:517-526`, `src/lib/ChatWidget.svelte:529-532`
**Issue:** `useServerPath()` reads the choice back from storage with
`getBool(PREF_KEYS.forceServer)` and ignores the `forceServer` state variable. `setBool` swallows
storage failures (Safari with cookies blocked, Firefox with site data disabled, sandboxed
iframes). In that case:

1. The privacy notice says audio goes to Google or Apple; the user clicks "Use the server
   instead".
2. `useServerAndStart` sets `forceServer = true`, the write fails silently, and `startCapture()`
   calls `useServerPath()`, which returns false.
3. `startBrowser()` runs and the audio goes to the browser vendor the user just declined.

The settings checkbox has the same defect: it shows checked while every capture uses the
browser path. The notice dismissal already has a session fallback (`noticeSeenSession`); this
preference does not.
**Verified by:** Traced, not executed in a browser.
**Fix:**
```js
const useServerPath = () => hasRec && (forceServer || sessionServer || !hasSR);
```
`forceServer` is already loaded from storage in `onMount` and updated by both handlers, so the
storage read at line 298 is redundant as well as wrong.

### CR-04 (BLOCKER): Duplicate Google Doc drafts when more than one chat ID is configured

**File:** `agent/did_agent/main.py:140-160`, `agent/did_agent/main.py:212`
**Issue:** One `morning_message` job is registered per chat, all at 08:45. The scheduler runs
coroutine jobs as concurrent tasks. The first job sees `_drafts_cache["date"] != today` and
awaits `asyncio.to_thread(create_draft, ...)`. That yields to the second chat's job, which sees
the same stale cache and creates its own drafts. The cache is only written at line 160, after
all drafts exist. With N chat IDs the result is N Google Docs and N LLM narrative calls per top
grant, and each chat receives different links for the same grant. With a single chat ID this
does not occur.
**Verified by:** Traced, not executed. The check and the update are separated by an `await`
with no lock.
**Fix:** Serialize the block and re-check inside the lock:
```python
_drafts_lock = asyncio.Lock()
...
async with _drafts_lock:
    if _drafts_cache["date"] != today:
        ...create drafts...
        _drafts_cache.update(date=today, drafts=drafts, note=note)
```
Better still, create the drafts once in the 06:00 sweep (or a single 08:40 job) and persist
the links in the state file, so a restart cannot recreate them either.

## Warnings

### WR-01 (WARNING): Recognizer that ends after interim results leaves the mic stuck in "listening"

**File:** `src/lib/voice/stt.ts:121-124`, `src/lib/ChatWidget.svelte:477-479`
**Issue:** In `onend`, when `gotResult` is true, the code runs `settle(() => {})`, which calls
neither `onFinal` nor `onFail`. If the engine ends after delivering only interim results, the
words are dropped and the widget keeps `micState = 'listening'`. The silence timer was already
cleared by the first result. Pressing the mic calls `h.stop()`, which returns early because
`settled` is true. The only recovery is Escape (not available on phones) or closing the chat.
How often an engine ends without a final result depends on the browser; the code path itself is
certain.
**Verified by:** Reproduced with a fake recognizer: one interim result then `onend` produced
only the `onInterim` callback, and `stop()` never reached the engine.
**Fix:** Keep the latest text and deliver it on end:
```ts
let lastText = '';
// in onresult: lastText = text;
r.onend = () => settle(() => (gotResult && lastText ? opts.onFinal(lastText) : opts.onFail('no-speech')));
```

### WR-02 (WARNING): `recognition.start()` throwing leaves the widget stuck in "listening"

**File:** `src/lib/voice/stt.ts:126`, `src/lib/ChatWidget.svelte:393-400`
**Issue:** `r.start()` is not guarded. `startBrowser` sets `micState` and `statusKind` to
`listening` before calling `listen()`, so a throw leaves that state with `capture === null`.
The mic button then does nothing (line 478 finds no capture).
**Verified by:** Reproduced: `listen()` propagated the exception and `onFail` was never called.
**Fix:**
```ts
try { r.start(); } catch { settle(() => opts.onFail('other')); return { stop() {}, abort() {} }; }
```

### WR-03 (WARNING): `MediaRecorder.start()` throwing leaks the live microphone stream

**File:** `src/lib/voice/stt.ts:264`, `src/lib/ChatWidget.svelte:413-430`
**Issue:** `recorder.start()` sits outside the try block that guards the constructor. If it
throws, `startRecording` rejects, `stopTracks()` never runs (the browser's mic indicator stays
on), and `onError` is not called. The caller has `.then` with no `.catch`, so the widget stays
in `listening` with `cap.rec === null` and an unhandled rejection is logged.
**Verified by:** Reproduced: the promise rejected with 0 tracks stopped and no `onError` call.
**Fix:**
```ts
try { recorder.start(); } catch { stopTracks(); opts.onError('other'); return null; }
```
Also add `recorder.onerror = () => { opts.onError('other'); cancel-equivalent cleanup }` and a
`.catch` in `startServer`.

### WR-04 (WARNING): The 8 s silence timer runs while the permission prompt is still open

**File:** `src/lib/voice/stt.ts:126-134`
**Issue:** The timer starts at `start()`, not when audio capture begins, and no `onstart` or
`onaudiostart` handler exists. A first-time user who takes more than 8 s to answer the
microphone permission prompt gets "I didn't catch that" and an aborted session, then has to
press the mic again after granting.
**Verified by:** Reproduced with a fake recognizer: the timer fired `no-speech` before any
start event.
**Fix:** Arm the timer in `r.onaudiostart` (fall back to `r.onstart`), with a separate longer
watchdog (for example 30 s) for the pre-start phase.

### WR-05 (WARNING): Spoken replies play into an open microphone

**File:** `src/lib/ChatWidget.svelte:81-85`, `src/lib/ChatWidget.svelte:140-144`
**Issue:** `startCapture` cancels speech once, but nothing blocks speech that starts during a
capture. Scenario: a question is pending, the user presses the mic to give a command (allowed
while busy), and the reply arrives. `say(job.reply)` speaks up to 600 characters into the live
recognizer or recorder. The transcript then contains the assistant's own words, which are routed
as the user's utterance and, because `busy` is now false, posted to `/chat` as a new question.
`toggleSpoken` (line 91) has the same effect if pressed while listening.
**Verified by:** Traced, not executed.
**Fix:** Gate on capture state in the one place speech is allowed:
```js
function say(text, { allowClosed = false } = {}) {
	if (!spoken || !canSpeak) return;
	if (micState === 'listening' || micState === 'processing') return;
	...
}
```

### WR-06 (WARNING): Whisper call has no deadline, so a hung backend holds a slot for minutes

**File:** `agent/did_agent/chat_api.py:317-319`
**Issue:** The review brief lists a "30 s handler timeout", but nothing bounds
`voice.transcribe`. The hosted path builds `OpenAI(...)` with the SDK defaults (600 s timeout,
2 retries); the local path is unbounded. The browser gives up after 20 s, yet the slot stays
taken. Two stalled calls make the endpoint return 503 to everyone until they finish.
**Verified by:** Traced; `agent/did_agent/voice.py` sets no timeout.
**Fix:** Pass `timeout=25, max_retries=0` to the hosted client (add parameters to
`voice.transcribe`), and for the local path run the call in a worker with a `future.result(timeout=...)`
bound, returning 504 on expiry.

### WR-07 (WARNING): Limiter key count is not bounded at 5000, and unlimited rejected uploads are read

**File:** `agent/did_agent/chat_api.py:83-84`, `agent/did_agent/chat_api.py:101-104`, `agent/did_agent/chat_api.py:274-281`, `agent/did_agent/chat_api.py:131`
**Issue:** Four related gaps:

- `_prune` only drops keys idle for a full window. Within one window the key count grows with
  the number of distinct keys, which CR-02 makes free. Once past 5000 keys, every request
  rescans all keys while holding the global lock.
- The 401 and 415 checks run before the limiter, and both drain up to 1 MB. A client can send
  unlimited 1 MB bodies with `Content-Type: text/plain` and never be counted.
- IPv6 clients are keyed by full address, so one /64 yields unlimited buckets.
- A peer of `::ffff:127.0.0.1` (dual-stack bind) is not in `_TRUSTED_PEERS`, so every visitor
  behind the proxy would share one bucket. Not reachable with the current `127.0.0.1` bind.

**Verified by:** Reproduced: 50,000 distinct keys left 21,314 tracked keys, and the loop took
over a minute because of the per-call rescan. The v4-mapped case returned the peer unchanged.
**Fix:** Call the limiter first (before the 401/415 replies); cap the map hard (evict the oldest
key when at the cap, or refuse new keys with 429); prune on a time interval rather than on every
call; key IPv6 by /64; normalize with `ip.ipv4_mapped or ip` before the trust test.

### WR-08 (WARNING): Auto-stop and a manual stop can both upload the same recording

**File:** `src/lib/ChatWidget.svelte:416`, `src/lib/ChatWidget.svelte:434-441`, `src/lib/ChatWidget.svelte:444-450`
**Issue:** When the 18 s cap fires, `micState` stays `listening` until the recorder's `onstop`.
A mic press in that gap runs `finishRecording`, whose `rec.stop()` returns the same blob
promise. Both `onAutoStop` and the manual path then call `upload(cap, blob)`; `capture` is only
cleared after the `await`, so both pass the guard. Result: two POSTs, two rate-limit hits and
both Whisper slots for one clip. The window is short (stop to `onstop`).
**Verified by:** Traced, not executed.
**Fix:** Add an `uploading` flag on `cap`, set synchronously at the top of `upload` and checked
before it.

### WR-09 (WARNING): Voice commands leave panel state out of step with what is visible

**File:** `src/lib/voice/actions.ts:120-125`, `src/lib/voice/actions.ts:126-134`, `src/lib/voice/actions.ts:137-148`, `src/routes/+page.svelte:120-125`
**Issue:** Clicking a row in `TemplatesPanel` closes the list (`pick()`), but the voice
`open-grant` action does not. On phones `+page.svelte` hides `.templates-root` and `.qr-widget`
with `display: none` while a grant is selected, so:

- Templates open, say "open Ford": the list is hidden but `panels.templates` stays true.
  "Close" then answers "Closed the templates list." and the grant stays open; a second "close"
  is needed.
- Grant open, say "open templates": the reply is "Templates list opened." and the chat
  collapses, but nothing appears. The modal and scrim pop up later when the grant is closed.

**Verified by:** Traced, not executed.
**Fix:** In `open-grant` call `dash.closePanels()` before `dash.select()`. In `panel`, deselect
first (or refuse with a clear message) when a grant is selected. In `close`, prefer the selected
grant when the panels are not visible.

### WR-10 (WARNING): `in` on plain objects matches inherited keys; "constructor" becomes a broken panel command

**File:** `src/lib/voice/commands.ts:538-539`, `src/lib/voice/commands.ts:218`
**Issue:** `norm in PANEL_PHRASES` is true for `constructor`, so the utterance "constructor"
returns `{ kind: 'panel', name: <Object function> }` and the user sees "I couldn't open that
panel." instead of the question going to the assistant. Lines 218 and 539 use the same pattern
and happen to fall through harmlessly.
**Verified by:** Reproduced: `parse('constructor', ...)` returned `{"kind":"panel"}`.
**Fix:** Use `Object.hasOwn(PANEL_PHRASES, norm)` (and likewise for `FACT_PHRASES`, `ORDINALS`),
or build the tables as `Map`s.

### WR-11 (WARNING): Matcher opens the wrong grant on one shared word and pads "Did you mean" with an unrelated row

**File:** `src/lib/voice/commands.ts:376-382`, `src/lib/voice/commands.ts:401-402`, `src/lib/voice/commands.ts:462-468`
**Issue:** Reproduced against the shipped 40-row dataset:

| Utterance | Result | Problem |
|---|---|---|
| "open bank" | opens TD Bank | three Bank of America rows are never offered |
| "open new york" | opens New York Women's Foundation | NY Community Trust not offered |
| "find funding" | opens TD Bank | matched on the program name "Funding Opportunities" |
| "show nyc grants", "find organizing grants" | opens North Star Fund | matched on program words; several NYC rows exist |
| "find fellowships", "open x", "find women" | "Did you mean" lists NY Community Trust second | it is simply the first data row |

Causes: two-letter tokens such as "td" weigh 0.2, so "bank" alone fully covers TD Bank; the
program-only token set (line 381) can win an outright open; and line 467 pads a single
candidate with `scored.slice(0, 2)` regardless of the second row's score.
**Verified by:** Reproduced with `parse()` on `grants.generated.json`.
**Fix:** Do not open directly when every non-generic query token occurs in two or more funders
(`df >= 2`); let the program-only set contribute to "ambiguous" but not to "open"; when only one
row clears `LOW`, open it if it clears `HIGH`, otherwise return `none` so the text goes to chat.

### WR-12 (WARNING): Drafts are created for grants whose deadline has already passed

**File:** `agent/did_agent/sweep.py:114-126`
**Issue:** `top_open_now` filters on bucket and status only. `_block` (line 134) shows the
author expects passed deadlines ("(passed)"), yet such grants still qualify for a draft, and
the deadline-ascending tie-break ranks the most expired one first. Each one costs an LLM
narrative and a Google Doc.
**Verified by:** Traced, not executed.
**Fix:** Pass `today` in and skip grants where `days_until(g, today)` is negative.

### WR-13 (WARNING): Audio and chat destination comes from unvalidated remote JSON, with localhost tried first

**File:** `src/lib/ChatWidget.svelte:46-61`
**Issue:** This code pre-dates Phase 08, but Phase 08 now sends microphone recordings to
`BASE`. Three consequences:

- `BASE` starts as `http://127.0.0.1:8080` and stays there if anything on the visitor's machine
  answers 200 for `/chat-config.json` (many dev servers answer 200 for every path). Recordings
  then go to that local service.
- Otherwise `BASE` becomes whatever `api_url` a JSON file on the repository's `main` branch
  says, with no `https:` check and no host allow-list. The privacy notice promises "the DID
  assistant server".
- `loadConfig()` runs at component init, so it also fires during prerender and makes two
  network requests at build time. A recording made before discovery finishes (up to 2 s plus the
  GitHub fetch) is posted to localhost and reported as "couldn't reach the transcription server".

**Verified by:** Traced, not executed.
**Fix:** Move `loadConfig()` into `onMount`, keep its promise and `await` it in `upload` and
`askAssistant`; accept `api_url` only if `new URL(u).protocol === 'https:'` and the host is on a
short allow-list; try localhost only when `location.hostname` is `localhost` or `127.0.0.1`.

### WR-14 (WARNING): `/chat` has no body cap, shares one history across all visitors, and the token check can be skipped

**File:** `agent/did_agent/chat_api.py:242-243`, `agent/did_agent/chat_api.py:253-270`, `agent/did_agent/chat_api.py:194`
**Issue:** These pre-date Phase 08 (introduced in `208702a`) but sit in a reviewed file and
are reachable on the same public port:

- `self.rfile.read(length)` trusts `Content-Length`. A multi-gigabyte value is read into
  memory; a negative value reads until EOF.
- `session_id` defaults to `"dashboard"`, so every public visitor shares one history. One
  visitor's questions, now including voice transcripts, are fed into the next visitor's prompt.
- Each POST starts an unbounded thread and LLM call with no rate limit; `_JOBS` entries that
  are never polled and `_HISTORY` keys are never evicted.
- `_token_ok` skips the token when the `Host` header contains `trycloudflare.com`. Harmless
  while the token is empty, but it would defeat the token for any direct client if one is set.

**Verified by:** Traced, not executed.
**Fix:** Cap `/chat` bodies (for example 16 KB) and reject non-positive lengths; generate a
per-tab session id in the widget and bound `_HISTORY` and `_JOBS` with a TTL; apply the limiter
to `/chat`; replace the Host substring test with an explicit setting.

## Info

### IN-01: Closing the chat with the close button drops keyboard focus

**File:** `src/lib/ChatWidget.svelte:258-261`
**Issue:** `collapseChat` returns focus to the toggle; `closeChat` does not, so focus falls to
`<body>` when the panel unmounts.
**Fix:** Call `toggleEl?.focus()` in `closeChat`.

### IN-02: Pending follow-up edge cases send stray words to the assistant

**File:** `src/lib/voice/commands.ts:213-222`
**Issue:** Reproduced with two options pending: "third" and "the third one" go to `/chat` as
questions and drop the choices; "the one" selects the first option; "ford" (the shared funder
name) goes to `/chat`.
**Fix:** With options pending, answer out-of-range ordinals and bare funder names locally
("There are only two options") and keep the choices open.

### IN-03: `{@html}` in QrPanel, and the share panel has no Escape handler

**File:** `src/lib/hud/QrPanel.svelte:38`, `src/lib/hud/QrPanel.svelte:54`
**Issue:** The brief says no `{@html}`. This use pre-dates Phase 08 and renders build-time SVG
from fixed config, so it is not exploitable; it is listed only because it contradicts the stated
rule. Separately, `TemplatesPanel` closes on Escape and `QrPanel` does not, although voice can
now open both.
**Fix:** Record the exception in the conventions or render the QR as an `<img>` data URI; add
the same Escape handler as `TemplatesPanel`.

### IN-04: Static file guard is a string-prefix check; empty recordings are reported as "unreachable"

**File:** `agent/did_agent/chat_api.py:180`, `src/lib/ChatWidget.svelte:459-465`
**Issue:** `str(fp).startswith(str(_DASHBOARD_DIR))` would also accept a sibling directory
named `dashboard-something` (none exists today; pre-dates Phase 08). Separately, a zero-byte
recording (mic pressed twice during the permission prompt) gets a 400, which the widget shows as
"I couldn't reach the transcription server".
**Fix:** Use `fp.is_relative_to(_DASHBOARD_DIR)`; treat an empty blob as "didn't catch that"
before uploading.

---

_Reviewed: 2026-11-11T05:30:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Fixes applied

Python (`agent/`) findings only, fixed 2026-11-11. Each fix has regression tests in
`agent/tests/test_chat_transcribe.py` or `agent/tests/test_sweep.py`; the agent suite went from
85 to 119 tests, all passing. Findings under `src/` and WR-14 were not touched.

| Finding | Commit | Outcome |
|---|---|---|
| CR-01 | `1d842bc` | Fixed. The body is read in full under one 20 s deadline for the whole body before a Whisper slot is taken; a body still arriving at the deadline gets 408 and the connection is closed. The drain of rejected uploads uses the same deadline. |
| WR-06 | `1d842bc` | Partially fixed. Transcription runs under a 60 s deadline and returns 504 with the slot released and the temp file removed. The hosted client gets `timeout` and `max_retries=0`. What remains: local faster-whisper cannot be interrupted, so after a 504 the abandoned call keeps running in the background until it returns, outside the two-slot count. |
| (test stability) | `7872fea` | The 413 reply was lost to a connection reset on Windows about one run in eight (present before these fixes). After replying to an upload it will not read, the server now discards at most 64 KiB for at most 0.5 s before closing. |
| CR-02 | `7278373` | Fixed. `CF-Connecting-IP` is ignored unless `CHAT_TRUST_CF_CONNECTING_IP=true` (default false, documented in `.env.example` and the README). The key is the rightmost `X-Forwarded-For` entry from a loopback or private peer, else the socket peer. No Caddyfile change is needed. |
| WR-07 | `cd8df05` | Fixed. The limiter holds at most 5000 keys and prunes or evicts from the front of an ordered table with no scan. The rate limit runs before the 401 and 415 checks, so those now count toward the limit (the old "415 is not counted" behaviour is gone; test and README updated). A client over its limit has at most 256 KiB read before the 429. IPv6 is keyed by /64; IPv4-mapped peers are treated as IPv4. |
| CR-04 | `8925bd5` | Fixed. Draft creation goes through `sweep.todays_drafts`: an `asyncio.Lock` with a re-check inside it, and the links are stored in the sweep state file, so a restart or a second run that day reuses them. Old-format state files still load. What remains by design: the drafts are still created by the 08:45 job, not the 06:00 sweep, and the links are saved after all of the day's drafts exist, so a crash part-way through creation would create that day's drafts again. |
| WR-12 | `ed6e2eb` | Fixed. `top_open_now(new, today, n=3)` leaves out grants whose deadline is before today; a deadline of today counts; undated grants stay eligible and sort after dated ones of equal score. |
| IN-04 | `d6c6ecd` | Partially fixed. The static file guard uses `Path.is_relative_to` on resolved paths. The second half of the finding (an empty recording reported as "unreachable") is in `src/lib/ChatWidget.svelte` and was out of scope here. |

Behaviour changes to be aware of:

- The Telegram voice-note path shares `voice.transcribe`, so in hosted mode it now also has a
  60 s timeout and no retries (previously the SDK defaults: 600 s, 2 retries).
- New statuses on `/chat/transcribe`: 408 (upload too slow) and 504 (transcription timed out).
  The widget (`src/lib/voice/stt.ts`) has no case for them, so both show its generic
  "couldn't reach the transcription server" message.
- A full 1 MiB clip must arrive within 20 s, which needs roughly 420 kbit/s of uplink.
