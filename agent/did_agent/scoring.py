"""Award-likelihood scoring (Phase 4) — OpenAI-compatible LLM with JSON output.

Estimates a 0-100 chance DID would be awarded a grant IF it submitted a strong application, tempered
hard by eligibility under the 501(c)(3)-PENDING constraint. Uses JSON mode + a required-key contract,
then clamps/validates in code so a small local model can't return an out-of-range score.
`actionable_now` is derived in code from the eligibility bucket (set from the funder's rules), not
from the model; the OPEN_NOW prompt withholds the legal/pending lines so a small model cannot fixate on them.
"""

from __future__ import annotations

import json

from openai import OpenAI

from did_agent.models import Grant

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
DID_HAS_FISCAL_SPONSOR = False  # flip to True (and re-score) once a sponsor is secured

_SYSTEM = (
    "You are a grants strategist scoring how likely Diversity Includes Disability (DID) is to WIN a "
    "given grant if it applied. Weight eligibility hardest, under DID's 501(c)(3)-PENDING status:\n"
    "- OPEN_NOW: DID can apply today. Score on fit, competition, amount realism, deadline feasibility.\n"
    "- VIA_FISCAL_SPONSOR: reachable ONLY with a fiscal sponsor. If DID has none, actionable_now=false "
    "and near-term odds are low until a sponsor is secured.\n"
    "- AFTER_501C3: needs an ISSUED IRS determination letter (pending does not count). actionable_now=false; "
    "near-term odds low.\n"
    "- UNKNOWN: note the eligibility uncertainty as a key factor.\n"
    "score = 0-100 realistic probability of an award given a strong application. Be candid, not optimistic; "
    "a great mission fit that DID can't yet apply for should score low on near-term odds."
)

_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer", "description": "0-100 realistic near-term award probability"},
        "likelihood": {"type": "string", "enum": ["Low", "Medium", "High"]},
        "actionable_now": {"type": "boolean", "description": "Can DID actually apply today?"},
        "rationale": {"type": "string", "description": "2-3 sentences, plain language for Eman"},
        "key_factors": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["score", "likelihood", "actionable_now", "rationale", "key_factors"],
    "additionalProperties": False,
}


def _prompt(grant: Grant, has_fiscal_sponsor: bool) -> str:
    if grant.bucket == "OPEN_NOW":
        org = f"ORG:\n{DID_ORG_PROFILE_BASE}\n{_OPEN_NOW_ELIGIBILITY}\n\n"
    else:
        org = f"ORG:\n{DID_ORG_PROFILE}\nDID currently has a fiscal sponsor: {has_fiscal_sponsor}.\n\n"
    return org + (
        f"GRANT:\n  Funder/Program: {grant.funder}\n  Type: {grant.type}\n"
        f"  Amount: {grant.amount_note or grant.amount}\n  Deadline: {grant.deadline_note or grant.deadline or 'unknown'}\n"
        f"  501(c)(3) required: {grant.requires_501c3}\n  Eligibility bucket: {grant.bucket}\n"
        f"  Fit/eligibility notes: {grant.fit_notes or 'n/a'}\n\n"
        "Score DID's near-term likelihood of winning this grant."
    )


_JSON_CONTRACT = (
    "Return ONLY a JSON object with exactly these keys: "
    '"score" (integer 0-100), "likelihood" ("Low"|"Medium"|"High"), '
    '"actionable_now" (boolean), "rationale" (string, 2-3 sentences), '
    '"key_factors" (array of short strings). No prose outside the JSON.'
)

# OPEN_NOW grants: the bucket (set in code from the funder's rules) already proves eligibility. Small
# models (llama3.2:3b) fixate on "PENDING"/"NOT yet secured" and tank the score, so the legal lines are
# withheld for this bucket and actionable_now is derived in code (_actionable), never from the model.
_OPEN_NOW_ELIGIBILITY = (
    "Eligibility for THIS grant is CONFIRMED: the funder requires no 501(c)(3) and no fiscal sponsor, "
    "so DID can apply today. Judge fit, competition, amount realism and deadline feasibility only."
)


def _coerce(data: dict) -> dict:
    try:
        score = int(float(data.get("score", 0)))
    except (TypeError, ValueError):
        score = 0
    return {
        "score": max(0, min(100, score)),
        "likelihood": data.get("likelihood") if data.get("likelihood") in ("Low", "Medium", "High") else "Low",
        "actionable_now": bool(data.get("actionable_now", False)),
        "rationale": str(data.get("rationale", "")).strip(),
        "key_factors": [str(x) for x in (data.get("key_factors") or [])][:8],
    }


def _actionable(bucket: str, has_fiscal_sponsor: bool, model_says: bool) -> bool:
    """Eligibility is a code-level fact (the bucket), not a model opinion. Only UNKNOWN defers to the model."""
    if bucket == "OPEN_NOW":
        return True
    if bucket == "VIA_FISCAL_SPONSOR":
        return bool(has_fiscal_sponsor)
    if bucket in ("AFTER_501C3", "NOT_ELIGIBLE"):
        return False
    return bool(model_says)


def score_grant(
    client: OpenAI,
    grant: Grant,
    model: str,
    has_fiscal_sponsor: bool = DID_HAS_FISCAL_SPONSOR,
) -> dict:
    resp = client.chat.completions.create(
        model=model,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _SYSTEM + "\n\n" + _JSON_CONTRACT},
            {"role": "user", "content": _prompt(grant, has_fiscal_sponsor)},
        ],
    )
    text = resp.choices[0].message.content or "{}"
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        data = {}
    result = _coerce(data)
    result["actionable_now"] = _actionable(grant.bucket, has_fiscal_sponsor, result["actionable_now"])
    return result
