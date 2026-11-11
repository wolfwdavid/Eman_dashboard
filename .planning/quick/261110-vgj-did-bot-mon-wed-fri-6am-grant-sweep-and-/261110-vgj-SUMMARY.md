---
phase: quick-261110-vgj
plan: 01
subsystem: agent (Python Telegram bot)
tags: [scheduler, sweep, telegram, google-docs]
key-files:
  created: [agent/did_agent/sweep.py, agent/tests/test_sweep.py]
  modified: [agent/did_agent/main.py, agent/did_agent/tools/draft_application.py, agent/README.md, agent/Dockerfile, agent/deploy/oracle/docker-compose.yml, agent/.env.example]
decisions:
  - "Weekday numbering follows PTB (0=Sunday); MONDAY=(1,), MON_WED_FRI=(1,3,5)"
  - "Sweep state in data/local/sweep_state.json (SWEEP_STATE_PATH override), persisted via named volume sweep_state"
  - "Drafts cached per day so multiple chats share one set of Google Docs"
metrics:
  completed: 2026-11-10
---

# Quick 261110-vgj: Mon/Wed/Fri grant sweep and 8:45 message

Mon/Wed/Fri 06:00 ET sweep records newly found grants; 08:45 ET message sends a plain-text summary plus Google Doc draft links for up to 3 new OPEN_NOW grants; Monday digest now actually fires Monday (was Sunday via `days=(0,)`).

## Commits
- 27593d2 sweep.py, tests, `create_draft`/`DraftUnavailable` refactor
- 56dcf7b main.py wiring (morning_sweep, morning_message, digest weekday fix)
- 5eddb57 Dockerfile/compose volume, README, .env.example

- follow-up fix: "new" is measured against the previous sweep's stored `seen` keys (any date), falling back to the pre-scrape list when absent, because the midnight scrape makes the before/after diff nearly always empty. Message wording now "since the last sweep". State file stores `seen`; `load_previous_seen` reads it; README updated.

## Verification
`pytest -q tests`: 48 passed (after follow-up). `import did_agent.main` succeeds without starting the bot. No `days=(0,)` remains.

## Deviations
Three commits instead of one (per-task atomic commits). Otherwise as planned.

## Notes
Not deployed. Degradation paths: missing/stale/corrupt state -> "unavailable" message; Google unconfigured or a draft failing -> summary with one-line note; message trimmed to 4096 chars with "+K more". main.py job functions (closures) are not unit-tested; their logic lives in tested sweep.py.

## Self-Check: PASSED
