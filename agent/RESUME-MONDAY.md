# Resume Monday — finish the 2-person allowlist

## ✅ Already live (tested end-to-end on the free local stack)
- **LLM:** local Ollama (`llama3.2:3b` pulled on the Windows box; on the Mac use `llama3.1:8b`). Free + private.
- **Telegram:** bot **@Emandidbot** — token in `.env`, validated.
- **Notion:** integration "DID Grant Agent" connected; grants DB created under the DID page;
  **28 grants seeded** (data source id `b67e8a89-51e0-4a80-b238-ab723d36d8d7`).
- Verified live: chat, intent routing, grants.gov scrape (tool-calling), and reading grants back from Notion.
- David's Telegram chat id = **793244510**.

## ▶️ Monday step (the only thing left to finish the allowlist)
1. **Eman** opens Telegram → searches **@Emandidbot** → taps **Start** (or sends any message).
   - Telegram won't reveal her chat id from her @username; she must message the bot first.
2. Read her chat id from the bot log (line: `Authorized /start from chat_id=...`).
3. In `agent/.env` set: `TELEGRAM_ALLOWED_CHAT_IDS=793244510,<Eman's id>`
4. Restart the bot. Now ONLY those two can use it, and the daily deadline reminders +
   **Monday 9AM digest** start scheduling for both.

## Production note
The real home is **Eman's Mac** (kept on = always online). Follow `OLLAMA-MAC-SETUP.md`:
`brew install ollama` → `ollama pull llama3.1:8b llama3.2:3b` → venv + `pip install -r requirements.txt`
→ copy the same `.env` values → `python -m did_agent.main` (keep alive via `supervisor.sh` + launchd).

## The Windows test bot
Was running for testing; stopped for the weekend (open dev mode shouldn't sit unsupervised).
Restart any time: `cd agent && ./.venv/Scripts/python.exe -m did_agent.main`
