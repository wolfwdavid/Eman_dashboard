# Tasks — DID Grant Automation Agent (Milestone 2)

Plan approved decisions: local Windows + Task Scheduler · Telegram only · Claude Opus 4.8 + Haiku 4.5 ·
Notion REST source of truth · full spec one milestone. See `.planning/MILESTONE-2-agent-BRIEF.md`.

## Phase 1 — Foundation + Telegram loop
- [ ] Python project scaffold (venv/uv, Windows), repo layout, `.gitignore` for `.env`/secrets
- [ ] `.env` template + secrets loader (Telegram token, ANTHROPIC_API_KEY, Notion token)
- [ ] Telegram bot skeleton (python-telegram-bot) — receive + reply
- [ ] Anthropic SDK wiring: Opus 4.8 agent loop + Haiku 4.5 intent router
- [ ] End-to-end: Eman messages bot → Claude replies (verified)
- [ ] Task Scheduler entry keeps poller alive across reboots

## Phase 2 — Notion sync (source of truth)
- [ ] Notion API client + grant schema mapping (Funder/Amount/Deadline/501c3/Status/Fit/Link/Next Action)
- [ ] Seed Notion DB from `../Rimawi/grants.csv` (28 opps + 11 tools)
- [ ] `notion_sync` custom tool (read/write/upsert), 501c3 eligibility tagging

## Phase 3 — Grant scraper
- [ ] `scrape_grants`: grants.gov Search2 API (federal)
- [ ] Foundation-source crawlers + grant-news feeds
- [ ] Dedup + normalize (messy Amount/Deadline strings) → write new opps to Notion

## Phase 4 — Scoring engine
- [ ] `score_grant`: Opus scores award likelihood (fit, eligibility, amount, deadline, competition) → 0-100 + rationale
- [ ] Write scores + rationale to Notion; sort/flag actionable

## Phase 5 — Application autofill (Google Docs)
- [ ] Google Docs API service account + template doc
- [ ] `draft_application`: fill from grant + DID org profile → returns editable Doc link

## Phase 6 — Reminders + scheduling
- [ ] Deadline reminder logic: T-7 days, daily until filled and/or past due
- [ ] Monday 9AM grants + news digest
- [ ] `schedule` + `send_telegram` tools; Task Scheduler entries

## Phase 7 — Grants + News dashboard
- [ ] SvelteKit → GH Pages reading agent-published grants/news data
- [ ] ui-ux-pro-max UI-SPEC (grants pipeline + news feed)

## Review
- (to be filled after each phase — verification evidence, diffs, lessons)
