---
title: DID Grant Agent
emoji: "🧭"
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
short_description: Always-on assistant for Diversity Includes Disability (Telegram, email, web chat)
---

# DID Grant Automation Agent

Agentic chatbot for **Diversity Includes Disability** (Eman Rimawi) — finds, organizes, scores,
and helps fill out grants, and reminds Eman via Telegram before deadlines.

- **Brain:** a **free, local LLM via Ollama** (OpenAI-compatible) — private, nothing leaves the machine.
  Swappable to Groq/Gemini free tiers by editing three `.env` lines. **Mac setup: see `OLLAMA-MAC-SETUP.md`.**
- **Interface:** Telegram bot.
- **Data:** Notion (source of truth).
- **Runtime:** local machine (Windows Task Scheduler `supervisor.bat`, or macOS launchd `supervisor.sh`);
  schedule (America/New_York): midnight grant scrape, daily 9AM deadline reminders (T-7), Monday 9AM
  grants/news digest (it used to fire on Sunday: PTB numbers weekdays 0=Sunday), Mon/Wed/Fri 6:00AM
  grant sweep, and a Mon/Wed/Fri 8:45AM Telegram message with the new-grant summary plus Google Doc
  draft links for up to 3 new OPEN_NOW grants. "New" means not present at the previous Mon/Wed/Fri
  sweep (so grants the midnight scrape added in between count). The first run, or a missing/old-format
  state file, falls back to comparing against the grants present just before the 6AM scrape. No new
  grants sends a short "No new grants since the last sweep" message;
  missing or stale sweep state sends a "result unavailable" message.

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
      schedule.py          # T-7 reminders + Monday 9AM digest (jobs wired in main.py; sweep.py = Mon/Wed/Fri sweep logic)
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

## Hosting on the Oracle VM (current — live since 2026-09-25)

The bot runs 24/7 in Docker on an Oracle Cloud Always Free ARM VM (`VM.Standard.A1.Flex`, Ubuntu 24.04).
Ollama runs on the host (`llama3.2:3b`); the agent container uses host networking to reach it; Caddy
terminates HTTPS for the public web chat. `.github/workflows/uptime.yml` probes the chat endpoint every
30 minutes. Provisioning lives in `deploy/oracle/` (`provision.py` is idempotent; `state.json` records
the instance and its public IP).

| What | Where on the VM |
|---|---|
| Code | `/opt/did-agent` (clone of this repo, branch `main`) |
| Secrets | `/opt/did-agent/agent/.env` — the source of truth; keep the laptop copy in sync by hand |
| Stack | `cd /opt/did-agent/agent && sudo docker compose -f deploy/oracle/docker-compose.yml …` |
| Logs | `sudo docker logs --tail 50 did-agent` |

**Ship a code change** (after `git push origin main`):
```bash
ssh -i <key> ubuntu@<vm-ip> "cd /opt/did-agent && git pull -q --ff-only && cd agent   && sudo docker compose -f deploy/oracle/docker-compose.yml up -d --build agent && sleep 10 && sudo docker logs --tail 12 did-agent"
```

**Change one setting in place.** `env_file` is read only when the container is created, so edit the
VM's `.env` and recreate:
```bash
ssh -i <key> ubuntu@<vm-ip> "sudo sed -i 's/^TELEGRAM_ALLOWED_CHAT_IDS=.*/TELEGRAM_ALLOWED_CHAT_IDS=<id>,<id>/' /opt/did-agent/agent/.env   && cd /opt/did-agent/agent && sudo docker compose -f deploy/oracle/docker-compose.yml up -d --force-recreate agent && sleep 10 && sudo docker logs --tail 12 did-agent"
```
Never run a command that still contains a literal placeholder such as `<id>` or `NEW_TOKEN`: it is
written verbatim and the bot stays down (`InvalidToken`) until the real value is restored. For secrets,
read the value into a shell variable from the laptop's `.env` first instead of typing it.

`deploy/oracle/deploy.sh <ip>` pulls and builds but ALSO copies the laptop's `.env` over the VM's.
Use it only when the laptop copy is known to be complete and current.

**Sweep state and drafts.** The 6:00AM sweep writes `data/local/sweep_state.json` (override with
`SWEEP_STATE_PATH`; gitignored; compose mounts the `sweep_state` volume there) and the 8:45AM message
reads it. Draft links need `GOOGLE_SERVICE_ACCOUNT_JSON` + `GOOGLE_TEMPLATE_DOC_ID`; without them, or if
one draft fails, the summary is still sent with a one-line note. The drafts are created once per sweep
day, whatever the number of chat ids: the links are stored in the same state file, so every chat gets
the same links and a restart or a repeated 8:45AM message that day reuses them.

Healthy startup log: `DID grant agent starting (long-polling)`, `Scheduled Mon/Wed/Fri 6:00AM
(America/New_York) grant sweep.`, `Scheduled daily reminders + Monday 9AM digest + Mon/Wed/Fri 8:45AM
sweep message for N chat(s)`, `Application started`, and no `httpx` lines (silenced because request URLs embed
the bot token). `Unauthorized message from chat_id=…` means that id is missing from
`TELEGRAM_ALLOWED_CHAT_IDS`.

Rules: one Telegram poller per token (never run a laptop copy while the VM is up); never re-run
`python -m did_agent.bootstrap create` (the Notion grants DB already exists).

## Hosting on a Hugging Face Space (alternative, not in use)

The agent is packaged as a Docker Space (`Dockerfile`, `.dockerignore`, front matter at the top of
this README). Hugging Face requires a PRO subscription on the owning account to run Docker Spaces
on their free CPU hardware; PRO also raises the free Inference Providers credits that the hosted LLM
uses. Steps:

1. Deploy the code from this folder: `python deploy_space.py --space <owner>/did-grant-agent`
   (uses your `hf auth login`; never uploads `.env`, `.venv`, tests or secrets).
2. In the Space's **Settings → Variables and secrets**, add as **secrets**:
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_CHAT_IDS`, `NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`,
   `NOTION_GRANTS_DATA_SOURCE_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_TEMPLATE_DOC_ID`,
   `GOOGLE_OUTPUT_FOLDER_ID`, `CHAT_API_TOKEN`, the email trio if the email channel is wanted, and
   the LLM: `LLM_BASE_URL=https://router.huggingface.co/v1`, `LLM_API_KEY=<HF token with
   "Make calls to Inference Providers">`, `LLM_MODEL_REASONING=meta-llama/Llama-3.1-8B-Instruct:cheapest`,
   `LLM_MODEL_ROUTER=meta-llama/Llama-3.2-3B-Instruct:cheapest`. Optional hosted Whisper:
   `WHISPER_BASE_URL` / `WHISPER_API_KEY`.
   `CHAT_API_HOST=0.0.0.0` and `CHAT_API_PORT=7860` are already set in the Dockerfile.
3. Put the Space's direct URL (`https://<owner>-did-grant-agent.hf.space`) into
   `dashboard/chat-config.json` and push, so the deployed dashboard widget talks to it.
4. Keepalive: free hardware sleeps when unused. Ping `https://<owner>-did-grant-agent.hf.space/`
   every few hours (a GitHub Actions cron `curl` is enough) or upgrade the hardware to never sleep.
5. Only one process may poll the Telegram token — stop any local copy before the Space starts.

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

### Web chat conversations (`POST /chat`)

Each visitor has their own conversation. The dashboard widget makes a random id
when the page loads and sends it with every question as `session_id`:

```json
{ "message": "Which grants are due this month?", "session_id": "<random id>" }
```

- The id must be 16 to 64 characters of letters, digits, `-` or `_`. A request
  with no id, or a malformed one, is answered with no memory of earlier questions.
  There is no shared default conversation.
- History lives in memory only, capped at the last few turns per conversation.
- A conversation is dropped after 30 minutes without a question
  (`SESSION_IDLE_SECONDS`), and at most 500 are kept at once (`MAX_SESSIONS`);
  the least recently used goes first. Both are constants in `did_agent/chat_api.py`.
- Restarting the container clears every conversation. Reloading the dashboard
  starts a new one.

Tests: `tests/test_chat_sessions.py`.

### Voice transcription endpoint (`POST /chat/transcribe`)

Used by the dashboard mic on browsers without built-in speech recognition
(Firefox and others). The browser records a short clip and this endpoint turns it
into text. Live on the VM since 2026-11-11.

**Request.** The body is the raw audio bytes (not JSON, not multipart) and
`Content-Type` is an audio type. Accepted types: webm, ogg, opus, mp4, m4a,
mpeg/mp3, wav, flac (for example `audio/webm;codecs=opus`; parameters after `;`
are ignored). Browsers record webm/opus on Chrome and Edge, ogg/opus on Firefox
and mp4 on Safari. A `Content-Length` header is required.

**Response.** `200` with `{"text": "..."}` (empty string if nothing was heard).
Errors are `{"error": "..."}` with these statuses:

| Status | Meaning |
|---|---|
| 200 | transcript returned |
| 400 | empty body or invalid `Content-Length` |
| 401 | `CHAT_API_TOKEN` is set and the request lacks a matching `Authorization: Bearer` header (the same check `/chat` uses, so requests via the `trycloudflare.com` quick tunnel are exempt, as for `/chat`) |
| 408 | the whole body did not arrive within 20 seconds; the connection is closed |
| 411 | no `Content-Length` header |
| 413 | body over 1,048,576 bytes (1 MiB); the body is not read and the connection is closed |
| 415 | `Content-Type` is not one of the audio types above |
| 429 | more than 10 requests per minute from one client IP; a `Retry-After` header gives the seconds to wait. Every request counts, including those answered 400, 401, 411, 413 or 415 |
| 502 | transcription failed (Whisper error or undecodable audio) |
| 503 | server busy; at most 2 transcriptions run at once |
| 504 | transcription took longer than 60 seconds |

**Deadlines.** The upload is read in full, under one 20-second limit for the whole
body, before a transcription slot is taken, so a slow sender cannot hold a slot.
The transcription itself is given 60 seconds; the hosted Whisper request uses the
same limit and is not retried. In local mode a transcription that runs past the
limit cannot be interrupted: the request gets 504 and its slot is freed, but the
work finishes in the background.

The 1 MiB cap is the enforcement behind "about 20 seconds of speech": the server
does not measure duration. The dashboard stops recording at 18 seconds so a clip
stays under the cap.

**Client IP for the rate limit.** Behind the reverse proxy (Caddy on the VM) every
connection arrives from a local address, so the limiter reads the real client from
the rightmost `X-Forwarded-For` entry, the hop our own proxy appended. That header
is trusted only when the connection itself comes from loopback or a private range
(`127.0.0.0/8`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`,
`fc00::/7`). A direct public connection is keyed on its socket address, so it
cannot forge the header.

`CF-Connecting-IP` is ignored unless `CHAT_TRUST_CF_CONNECTING_IP=true` is set in
`.env` (default `false`). Caddy and other plain proxies pass a client-supplied
`CF-Connecting-IP` through unchanged, so believing it there would let a client
choose a new rate-limit key on every request. Turn the setting on only when every
request reaches the agent through Cloudflare (a `cloudflared` tunnel or the
Cloudflare proxy), which sets that header itself; it is then preferred over
`X-Forwarded-For`, still only from a loopback or private peer.

The rate limit is checked before anything else, so a request refused for a missing
token or a wrong `Content-Type` uses up budget like any other. A client that is
over its limit and declares a body larger than 256 KiB gets the 429 without the
body being read, and the connection is closed. IPv6 clients are counted per /64
network, not per address. IPv4-mapped IPv6 addresses (`::ffff:a.b.c.d`) are
treated as the IPv4 address. The limiter tracks at most 5,000 clients at a time;
when full it forgets the one that has been quiet longest.

**Access.** By owner decision the endpoint needs no token of its own beyond the
`CHAT_API_TOKEN` rule above; it is protected by the size, type, rate and
concurrency limits instead. The server is threaded, so a slow transcription does
not block chat polling. Each upload is written to a temp file whose suffix comes
from the MIME map (never from the client) and the file is deleted before the reply
is sent.

**Whisper configuration** (in `.env`; names only, never commit values):

| Key | Purpose |
|---|---|
| `WHISPER_BASE_URL` | hosted mode: any OpenAI-compatible `/audio/transcriptions` endpoint (Groq serves Whisper free). Empty means local mode |
| `WHISPER_MODEL` | model name (`whisper-large-v3-turbo` hosted; `base`, `small`, ... local) |
| `WHISPER_API_KEY` | key for the hosted backend; falls back to `LLM_API_KEY` when empty |

Hosted mode needs only `WHISPER_BASE_URL` (plus `WHISPER_MODEL`) and no native
dependencies. Local mode (empty `WHISPER_BASE_URL`) uses faster-whisper, which needs
the `av` wheel and `ffmpeg` installed so the webm, ogg and mp4 clips browsers
produce can be decoded.

**Privacy.** On this path the audio leaves the browser and goes to the configured
Whisper backend (Groq or similar when hosted). It is not stored on the server
after the request.

**Deploy.** After merging, redeploy the agent on the Oracle VM (an owner step, not
automated here). Check it with one request, using a placeholder host and any small
recording:

```bash
curl -s -X POST https://<your-tunnel-host>/chat/transcribe \
  -H "Content-Type: audio/webm" --data-binary @sample.webm
```

Expect `{"text": "..."}` with status 200.

See `../.planning/MILESTONE-2-agent-BRIEF.md` for the full plan.
