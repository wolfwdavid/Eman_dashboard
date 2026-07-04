# Milestone 2 — DID Grant Automation Agent

**Requested:** 2026-07-04 · **Status:** Planning · **Repo:** Eman_dashboard (same repo, new milestone)

An agentic chatbot that finds, organizes, scores, and helps fill out grants for
Diversity Includes Disability (Eman Rimawi), and nags Eman via Telegram until deadlines are met.

## Locked decisions (2026-07-04)

| Decision | Choice | Notes |
|---|---|---|
| Runtime host | **Local Windows machine + Task Scheduler** | Free. ⚠️ Only runs while PC is on/online. Host kept as swappable config for later VPS move. |
| Messaging | **Telegram only** (Bot API via @BotFather) | Adapter pattern so Signal (signal-cli bridge) can be added later. |
| LLM | **Claude Opus 4.8** (`claude-opus-4-8`) for reasoning/scoring/drafting; **Haiku 4.5** (`claude-haiku-4-5`) for intent routing | Self-hosted agentic loop, Anthropic Python SDK + tool use. |
| Source of truth | **Notion REST API** (`ntn_` internal integration token) | Direct REST, NOT Notion MCP (that's only for the Managed-Agents host we didn't pick). Seed from `../Rimawi/grants.csv`. |
| Scope | **Full spec, one milestone** | Scraper + organizer + scorer + Google-Docs autofill + Telegram reminders + Mon 9AM digest + grants/news dashboard. |
| UI | SvelteKit → GH Pages, driven by **ui-ux-pro-max** UI-SPEC | Grants+news dashboard reads data the agent publishes. |

## Hard constraint (drives eligibility logic)

DID is an S-corp LLC with **501(c)(3) PENDING**. The scorer/organizer MUST tag each grant:
`Yes` (blocked until status lands) · `Yes — or fiscal sponsor` (reachable NOW) · `No` (open now).
Exclude Declined/Not-eligible from "actionable" views.

## Security (non-negotiable)

- Notion page has plaintext creds/EINs/home address — see `SOURCES.md`. **Never commit raw Notion content.**
- All secrets (Telegram token, Anthropic key, Notion token, Google service-account JSON) in `.env` / OS keychain. `.env` git-ignored. Nothing secret in commits.
- Commit messages: no mention of Claude/AI assistants (per operating contract).

## Custom tools the agent will call

1. `notion_sync` — read/write/upsert grants + funder log in Notion.
2. `scrape_grants` — grants.gov Search2 API (federal) + targeted foundation crawlers + grant-news feeds; dedup + normalize.
3. `score_grant` — Opus scores award likelihood (mission fit, 501c3/fiscal-sponsor eligibility, amount realism, deadline feasibility, competition) → 0-100 + rationale.
4. `draft_application` — fill a Google Docs template from grant + DID org profile → returns editable Doc link.
5. `send_telegram` — outbound messages (reminders, digest, replies).
6. `schedule` — deadline reminder cadence (T-7 daily until filled/past due) + Monday 9AM digest.

## Phase roadmap (draft — GSD will formalize)

- **P1 Foundation + Telegram loop** — Python scaffold (uv/venv, Windows), `.env` secrets, python-telegram-bot skeleton, Anthropic SDK wiring (Opus+Haiku router), Eman ↔ bot chat works end-to-end. Task Scheduler keeps the poller alive.
- **P2 Notion sync** — Notion client + grant schema mapping; seed from `grants.csv`; `notion_sync` tool.
- **P3 Grant scraper** — `scrape_grants` (grants.gov API + foundation sources + news); dedup/normalize; write new opps to Notion with 501c3 tags.
- **P4 Scoring engine** — `score_grant`; write scores + rationale to Notion.
- **P5 Application autofill** — Google Docs API (service account) + template; `draft_application`.
- **P6 Reminders + scheduling** — T-7 daily reminders, Mon 9AM grants+news digest; Task Scheduler entries; `schedule` + `send_telegram`.
- **P7 Grants + News dashboard** — SvelteKit → GH Pages reading agent-published data; ui-ux-pro-max UI-SPEC.

## Resume

Run GSD from the Eman_dashboard directory: `/gsd:new-milestone` (feed it this brief), then
`/gsd:plan-phase 1`. ui-ux-pro-max drives P7 UI-SPEC.
