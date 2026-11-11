---
phase: quick-261110-vgj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agent/did_agent/sweep.py
  - agent/did_agent/tools/draft_application.py
  - agent/did_agent/main.py
  - agent/tests/test_sweep.py
  - agent/README.md
  - agent/Dockerfile
  - agent/deploy/oracle/docker-compose.yml
autonomous: true
requirements: [QUICK-261110-vgj]
must_haves:
  truths:
    - "Mon/Wed/Fri 06:00 America/New_York a sweep runs (same 3 grants_gov queries as daily_scrape) and records which grants are new"
    - "Mon/Wed/Fri 08:45 America/New_York every allowed chat gets a fixed-format new-grants summary plus Google Doc draft links for up to 3 new OPEN_NOW grants"
    - "No new grants -> short 'no new grants this sweep' message is still sent"
    - "Missing/stale sweep state at 08:45 -> message says result unavailable, no invented data"
    - "Google Docs unconfigured or a draft fails -> summary still sent with a one-line note"
    - "Monday digest fires on Monday (was Sunday); midnight scrape and daily 9AM reminders unchanged"
  artifacts:
    - path: agent/did_agent/sweep.py
      provides: "weekday constants, diff, state file IO, top-N selection, formatter"
    - path: agent/tests/test_sweep.py
      provides: "offline pytest coverage"
  key_links:
    - from: agent/did_agent/main.py
      to: agent/did_agent/sweep.py
      via: "jq.run_daily(..., days=sweep.MON_WED_FRI)"
      pattern: "sweep\\.(MON_WED_FRI|MONDAY)"
---

<objective>
Add a Mon/Wed/Fri 06:00 ET grant sweep and a 08:45 ET Telegram summary-with-drafts message to the DID bot (agent/, separate Python project), and fix the digest weekday bug.

Findings verified in the installed library: `agent/.venv/Lib/site-packages/telegram/ext/_jobqueue.py` line 114 has `_CRON_MAPPING = ("sun","mon","tue","wed","thu","fri","sat")`, so the existing `days=(0,)` is SUNDAY and the "Monday digest" currently fires Sunday. Correct: Monday=(1,), Mon/Wed/Fri=(1,3,5).
Upsert key is the exact `Funder / Program` title (`NotionStore.upsert` -> `query_by_funder`), so `Grant.funder` is the stable diff key.

Output: new `sweep.py`, refactored draft helper, scheduler wiring, tests, README/compose updates.
Constraints: do NOT deploy, do NOT touch agent/.env, no real Telegram sends or real Google Docs. Commit messages must not mention AI assistants and must have no co-author trailer (overrides any default attribution).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@agent/did_agent/main.py
@agent/did_agent/reminders.py
@agent/did_agent/tools/draft_application.py
@agent/did_agent/models.py
@agent/did_agent/config.py

<interfaces>
Grant (models.py): funder, amount: float|None, amount_note, deadline: ISO str|None, deadline_note, bucket (OPEN_NOW|VIA_FISCAL_SPONSOR|AFTER_501C3|NOT_ELIGIBLE|UNKNOWN), score: float|None, next_action, link, status, source.
reminders.py: `days_until(g, today)`, `_TERMINAL` set.
NotionStore: `list_grants() -> list[Grant]` (blocking), `get_grant(funder)`.
draft_application.py: in `build(settings)`, closure `run` checks `settings.google_service_account_json` and `settings.google_template_doc_id`, calls `_draft_narrative(client, settings.llm_model_reasoning, grant, notes)`, builds `fields`, calls `google_docs.fill_application(sa_json, template_id, folder_id, fields, title=...)` which returns the URL. `client = make_client(settings)`.
main.py `_post_init`: `grace = {"misfire_grace_time": 3600}`; `jq.run_daily(fn, time=dtime(h,m,tzinfo=tz), days=..., chat_id=cid, name=..., job_kwargs=grace)`; `daily_scrape` loops queries "disability","accessibility","assistive technology" with `scrape_tool.run({"query": q, "sources": ["grants_gov"], "max_results": 8})` then `publish.publish(None, True, None)`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: sweep.py pure logic, tests, reusable draft helper</name>
  <files>agent/did_agent/sweep.py, agent/tests/test_sweep.py, agent/did_agent/tools/draft_application.py</files>
  <behavior>
    - Constants SUNDAY..SATURDAY = 0..6 (PTB 22.8 numbering); MONDAY=(1,), MON_WED_FRI=(1,3,5). Test maps them through ("sun","mon","tue","wed","thu","fri","sat") to "mon" and "mon,wed,fri" and asserts MONDAY != (0,).
    - new_grants(before, after): grants in `after` whose funder (strip+casefold) is absent from `before`; order preserved; unchanged/removed grants ignored.
    - save_state/load_state round trip via tmp_path JSON {"date": iso, "new": [dataclasses.asdict(grant)...]}; load_state(path, today) returns None for missing file, corrupt JSON, or date != today; save is atomic (temp file + os.replace) and creates parent dirs.
    - top_open_now(new, n=3): only bucket OPEN_NOW and status not in reminders._TERMINAL; sort score desc (None last), then deadline asc (None last), then funder; cap n.
    - format_sweep_message(new, drafts, today, state_ok=True, draft_note=""): state_ok False -> one line "Sweep result unavailable for {today} - nothing to report."; empty new -> "No new grants this sweep ({today})."; otherwise header "New grants from this morning's sweep ({today}): N" then per grant: funder, amount ($ formatted, else amount_note, else "TBD"), deadline (deadline or deadline_note or "none listed", plus "N days left" via reminders.days_until when parseable), eligibility bucket, link, suggested next step (grant.next_action else a bucket-based default, e.g. OPEN_NOW "Review fit and start a draft"). Then a "Drafts ready" section "funder: url" per drafts dict entry, and the draft_note line if non-empty. Cases tested: with/without new grants, with/without drafts, with draft_note, state unavailable.
  </behavior>
  <action>
    Write tests first in `agent/tests/test_sweep.py` (pytest, offline, fixed `date(2026, 11, 13)`, Grants built inline, no network/Notion), then implement.

    Create `agent/did_agent/sweep.py`: pure, imports only stdlib + did_agent.models + did_agent.reminders (no Telegram/Notion). Provide the constants and functions above plus `DEFAULT_STATE_PATH`: `SWEEP_STATE_PATH` env var if set, else `data/local/sweep_state.json` resolved against the agent root (`Path(__file__).resolve().parents[1]`); `data/local/` is already gitignored in agent/.gitignore. Output plain text (main.py will send WITHOUT parse_mode since funder names/URLs contain Markdown-special characters). Trim to Telegram's 4096-char limit by dropping trailing grants and adding a "+K more" line.

    Refactor `draft_application.py` minimally: add `class DraftUnavailable(Exception)` and module-level `create_draft(settings, client, grant, notes="") -> str` holding the Google-configured check (raise DraftUnavailable with the existing "Google Docs isn't configured yet..." message), narrative generation, fields dict and the `google_docs.fill_application` call, returning the URL. `run` keeps `store.get_grant` and delegates to `create_draft`, catching DraftUnavailable to return its message; every return string stays byte-identical. The sweep calls `create_draft` directly (not through the LLM tool loop).
  </action>
  <verify>
    <automated>cd agent && .venv/Scripts/python.exe -m pytest -q tests</automated>
  </verify>
  <done>Existing and new tests pass; draft_application.run behavior unchanged; sweep.py importable with no network.</done>
</task>

<task type="auto">
  <name>Task 2: Wire sweep + message jobs in main.py, fix digest weekday</name>
  <files>agent/did_agent/main.py</files>
  <action>
    Import `sweep` and `draft_application` (module) in main.py. Add `from did_agent.llm.client import make_client` alongside the existing llm.client import.

    Refactor the three-query scrape loop into a local helper `_run_queries()` used by both `daily_scrape` (behavior unchanged) and the new job.

    New job `morning_sweep(_ctx)` (global, not per chat): `before = await asyncio.to_thread(store.list_grants)`; if that raises, log and return WITHOUT writing state (08:45 then reports unavailable). Run `_run_queries()`, then `after = list_grants()`; `new = sweep.new_grants(before, after)`; `sweep.save_state(path, today_in_tz, new)` where today is `datetime.now(tz).date()` (do not use naive `date.today()` for this; container TZ may be UTC). Then run the dashboard `publish.publish(None, True, None)` in try/except like daily_scrape. Guard: if `before` is empty and `after` is non-empty (first run / Notion read glitch) still save, since it is a real diff; but if the second list_grants call fails, do not save state.

    New job `morning_message(ctx)` per chat (chat_id from `ctx.job.chat_id`): `today = datetime.now(tz).date()`; `new = sweep.load_state(path, today)`. If None -> send `sweep.format_sweep_message([], {}, today, state_ok=False)`. Else compute `top = sweep.top_open_now(new)`; if `top` non-empty: if `settings.google_service_account_json` and `settings.google_template_doc_id` are set, build `client = make_client(settings)` once and for each grant in `top` call `await asyncio.to_thread(draft_application.create_draft, settings, client, g)` inside try/except per grant (log.exception; collect failures); set `draft_note` to one line like "Draft links unavailable: Google Docs is not configured." or "Could not create a draft for: A, B." when applicable. Drafts for the same sweep are created once per fire per chat; to avoid duplicate Docs when there are 2+ chats, cache the drafts dict in a closure variable keyed by today's date (`_drafts_cache = {"date": None, "drafts": {}, "note": ""}`) so the second chat reuses it. Send via `ctx.bot.send_message(chat_id=..., text=text)` with NO parse_mode. Never create/send anything at import or during tests.

    Scheduling in `_post_init`: after the existing `daily_scrape` registration add `jq.run_daily(morning_sweep, time=dtime(6, 0, tzinfo=tz), days=sweep.MON_WED_FRI, name="morning-sweep", job_kwargs=grace)` and log "Scheduled Mon/Wed/Fri 6:00AM (%s) grant sweep." Inside the per-chat loop keep `deadline_sweep` as is, change the digest to `days=sweep.MONDAY` (fixes the Sunday bug), and add `jq.run_daily(morning_message, time=dtime(8, 45, tzinfo=tz), days=sweep.MON_WED_FRI, chat_id=cid, name=f"sweep-message-{cid}", job_kwargs=grace)`. Change the final log to `Scheduled daily reminders + Monday 9AM digest + Mon/Wed/Fri 8:45AM sweep message for %d chat(s).` Keep `grace`. Update the on_start text only if it mentions the schedule (leave as is otherwise).

    Add a lightweight check that main imports cleanly: `python -c "import did_agent.main"` must not start the bot (main() is guarded by __main__).
  </action>
  <verify>
    <automated>cd agent && .venv/Scripts/python.exe -c "import did_agent.main" && .venv/Scripts/python.exe -m pytest -q tests</automated>
  </verify>
  <done>main.py imports; digest uses sweep.MONDAY; morning-sweep (06:00) and sweep-message (08:45) registered with MON_WED_FRI; message job sends plain text, degrades on missing state / missing Google config / draft failure; midnight scrape and 9AM reminders untouched.</done>
</task>

<task type="auto">
  <name>Task 3: Persist state in Docker, update README, commit</name>
  <files>agent/README.md, agent/Dockerfile, agent/deploy/oracle/docker-compose.yml</files>
  <action>
    State persistence: the container filesystem survives `restart` but not recreate; add a named volume. In `agent/Dockerfile`, next to the existing `mkdir -p /home/user/.cache` RUN, also `mkdir -p /home/user/app/data/local` and chown to user (so a fresh named volume mounted there inherits ownership). In `agent/deploy/oracle/docker-compose.yml` under agent `volumes:` add `- sweep_state:/home/user/app/data/local` and declare `sweep_state:` in the top-level `volumes:`. Do not run docker or deploy. Code already falls back gracefully (unwritable/missing state -> sweep.save_state failures are logged in main.py, and 08:45 reports "unavailable").

    README (`agent/README.md`): update line ~22 schedule description and line ~40 `schedule.py` note to read: midnight scrape, daily 9AM deadline reminders, Monday 9AM digest (now actually Monday; note it previously fired Sunday), Mon/Wed/Fri 6:00AM ET grant sweep, Mon/Wed/Fri 8:45AM ET Telegram message (new-grant summary + Google Doc draft links for up to 3 new OPEN_NOW grants, "no new grants" message when empty, "unavailable" message if the sweep state is missing). Update the healthy startup log line (~93) to `Scheduled daily reminders + Monday 9AM digest + Mon/Wed/Fri 8:45AM sweep message for N chat(s)` and mention the `Scheduled Mon/Wed/Fri 6:00AM (America/New_York) grant sweep.` line. Document optional env var `SWEEP_STATE_PATH` (default `data/local/sweep_state.json`, gitignored; compose mounts the `sweep_state` volume there). Mention drafts need GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_TEMPLATE_DOC_ID and degrade gracefully otherwise. Optionally add `SWEEP_STATE_PATH` as a commented line in `agent/.env.example` if that file exists (never touch `agent/.env`).

    Then run the full test suite and commit only the files from this plan (git add by explicit path) with a message like `feat(agent): Mon/Wed/Fri grant sweep and 8:45 new-grants message; fix Monday digest weekday`. No AI/assistant mention, no co-author trailer.
  </action>
  <verify>
    <automated>cd agent && .venv/Scripts/python.exe -m pytest -q tests && git status --short | grep -v "^??" | head</automated>
  </verify>
  <done>README describes the new schedule, log line and env var; compose/Dockerfile persist data/local; tests pass; one clean commit with only the planned files.</done>
</task>

</tasks>

<verification>
- `cd agent && .venv/Scripts/python.exe -m pytest -q tests` all green.
- `grep -n "days=(0,)" agent/did_agent/main.py` returns nothing.
- No change to agent/.env; no deploy; no real network sends performed.
</verification>

<success_criteria>
Sweep at 06:00 and message at 08:45 ET on Mon/Wed/Fri, digest on Monday, graceful degradation paths covered by tests, README updated, committed.
</success_criteria>

<output>
Create `.planning/quick/261110-vgj-did-bot-mon-wed-fri-6am-grant-sweep-and-/261110-vgj-SUMMARY.md` when done
</output>
