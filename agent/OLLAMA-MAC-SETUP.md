# Running the DID Grant Agent on a Mac — with a free, local LLM (Ollama)

This runs the whole agent for **$0** and keeps every bit of grant/funder data **on your Mac** — nothing
is sent to a cloud LLM. The "brain" is [Ollama](https://ollama.com), a free local model server.

Apple Silicon (M1/M2/M3/M4) is strongly recommended. RAM guide:
- **16 GB** → `llama3.1:8b` (default) works well.
- **32 GB** → try `qwen2.5:14b` for sharper scoring/drafting.
- **64 GB+** → `llama3.3:70b` is close to cloud quality.

---

## 1. Install Ollama + pull models

```bash
# Option A — Homebrew
brew install ollama
brew services start ollama          # runs the server in the background, restarts on login

# Option B — app: download from https://ollama.com/download and open it (menu-bar app)

# Pull the two models the agent uses (reasoning + a small fast router):
ollama pull llama3.1:8b
ollama pull llama3.2:3b
```

Quick sanity check that the server + a tool-capable model are up:

```bash
ollama run llama3.1:8b "say hello in 3 words"
curl http://localhost:11434/v1/models          # should list your pulled models
```

> **Tool calling matters.** The agent needs a model that supports tool/function calling. `llama3.1`,
> `llama3.3`, `qwen2.5`, and `mistral-nemo` do. If you swap models, pick one of those.

---

## 2. Install Python + the agent's dependencies

```bash
brew install python@3.13            # if you don't already have Python 3.11+
cd /path/to/Eman_dashboard/agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 3. Fill in `.env`

`cp .env.example .env`, then edit. The **LLM lines already point at your local Ollama** — leave them:

```
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL_REASONING=llama3.1:8b     # bump to qwen2.5:14b / llama3.3:70b if you have the RAM
LLM_MODEL_ROUTER=llama3.2:3b
```

Fill the two secrets you do need:

```
TELEGRAM_BOT_TOKEN=...      # @BotFather -> /newbot
NOTION_TOKEN=ntn_...        # notion.so/my-integrations
NOTION_PARENT_PAGE_ID=...   # a clean Notion page shared with the integration
```

(Anthropic key is **not** needed anymore — the brain is local.)

---

## 4. Create the Notion DB, seed it, run

```bash
python -m did_agent.bootstrap create     # prints NOTION_GRANTS_DATA_SOURCE_ID -> paste into .env
python -m did_agent.bootstrap seed        # loads the 28 grants
python -m did_agent.main                  # start the bot
```

Then message your bot on Telegram, send `/start`, add the printed chat id to
`TELEGRAM_ALLOWED_CHAT_IDS` in `.env`, and restart. Publish the dashboard any time with
`python -m did_agent.publish` and open `dashboard/grants-dashboard.html`.

---

## 5. Keep it always-on (launchd — the macOS equivalent of Windows Task Scheduler)

Two things must stay running: **Ollama** (done by `brew services start ollama`) and **the bot**.
Use `supervisor.sh` (restart loop) under a launchd LaunchAgent so it starts at login and restarts on crash.

```bash
chmod +x supervisor.sh
```

Create `~/Library/LaunchAgents/com.did.grantagent.plist` (edit the path to your checkout):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>            <string>com.did.grantagent</string>
  <key>ProgramArguments</key> <array>
    <string>/bin/bash</string>
    <string>/ABSOLUTE/PATH/TO/Eman_dashboard/agent/supervisor.sh</string>
  </array>
  <key>RunAtLoad</key>        <true/>
  <key>KeepAlive</key>        <true/>
  <key>StandardOutPath</key>  <string>/tmp/did-grant-agent.log</string>
  <key>StandardErrorPath</key><string>/tmp/did-grant-agent.err</string>
</dict>
</plist>
```

Load it (starts immediately and on every login):

```bash
launchctl load ~/Library/LaunchAgents/com.did.grantagent.plist
# to stop:  launchctl unload ~/Library/LaunchAgents/com.did.grantagent.plist
# logs:     tail -f /tmp/did-grant-agent.log
```

> The Mac must be **awake and logged in** for reminders/digest to fire (same caveat as the Windows
> plan). To let it run while the lid is closed, plug in and set *System Settings → Battery → Options →
> Prevent sleeping when display is off*, or run it on an always-on Mac.

---

## Voice messages (send the bot a voice note)

Speech-to-text runs **locally too** (free/private) via `faster-whisper` — already in `requirements.txt`.
The first voice note auto-downloads the Whisper model (`WHISPER_MODEL=base` in `.env`; use `small`/`medium`
for more accuracy). If OGG decoding ever fails, `brew install ffmpeg`. Just record a voice note to
@Emandidbot — the bot transcribes it, echoes what it heard, and answers as if you'd typed it.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Connection refused` / bot can't reach the model | Ollama isn't running — `brew services start ollama` (or open the app). |
| `model "..." not found` | `ollama pull <model>` for whatever `LLM_MODEL_*` names you set. |
| Agent ignores tools / never scrapes | Your model doesn't do tool-calling — use `llama3.1:8b`, `llama3.3`, or `qwen2.5`. |
| Replies are slow | Use a smaller model, or a Mac with more RAM/GPU. `llama3.2:3b` is fast for the router. |
| Scores feel shallow | Bump `LLM_MODEL_REASONING` to `qwen2.5:14b` or `llama3.3:70b` if RAM allows. |

## Prefer a cloud free tier instead? (no local model)

The same code works with Groq or Gemini's free tier — just change three `.env` lines (examples are in
`.env.example`). Grant data then leaves your machine, so local Ollama stays the most private option.
