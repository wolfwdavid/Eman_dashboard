---
phase: quick-261029-jaq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agent/did_agent/scoring.py
  - agent/tests/test_scoring.py
autonomous: true
requirements: [QUICK-261029-JAQ]
must_haves:
  truths:
    - "An OPEN_NOW grant scored by score_grant always reports actionable_now=True, regardless of what the model returned"
    - "An AFTER_501C3 or NOT_ELIGIBLE grant always reports actionable_now=False, regardless of what the model returned"
    - "A VIA_FISCAL_SPONSOR grant reports actionable_now equal to has_fiscal_sponsor; an UNKNOWN grant defers to the model's answer"
    - "The user prompt sent to the model for an OPEN_NOW grant contains no 501(c)(3)-PENDING / no-fiscal-sponsor lines and states eligibility is confirmed"
    - "Prompts for every other bucket are unchanged from today, and DID_ORG_PROFILE (imported by draft_application.py) is the same string as before"
    - "All pre-existing tests (16) plus the new scoring tests pass with the agent venv"
  artifacts:
    - path: "agent/did_agent/scoring.py"
      provides: "DID_ORG_PROFILE_BASE, DID_ORG_PROFILE_LEGAL, DID_ORG_PROFILE (= BASE + LEGAL), bucket-aware _prompt, _actionable, score_grant override"
      contains: "def _actionable("
    - path: "agent/tests/test_scoring.py"
      provides: "Fake OpenAI-compatible client + unit tests for prompt content, actionable override per bucket, _coerce clamping"
      min_lines: 60
  key_links:
    - from: "agent/did_agent/scoring.py::score_grant"
      to: "agent/did_agent/scoring.py::_actionable"
      via: "result['actionable_now'] overridden after _coerce"
      pattern: "actionable_now\\\"\\] = _actionable\\("
    - from: "agent/did_agent/scoring.py::_prompt"
      to: "grant.bucket"
      via: "OPEN_NOW branch selects DID_ORG_PROFILE_BASE + confirmed-eligibility sentence"
      pattern: "bucket == \\\"OPEN_NOW\\\""
    - from: "agent/did_agent/tools/draft_application.py"
      to: "agent/did_agent/scoring.py::DID_ORG_PROFILE"
      via: "existing import must keep resolving to the full (BASE + LEGAL) profile"
      pattern: "DID_ORG_PROFILE = DID_ORG_PROFILE_BASE \\+ DID_ORG_PROFILE_LEGAL"
---

<objective>
Stop the grant scorer from under-rating OPEN_NOW grants because of DID's pending 501(c)(3).

With the configured model (llama3.2:3b), `score_grant` returns score 20 / `actionable_now=false` for grants whose bucket is `OPEN_NOW` and whose `requires_501c3` is "No" (e.g. an individual fellowship), citing the pending 501(c)(3). Prompt strengthening did not fix it. The bucket already encodes eligibility (set in code from the funder's rules), so `actionable_now` must be derived in code from the bucket, and the OPEN_NOW user prompt must omit the legal/pending lines so a small model has nothing to fixate on.

Purpose: Eman's Notion scores and the "actionable now / NOT actionable yet" line in the Telegram reply must be trustworthy for the grants DID can actually apply to today.
Output: Patched `agent/did_agent/scoring.py` + new `agent/tests/test_scoring.py`; full agent suite green (16 existing + new).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@agent/did_agent/scoring.py
@agent/did_agent/models.py
@agent/did_agent/tools/score_grant.py
@agent/tests/test_public_agent.py

<locked_design>
Source: Websites/Eman/NEXT-TASK.md, final section "Follow-up (added 2026-10-29) — fix the scorer's 501c3 fixation". Non-negotiable:

1. Split `DID_ORG_PROFILE` into `DID_ORG_PROFILE_BASE` + `DID_ORG_PROFILE_LEGAL`; keep `DID_ORG_PROFILE = DID_ORG_PROFILE_BASE + DID_ORG_PROFILE_LEGAL` for compatibility. For `grant.bucket == "OPEN_NOW"`, `_prompt` uses BASE plus one sentence stating eligibility for this grant is confirmed, the funder requires no 501(c)(3) or fiscal sponsor, judge fit and odds only. Other buckets keep the current prompt verbatim.
2. Add `_actionable(bucket, has_fiscal_sponsor, model_says) -> bool`: OPEN_NOW -> True; VIA_FISCAL_SPONSOR -> has_fiscal_sponsor; AFTER_501C3 / NOT_ELIGIBLE -> False; anything else (UNKNOWN) -> model_says.
3. In `score_grant`, after `_coerce`, override `result["actionable_now"]` with `_actionable(...)`.
4. New `agent/tests/test_scoring.py` with a fake OpenAI-compatible client.

Non-goals: NO changes to models.py, notion_store, tools/, Dockerfile, deploy scripts, or `_SYSTEM`; no redeploy (VM redeploy waits on .env reconciliation per NEXT-TASK.md item 4).
</locked_design>

<interfaces>
<!-- Everything the executor needs; no codebase exploration required. -->

From agent/did_agent/models.py (do NOT modify):
```python
BUCKET_OPTIONS = ["OPEN_NOW", "VIA_FISCAL_SPONSOR", "AFTER_501C3", "NOT_ELIGIBLE", "UNKNOWN"]

@dataclass
class Grant:
    funder: str
    type: str = "Grant"
    amount: float | None = None
    amount_note: str = ""
    deadline: str | None = None
    deadline_note: str = ""
    requires_501c3: str = "Unknown"   # one of C3_OPTIONS: Yes / No / Or fiscal sponsor / Unknown
    bucket: str = "UNKNOWN"           # one of BUCKET_OPTIONS
    fit_notes: str = ""
    # ... status, next_action, link, score, rationale, source
```

From agent/did_agent/scoring.py — CURRENT state (lines 17-23, 53-61, 86-106):
```python
DID_ORG_PROFILE = (
    "Diversity Includes Disability (DID) — a disability-equity venture founded by Eman Rimawi (NYC). "
    "Work: disability trainings, consulting, representation modeling, and speaking. "
    "Legal: S-corp LLC with 501(c)(3) status PENDING (no IRS determination letter yet). "
    "Fiscal sponsor: NOT yet secured (pursuing the Fund for the City of NY / NY Community Trust pathway). "
    "Funding: sole current funder is NY Community Trust ($20k, 2025). Very small / early-stage."
)
DID_HAS_FISCAL_SPONSOR = False

def _prompt(grant: Grant, has_fiscal_sponsor: bool) -> str:
    return (
        f"ORG:\n{DID_ORG_PROFILE}\nDID currently has a fiscal sponsor: {has_fiscal_sponsor}.\n\n"
        f"GRANT:\n  Funder/Program: {grant.funder}\n  Type: {grant.type}\n"
        f"  Amount: {grant.amount_note or grant.amount}\n  Deadline: {grant.deadline_note or grant.deadline or 'unknown'}\n"
        f"  501(c)(3) required: {grant.requires_501c3}\n  Eligibility bucket: {grant.bucket}\n"
        f"  Fit/eligibility notes: {grant.fit_notes or 'n/a'}\n\n"
        "Score DID's near-term likelihood of winning this grant."
    )

def score_grant(client: OpenAI, grant: Grant, model: str, has_fiscal_sponsor: bool = DID_HAS_FISCAL_SPONSOR) -> dict:
    resp = client.chat.completions.create(model=model, temperature=0, response_format={"type": "json_object"}, messages=[...])
    text = resp.choices[0].message.content or "{}"
    try: data = json.loads(text)
    except json.JSONDecodeError: data = {}
    return _coerce(data)
```
`_coerce(data)` returns `{"score": int 0-100, "likelihood": "Low"|"Medium"|"High", "actionable_now": bool, "rationale": str, "key_factors": list[str] (max 8)}`.

External importers of scoring (compatibility surface):
- `agent/did_agent/tools/draft_application.py:14` — `from did_agent.scoring import DID_ORG_PROFILE` (uses the FULL profile in its own prompt; must remain the same string).
- `agent/did_agent/tools/score_grant.py:8` — `from did_agent.scoring import score_grant as run_score`; reads `result["score"]`, `result["likelihood"]`, `result["rationale"]`, `result.get("key_factors")`, `result.get("actionable_now")`. Return shape must not change.

Existing test style (agent/tests/test_public_agent.py): plain pytest functions, no fixtures/conftest, `from did_agent... import ...`.
</interfaces>

<test_runner>
Run from the `agent/` directory (running from repo root fails with `ModuleNotFoundError: No module named 'did_agent'`):

```
cd C:/Users/Mkaru/Documents/Hello_World/hugginface_profile/Websites/Eman/Eman_dashboard/agent && .venv/Scripts/python.exe -m pytest -q tests
```
Baseline verified 2026-10-29: `16 passed`.
</test_runner>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write the failing scoring tests with a fake OpenAI-compatible client</name>
  <files>agent/tests/test_scoring.py</files>
  <behavior>
    Fake client: a class whose `chat.completions.create(**kwargs)` records `kwargs` (so tests can inspect the `messages` list) and returns an object with `.choices[0].message.content` equal to a caller-supplied string. Use `types.SimpleNamespace` for the nested stubs — no `unittest.mock`, no network, no `openai` instantiation.

    Tests (plain pytest functions, matching test_public_agent.py style):
    - test_open_now_prompt_omits_legal_lines_and_confirms_eligibility: `_prompt(Grant(funder="Awesome Foundation Disability Chapter", requires_501c3="No", bucket="OPEN_NOW"), False)` -> "PENDING" NOT in text; "NOT yet secured" NOT in text; "currently has a fiscal sponsor" NOT in text; "confirmed" IN text.lower(); "Eman Rimawi" IN text (BASE facts kept); "Funder/Program: Awesome Foundation" IN text (GRANT block kept).
    - test_after_501c3_prompt_keeps_legal_lines: same with bucket="AFTER_501C3", requires_501c3="Yes" -> "PENDING" IN text AND "DID currently has a fiscal sponsor: False" IN text.
    - test_via_fiscal_sponsor_prompt_unchanged: bucket="VIA_FISCAL_SPONSOR" -> "PENDING" IN text (other buckets untouched).
    - test_profile_constant_is_base_plus_legal: `DID_ORG_PROFILE == DID_ORG_PROFILE_BASE + DID_ORG_PROFILE_LEGAL` AND "PENDING" in DID_ORG_PROFILE AND "PENDING" not in DID_ORG_PROFILE_BASE (draft_application compatibility).
    - test_actionable_rules (pytest.mark.parametrize over (bucket, has_sponsor, model_says, expected)):
        ("OPEN_NOW", False, False, True), ("OPEN_NOW", False, True, True),
        ("VIA_FISCAL_SPONSOR", False, True, False), ("VIA_FISCAL_SPONSOR", True, False, True),
        ("AFTER_501C3", True, True, False), ("NOT_ELIGIBLE", True, True, False),
        ("UNKNOWN", False, True, True), ("UNKNOWN", False, False, False).
    - test_score_grant_open_now_overrides_model_false: fake content = json.dumps({"score": 20, "likelihood": "Low", "actionable_now": False, "rationale": "501c3 pending", "key_factors": ["pending"]}); bucket OPEN_NOW -> result["actionable_now"] is True; result["score"] == 20 (score NOT altered by this change); the recorded user message (`calls[0]["messages"][1]["content"]`) does NOT contain "PENDING".
    - test_score_grant_not_eligible_forces_false: content actionable_now True, bucket NOT_ELIGIBLE -> False.
    - test_score_grant_unknown_defers_to_model: content actionable_now True, bucket UNKNOWN -> True.
    - test_score_grant_bad_json_still_derives_actionable: content "not json at all", bucket OPEN_NOW -> score 0, likelihood "Low", actionable_now True.
    - test_coerce_clamps_and_defaults: `_coerce({"score": 250})["score"] == 100`; `_coerce({"score": -5})["score"] == 0`; `_coerce({"score": "abc"})["score"] == 0`; `_coerce({"score": "42.7"})["score"] == 42`; `_coerce({"likelihood": "Maybe"})["likelihood"] == "Low"`; `len(_coerce({"key_factors": list(range(12))})["key_factors"]) == 8`; `_coerce({})["actionable_now"] is False`.
  </behavior>
  <action>
    Create `agent/tests/test_scoring.py`. Imports: `import json`, `from types import SimpleNamespace`, `import pytest`, `from did_agent.models import Grant`, `from did_agent.scoring import (DID_ORG_PROFILE, DID_ORG_PROFILE_BASE, DID_ORG_PROFILE_LEGAL, _actionable, _coerce, _prompt, score_grant)`.

    Fake client sketch (keep it this small):
    ```python
    class FakeClient:
        """Minimal OpenAI-compatible stub: records create() kwargs, returns canned content."""
        def __init__(self, content: str):
            self.calls: list[dict] = []
            def create(**kwargs):
                self.calls.append(kwargs)
                return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))
    ```
    Helper `_grant(bucket, c3="No")` returning `Grant(funder="Awesome Foundation Disability Chapter", requires_501c3=c3, bucket=bucket)`.

    Write every test listed in <behavior>. Pass `has_fiscal_sponsor` explicitly in `score_grant(...)` calls (default is False; be explicit so the VIA_FISCAL_SPONSOR/UNKNOWN cases read clearly). Use the model name "fake-model" — it is never dereferenced.

    RED step: run the suite; the new module must FAIL at import (ImportError for `DID_ORG_PROFILE_BASE` / `_actionable`) — the 16 existing tests must still pass. Do not touch scoring.py in this task.
  </action>
  <verify>
    <automated>cd C:/Users/Mkaru/Documents/Hello_World/hugginface_profile/Websites/Eman/Eman_dashboard/agent && .venv/Scripts/python.exe -m pytest -q tests/test_scoring.py 2>&1 | grep -E "ImportError|cannot import name" </automated>
  </verify>
  <done>`agent/tests/test_scoring.py` exists, imports only `did_agent.*`, `json`, `types`, `pytest`; collection fails with an ImportError naming a not-yet-existing symbol (`DID_ORG_PROFILE_BASE` or `_actionable`); `pytest -q tests/test_public_agent.py tests/test_site_knowledge.py` still reports 16 passed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Derive actionable_now from the bucket and strip legal lines from the OPEN_NOW prompt</name>
  <files>agent/did_agent/scoring.py</files>
  <behavior>
    - `DID_ORG_PROFILE_BASE` = the first two sentences of today's profile (org description + "Work: ..."), ending with a trailing space exactly as today.
    - `DID_ORG_PROFILE_LEGAL` = the remaining three sentences verbatim ("Legal: ... PENDING ...", "Fiscal sponsor: NOT yet secured ...", "Funding: ..."), with no leading space.
    - `DID_ORG_PROFILE = DID_ORG_PROFILE_BASE + DID_ORG_PROFILE_LEGAL` — byte-identical to the current constant (draft_application.py keeps importing it; its prompt must not change).
    - `_prompt(grant, has_fiscal_sponsor)`: when `grant.bucket == "OPEN_NOW"`, the ORG header is `f"ORG:\n{DID_ORG_PROFILE_BASE}\n{_OPEN_NOW_ELIGIBILITY}\n\n"` where `_OPEN_NOW_ELIGIBILITY` is one sentence: "Eligibility for THIS grant is CONFIRMED: the funder requires no 501(c)(3) and no fiscal sponsor, so DID can apply today. Judge fit, competition, amount realism and deadline feasibility only." For every other bucket the header is today's `f"ORG:\n{DID_ORG_PROFILE}\nDID currently has a fiscal sponsor: {has_fiscal_sponsor}.\n\n"` — unchanged. The GRANT block and closing instruction are shared and unchanged for all buckets.
    - `_actionable(bucket: str, has_fiscal_sponsor: bool, model_says: bool) -> bool`: `"OPEN_NOW" -> True`; `"VIA_FISCAL_SPONSOR" -> has_fiscal_sponsor`; `"AFTER_501C3"` or `"NOT_ELIGIBLE" -> False`; anything else -> `bool(model_says)`.
    - `score_grant`: after `result = _coerce(data)`, set `result["actionable_now"] = _actionable(grant.bucket, has_fiscal_sponsor, result["actionable_now"])` and return `result`. Return shape unchanged; `score`, `likelihood`, `rationale`, `key_factors` untouched.
  </behavior>
  <action>
    Edit `agent/did_agent/scoring.py` only (per the locked design; `_SYSTEM`, `_SCHEMA`, `_JSON_CONTRACT`, `_coerce`, `DID_HAS_FISCAL_SPONSOR` stay as they are).

    1. Replace the `DID_ORG_PROFILE = (...)` block with three constants:
       ```python
       # Non-secret org facts (no EIN / address / creds — those never leave Notion).
       DID_ORG_PROFILE_BASE = (
           "Diversity Includes Disability (DID) — a disability-equity venture founded by Eman Rimawi (NYC). "
           "Work: disability trainings, consulting, representation modeling, and speaking. "
       )
       DID_ORG_PROFILE_LEGAL = (
           "Legal: S-corp LLC with 501(c)(3) status PENDING (no IRS determination letter yet). "
           "Fiscal sponsor: NOT yet secured (pursuing the Fund for the City of NY / NY Community Trust pathway). "
           "Funding: sole current funder is NY Community Trust ($20k, 2025). Very small / early-stage."
       )
       # Full profile (BASE + LEGAL) — imported by tools/draft_application.py; keep the combined text unchanged.
       DID_ORG_PROFILE = DID_ORG_PROFILE_BASE + DID_ORG_PROFILE_LEGAL
       ```
       Also add, next to `_JSON_CONTRACT`, the module constant:
       ```python
       # OPEN_NOW grants: the bucket (set in code from the funder's rules) already proves eligibility. Small
       # models (llama3.2:3b) fixate on "PENDING"/"NOT yet secured" and tank the score, so the legal lines are
       # withheld for this bucket and actionable_now is derived in code (_actionable), never from the model.
       _OPEN_NOW_ELIGIBILITY = (
           "Eligibility for THIS grant is CONFIRMED: the funder requires no 501(c)(3) and no fiscal sponsor, "
           "so DID can apply today. Judge fit, competition, amount realism and deadline feasibility only."
       )
       ```
    2. Rewrite `_prompt` so the ORG header is chosen by bucket and the GRANT block is shared:
       ```python
       def _prompt(grant: Grant, has_fiscal_sponsor: bool) -> str:
           if grant.bucket == "OPEN_NOW":
               org = f"ORG:\n{DID_ORG_PROFILE_BASE}\n{_OPEN_NOW_ELIGIBILITY}\n\n"
           else:
               org = f"ORG:\n{DID_ORG_PROFILE}\nDID currently has a fiscal sponsor: {has_fiscal_sponsor}.\n\n"
           return org + (
               f"GRANT:\n  Funder/Program: {grant.funder}\n  Type: {grant.type}\n"
               ...existing GRANT lines verbatim...
               "Score DID's near-term likelihood of winning this grant."
           )
       ```
    3. Add `_actionable` after `_coerce`:
       ```python
       def _actionable(bucket: str, has_fiscal_sponsor: bool, model_says: bool) -> bool:
           """Eligibility is a code-level fact (the bucket), not a model opinion. Only UNKNOWN defers to the model."""
           if bucket == "OPEN_NOW":
               return True
           if bucket == "VIA_FISCAL_SPONSOR":
               return bool(has_fiscal_sponsor)
           if bucket in ("AFTER_501C3", "NOT_ELIGIBLE"):
               return False
           return bool(model_says)
       ```
    4. In `score_grant`, replace the final `return _coerce(data)` with:
       ```python
       result = _coerce(data)
       result["actionable_now"] = _actionable(grant.bucket, has_fiscal_sponsor, result["actionable_now"])
       return result
       ```
    5. Update the module docstring's second paragraph to mention that `actionable_now` is derived from the eligibility bucket in code and the OPEN_NOW prompt withholds the legal lines (two sentences max).

    GREEN step: run the full suite — expect 16 + the new tests all passing (26 total). Then sanity-check the compatibility surface: `.venv/Scripts/python.exe -c "from did_agent.tools import draft_application"` must import cleanly (it pulls `DID_ORG_PROFILE`).

    Commit as ONE commit with both files, message: `agent: derive actionable_now from the eligibility bucket and drop legal lines from the OPEN_NOW scoring prompt` (describe the change only; no AI-assistant mentions, no Co-Authored-By trailer — user's global policy overrides the default attribution reminder). Do NOT redeploy to the VM (NEXT-TASK.md item 4 gates that on .env reconciliation).
  </action>
  <verify>
    <automated>cd C:/Users/Mkaru/Documents/Hello_World/hugginface_profile/Websites/Eman/Eman_dashboard/agent && .venv/Scripts/python.exe -m pytest -q tests && .venv/Scripts/python.exe -c "from did_agent.scoring import DID_ORG_PROFILE, DID_ORG_PROFILE_BASE, DID_ORG_PROFILE_LEGAL; assert DID_ORG_PROFILE == DID_ORG_PROFILE_BASE + DID_ORG_PROFILE_LEGAL and DID_ORG_PROFILE.startswith('Diversity Includes Disability (DID)') and DID_ORG_PROFILE.endswith('Very small / early-stage.'); from did_agent.tools import draft_application; print('compat ok')"</automated>
  </verify>
  <done>Full suite reports 26 passed (16 existing + 10 new); `DID_ORG_PROFILE` text unchanged and `draft_application` imports; `git diff --stat` touches only `agent/did_agent/scoring.py` and `agent/tests/test_scoring.py`; one commit on the branch with the specified message and no AI attribution.</done>
</task>

</tasks>

<verification>
- `cd agent && .venv/Scripts/python.exe -m pytest -q tests` -> 26 passed, 0 failed, 0 errors.
- `git show --stat HEAD` lists exactly `agent/did_agent/scoring.py` and `agent/tests/test_scoring.py`; `git show -s --format=%B HEAD` contains no "Claude", "AI", or "Co-Authored-By".
- `grep -n "PENDING" agent/did_agent/scoring.py` -> only inside `DID_ORG_PROFILE_LEGAL` and `_SYSTEM` (never in `DID_ORG_PROFILE_BASE` or `_OPEN_NOW_ELIGIBILITY`).
- models.py, notion_store.py, tools/, Dockerfile, deploy scripts: `git status --short` shows them untouched.
</verification>

<success_criteria>
- For an OPEN_NOW grant, `score_grant` returns `actionable_now=True` even when the model's JSON says false, and the user prompt it sent contains no "PENDING" / "NOT yet secured" / "currently has a fiscal sponsor" text.
- AFTER_501C3 and NOT_ELIGIBLE always return `actionable_now=False`; VIA_FISCAL_SPONSOR mirrors `has_fiscal_sponsor`; UNKNOWN defers to the model.
- Non-OPEN_NOW prompts and `DID_ORG_PROFILE` are byte-for-byte what they were, so `draft_application` behaviour is unaffected.
- `_coerce` clamping/defaults unchanged and now covered by tests.
- No files outside the two listed are modified; no redeploy performed.
</success_criteria>

<output>
After completion, create `.planning/quick/261029-jaq-fix-scorer-501c3-fixation-derive-actiona/261029-jaq-SUMMARY.md` recording: the two files changed, the test count delta (16 -> 26), the commit hash, and the still-open follow-up that the VM redeploy waits on laptop/VM .env reconciliation (NEXT-TASK.md item 4).
</output>
