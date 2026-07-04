# Tasks — DID Grant Automation Agent (Milestone 2)

Plan approved decisions: local Windows + Task Scheduler · Telegram only · Claude Opus 4.8 + Haiku 4.5 ·
Notion REST source of truth · full spec one milestone. See `.planning/MILESTONE-2-agent-BRIEF.md`.

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
- [ ] Deadline reminder logic: T-7 days, daily until filled and/or past due
- [ ] Monday 9AM grants + news digest
- [ ] `schedule` + `send_telegram` tools; Task Scheduler entries

## Phase 7 — Grants + News dashboard
- [ ] SvelteKit → GH Pages reading agent-published grants/news data
- [ ] ui-ux-pro-max UI-SPEC (grants pipeline + news feed)

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
