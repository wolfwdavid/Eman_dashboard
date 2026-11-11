---
phase: 08-voice-commands-for-the-did-grant-assistant
fixed_at: 2026-11-11
review_path: .planning/phases/08-voice-commands-for-the-did-grant-assistant/08-REVIEW.md
scope: dashboard (src/, tests/) findings only; agent/ findings are handled separately
iteration: 1
findings_in_scope: 14
fixed: 13
partially_fixed: 1
skipped: 0
status: partial
---

# Phase 08: Code Review Fix Report (dashboard)

**Source review:** `08-REVIEW.md`
**Base commit:** `ed627ab`
**Scope:** CR-03, WR-01, WR-02, WR-03, WR-04, WR-05, WR-08, WR-09, WR-10, WR-11, WR-13, IN-01, IN-02, IN-04 (client half).
Out of scope here: everything under `agent/` (CR-01, CR-02, CR-04, WR-06, WR-07, WR-12, WR-14, server half of IN-04) and IN-03.

## Summary

| Finding | Commit | Outcome |
|---|---|---|
| CR-03 | `a07e211` | fixed |
| WR-01 | `0f1e598` | fixed |
| WR-02 | `0f1e598` | fixed |
| WR-04 | `0f1e598` | fixed |
| WR-03 | `666c9ef` | fixed |
| WR-08 | `666c9ef` | fixed |
| WR-05 | `94d7028` | fixed |
| WR-09 | `133cc8a` | fixed (one related case left as is, see below) |
| WR-10 | `9fde2f1` | fixed |
| WR-11 | `cc6e730` | fixed: requires human verification (matcher logic; one deviation, see below) |
| IN-02 | `cc6e730` | fixed |
| WR-13 | `c3d30cf` | partially fixed (two review suggestions not adopted, see below) |
| IN-01 | `173386d` | fixed |
| IN-04 (client) | `01090df` | fixed |
| stale comment on `handleUtterance` | `4268d34` | removed |

## Verification

Run on the final tree:

- `pnpm test:unit`: 22 files, 444 tests passed (361 before).
- `pnpm check`: 0 errors, 1 warning (the existing `messagesEl` one).
- `BASE_PATH=/Eman_dashboard pnpm build`, then `pnpm verify:build`: PASSED.
- `pnpm test:smoke`: 54 passed (41 before, 13 new).

Red check for the browser tests: with `src/` restored to `ed627ab` and the new
`tests/voice.spec.ts`, all 13 new tests failed and the 38 existing voice tests passed. The
new unit tests for `stt.ts`, `actions.ts` and the inherited-key cases were run failing before
each fix. The matcher cases were confirmed against the old code with a probe of `parse()` on
the real dataset (same outputs the review lists).

## Fixed Issues

### CR-03: "Use the server instead" with localStorage unavailable

**Files:** `src/lib/ChatWidget.svelte`, `tests/voice.spec.ts`
**Commit:** `a07e211`
`useServerPath()` is now `hasRec && (forceServer || sessionServer || !hasSR)`. `forceServer` is
set before the storage write in both the notice button and the settings checkbox.
Tests: two Playwright tests with `window.localStorage` throwing `SecurityError`; the recorder
starts and the browser recognizer never does, on the first press and on the next one.

### WR-01, WR-02, WR-04: recognizer lifecycle

**Files:** `src/lib/voice/stt.ts`, `src/lib/voice/stt.test.ts`, `tests/voice.spec.ts`
**Commit:** `0f1e598`
- `onend` after interim results only delivers the last interim text through `onFinal`; when
  that text is empty it fires `onFail('no-speech')`. One callback per session.
- `r.start()` is guarded; a throw fires `onFail('other')` and returns an inert handle.
- The 8 s silence timer is armed by `onstart` or `onaudiostart` (whichever comes first). Until
  then a 30 s outer guard runs (`startGuardMs`), which ends the session as `no-speech`.
The fake recognizers in both test files now report `start`, as real engines do.

### WR-03, WR-08: recorder lifecycle

**Files:** `src/lib/voice/stt.ts`, `src/lib/voice/stt.test.ts`, `src/lib/ChatWidget.svelte`, `tests/voice.spec.ts`
**Commit:** `666c9ef`
- A throwing `recorder.start()` and a recorder `error` event both stop every track, clear the
  timers and call `onError('other')` once. `startServer` has a `.catch` that does the same.
- `upload()` sets `cap.uploading` synchronously and returns if it was already set, so the
  18 s auto-stop and a mic press before `onstop` post the clip once.

### WR-05: speech into an open microphone

**Files:** `src/lib/ChatWidget.svelte`, `tests/voice.spec.ts`
**Commit:** `94d7028`
`say()` returns while `micState` is `listening` or `processing`; the "Spoken replies on."
confirmation is skipped in the same state. The reply still reaches the message list and the
live region and is not queued.

### WR-09: panels and grant detail

**Files:** `src/lib/voice/actions.ts`, `src/lib/voice/actions.test.ts`, `src/lib/ChatWidget.svelte`, `tests/voice.spec.ts`
**Commit:** `133cc8a`
- `open-grant` closes TEMPLATES/SHARE first when either is open.
- `panel` deselects the grant first when the injected `oneSurface()` is true. The widget
  passes `matchMedia('(max-width: 768px)')`, read at command time. Wide screens are unchanged.
- `+page.svelte` did not need a change.

**Left as is:** the review's third suggestion ("in `close`, prefer the selected grant when
the panels are not visible") was not part of the agreed fix. The state it covers can still be
reached by touch on a phone (SHARE open, then a node tapped in the scene): "close" then
reports the share panel closed and the grant stays open.

### WR-10: inherited keys

**Files:** `src/lib/voice/commands.ts`, `src/lib/voice/commands.test.ts`
**Commit:** `9fde2f1`
`PANEL_PHRASES`, `FACT_PHRASES`, `ORDINALS` and the three filter synonym tables are read with
`Object.hasOwn`. "constructor", "toString", "__proto__", "valueOf" and "hasOwnProperty" go to chat.

### WR-11 + IN-02: matcher quality and pending follow-ups

**Files:** `src/lib/voice/commands.ts`, `src/lib/voice/commands.test.ts`, `src/lib/voice/router.test.ts`
**Commit:** `cc6e730`
**Status:** fixed: requires human verification (logic change).

Results on the 40-row dataset:

| Utterance | Before | After |
|---|---|---|
| "open bank" | opens TD Bank | did-you-mean: TD Bank, Harry S. Black & Allon Fuller Fund (Bank of America), Bank of America |
| "open new york" | opens New York Women's Foundation | did-you-mean: New York Women's Foundation, NY Community Trust |
| "find funding" | opens TD Bank | did-you-mean: TD Bank, Impact Funding Solutions |
| "show nyc grants" | opens North Star Fund | did-you-mean: three rows containing "NYC" |
| "find organizing grants" | opens North Star Fund | did-you-mean: North Star Fund, Ben & Jerry's Foundation |
| "find fellowships" | Echoing Green + NY Community Trust (padding) | did-you-mean: Echoing Green Fellowship alone |
| "open x", "open queens" | padded with NY Community Trust | the one plausible row alone |
| "open mobilize" (program name only) | opens the grant | did-you-mean: that row alone |
| "open foundation", "open fund", "open grants" | chat | chat (unchanged) |

How:
- When every non-generic query word appears in rows of two or more funders, those rows are
  offered (one per funder first, at most three).
- The program-only token set can suggest but not open, except when re-matching among options
  already offered ("the justfilms one" still opens).
- No padding: a lone candidate is offered by itself. The `did-you-mean` intent may now carry
  one option.
- `'new york' -> 'ny'` was added to `FUNDER_ALIASES` and aliases are applied to the index as
  well as the query. Without it "new york" occurs in only one funder name.
- Funder names are indexed without the spoken-filler strip, which had turned "Hey Helen
  Grant" into "helen grant"; "open hey helen grant" now opens it.
- Pending options: an out-of-range ordinal and "the one" return the same options again; a
  shared funder name ("ford") returns the options it fits; a name that fits one option opens it.

**Deviations to confirm:**
1. "open bank" offers three options, not all four rows that contain "bank". The existing test
   "option count is always 2 or 3" includes "open bank" and had to keep passing, and the UI-SPEC
   allows at most three buttons. The dropped row is Bank of America Charitable Foundation;
   "open bank of america" lists all three Bank of America rows.
2. A one-option list is new. 08-UI-SPEC section 3b and its acceptance line say "2 or 3
   buttons"; the copy ("Did you mean…?", "None of these", the hint) is reused unchanged.
3. One existing test was changed because the agreed behaviour contradicts it: "third is
   ignored when only two options exist" expected `chat`; it now expects the re-ask.
4. Side effect of the shared-word rule: "open impact" and "open just" now ask (two funders
   each) where they used to open or list three.

### WR-13: api_url validation

**Files:** `src/lib/voice/apiUrl.ts` (new), `src/lib/voice/apiUrl.test.ts` (new), `src/lib/ChatWidget.svelte`, `tests/voice.spec.ts`
**Commit:** `c3d30cf`
**Status:** partially fixed.
`safeApiUrl()` accepts `https:` URLs, or `http:` for `localhost` / `127.0.0.1`, rejects URLs
with credentials, and returns the origin plus path without a trailing slash. `loadConfig()`
runs from `onMount`, so prerender makes no request. The localhost-first probe is unchanged.

**Not done (not part of the agreed fix):**
- No host allow-list: any `https:` host in the published JSON is accepted.
- `upload()` and `askAssistant()` do not wait for discovery, so a request made in the first
  seconds after load still goes to `http://127.0.0.1:8080`.
- The localhost probe still runs for every visitor, so a local service that answers 200 for
  `/chat-config.json` keeps `BASE` on localhost.

### IN-01: close button focus

**Files:** `src/lib/ChatWidget.svelte`, `tests/voice.spec.ts`
**Commit:** `173386d`
`closeChat()` focuses `.chat-toggle`.

### IN-04 (client half): zero-byte recording

**Files:** `src/lib/ChatWidget.svelte`, `tests/voice.spec.ts`
**Commit:** `01090df`
`upload()` takes the "I didn't catch that." path for an empty blob and sends nothing.

### Stale comment

**Commit:** `4268d34`
Removed "(wired in a later plan)" from the `handleUtterance` doc comment.

## New files

- `src/lib/voice/apiUrl.ts` and `src/lib/voice/apiUrl.test.ts`: the validator had to live in a
  plain module to be unit-tested.

---

_Fixed: 2026-11-11_
_Iteration: 1_
