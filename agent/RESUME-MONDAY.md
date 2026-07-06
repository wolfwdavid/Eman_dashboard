# DID Grant Agent — Status & Resume (paused 2026-07-04)

An agentic chatbot that **finds, organizes, scores, and helps fill out grants** for Diversity Includes
Disability (Eman Rimawi), and reminds Eman via Telegram. **Free & private** — local LLM, nothing to a
cloud AI, no API bill.

## Architecture (all built + on GitHub `wolfwdavid/Eman_dashboard`, under `/agent`)
- **Brain:** local **Ollama** (OpenAI-compatible). Reasoning `llama3.1:8b`, router `llama3.2:3b`.
  Swappable to Groq/Gemini free tiers via 3 `.env` lines.
- **Interface:** Telegram bot **@Emandidbot** — text **and voice notes** (local Whisper STT).
- **Data:** Notion (source of truth) — 28 grants seeded, eligibility-bucketed for 501(c)(3)-pending.
- **6 tools:** notion_sync, scrape_grants, score_grant, draft_application, send_telegram, schedule.
- **Runtime:** Eman's **Mac** (always-on). Keep-alive via `supervisor.sh` + launchd (`OLLAMA-MAC-SETUP.md`).

## ✅ Proven live (on the free stack, this session)
- Local model: chat, intent routing, **tool-calling into live grants.gov**, reading grants back from Notion.
- Telegram round-trip: David texted @Emandidbot, got real answers.
- Notion: integration connected, 28 grants seeded (data source `b67e8a89-51e0-4a80-b238-ab723d36d8d7`).
- Agent **found accessibility grants on its own** → saved to Notion; **scored** two; **previewed a draft**.
- Bugs found+fixed by running it: startup KeyError (84726ed), wrong model id, grants.gov `'none'` amounts.

## Scheduled jobs (fire while the bot runs)
- **Daily 12:00 AM ET:** auto-scrape (disability/accessibility/assistive-tech) → save new to Notion → refresh dashboard. Silent.
- **Daily 9:00 AM ET:** deadline reminders (T-7, until filled/past-due).
- **Monday 9:00 AM ET:** grants + news digest.

## Features added late this session
- **Voice notes** (`voice.py` + `filters.VOICE`): send a voice message → local Whisper transcribes → agent answers.
- **Voice intake** (`eman-voice-intake.md`): Eman answers 7 sections (by voice/text) → the drafter uses her
  real words/voice instead of guessing. Already wired into `draft_application`.
- **Daily midnight ET auto-scrape** (above).

## ▶️ Monday finish-list (short)
1. **Eman** opens Telegram → @Emandidbot → **Start**. Then tell me → I read her chat id from the log,
   set `TELEGRAM_ALLOWED_CHAT_IDS=793244510,<Eman's id>`, restart → locked to 2 people + reminders/digest on.
2. **Eman fills `eman-voice-intake.md`** (voice or text) → drafts sound like her.
3. **Deploy on the Mac** per **`MAC-DEPLOY.md`** (step-by-step migration runbook with verify
   checks; reuses the existing `.env` — transfer it out of band, it's git-ignored). Background
   reference: `OLLAMA-MAC-SETUP.md`.

## Config / secrets
- `agent/.env` (git-ignored, local only) holds the real Notion token, Telegram token, chat id, data-source id.
- David chat id = **793244510**. Bot = **@Emandidbot**.
- ⚠️ The Notion integration was shared with the **main DID page** (has creds/EIN/address) — token can read it.
  Optional hardening: move the grants DB under a clean subpage and unshare the main page.

## Run commands
- Bot: `cd agent && ./.venv/Scripts/python -m did_agent.main`  (Mac: `.venv/bin/python`)
- Seed/refresh Notion: `python -m did_agent.bootstrap seed`
- Publish dashboard: `python -m did_agent.publish` → open `dashboard/grants-dashboard.html`

## The one small build left
None blocking. Everything requested is built. Remaining is live setup on the Mac + the 2 Monday steps.
