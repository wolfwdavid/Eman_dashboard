# Quick 261113-pj6 Summary

Public chat now gets the whole knowledge file in a stable system prompt with visitor-safe wording and 6-message history; Telegram reminder/digest text is Markdown-escaped with a plain-text resend fallback.

## Commits
- e6071f7: public chat knowledge, prompt wording, history cap
- see git log for the Telegram Markdown commit (second)

## Deviations
None. The test for "SITE FACTS" is case-sensitive because the required prompt sentence legitimately contains lowercase "site facts".

## Result
Full suite: 140 passed (134 baseline + 6 new).

## Follow-up after merge (2026-11-13)
- Commits: e6071f7, 76ee4ec, then 2e6d05a. Checked against Telegram's live parser (owner chat only): escapes inside a `*bold*` span are shown literally, and `_ [` and backtick are literal there, so the bold funder name is no longer escaped; asterisks are stripped from it instead.
- The 2026-11-09 reminder text Telegram rejected is now accepted, with the underscore Google Doc link intact.
- New prompt tried on local llama3.2:3b: 1,722 prompt tokens; mission, donation, pricing and location questions answered correctly.
- Not deployed to the VM. One unidentified intermittent test failure in 1 of ~12 full-suite runs (not reproduced).
