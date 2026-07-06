# MAC-DEPLOY — move the DID Grant Agent to Eman's Mac (migration runbook)

**Audience:** whoever (or whatever AI assistant) sits at the Mac. Follow top to bottom; every step
has a ✅ verify command — do not continue past a failed verify.

**What this is NOT:** a from-scratch install. The bot (@Emandidbot), the Notion grants DB
(28 grants seeded), and all tokens **already exist** and were proven working on David's Windows
machine. This runbook *moves* that working setup to the Mac. For from-scratch context (model
choices, troubleshooting table, cloud fallback) see `OLLAMA-MAC-SETUP.md`.

**The one rule that can break production:** Telegram allows **one poller per bot token**. The
moment the Mac bot starts, the Windows bot must be stopped (and vice versa). Never run both.

---

## 0. Prerequisites

- Apple Silicon Mac (M1+), 16 GB RAM recommended, ~10 GB free disk (models + Whisper).
- Logged-in user account that stays logged in (launchd LaunchAgents run per-user).
- The `.env` file from David's Windows machine, transferred **out of band** (AirDrop, USB, or
  password manager — it holds the Telegram bot token and Notion token). **It is git-ignored on
  purpose; it will NOT arrive via `git clone` and must NEVER be committed.**

✅ Verify:
```bash
uname -m          # expect: arm64
sysctl -n hw.memsize | awk '{print $1/1073741824 " GB"}'
```

---

## 1. Clone the repo

```bash
cd ~
git clone https://github.com/wolfwdavid/Eman_dashboard.git
cd Eman_dashboard/agent
```

✅ Verify:
```bash
ls did_agent/main.py requirements.txt supervisor.sh   # all three must exist
```

---

## 2. Install Ollama + pull the models

```bash
brew install ollama
brew services start ollama       # background server, restarts on login
ollama pull llama3.1:8b          # reasoning (tool-calling capable — required)
ollama pull llama3.2:3b          # fast router
```

✅ Verify:
```bash
curl -s http://localhost:11434/v1/models | grep -c llama   # expect: 1 (both models listed)
ollama run llama3.1:8b "say hello in 3 words"              # expect a reply within ~10s
```

> RAM upgrades (optional, later): 32 GB → `qwen2.5:14b`, 64 GB → `llama3.3:70b` as
> `LLM_MODEL_REASONING`. Must be a tool-calling model (`llama3.1/3.3`, `qwen2.5`, `mistral-nemo`).

---

## 3. Python env + dependencies

```bash
brew install python@3.13 ffmpeg     # ffmpeg: voice-note (OGG) decoding for Whisper
cd ~/Eman_dashboard/agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

✅ Verify:
```bash
./.venv/bin/python -c "import telegram, apscheduler, notion_client, faster_whisper; print('deps OK')"
```

---

## 4. Install the transferred `.env` (do NOT bootstrap a new Notion DB)

Place the `.env` from David's machine at `~/Eman_dashboard/agent/.env`, then make **two Mac-specific
edits** — the Windows box ran both roles on the small model; the Mac uses the 8b brain:

```bash
# in agent/.env:
LLM_MODEL_REASONING=llama3.1:8b     # was llama3.2:3b on Windows
LLM_MODEL_ROUTER=llama3.2:3b        # unchanged
```

Everything else in the file stays exactly as transferred — especially:

| Key | Why it must not change |
|---|---|
| `TELEGRAM_BOT_TOKEN` | The live @Emandidbot token. |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Currently `793244510` (David). Eman gets added in step 7. |
| `NOTION_TOKEN` / `NOTION_GRANTS_DATA_SOURCE_ID` | Points at the **existing** DB with 28 seeded grants. |
| `TIMEZONE=America/New_York` | Drives the midnight scrape, 9AM reminders, Monday digest. |

**Do NOT run `python -m did_agent.bootstrap create`** — that makes a *second* empty Notion DB.
(`bootstrap seed` is safe/idempotent but unnecessary; the DB is already seeded.)

✅ Verify (checks required keys exist and are non-empty, prints no secrets):
```bash
cd ~/Eman_dashboard/agent
for k in TELEGRAM_BOT_TOKEN NOTION_TOKEN NOTION_GRANTS_DATA_SOURCE_ID TELEGRAM_ALLOWED_CHAT_IDS; do
  grep -q "^$k=.\+" .env && echo "$k: set" || echo "$k: MISSING <-- fix before continuing"
done
grep '^LLM_MODEL_REASONING=' .env    # expect: llama3.1:8b
```

---

## 5. ⚠️ Stop the Windows bot (coordination point)

Message David: the Windows instance must be stopped **before** the next step. One poller per token —
if both run, Telegram gives each poller a random subset of messages and the bot looks "flaky."

✅ Verify: David confirms the Windows process/`supervisor.bat` is stopped.

---

## 6. First foreground run (smoke test before installing keep-alive)

```bash
cd ~/Eman_dashboard/agent
./.venv/bin/python -m did_agent.main
```

✅ Verify — the startup log must show ALL of:
- `DID grant agent starting (long-polling). Tools: ['notion_sync', 'scrape_grants', ...]`
- `Scheduled daily midnight (America/New_York) grant scrape.`
- `Scheduled daily reminders + Monday 9AM digest for 1 chat(s).`  ← if instead you see
  `No TELEGRAM_ALLOWED_CHAT_IDS`, the `.env` didn't load — recheck step 4.
- `Application started`

✅ Verify end-to-end: David texts @Emandidbot *"what's due soon?"* → bot answers with real grants
from Notion. Send a short **voice note** too — first one downloads the Whisper model (one-time,
~150 MB), then it should echo the transcription and answer.

Leave it running for step 7, or Ctrl-C and continue to step 8 first.

---

## 7. Add Eman to the allowlist

1. Eman opens Telegram → search **@Emandidbot** → taps **Start**.
2. The bot replies to her with *"…Your chat id is `<number>` — send it to David…"*, and the same id
   appears in the bot log as `Unauthorized message from chat_id=…`.
3. Edit `.env`: `TELEGRAM_ALLOWED_CHAT_IDS=793244510,<Eman's id>`
4. Restart the bot (Ctrl-C + rerun, or `launchctl kickstart -k gui/$(id -u)/com.did.grantagent`
   if step 8 is already done).

✅ Verify: startup log now says `…digest for 2 chat(s).`, and Eman's messages get answered.

---

## 8. Keep it always-on (launchd)

```bash
chmod +x ~/Eman_dashboard/agent/supervisor.sh

cat > ~/Library/LaunchAgents/com.did.grantagent.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>            <string>com.did.grantagent</string>
  <key>ProgramArguments</key> <array>
    <string>/bin/bash</string>
    <string>$HOME/Eman_dashboard/agent/supervisor.sh</string>
  </array>
  <key>RunAtLoad</key>        <true/>
  <key>KeepAlive</key>        <true/>
  <key>StandardOutPath</key>  <string>/tmp/did-grant-agent.log</string>
  <key>StandardErrorPath</key><string>/tmp/did-grant-agent.err</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.did.grantagent.plist
```

Then stop any foreground copy from step 6 (single poller!).

Sleep settings — reminders can't fire from a sleeping Mac: plug in and enable
*System Settings → Battery → Options → Prevent automatic sleeping when the display is off*.

✅ Verify:
```bash
launchctl list | grep com.did.grantagent      # PID in first column = running
tail -5 /tmp/did-grant-agent.log              # shows 'Application started'
```
Reboot test (recommended): restart the Mac, log in, wait 60s, re-run both checks.

---

## 9. Done — steady-state expectations

| When (ET) | What | Who sees it |
|---|---|---|
| Daily 12:00 AM | Auto-scrape grants.gov (disability / accessibility / assistive tech) → new grants saved to Notion, dashboard refreshed | Silent |
| Daily 9:00 AM | Deadline reminders (starting `REMINDER_LEAD_DAYS=7` days out) | Telegram |
| Monday 9:00 AM | Grants + news digest | Telegram |
| Anytime | Chat/voice: find, score, draft grants; check deadlines | Telegram |

## Ops quick reference

```bash
tail -f /tmp/did-grant-agent.log                                  # live log
launchctl kickstart -k gui/$(id -u)/com.did.grantagent            # restart bot (e.g. after .env edit)
launchctl unload ~/Library/LaunchAgents/com.did.grantagent.plist  # stop for maintenance
cd ~/Eman_dashboard && git pull                                   # update code, then restart bot
./.venv/bin/python -m did_agent.publish                           # regenerate dashboard/grants-dashboard.html
```

Troubleshooting: see the table in `OLLAMA-MAC-SETUP.md`. Most common: Ollama not running
(`brew services start ollama`) and two pollers fighting over the token (stop one).
