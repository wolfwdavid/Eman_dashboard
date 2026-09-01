# Tasks — DID Grant Automation Agent (Milestone 2)

Plan approved decisions: local machine (Windows Task Scheduler OR macOS launchd) · Telegram only ·
Notion REST source of truth · full spec one milestone. See `.planning/MILESTONE-2-agent-BRIEF.md`.

**LLM backend (updated):** switched from Claude to a **free, local LLM via Ollama** (OpenAI-compatible;
default llama3.1:8b reasoning + llama3.2:3b router), private — data never leaves the machine. Swappable to
Groq/Gemini free tiers via `.env`. Mac setup guide: `agent/OLLAMA-MAC-SETUP.md`. Refactor verified with a
stubbed client (tool loop, scoring clamp, no anthropic import).

## Phase 1 — Foundation + Telegram loop
- [x] Python project scaffold (venv, Windows), repo layout, `.gitignore` for `.env`/secrets
- [x] `.env` template + secrets loader (Telegram token, ANTHROPIC_API_KEY, Notion token) + missing-secret guard
- [x] Telegram bot skeleton (python-telegram-bot) — receive + reply; Windows-robust `run_polling(stop_signals=None)`
- [x] Anthropic SDK wiring: Opus 4.8 agentic tool loop + Haiku 4.5 intent router
- [x] Wiring verified (package imports, 6 tools register, model IDs, secrets guard) via venv smoke test
- [ ] LIVE end-to-end: Eman messages bot → Claude replies — BLOCKED on real tokens (Telegram/Anthropic/Notion)
- [x] `supervisor.bat` for Task Scheduler; [ ] register the Task Scheduler task on Eman's machine (user step)

## Phase 2 — Notion sync (source of truth)
- [x] Notion data-source client (`notion_store.py`, 2025-09-03 API) + 15-property schema
- [x] Grant model + messy-string normalizers (amount/deadline/501c3/bucket) with raw-text preserved
- [x] `bootstrap.py` create-DB + seed-from-CSV CLI (idempotent upsert by funder)
- [x] `notion_sync` custom tool (list/get/upsert), read-modify-write so partial edits don't clobber
- [x] Offline-validated on real grants.csv: 28/28 parsed, all selects valid, buckets faithful
- [ ] LIVE: create DB + seed 28 grants — BLOCKED on `NOTION_TOKEN` + a shared `NOTION_PARENT_PAGE_ID`

## Phase 3 — Grant scraper  ✅ LIVE-VERIFIED (no-auth sources)
- [x] `clients/grants_gov.py`: Search2 + fetchOpportunity, applicant-code → eligibility bucket, → Grant
- [x] `clients/propublica.py`: Nonprofit Explorer funder prospecting (NY 501c3 by keyword)
- [x] `clients/feeds.py`: RSS digest (feedparser, resilient to dead/403 feeds)
- [x] `scrape_grants` tool: orchestrates all 3, upserts federal opps to Notion, degrades gracefully
- [x] Live-tested: real disability grants bucketed (4 OPEN_NOW/1 NOT_ELIGIBLE), 15 ProPublica leads, RSS items

## Phase 4 — Scoring engine
- [x] `scoring.py`: Opus 4.8 + structured output (json_schema) → score 0-100 + likelihood + actionable_now + rationale + key_factors
- [x] DID org profile + fiscal-sponsor flag baked into the rubric; eligibility weighted hardest
- [x] `score_grant` tool: look up in Notion, score, merge-write score + rationale back
- [x] Offline-verified (schema, prompt, parse+clamp via stub client, tool build)
- [ ] LIVE Opus score — BLOCKED on `ANTHROPIC_API_KEY`

## Phase 5 — Application autofill (Google Docs)
- [x] `clients/google_docs.py`: service-account copy (Drive files.copy) + replaceAllText (Docs batchUpdate); deferred imports
- [x] `draft_application` tool: Opus-drafted project summary + org fields → filled Doc, returns edit URL; never auto-submits
- [x] Offline-verified: replaceAllText payloads (matchCase, None→"" atomic-safe), unconfigured/missing-funder guards
- [ ] LIVE draft — BLOCKED on Google service account + a {{placeholder}} template Doc (+ ANTHROPIC_API_KEY for the narrative)

## Phase 6 — Reminders + scheduling
- [x] `reminders.py`: T-7 cadence (daily within window, stop on filled/past-due) + Monday digest formatting (pure)
- [x] JobQueue wiring in `main.py`: daily 9AM deadline sweep + Monday 9AM digest per allowed chat
- [x] `outbound.py`: cross-thread send bridge (run_coroutine_threadsafe) for the threaded agent loop
- [x] `send_telegram` + `schedule` tools (on-demand reminder/digest/upcoming views)
- [x] Offline-verified cadence (due-today/3d fire; submitted/outside/past-due/undated excluded) + digest ordering
- [ ] LIVE reminders/digest — BLOCKED on Telegram token + a known chat id (Eman `/start`s once) + Notion set up

## Phase 7 — Grants + News dashboard  ✅ VERIFIED
- [x] Self-contained HTML dashboard (`dashboard/template.html`) — chosen over a SvelteKit route to avoid
      colliding with the concurrent dashboard-v1 build; data embedded (no server/CORS), double-clickable
- [x] `publish.py`: Notion-or-CSV + RSS news → renders `dashboard/grants-dashboard.html` (build output, gitignored)
- [x] Views: stat cards, deadlines ≤30d (DUE TODAY highlight), filterable/sortable pipeline by eligibility bucket, news feed
- [x] DID palette + dark-mode + responsive + `</script>`-safe; verified: 28 grants + 10 news embedded, JSON valid
- [~] ui-ux-pro-max: DID brand + a11y-minded design applied directly; a formal ui-ux-pro-max polish pass is optional

## Review

### Phase 1 (committed `aa88d33`)
- **Built:** Python package `agent/did_agent/` — `config.py` (env-backed settings + missing-secret guard),
  `llm/client.py` (Opus 4.8 agentic tool loop + Haiku 4.5 intent router, adaptive thinking, ToolRegistry),
  6 tool stubs (spec'd with JSON schemas, bodies raise NotImplementedError tagged to their phase),
  `main.py` (Telegram bot, allowlist gate, per-chat history, agent run off-thread), `supervisor.bat`.
- **Grounded by** `.planning/RESEARCH.md` (grants.gov Search2, Notion 2025-09-03 data-source API,
  Google Docs service-account copy+merge, ProPublica/RSS free sources, Windows/PTB gotchas).
- **Verified:** `py_compile` all modules; venv install of import-time deps; smoke test confirms package
  imports, all 6 tools register, model IDs correct, missing-secrets guard names the 4 required secrets.
- **Not yet verifiable by me:** live "Eman → bot → Claude reply" (needs real tokens); Task Scheduler
  registration (Eman's machine). These are the remaining Phase 1 acceptance items.
- **Lesson:** research-first fan-out caught the Notion API v2025-09-03 data-source breaking change and the
  Windows `stop_signals=None` requirement before they became runtime bugs — kept as the pattern for P2-P7.

### Phase 2
- **Built:** `models.py` (Grant + amount/deadline/501c3 normalizers, Notion property (de)serialization,
  CSV loader), `notion_store.py` (data-source create/query/upsert, `iterate_paginated_api`, rate-limit
  sleep), `bootstrap.py` (create + seed CLI), `notion_sync` tool (list/get/upsert, merge-then-write).
- **Config:** added `NOTION_PARENT_PAGE_ID` + `NOTION_GRANTS_DATA_SOURCE_ID`; dropped `NOTION_GRANTS_DB_ID`.
- **Verified offline** against real `data/grants.csv`: 28/28 rows parse; amount "avg"/range logic correct
  ($10k avg, $200k range); 5/28 deadlines are real ISO dates (rest free-text, raw kept); every select value
  is within its allowed option set (no Notion junk-option auto-create); bucket split 12 OPEN_NOW /
  4 VIA_FISCAL_SPONSOR / 4 AFTER_501C3 / 8 UNKNOWN.
- **Fixed during verification:** normalizer missed "Likely yes" (→ now Yes/AFTER_501C3) and let a downstream
  "fiscal sponsor" mention override a leading "No" (→ leading No now wins → OPEN_NOW).
- **Not yet verifiable by me:** live create-DB + seed (needs Notion token + a page shared with the integration).

### Phase 3
- **Built:** `clients/grants_gov.py` (Search2 + fetchOpportunity, applicant-code→bucket, Grant conversion),
  `clients/propublica.py` (funder prospecting), `clients/feeds.py` (RSS digest), `scrape_grants` tool
  (orchestrates all three; federal opps upserted to Notion; foundations/news surfaced as leads).
- **Verified LIVE** (all sources no-auth): probed real API shapes first, then ran the pipeline — grants.gov
  returned 320 disability opps, top results bucketed correctly (7/8 OPEN_NOW via applicant code 13),
  amounts/deadlines parsed; ProPublica returned 15 real NY disability funders w/ EINs; RSS returned live news.
- **Fixed during live verification:** grants.gov returns the literal string `'none'` for missing award
  amounts — added a safe numeric coercer (`_num`) so `float('none')` no longer crashes the pipeline.
- **Note:** federal opp titles are prefixed `[grants.gov]` as the funder key so they dedupe cleanly and
  don't collide with the CSV-seeded foundation rows.

### Phase 4
- **Built:** `scoring.py` (Opus 4.8 structured-output scorer — DID org profile + fiscal-sponsor flag,
  eligibility-weighted rubric, 0-100 + likelihood + actionable_now + rationale + key_factors),
  `score_grant` tool (Notion lookup → score → merge-write). Client uses ambient creds if `.env` key empty.
- **Verified offline:** schema valid; prompt carries eligibility/fiscal-sponsor context; parse+clamp
  (150→100) via a stub client; actionable_now respected; tool builds without a live key.
- **Not yet verifiable by me:** the real Opus score (needs ANTHROPIC_API_KEY). Design choice: near-term
  odds, so a strong-fit grant DID can't yet apply for (VIA_FISCAL_SPONSOR / AFTER_501C3) scores LOW +
  actionable_now=false, rather than a misleading high fit score.

### Phase 5
- **Built:** `clients/google_docs.py` (SA copy-template + replaceAllText, deferred google imports so the
  request builder is testable without the heavy libs) + `draft_application` tool (Opus narrative + org fields).
- **Verified offline:** replaceAllText payload shape (matchCase, None→"" for atomic batch), unconfigured/
  missing-funder guards return friendly messages without any network call.

### Phase 6
- **Built:** `reminders.py` (pure cadence + digest formatting), JobQueue jobs in `main.py` (daily deadline
  sweep + Monday 9AM digest, tz-aware), `outbound.py` (thread→loop send bridge), `send_telegram` + `schedule`
  tools. `tzdata` added for Windows zoneinfo.
- **Verified offline:** cadence rules exact (due-today + due-3d fire; Submitted/outside-7d/past-due/undated
  excluded); digest orders actionable by score and includes news; full package imports with all 6 tools live.
- **Design:** proactive sends via JobQueue (in-process, kept alive by supervisor.bat); `schedule` tool gives
  the same views on demand ("what's due?"). Proactive sends need a known chat id — Eman `/start`s once.

### Phase 7
- **Built:** `dashboard/template.html` (self-contained: stat cards, ≤30d deadlines, filter/sort pipeline by
  eligibility bucket, news feed; DID palette, dark-mode, responsive) + `publish.py` (Notion-or-CSV + RSS →
  embeds data → `grants-dashboard.html`, a gitignored build output regenerated on demand).
- **Verified LIVE:** generated a 20KB dashboard from the real 28 grants + 10 live news items; embedded JSON
  re-parsed valid; buckets faithful; `</script>`-safe. Double-click to open — no server needed.
- **Decision:** self-contained HTML instead of a SvelteKit route — the repo's SvelteKit app is being built
  concurrently (dashboard v1); this avoids collision and works offline for Eman today.

## Milestone 2 status: all 7 phases BUILT + committed. Remaining = LIVE integration tests (need Eman's
## Telegram / Anthropic / Notion tokens + optional Google service account). See each phase's blocked item.

---

# Migration — Mac → Windows laptop (2026-09-01)

The Mac currently hosting the agent is going away. Target host is a Lenovo Yoga Book 9i Gen 8
(Core i7-1355U, 16 GB, integrated graphics), temporary until another Mac is sourced.

**Key decision — the LLM does not move with it.** That laptop is a 15 W ultrabook; it would run
`llama3.1:8b` *slower* than the Intel i9 Mac did. Ollama is dropped and `LLM_BASE_URL` repoints at
Groq's free tier, so replies go from 2–3 min to seconds on weaker hardware. No code changes needed —
`llm/client.py` was already provider-agnostic via `config.py`. Tradeoff accepted: prompts and grant
context now leave the machine, which the original local-Ollama design deliberately avoided. Revisit
when the new Mac arrives (`WINDOWS-DEPLOY.md` Appendix C).

## Prepared
- [x] `agent/WINDOWS-DEPLOY.md` — full runbook, mirrors MAC-DEPLOY.md's numbered-steps + ✅ verify style
- [x] `agent/tunnel.ps1` — Windows analog of `tunnel.sh`; only republishes when the hostname actually
      changes (the bash version pushed a commit on every banner reprint)
- [x] `agent/supervisor.bat` — fixed two latent bugs: it never `cd`'d to the agent dir (Task Scheduler
      starts in System32 → `ModuleNotFoundError`), and `pythonw.exe` discards stdout so there was no
      log to debug from. Now `python.exe` + append to `%TEMP%\did-grant-agent.log`.
- [x] `agent/.env.example` — the Groq models it named (`llama-3.3-70b-versatile`,
      `llama-3.1-8b-instant`) were shut down 2026-08-16 on free/dev tiers. Now points at
      `openai/gpt-oss-120b` / `openai/gpt-oss-20b` and tells the reader to confirm against a live
      `/models` call rather than trusting the doc.
- [x] Verified: `tunnel.ps1` parses clean, URL regex + JSON round-trip tested under pwsh, all 18
      PowerShell blocks in the runbook parse clean.

## To do on the Windows machine (user steps)
- [ ] Groq API key from console.groq.com, and confirm both model IDs against a live `/models` call
- [ ] Transfer `.env` out of band (never git); repoint the 4 `LLM_*` keys
- [ ] Stop + disable the Mac's launchd agents BEFORE starting Windows (one poller per token)
- [ ] Power settings: lid-close = "Do nothing" on AC and battery; Windows Update active hours
- [ ] Register both scheduled tasks; one manual `git push` first so the tunnel's push isn't the
      first time credentials are needed
- [ ] Reboot test

## Known risks
- Lid close / sleep is the most likely way this dies; Task Scheduler's 3-day execution limit and
  its stop-on-battery default are the next two. All three are addressed in the runbook.
- Groq free tier is 30 req/min. Fine for 2 users; a tool loop can burn several requests per message.
- Tunnel URL still rotates on every restart — unchanged from the Mac setup.

## Whisper swap (done)
- [x] `voice.py` now has two backends selected by `WHISPER_BASE_URL`: hosted (any OpenAI-compatible
      `/audio/transcriptions`; Groq serves whisper-large-v3-turbo free, 2k/day) or the original local
      `faster-whisper`. Empty = local, so the running Mac is unaffected — this is additive.
- [x] `config.py`: added `whisper_base_url` + `whisper_api_key`; the key falls back to `LLM_API_KEY`
      so pointing both at Groq needs no second key.
- [x] `main.py`: single call site passes the new settings through.
- [x] `requirements.txt`: `faster-whisper` commented out — it pulls `av`, which needs a native build
      plus ffmpeg. `voice.py` imports it lazily so absence is harmless. Windows install no longer
      needs ffmpeg or a compiler.
- [x] Verified: 8/8 routing tests pass (hosted path gets right base_url/key/model, `.ogg` extension
      preserved for container sniffing, empty base_url falls back to local, old 2-arg call still
      works); `config.py`/`voice.py`/`main.py` compile; full package imports; live config confirms
      the Mac still resolves to the local backend.
