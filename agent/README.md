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
    tools/             # the 7 custom tools the agent calls
      notion_sync.py       # read/write/upsert grants in Notion
      scrape_grants.py     # grants.gov API + foundation sources + news
      score_grant.py       # Opus award-likelihood score (0-100 + rationale)
      draft_application.py # Google Docs template autofill -> editable link
      send_telegram.py     # outbound messages
      schedule.py          # T-7 reminders + Monday 9AM digest
      site_knowledge.py    # DID facts lookup (services, prices, bio, contact, events) — no LLM call
  knowledge/
    did-site-knowledge.md  # public facts the site_knowledge tool reads; one `## ` heading per topic
  tests/                 # pytest (pure, offline): .venv/Scripts/python -m pytest -q tests
  requirements.txt
  requirements-dev.txt   # pytest
  .env.example         # copy to .env and fill (NEVER commit .env)
```

### Site knowledge (replaces the old Wix chat)

The old Wix site's chat widget was a plain Wix Chat box answered by Eman, not an AI bot. When the
site moved to GitHub Pages (2026-09-24) its content was archived in
`diversityincludesdisability_one/archive/wix-site-2026-09-24/`, and the public facts from it plus the
current site were condensed into `knowledge/did-site-knowledge.md`. The `site_knowledge` tool splits
that file on `## ` headings and returns the best-matching sections, and the system prompt tells the
model to call it before answering any question about DID itself. To update the assistant's answers,
edit the markdown file and restart the bot; keep it free of EIN, addresses and credentials (the tests
check for that).

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
