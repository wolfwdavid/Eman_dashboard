# WINDOWS-DEPLOY — move the DID Grant Agent to the Windows laptop (migration runbook)

**Audience:** whoever sits at the Lenovo Yoga Book 9i. Follow top to bottom; every step has a
✅ verify command — do not continue past a failed verify.

**What this is NOT:** a from-scratch install. The bot (@Emandidbot), the Notion grants DB
(28 grants seeded), and all tokens **already exist** and are running on the Mac right now. This
runbook *moves* that working setup to Windows because the Mac is going away.

**What changes vs. the Mac setup:** the LLM no longer runs locally. The Yoga Book is a 15 W
ultrabook (Core i7-1355U, 16 GB, integrated graphics) — it would run `llama3.1:8b` *slower* than
the Mac did, not faster. So Ollama is dropped and `LLM_BASE_URL` points at Groq instead. Replies go
from 2–3 minutes to a few seconds. Everything else — Telegram polling, Notion, scrapes, reminders,
the chat API — is light I/O work that this laptop handles comfortably.

**The one rule that can break production:** Telegram allows **one poller per bot token**. The
moment the Windows bot starts, the Mac bot must be stopped. Never run both. This has already caused
an outage once.

**The one rule that will silently kill a laptop deployment:** a closed lid sleeps the machine and
the bot dies with it. Step 7 is not optional.

---

## 0. Prerequisites

- Windows 11, ~5 GB free disk (no models to download anymore — that's the Ollama saving).
- A user account that **stays logged in** (Task Scheduler runs the bot in your session).
- The `.env` file from the Mac, transferred **out of band** (USB, SD card, or password manager —
  it holds the Telegram bot token and Notion token). **It is git-ignored on purpose; it will NOT
  arrive via `git clone` and must NEVER be committed.**
- A Groq API key — free, no credit card: https://console.groq.com → API Keys.

✅ Verify:
```powershell
winget --version          # any output = winget present
[Environment]::OSVersion  # expect Windows 11
```

---

## 1. Install the toolchain

```powershell
winget install Git.Git
winget install Python.Python.3.13        # 3.13 is the well-tested line for these deps
winget install Cloudflare.cloudflared    # tunnel for the dashboard chat widget
```

No ffmpeg and no `av` build: voice notes go to hosted Whisper on this deployment (step 5), so
`faster-whisper` and its native toolchain are not installed at all.

Close and reopen PowerShell afterwards so `PATH` picks all three up.

✅ Verify:
```powershell
git --version; py -3.13 --version; cloudflared --version
```
All three must print a version.

---

## 2. Clone the repo

```powershell
cd $HOME
git clone https://github.com/wolfwdavid/Eman_dashboard.git
cd Eman_dashboard\agent
```

✅ Verify:
```powershell
Test-Path did_agent\main.py, requirements.txt, supervisor.bat, tunnel.ps1
```
Expect four `True` values.

---

## 3. Python env + dependencies

```powershell
cd $HOME\Eman_dashboard\agent
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

All pure-Python wheels — this should finish in under a minute with no compiler involved.

✅ Verify:
```powershell
.\.venv\Scripts\python.exe -c "import telegram, apscheduler, notion_client, openai; print('deps OK')"
```

---

## 4. Get a Groq API key and confirm the model IDs

Groq rotates models and **shuts old ones off**. `llama-3.3-70b-versatile` and `llama-3.1-8b-instant`
— the ones named in older docs in this repo — were shut down on **2026-08-16** for free and
developer tiers. Do not trust any hardcoded list, including this one. Check live:

```powershell
curl.exe -s -H "Authorization: Bearer gsk_YOUR_KEY_HERE" https://api.groq.com/openai/v1/models
```

Pick from what actually comes back. As of this writing the correct choices are:

| Role | Model ID | Why |
|---|---|---|
| `LLM_MODEL_REASONING` | `openai/gpt-oss-120b` | Drives the agentic tool loop — **must** support tool calling |
| `LLM_MODEL_ROUTER` | `openai/gpt-oss-20b` | Cheap 1-label intent classifier; no tools needed |

✅ Verify both IDs appear in the `/models` output above.

---

## 5. Install the transferred `.env`

Place the `.env` from the Mac at `$HOME\Eman_dashboard\agent\.env`, then edit the LLM and voice
blocks — everything else transfers unchanged:

```ini
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=gsk_your_key_here
LLM_MODEL_REASONING=openai/gpt-oss-120b
LLM_MODEL_ROUTER=openai/gpt-oss-20b

# Voice notes -> hosted Whisper, so no faster-whisper/av/ffmpeg on this box.
# WHISPER_API_KEY is left blank on purpose: it falls back to LLM_API_KEY.
WHISPER_BASE_URL=https://api.groq.com/openai/v1
WHISPER_MODEL=whisper-large-v3-turbo
```

> Leaving `WHISPER_BASE_URL` empty is what selects the old local backend — if you ever see
> "No module named 'faster_whisper'" in the log, that key got dropped.

Everything else stays exactly as transferred — especially:

| Key | Why it must not change |
|---|---|
| `TELEGRAM_BOT_TOKEN` | The live @Emandidbot token. |
| `TELEGRAM_ALLOWED_CHAT_IDS` | `793244510` (David) + `6577520928` (Eman). |
| `NOTION_TOKEN` / `NOTION_GRANTS_DATA_SOURCE_ID` | Points at the **existing** DB with 28 seeded grants. |
| `TIMEZONE=America/New_York` | Drives the midnight scrape, 9AM reminders, Monday digest. |
| `CHAT_API_TOKEN` / `CHAT_API_PORT` | The dashboard chat widget authenticates with these. |

**Do NOT run `python -m did_agent.bootstrap create`** — that makes a *second* empty Notion DB.

✅ Verify (checks required keys are present and non-empty, prints no secrets):
```powershell
cd $HOME\Eman_dashboard\agent
foreach ($k in 'TELEGRAM_BOT_TOKEN','NOTION_TOKEN','NOTION_GRANTS_DATA_SOURCE_ID','TELEGRAM_ALLOWED_CHAT_IDS','LLM_API_KEY') {
  if (Select-String -Path .env -Pattern "^$k=.+" -Quiet) { "$k`: set" } else { "$k`: MISSING <-- fix before continuing" }
}
Select-String -Path .env -Pattern '^LLM_BASE_URL='   # expect the Groq URL, not localhost:11434
```

---

## 6. ⚠️ Stop the Mac agent (coordination point — do this before step 7)

On the **Mac**, stop both services and prevent them coming back after a reboot:

```bash
launchctl bootout gui/$(id -u)/com.did.grantagent
launchctl bootout gui/$(id -u)/com.did.tunnel
mv ~/Library/LaunchAgents/com.did.grantagent.plist ~/Library/LaunchAgents/com.did.grantagent.plist.disabled
mv ~/Library/LaunchAgents/com.did.tunnel.plist     ~/Library/LaunchAgents/com.did.tunnel.plist.disabled
```

✅ Verify on the Mac — both must return nothing:
```bash
launchctl list | grep com.did.
pgrep -fl did_agent.main
```

Until this passes, do not start the Windows bot. Two pollers means Telegram hands each one a random
subset of messages and the bot looks intermittently broken rather than cleanly down.

---

## 7. Power settings — the laptop trap

A laptop running 24/7 needs its sleep behaviour disabled, or reminders and the chat API die
whenever the lid closes. Run PowerShell **as Administrator**:

```powershell
powercfg /change standby-timeout-ac 0        # never sleep on AC
powercfg /change hibernate-timeout-ac 0      # never hibernate on AC
powercfg /change disk-timeout-ac 0           # keep disks spun up

# Lid close = do nothing, on both AC and battery. THIS is the one that matters.
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setactive SCHEME_CURRENT
```

Leaving the display timeout alone is fine and *recommended* — the screens turning off does not sleep
the machine, and these are dual OLED panels that can burn in.

Also, in **Settings → Windows Update → Advanced options**: set **Active hours** wide, and turn off
"Restart as soon as possible…". An unattended 3am update reboot is the second most likely way this
deployment dies.

✅ Verify:
```powershell
powercfg /query SCHEME_CURRENT SUB_BUTTONS LIDACTION | Select-String 'Current AC|Current DC'
```
Both Current settings must read `0x00000000`.

Keep the laptop plugged in. On battery it will still throttle and eventually die.

---

## 8. First foreground run (smoke test before installing keep-alive)

```powershell
cd $HOME\Eman_dashboard\agent
.\.venv\Scripts\python.exe -m did_agent.main
```

✅ Verify — the startup log must show ALL of:
- `DID grant agent starting (long-polling). Tools: ['notion_sync', 'scrape_grants', ...]`
- `Scheduled daily midnight (America/New_York) grant scrape.`
- `Scheduled daily reminders + Monday 9AM digest for 2 chat(s).` ← if it says `No
  TELEGRAM_ALLOWED_CHAT_IDS`, the `.env` didn't load — recheck step 5.
- `Application started`

✅ Verify end-to-end: text @Emandidbot *"what's due soon?"* → it answers with real grants from
Notion, **within a few seconds** rather than minutes. That speed is how you know it's hitting Groq
and not falling back to something local.

✅ Verify voice: send a short voice note. The log should show
`Transcribing via hosted Whisper (https://api.groq.com/openai/v1, model=whisper-large-v3-turbo)`
and reply in a second or two — no model download, since nothing runs locally. If it instead says
`Transcribing via local faster-whisper`, `WHISPER_BASE_URL` didn't load — recheck step 5.

Ctrl-C when satisfied.

---

## 9. Keep it always-on (Task Scheduler)

`supervisor.bat` is already in the repo — it restarts the bot on *any* exit, which Task Scheduler
alone won't do (it only restarts on non-zero exit codes).

Register both tasks from an **Administrator** PowerShell. Use the `ScheduledTask` cmdlets rather
than `schtasks` — two Task Scheduler defaults are fatal to a 24/7 laptop deployment and only these
cmdlets can override them:

- **Execution time limit defaults to 3 days.** Task Scheduler would kill the bot every 72 hours.
  `-ExecutionTimeLimit 0` disables it.
- **Tasks stop when the machine goes on battery.** A power blip or a pulled charger would silently
  end the bot. `-AllowStartIfOnBatteries -DontStopIfGoingOnBatteries` prevents it.

```powershell
$agent    = "$HOME\Eman_dashboard\agent"
$trigger  = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit 0 `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName 'DID Grant Agent' -Force -RunLevel Highest `
    -Trigger $trigger -Settings $settings `
    -Action (New-ScheduledTaskAction -Execute 'cmd.exe' `
        -Argument "/c `"$agent\supervisor.bat`"" -WorkingDirectory $agent)

Register-ScheduledTask -TaskName 'DID Tunnel' -Force -RunLevel Highest `
    -Trigger $trigger -Settings $settings `
    -Action (New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$agent\tunnel.ps1`"" `
        -WorkingDirectory $agent)
```

Then start them now rather than waiting for a logon:
```powershell
Start-ScheduledTask -TaskName 'DID Grant Agent'
Start-ScheduledTask -TaskName 'DID Tunnel'
```

> A console window will open for the bot and stay open — that is the supervisor loop. **Minimize it;
> do not close it.** Closing that window stops the bot. The tunnel runs hidden.

`tunnel.ps1` needs git push rights so the dashboard widget can find the new tunnel URL. The first
push will prompt for GitHub credentials via Git Credential Manager — **run one manual push before
relying on the task**, or it will fail silently in the background:

```powershell
cd $HOME\Eman_dashboard; git pull; git push
```

✅ Verify:
```powershell
Get-ScheduledTask 'DID Grant Agent','DID Tunnel' | Get-ScheduledTaskInfo |
    Select-Object TaskName, LastRunTime, LastTaskResult   # LastTaskResult 267009 = currently running
Get-Content $env:TEMP\did-grant-agent.log -Tail 5         # shows 'Application started'
Get-Content $env:TEMP\did-tunnel.log -Tail 5              # shows a trycloudflare.com URL
Invoke-RestMethod http://127.0.0.1:8080/                  # chat API serving the dashboard
```

✅ Reboot test (do not skip): restart the laptop, log in, wait 60 s, re-run all three checks.

> Both tasks are "on logon", so an unattended reboot leaves the bot down until someone logs in.
> If the laptop will sit headless, enable auto-login (`netplwiz`, untick "Users must enter a user
> name and password"). Note this trades physical security for uptime — reasonable for a machine
> that stays at a desk, not for one that travels.

---

## 10. Done — steady-state expectations

| When (ET) | What | Who sees it |
|---|---|---|
| Daily 12:00 AM | Auto-scrape grants.gov → new grants saved to Notion, dashboard refreshed | Silent |
| Daily 9:00 AM | Deadline reminders (`REMINDER_LEAD_DAYS=7` days out) | Telegram |
| Monday 9:00 AM | Grants + news digest | Telegram |
| Anytime | Chat/voice: find, score, draft grants; check deadlines | Telegram + dashboard widget |

## Ops quick reference

```powershell
Get-Content $env:TEMP\did-grant-agent.log -Wait          # live log
Stop-ScheduledTask  -TaskName 'DID Grant Agent'          # stop for maintenance
Start-ScheduledTask -TaskName 'DID Grant Agent'          # restart (e.g. after a .env edit)
cd $HOME\Eman_dashboard; git pull                        # update code, then restart the task
.\agent\.venv\Scripts\python.exe -m did_agent.publish    # regenerate the grants dashboard
```

> `Stop-ScheduledTask` ends the supervisor loop, but a bot process it already spawned can outlive
> it. After stopping, confirm with `Get-Process python -ErrorAction SilentlyContinue` and
> `Stop-Process` any straggler — a leftover poller is exactly the 409 Conflict situation.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Bot answers some messages, ignores others | Two pollers on one token | Confirm step 6 — the Mac is still running |
| `401` / `invalid_api_key` in the log | Groq key wrong or unquoted in `.env` | Re-copy from console.groq.com |
| `model_not_found` | Groq shut that model off | Re-run the `/models` curl in step 4 and update `.env` |
| `429 rate_limit_exceeded` | Free tier is 30 req/min, ~14.4k/day | Fine for 2 users; if it recurs, add a paid card or fall back to Ollama |
| Bot dies overnight | Lid close or Windows Update | Re-verify step 7 |
| Chat widget on the website can't connect | Tunnel URL changed and the push failed | `Get-Content $env:TEMP\did-tunnel.log -Tail 20`; check git credentials |
| `No module named 'faster_whisper'` | `WHISPER_BASE_URL` missing → fell back to the local backend | Set it per step 5 and restart |
| Voice notes fail with `model_not_found` | Groq rotated the Whisper model id | Re-check the `/models` call from step 4 |

---

## Appendix A — rollback to the Mac

Nothing about this migration is destructive to the Mac. To go back before it's gone:

```powershell
# Windows: stop first, and make sure nothing survives the supervisor
Stop-ScheduledTask -TaskName 'DID Grant Agent'; Stop-ScheduledTask -TaskName 'DID Tunnel'
Get-Process python, cloudflared -ErrorAction SilentlyContinue | Stop-Process
```
```bash
# Mac: re-enable
mv ~/Library/LaunchAgents/com.did.grantagent.plist.disabled ~/Library/LaunchAgents/com.did.grantagent.plist
mv ~/Library/LaunchAgents/com.did.tunnel.plist.disabled     ~/Library/LaunchAgents/com.did.tunnel.plist
launchctl load ~/Library/LaunchAgents/com.did.grantagent.plist
launchctl load ~/Library/LaunchAgents/com.did.tunnel.plist
```

## Appendix B — how the two Whisper backends work

`did_agent/voice.py` has two backends, selected by whether `WHISPER_BASE_URL` is set:

| `WHISPER_BASE_URL` | Backend | Needs | Audio leaves machine |
|---|---|---|---|
| set | any OpenAI-compatible `/audio/transcriptions` (Groq: free, 2,000/day) | nothing beyond `openai` | yes |
| empty *(default)* | local `faster-whisper` | `av` wheel + ffmpeg | no |

This Windows deployment uses the hosted path, which is why steps 1 and 3 install no ffmpeg and no
native build toolchain. `faster-whisper` is commented out of `requirements.txt` for the same reason;
`voice.py` imports it lazily, so its absence is harmless.

To go back to fully-local transcription (e.g. on the next Mac), clear `WHISPER_BASE_URL`, set
`WHISPER_MODEL` back to a size like `base`, and `pip install "faster-whisper>=1.0"`.

## Appendix C — when the new Mac arrives

`MAC-DEPLOY.md` still describes the local-Ollama setup. Two things to decide at that point:

1. Whether to go back to local inference at all. On Apple Silicon, `llama3.1:8b` is genuinely fast
   and keeps grant data on-machine — the reason it was chosen originally. Groq was picked here to
   work around 15 W ultrabook hardware, not because hosted is better.
2. Follow the single-poller rule in reverse: stop Windows before starting the Mac.
