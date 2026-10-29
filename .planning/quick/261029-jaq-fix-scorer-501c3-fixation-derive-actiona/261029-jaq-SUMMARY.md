---
phase: quick-261029-jaq
plan: 01
subsystem: agent/scoring
tags: [grant-scorer, llm-prompt, eligibility, tdd, did-agent]
requires: []
provides:
  - "DID_ORG_PROFILE_BASE / DID_ORG_PROFILE_LEGAL split (DID_ORG_PROFILE = BASE + LEGAL, byte-identical)"
  - "_actionable(bucket, has_fiscal_sponsor, model_says) — code-derived actionable_now"
  - "Bucket-aware _prompt: OPEN_NOW omits the 501(c)(3)-PENDING / no-fiscal-sponsor lines"
  - "agent/tests/test_scoring.py — 17 unit tests with a no-network FakeClient"
affects:
  - "agent/did_agent/tools/score_grant.py (consumes result['actionable_now'] — now trustworthy per bucket)"
  - "Telegram 'actionable now / NOT actionable yet' line and Notion score rows for OPEN_NOW grants"
tech-stack:
  added: []
  patterns:
    - "Eligibility is a code-level fact (bucket), never a model opinion; only UNKNOWN defers to the LLM"
    - "Withhold distracting facts from small-model prompts when the answer is already known in code"
    - "SimpleNamespace fake for OpenAI-compatible clients (records create() kwargs, returns canned content)"
key-files:
  created:
    - agent/tests/test_scoring.py
  modified:
    - agent/did_agent/scoring.py
decisions:
  - "actionable_now is overridden in score_grant after _coerce from grant.bucket; the model's boolean is used only for UNKNOWN"
  - "OPEN_NOW prompt = DID_ORG_PROFILE_BASE + one confirmed-eligibility sentence; all other buckets' prompts unchanged byte-for-byte"
  - "DID_ORG_PROFILE kept as BASE + LEGAL so draft_application.py's prompt is unaffected (SHA256 verified equal to pre-change)"
  - "Two commits (RED test module, then GREEN implementation) rather than the plan's single commit — follows the executor TDD protocol; each commit is self-contained"
metrics:
  duration: "~9 min"
  completed: "2026-10-29"
  tasks: 2
  tests_before: 16
  tests_after: 33
---

# Quick Task 261029-jaq: Fix scorer 501(c)(3) fixation — derive actionable_now from the bucket Summary

Grant scorer now derives `actionable_now` in code from the eligibility bucket and sends OPEN_NOW grants a prompt without the 501(c)(3)-PENDING / no-fiscal-sponsor lines, so llama3.2:3b can no longer flag an eligible grant as "NOT actionable yet".

## What was built

**`agent/did_agent/scoring.py`**
- `DID_ORG_PROFILE` split into `DID_ORG_PROFILE_BASE` (org description + Work) and `DID_ORG_PROFILE_LEGAL` (Legal / Fiscal sponsor / Funding). `DID_ORG_PROFILE = DID_ORG_PROFILE_BASE + DID_ORG_PROFILE_LEGAL` — SHA256 `761b0d6a…82f4` before and after, so `tools/draft_application.py` (which imports the full profile) is unaffected.
- New module constant `_OPEN_NOW_ELIGIBILITY` ("Eligibility for THIS grant is CONFIRMED: the funder requires no 501(c)(3) and no fiscal sponsor, so DID can apply today. Judge fit, competition, amount realism and deadline feasibility only.").
- `_prompt` chooses the ORG header by bucket: OPEN_NOW -> BASE + `_OPEN_NOW_ELIGIBILITY`; everything else -> the previous header verbatim. GRANT block and closing instruction shared.
- New `_actionable(bucket, has_fiscal_sponsor, model_says)`: OPEN_NOW -> True; VIA_FISCAL_SPONSOR -> `has_fiscal_sponsor`; AFTER_501C3 / NOT_ELIGIBLE -> False; otherwise (UNKNOWN) -> `bool(model_says)`.
- `score_grant` overrides `result["actionable_now"]` with `_actionable(...)` after `_coerce`. `score`, `likelihood`, `rationale`, `key_factors` and the return shape are untouched.
- Module docstring updated (two sentences) to describe the code-derived `actionable_now` and the OPEN_NOW prompt.

**`agent/tests/test_scoring.py`** (new, 17 tests)
- `FakeClient` — `types.SimpleNamespace` stub whose `chat.completions.create(**kwargs)` records kwargs and returns canned content. No `unittest.mock`, no network, no `openai` instantiation.
- Prompt content per bucket (OPEN_NOW omits legal lines + confirms eligibility; AFTER_501C3 / VIA_FISCAL_SPONSOR keep them), `DID_ORG_PROFILE == BASE + LEGAL`, 8-case parametrized `_actionable` table, four `score_grant` end-to-end cases (model-false override, NOT_ELIGIBLE forced false, UNKNOWN defers, bad-JSON still derives), `_coerce` clamping/defaults.

## Verification

- `cd agent && .venv/Scripts/python.exe -m pytest -q tests` -> **33 passed** (16 existing + 17 new; the plan's "26" counted the 8-case parametrize as one test).
- RED confirmed before implementation: `ImportError: cannot import name 'DID_ORG_PROFILE_BASE'` with the 16 existing tests still green.
- Compat one-liner from the plan passed (`DID_ORG_PROFILE` equality, prefix/suffix, `from did_agent.tools import draft_application` -> `compat ok`).
- `DID_ORG_PROFILE` SHA256 identical pre/post change (`761b0d6a02edf45e3cd4f47a6bba7ba3c460bd9222acc88a0237cb01b51d82f4`).
- Loaded the pre-change `scoring.py` from git and compared `_prompt` output for all 5 buckets x both `has_fiscal_sponsor` values: only OPEN_NOW differs; `_SYSTEM`, `_JSON_CONTRACT`, `_SCHEMA` unchanged.
- `grep -n PENDING agent/did_agent/scoring.py`: pre-existing docstring line, `DID_ORG_PROFILE_LEGAL`, `_SYSTEM`, and the plan-prescribed comment above `_OPEN_NOW_ELIGIBILITY` — never in `DID_ORG_PROFILE_BASE` or `_OPEN_NOW_ELIGIBILITY`.
- `git diff --stat` across both commits touches only `agent/did_agent/scoring.py` and `agent/tests/test_scoring.py`; models.py, notion_store, tools/, Dockerfile, deploy scripts, .env untouched. No deploy, no push.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 — RED: scoring tests with FakeClient | `f469ccc` | agent/tests/test_scoring.py |
| 2 — GREEN: bucket-derived actionable_now + OPEN_NOW prompt | `730a300` | agent/did_agent/scoring.py |

Both commit messages describe the change only (no AI-assistant mentions, no Co-Authored-By trailer).

## Deviations from Plan

**1. Two commits instead of one.** The plan's Task 2 said to land both files in a single commit; the executor TDD protocol and the orchestrator's "commit each task atomically" constraint call for a RED commit followed by a GREEN commit. Followed the latter — `f469ccc` (tests) then `730a300` (implementation). Net diff is identical to the single-commit version.

**2. Test count.** Plan expected 26 passing; actual is 33 because `test_actionable_rules` is parametrized over 8 cases. Nothing was added beyond the plan's listed tests.

No code deviations — scoring.py matches the locked design and action steps exactly.

## Known Stubs

None.

## Still-open follow-up

- **VM redeploy is NOT done.** The patched scorer runs only in this checkout; the Oracle VM still runs the pre-change `scoring.py`. Redeploy waits on laptop/VM `.env` reconciliation (Websites/Eman/NEXT-TASK.md item 4). After that, re-score the OPEN_NOW rows (e.g. Awesome Foundation Disability Chapter) so the Notion scores and the Telegram actionable line reflect the fix.
- `DID_HAS_FISCAL_SPONSOR` is still `False`; flip and re-score once a sponsor is secured (VIA_FISCAL_SPONSOR rows will become actionable automatically via `_actionable`).

## Self-Check: PASSED

- `agent/tests/test_scoring.py` — FOUND
- `agent/did_agent/scoring.py` contains `def _actionable(` and `DID_ORG_PROFILE = DID_ORG_PROFILE_BASE + DID_ORG_PROFILE_LEGAL` — FOUND
- Commits `f469ccc`, `730a300` — FOUND in `git log`
