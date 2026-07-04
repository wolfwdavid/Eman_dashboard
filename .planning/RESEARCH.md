# Milestone 2 — DID Grant Automation Agent: Technical Grounding (RESEARCH.md)

## 1. Executive Summary — Recommended Stack

A single long-running local Python process on Eman's Windows machine, orchestrated by an Anthropic tool-use loop, kept alive by Task Scheduler + a supervisor `.bat`. Notion is the source of truth; everything else is a tool the agent calls.

| Concern | Pinned choice |
|---|---|
| Language / runtime | Python 3.13 (SDK support: 3.10–3.15) |
| Agent brain | `anthropic` SDK — `claude-opus-4-8` (planning/scoring/drafting), `claude-haiku-4-5` (cheap classification/extraction) via a tool-use loop |
| Federal grants | `requests` → `api.grants.gov/v1/api/search2` + `fetchOpportunity` (no auth) |
| Foundation prospecting | `requests` → ProPublica Nonprofit Explorer API v2 (no auth) |
| News/RFP digest | `feedparser` over free RSS (grants.gov RSS, PND RFP Bulletin, Disability Scoop, Chronicle) |
| Notion | `notion-client` (ramnes/notion-sdk-py) v3.1.0, API version **2025-09-03 data-source model** |
| Google Docs drafting | `google-api-python-client` + `google-auth`, **service account** (Drive v3 `files.copy` + Docs v1 `batchUpdate`) |
| Telegram | `python-telegram-bot[job-queue]` v22.8, **long-polling** + built-in `JobQueue` |
| Scheduling | Telegram `JobQueue` for in-process pings; Windows Task Scheduler "At log on" for process lifecycle |
| Config/secrets | `python-dotenv` → `.env` (git-ignored), plus a git-ignored `service_account.json` |

Install baseline:

```bash
pip install anthropic requests feedparser python-dotenv \
    notion-client \
    "python-telegram-bot[job-queue]" \
    google-api-python-client google-auth
```

**Binding project constraint:** DID is **501(c)(3)-PENDING**. This is not cosmetic — it changes eligibility classification for every discovered grant. The agent must bucket opportunities into *OPEN NOW* vs *ELIGIBLE ONCE APPROVED* vs *NOT ELIGIBLE* rather than silently filtering, so Eman can act on what's actionable today (no-501c3 funders, unrestricted federal codes, fiscally-sponsored funds) and queue the rest.

---

## 2. Integrations

### 2.1 Grants.gov — federal discovery (`scrape_grants`, federal track)

**Approach.** Use the public, no-auth `POST https://api.grants.gov/v1/api/search2` as the *discovery* layer and `fetchOpportunity` as the *enrichment* layer. Run keyword sweeps (`disability`, `accessibility`, `independent living`, `inclusion`) with `oppStatuses="forecasted|posted"`. **Do not** hard-filter by `eligibilities` in the request — over-filtering hides broadly-eligible opportunities. Pull unfiltered, then post-classify each opportunity's applicant-type codes client-side.

Eligibility buckets for a 501(c)(3)-pending org:
- **OPEN NOW** → codes `13` (nonprofit *without* 501c3), `99` (unrestricted), `25` (others)
- **ELIGIBLE ONCE 501(c)(3) APPROVED** → restricted to code `12` only (requires an *issued* IRS determination letter — pending does not count)
- **NOT ELIGIBLE** → govt/tribal/education/for-profit only

```python
import requests, time

SEARCH = "https://api.grants.gov/v1/api/search2"
FETCH  = "https://api.grants.gov/v1/api/fetchOpportunity"
HEADERS = {"Content-Type": "application/json", "User-Agent": "DID-grant-agent/1.0"}

OPEN_NOW    = {"13", "99", "25"}
AFTER_501C3 = {"12"}

def search(keyword, rows=100):
    start, out = 0, []
    while True:
        body = {"keyword": keyword, "oppStatuses": "forecasted|posted",
                "rows": rows, "startRecordNum": start,      # request offset key
                "eligibilities": "", "agencies": "", "aln": "", "fundingCategories": ""}
        d = requests.post(SEARCH, json=body, headers=HEADERS, timeout=30).json()["data"]
        hits = d.get("oppHits", [])
        out.extend(hits)
        start += rows
        if start >= d.get("hitCount", 0) or not hits:
            break
        time.sleep(1)  # self-throttle ~1 req/s
    return out

def enrich(opportunity_id):
    # award ceiling/floor, full eligibility narrative, description — NOT in search2
    return requests.post(FETCH, json={"opportunityId": opportunity_id},
                         headers=HEADERS, timeout=30).json().get("data", {})

def bucket(eligibility_codes: set[str]) -> str:
    if eligibility_codes & OPEN_NOW:                 return "OPEN_NOW"
    if eligibility_codes and eligibility_codes <= AFTER_501C3: return "AFTER_501C3"
    return "NOT_ELIGIBLE"
```

**Gotchas.**
- `search2` returns **no award amounts and no per-opportunity eligibility narrative** — only aggregate facets. You *must* call `fetchOpportunity` for dollar figures and full eligibility text.
- Request offset key is `startRecordNum`; the response echoes it as `startRecord` — don't confuse them.
- `oppStatuses`/`eligibilities`/`agencies`/`fundingCategories` are **pipe-separated strings** (`"forecasted|posted"`), not JSON arrays. Empty string = no filter.
- `closeDate` is frequently empty for forecasted/rolling opportunities — handle missing deadlines, don't assume a date.
- Code `12` needs an *issued* determination letter — flag code-12-only as "blocked until 501(c)(3) approved."
- Don't confuse classic `search2` with the newer **Simpler.Grants.gov** API (different schema, arrays/facets, requires an API key, 60/min + 10k/day). Classic is the no-auth quick path; Simpler is the richer successor if needed later.
- No documented rate limit ≠ license to hammer — self-throttle ~1 req/s, backoff on 429/5xx, cache and diff against prior runs to alert only on new/changed opportunities.
- Verify numeric eligibility codes against a live faceted response (`data.eligibilities` returns code+label+count) rather than trusting hardcoded labels forever.

---

### 2.2 Telegram on Windows (`send_telegram` + `schedule`)

**Approach.** Long-polling via `Application.run_polling()` — outbound HTTPS only, so it traverses home NAT with zero router/firewall/cert config (webhooks would require an inbound public HTTPS URL). Use the built-in `JobQueue` (APScheduler-backed) for the T-7 daily reminder and the Monday 9AM digest — it shares the bot's event loop and `Bot` instance, so no separate scheduler process or token re-init. Keep the default `ProactorEventLoop`; pass `stop_signals=None` to silence the Windows signal-handler warning.

```python
import os
from datetime import time as dtime
from zoneinfo import ZoneInfo
from telegram import Update
from telegram.ext import (ApplicationBuilder, CommandHandler, MessageHandler,
                          ContextTypes, filters)

NY = ZoneInfo("America/New_York")

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id           # PERSIST this — needed for unsolicited sends
    # Monday 9AM digest (day 0 = Monday in PTB)
    ctx.job_queue.run_daily(weekly_digest, time=dtime(9, 0, tzinfo=NY),
                            days=(0,), chat_id=chat_id, name=f"digest-{chat_id}")
    # Daily T-7 deadline sweep
    ctx.job_queue.run_daily(deadline_sweep, time=dtime(9, 0, tzinfo=NY),
                            chat_id=chat_id, name=f"t7-{chat_id}")
    await update.message.reply_text("DID grant agent online. Daily 9am + Monday digest set.")

async def deadline_sweep(ctx: ContextTypes.DEFAULT_TYPE):
    # query Notion for deadlines exactly 7 days out; send if any
    await ctx.bot.send_message(ctx.job.chat_id, text="T-7 reminder: …")

async def weekly_digest(ctx: ContextTypes.DEFAULT_TYPE):
    await ctx.bot.send_message(ctx.job.chat_id, text="Monday digest: …")

def main():
    app = ApplicationBuilder().token(os.environ["TELEGRAM_BOT_TOKEN"]).build()
    app.add_handler(CommandHandler("start", start))
    app.run_polling(stop_signals=None)   # stop_signals=None REQUIRED on Windows/Proactor

if __name__ == "__main__":
    main()
```

Supervisor `.bat` (Task Scheduler runs *this* "At log on", so it restarts on *any* exit, not just crashes):

```bat
@echo off
:loop
"C:\path\venv\Scripts\pythonw.exe" "C:\path\agent\bot.py"
timeout /t 5 /nobreak >nul
goto loop
```

**Gotchas.**
- Don't wrap `run_polling` in `asyncio.run()` — it manages its own loop lifecycle; nesting throws "event loop already running / closed." Use `post_init` for custom async setup.
- `stop_signals=None` is mandatory on Windows — `ProactorEventLoop` lacks `add_signal_handler`.
- `JobQueue` only exists with the `[job-queue]` extra; a bare install leaves `application.job_queue = None` and scheduling raises.
- A bot can only message a `chat_id` it already knows — Eman must `/start` the bot once. **Capture and persist that chat_id** before scheduling sends.
- Only **one** polling process per token — duplicate launches cause 409 `Conflict: terminated by other getUpdates request`. Ensure the supervisor doesn't double-launch.
- Task Scheduler only auto-restarts on **non-zero** exit — that's why the `.bat` supervisor loop exists (restarts even on exit 0). Prefer "At log on" + "Run only when user is logged on" over "At startup" (network/profile not ready in Session 0).
- Use `pythonw.exe` (venv's) to avoid a persistent console window.
- Don't force `WindowsSelectorEventLoopPolicy` if any code spawns subprocesses — Selector can't do subprocess pipes on Windows. Proactor default + `close_loop=True` is fine.
- Get the token from `@BotFather` (`/newbot`); load from env, never commit.

---

### 2.3 Notion — source of truth (`notion_sync`)

**Approach.** Pin the mental model to the **2025-09-03 data-source API** (the SDK default; legacy `databases.query` now 400s). A database is a container of one or more *data sources*; schema + query + insert all live on the **data source**. One-time: create the Grants Tracker via `databases.create(... initial_data_source={"properties": SCHEMA})`, resolve `data_source_id = databases.retrieve(db_id)["data_sources"][0]["id"]`, cache it in `.env`. Per grant: UPSERT by querying the data source filtered on the Funder/Program title, then `pages.create` (parent `{"type":"data_source_id","data_source_id":DS_ID}`) or `pages.update`.

Grants-tracker schema (create payload):

```python
SCHEMA = {
    "Funder/Program": {"title": {}},                       # exactly one title prop
    "Type":   {"select": {"options": [{"name": "Federal"}, {"name": "Foundation"},
                                       {"name": "Micro-grant"}]}},
    "Amount": {"number": {"format": "dollar"}},            # display only; value is plain number
    "Deadline": {"date": {}},
    "501c3 Required": {"select": {"options": [{"name": "Yes"}, {"name": "No"},
                                              {"name": "Unknown"}]}},
    "Eligibility Bucket": {"select": {"options": [{"name": "OPEN_NOW"},
                                                  {"name": "AFTER_501C3"},
                                                  {"name": "NOT_ELIGIBLE"}]}},
    "Fit":    {"select": {"options": [{"name": "High"}, {"name": "Medium"}, {"name": "Low"}]}},
    "Status": {"select": {"options": [{"name": "New"}, {"name": "Reviewing"},
                                       {"name": "Drafting"}, {"name": "Submitted"},
                                       {"name": "Skipped"}]}},
    "Next Action": {"rich_text": {}},
    "Link":   {"url": {}},
}
```

```python
import os, time
from notion_client import Client
from notion_client.helpers import iterate_paginated_api

notion = Client(auth=os.environ["NOTION_TOKEN"])   # ntn_… from env ONLY
DS_ID  = os.environ["GRANTS_DATA_SOURCE_ID"]

def upsert_grant(key, props_values):
    resp = notion.data_sources.query(
        data_source_id=DS_ID,
        filter={"property": "Funder/Program", "title": {"equals": key}},
        page_size=1)
    props = {"Funder/Program": {"title": [{"text": {"content": key}}]}, **props_values}
    if resp["results"]:
        notion.pages.update(page_id=resp["results"][0]["id"], properties=props)
    else:
        notion.pages.create(
            parent={"type": "data_source_id", "data_source_id": DS_ID}, properties=props)
    time.sleep(0.35)   # stay under ~3 req/s in batch loops

def read_page_text(page_id):   # for reading Eman's shared org-profile page
    lines = []
    for block in iterate_paginated_api(notion.blocks.children.list, block_id=page_id):
        for rt in block.get(block.get("type", ""), {}).get("rich_text", []):
            lines.append(rt.get("plain_text", ""))
    return "\n".join(lines)
```

Property **values** shape (differs from schema): title → `{"title":[{"text":{"content":"X"}}]}`; select → `{"select":{"name":"Open"}}`; number → `{"number": 50000}`; date → `{"date":{"start":"2026-09-01"}}` (ISO-8601 string); url → `{"url":"https://…"}`; rich_text → `{"rich_text":[{"text":{"content":"…"}}]}`.

**Gotchas.**
- **Version trap:** under default 2025-09-03, `databases.query(database_id=...)` errors — use `data_sources.query(data_source_id=...)`. Don't mix models.
- `databases.retrieve` no longer returns the property schema — it returns the `data_sources` list. Get properties from `data_sources.retrieve(ds_id)`.
- Page parent is `{"type":"data_source_id","data_source_id":...}`, **not** `{"database_id":...}`.
- Must **share the page/database with the integration** first (page `•••` → Connections, or my-integrations → Access), else every call 404s `object_not_found`.
- No native upsert and no unique constraint — serialize writes / dedupe on a normalized (trim+case) title key or you get duplicates.
- Writing a `{"select":{"name":"X"}}` that doesn't exist **auto-creates** the option — validate against the fixed allowed set so typos don't multiply options.
- Rate limit ~3 req/s per integration; SDK auto-retries 429s (default `max_retries=2` — raise for big syncs) and honors `Retry-After`. Add ~0.35s sleep in batch loops.
- Dates must be ISO-8601 strings — a Python `date` object fails; `Amount` value is a plain number, never `"$50,000"`.
- **Secret hygiene:** Eman's source Notion page body may contain plaintext credentials (Notion source is known to). `blocks.children.list` returns raw text — extract only the specific non-secret grant fields; never dump full block payloads to logs or committed files. Token prefix is `ntn_` (env only).

---

### 2.4 Google Docs — application drafting (`draft_application`)

**Approach.** "Copy then merge" with a **plain (non-DWD) service account**: Drive v3 `files.copy` duplicates a master template Doc holding `{{placeholders}}`, then Docs v1 `documents.batchUpdate` swaps every token via `replaceAllText`, then return `https://docs.google.com/document/d/<id>/edit`. The SA either owns the template or is shared on it (+ an output folder) as Editor. No interactive OAuth, no domain-wide delegation (DWD is only for impersonating real Workspace users — DID on plain Gmail can't use it anyway). Use scopes `['.../documents', '.../drive']` — the narrow `drive.file` scope will **not** see a template merely shared with the SA.

```python
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/documents",
          "https://www.googleapis.com/auth/drive"]
creds = service_account.Credentials.from_service_account_file(
    os.environ["GOOGLE_SA_JSON_PATH"], scopes=SCOPES)
drive = build("drive", "v3", credentials=creds)
docs  = build("docs",  "v1", credentials=creds)

def fill_grant_application(template_id, output_folder_id, fields, title):
    copy = drive.files().copy(
        fileId=template_id,
        body={"name": title, "parents": [output_folder_id]},
        fields="id", supportsAllDrives=True).execute()
    doc_id = copy["id"]
    requests_ = [
        {"replaceAllText": {
            "containsText": {"text": "{{%s}}" % k, "matchCase": True},
            "replaceText": "" if v is None else str(v)}}     # coerce None → "" (must be str)
        for k, v in fields.items()]
    docs.documents().batchUpdate(documentId=doc_id, body={"requests": requests_}).execute()
    return f"https://docs.google.com/document/d/{doc_id}/edit"
```

**Gotchas.**
- **Enable BOTH** Drive API and Docs API in the Cloud project — forgetting Docs yields a 403 "API has not been used" on `batchUpdate` even after the copy succeeds.
- `drive.file` scope won't grant access to a shared template — use full `drive`, or have the SA own the template.
- Files the SA creates live in the **SA's own 15GB Drive quota** and are invisible in any human's Drive UI unless explicitly shared or placed in a person-owned folder the SA has Editor on.
- `batchUpdate` is **atomic** — one malformed request (non-string `replaceText`, empty `containsText.text`) fails the whole batch. Coerce all values to `str`, skip empty keys.
- `replaceAllText` is literal (not regex); wrap tokens as `{{...}}` with `matchCase:True` to avoid partial-word collisions. Insert placeholders via find-and-replace in the template so they aren't split across styling runs.
- **Don't commit `service_account.json`** — load from an env path (matches the Rimawi no-plaintext-creds rule). Prefer explicit per-reviewer `permissions().create` (`type:"user"`) over "anyone with link" so EIN/financials don't leak.

Template placeholders to standardize: `{{org_legal_name}}`, `{{ein}}`, `{{fiscal_sponsor}}`, `{{grant_name}}`, `{{funder}}`, `{{amount_requested}}`, `{{deadline}}`, `{{project_summary}}`, `{{mission}}`.

---

### 2.5 Grant + news sources (`scrape_grants`, foundation + digest tracks)

**Approach — two free tracks.**

**TRACK 1 — funder prospecting (programmatic).** ProPublica Nonprofit Explorer API v2 is the only genuinely free, keyless, structured funder dataset — sidesteps the Candid/Instrumentl paywalls. Query by `state[id]=NY` + keyword/NTEE/`c_code[id]=3` to enumerate foundations, then pull each foundation's 990-PF to read its actual grant history (recipients, amounts, focus). Supplement with free *read-only* HTML pages that pre-curate disability funders (Instrumentl `browse-grants` disabled + NY, Ability Central's funder list, fundsforNGOs disability category, Inside Philanthropy guides) — scrape for names/deadlines, then verify on each funder's own site. Separately register a free Candid account and pursue the **Gold Seal of Transparency** to unlock free Candid Premium (highest-value free unlock for a sub-$1M nonprofit).

**TRACK 2 — weekly digest (RSS).** Aggregate free feeds with `feedparser`: grants.gov RSS (federal), PND RFP Bulletin (foundation RFPs — via the newsletter/RSS, not a naive scraper), Disability Scoop (sector news), Chronicle's *Philanthropy Today*, Inside Philanthropy. Source exact feed URLs from Feedspot's curated disability/philanthropy RSS directories.

```python
import requests, feedparser

PP = "https://projects.propublica.org/nonprofits/api/v2"

def prospect_ny_funders(query="disability"):
    r = requests.get(f"{PP}/search.json",
                     params={"q": query, "state[id]": "NY", "c_code[id]": 3})
    orgs = r.json()["organizations"]          # each has ein, name, ntee_code
    for o in orgs:
        detail = requests.get(f"{PP}/organizations/{o['ein']}.json").json()
        yield o["name"], o["ein"], detail["filings_with_data"]   # 990-PF → grant schedule

DIGEST_FEEDS = [
    "https://www.grants.gov/rss/GG_NewOppByCategory.xml",
    # + PND RFP Bulletin, Disability Scoop, Chronicle feeds (URLs via Feedspot)
]
def weekly_digest_items(limit=10):
    for url in DIGEST_FEEDS:
        for e in feedparser.parse(url).entries[:limit]:
            yield e.title, e.link
```

**Priority funders given pending status (apply direct):** Awesome Foundation — Disability chapter ($1,000 micro-grant, **no 501c3 required**, apply 1st–10th monthly — best near-term fit); NY Community Trust (Older Adults & People with Disabilities program, ~$5K–$200K, *but requires determination letter*); Disability Rights Fund; Borealis Disability Inclusion Fund (cyclical RFP windows); Ford Foundation Disability Rights; Third Wave Mobilize Power Fund (rapid-response, open) — note Third Wave *Disability Frontlines* Fund is in a "learning stage," **not** accepting applications.

**Gotchas.**
- **501(c)(3)-pending is the binding constraint:** most foundations (incl. NY Community Trust) require an issued determination letter or a fiscal sponsor. Prospect now, but flag actual apply-eligibility — prioritize no-501c3 (Awesome Foundation) and fiscally-sponsored funds.
- Candid Foundation Directory + Instrumentl full search are paid/login-gated — scraping the gated app violates ToS. Only public marketing/browse pages are freely fetchable.
- PND's RFP page returns **HTTP 403** to bots (Cloudflare) — consume via the RFP Bulletin email or a proper RSS reader with a real user-agent, not a naive scraper.
- 990-PF data lags 1–2+ years (IRS release delay) — use for targeting/patterns, confirm current cycles on the funder's own site.
- ProPublica bracket params (`state[id]`, `c_code[id]`) must be URL-encoded — `requests` `params=` handles this.
- Feedspot pages are curated *lists*, not subscribable feeds — extract each underlying RSS URL and validate (some are stale/dead).
- GrantWatch RSS/details are subscriber-only — treat as paid, not a free source.

---

## 3. Proposed Repo Layout

```
did-grant-agent/
├── .env                      # git-ignored — all secrets
├── .env.example              # committed — key names only, no values
├── .gitignore                # ignores .env, service_account.json, cache/, *.log
├── service_account.json      # git-ignored — Google SA key
├── requirements.txt
├── README.md
├── supervisor.bat            # Task Scheduler "At log on" entrypoint (restart loop)
│
├── did_agent/
│   ├── __init__.py
│   ├── config.py             # loads .env via python-dotenv; typed settings object
│   ├── bot.py                # PTB Application entrypoint (run_polling) + JobQueue wiring
│   ├── agent_loop.py         # Anthropic tool-use loop: Opus 4.8 planner, Haiku 4.5 extractor
│   ├── llm.py                # anthropic.Anthropic client, model IDs, tool-schema registry
│   │
│   ├── tools/                # the 6 custom tools (each = one Anthropic tool definition)
│   │   ├── __init__.py       # TOOLS registry: name → (json_schema, handler)
│   │   ├── notion_sync.py    # upsert_grant, read_page_text, query deadlines
│   │   ├── scrape_grants.py  # grants.gov search2/fetch + ProPublica + RSS digest
│   │   ├── score_grant.py    # eligibility bucketing + Opus fit/priority scoring
│   │   ├── draft_application.py  # Drive copy + Docs batchUpdate → edit URL
│   │   ├── send_telegram.py  # send_message helpers used by JobQueue + agent
│   │   └── schedule.py       # JobQueue registration: T-7 daily sweep, Monday 9AM digest
│   │
│   ├── clients/              # thin API wrappers (no business logic)
│   │   ├── grants_gov.py
│   │   ├── propublica.py
│   │   ├── notion_client_wrap.py
│   │   ├── google_docs.py
│   │   └── feeds.py
│   │
│   └── cache/                # git-ignored — diff-against-prior-run JSON snapshots
│
├── data/
│   └── org_profile.json      # DID org facts for doc merge (name, EIN-pending, mission, fiscal sponsor)
│
└── tasks/
    ├── todo.md
    └── lessons.md
```

**Tool contract sketch** (`tools/__init__.py`): each tool exports a JSON schema (Anthropic tool-use format) + a Python handler. `agent_loop.py` runs the loop — Opus 4.8 decides which tool to call, `score_grant`/extraction offloads to Haiku 4.5 for cost — and feeds `tool_result` blocks back until the model returns a final answer. The 6 tools map 1:1 to the pipeline: `scrape_grants` → `score_grant` → `notion_sync` (source of truth) → `draft_application` → `send_telegram`, with `schedule` registering the recurring jobs.

---

## 4. Secrets & Config (`.env`)

| Key | Purpose | Source / format |
|---|---|---|
| `ANTHROPIC_API_KEY` | Agent brain (Opus 4.8 + Haiku 4.5) | console.anthropic.com — `sk-ant-…` |
| `ANTHROPIC_PLANNER_MODEL` | Planner/scorer/drafter model id | `claude-opus-4-8` |
| `ANTHROPIC_EXTRACTOR_MODEL` | Cheap classify/extract model id | `claude-haiku-4-5` |
| `NOTION_TOKEN` | Notion integration auth | notion.so/my-integrations — `ntn_…` |
| `GRANTS_DATA_SOURCE_ID` | Cached Grants Tracker data_source_id | resolved once from `databases.retrieve` |
| `NOTION_ORG_PROFILE_PAGE_ID` | Shared org-profile page (read-only input) | page id (share page with integration) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot auth | @BotFather `/newbot` — `123…:AA…` |
| `TELEGRAM_CHAT_ID` | Eman's chat id for unsolicited sends | captured on first `/start`, persisted |
| `GOOGLE_SA_JSON_PATH` | Path to service_account.json (not the key itself) | `C:\…\service_account.json` |
| `GDOCS_TEMPLATE_ID` | Master application template Doc id | Drive URL |
| `GDOCS_OUTPUT_FOLDER_ID` | Folder (shared with SA) for filled drafts | Drive URL |
| `TIMEZONE` | Reminder/digest timezone | `America/New_York` |

**Rules:** `.env` and `service_account.json` are git-ignored; commit only `.env.example` with key names. Never echo `NOTION_TOKEN` / SA key / bot token into logs or committed files. Notion source pages may hold plaintext creds — parse in memory, extract only non-secret grant fields, never persist raw block text (per the existing Rimawi constraint).

---

## 5. Open Risks / Decisions

- **501(c)(3)-PENDING gates real applications.** Discovery works today, but most foundations and federal code-12 opportunities require an *issued* determination letter or a fiscal sponsor. **Decision needed:** does DID have a fiscal sponsor? If yes, whole classes of "AFTER_501C3" grants become actionable now — the scoring buckets should read fiscal-sponsor status from config.
- **`chat_id` bootstrap.** Unsolicited T-7/digest sends require Eman to `/start` the bot once and the id persisted. If she never does, all scheduled sends silently no-op. Add a startup log/health check.
- **Single-instance enforcement.** Supervisor `.bat` + Task Scheduler must never double-launch (409 polling conflict). Consider a lockfile/named-mutex guard in `bot.py`.
- **Human-in-the-loop on drafts.** LLM-drafted applications must never auto-submit — the agent returns an *edit URL* for Eman's review. Confirm the workflow stops at "draft ready" and does not auto-share publicly (EIN/financials leak risk).
- **Notion single-writer.** No native upsert / unique constraint — if the scheduled scrape and an ad-hoc agent run overlap, duplicates appear. Serialize all writes through one code path and dedupe on a normalized title key.
- **PND/Cloudflare 403 & scraping ToS.** Foundation news via naive scraping is fragile and partly ToS-violating (Candid/Instrumentl gated). Commit to RSS/newsletter ingestion + ProPublica API; treat HTML browse pages as read-only leads to verify manually.
- **Classic vs Simpler Grants.gov.** Starting on no-auth classic `search2` is right for speed; revisit migrating to Simpler.Grants.gov (API key, richer structured data) if federal coverage/quality proves insufficient.
- **Google SA Drive quota & ownership.** SA-owned docs count against the SA's 15GB and aren't visible in Eman's Drive UI unless shared. **Decision:** share each draft to Eman's Gmail as Editor on creation, or place output folder under an account she controls.
- **Model cost/latency split.** Confirm the Opus-4.8-vs-Haiku-4.5 routing (Haiku for eligibility extraction/classification, Opus only for fit scoring + drafting) actually holds costs down at the expected grant volume; instrument token usage.
- **990-PF staleness.** Prospect lists reflect giving 1–2+ years old — always confirm current cycles on the funder's site before drafting.
- **Determination-letter trigger.** When DID's 501(c)(3) is approved, a config flip must re-bucket all "AFTER_501C3" rows to "OPEN_NOW." Build that re-classification as a one-shot command, not a manual Notion edit.