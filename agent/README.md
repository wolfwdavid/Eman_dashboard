# DID Grant Automation Agent

Agentic chatbot for **Diversity Includes Disability** (Eman Rimawi) — finds, organizes, scores,
and helps fill out grants, and reminds Eman via Telegram before deadlines.

- **Brain:** a **free, local LLM via Ollama** (OpenAI-compatible) — private, nothing leaves the machine.
  Swappable to Groq/Gemini free tiers by editing three `.env` lines. **Mac setup: see `OLLAMA-MAC-SETUP.md`.**
- **Interface:** Telegram bot.
- **Data:** Notion (source of truth).
- **Runtime:** local machine (Windows Task Scheduler `supervisor.bat`, or macOS launchd `supervisor.sh`);
  deadline reminders (T-7 daily) + Monday 9AM grants/news digest.

> ⚠️ Runs only while the host machine is on and online. Host is a swappable config for a later VPS move.

## Layout

```
agent/
  did_agent/
    config.py          # env-backed settings + validation
    main.py            # entrypoint: starts the Telegram bot + scheduler
    llm/client.py      # Claude client, Opus agent loop + Haiku intent router
    tools/             # the 6 custom tools the agent calls
      notion_sync.py       # read/write/upsert grants in Notion
      scrape_grants.py     # grants.gov API + foundation sources + news
      score_grant.py       # Opus award-likelihood score (0-100 + rationale)
      draft_application.py # Google Docs template autofill -> editable link
      send_telegram.py     # outbound messages
      schedule.py          # T-7 reminders + Monday 9AM digest
  requirements.txt
  .env.example         # copy to .env and fill (NEVER commit .env)
```

## Setup (Windows)

```powershell
cd agent
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env    # then edit .env with your tokens
python -m did_agent.main
```

## Secrets (in `.env`, never committed)

| Key | From |
|---|---|
| `LLM_BASE_URL` / `LLM_MODEL_*` | local Ollama (defaults) — no key needed; or a cloud free tier |
| `TELEGRAM_BOT_TOKEN` | @BotFather on Telegram |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Eman's chat id(s), comma-separated |
| `NOTION_TOKEN` | Notion internal integration (`ntn_...`) |
| `NOTION_GRANTS_DB_ID` | the grants database id |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | path to service-account key file |
| `GOOGLE_TEMPLATE_DOC_ID` | the application template Google Doc id |

See `../.planning/MILESTONE-2-agent-BRIEF.md` for the full plan.
