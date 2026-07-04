"""Award-likelihood scoring (Phase 4) — Opus 4.8 with structured output.

Estimates a 0-100 chance DID would be awarded a grant IF it submitted a strong application, tempered
hard by eligibility under the 501(c)(3)-PENDING constraint. Uses structured outputs (json_schema) so
the result is always valid JSON — no fragile parsing.
"""

from __future__ import annotations

import json

import anthropic

from did_agent.config import MODEL_REASONING
from did_agent.models import Grant

# Non-secret org facts (no EIN / address / creds — those never leave Notion).
DID_ORG_PROFILE = (
    "Diversity Includes Disability (DID) — a disability-equity venture founded by Eman Rimawi (NYC). "
    "Work: disability trainings, consulting, representation modeling, and speaking. "
    "Legal: S-corp LLC with 501(c)(3) status PENDING (no IRS determination letter yet). "
    "Fiscal sponsor: NOT yet secured (pursuing the Fund for the City of NY / NY Community Trust pathway). "
    "Funding: sole current funder is NY Community Trust ($20k, 2025). Very small / early-stage."
)
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
    return (
        f"ORG:\n{DID_ORG_PROFILE}\nDID currently has a fiscal sponsor: {has_fiscal_sponsor}.\n\n"
        f"GRANT:\n  Funder/Program: {grant.funder}\n  Type: {grant.type}\n"
        f"  Amount: {grant.amount_note or grant.amount}\n  Deadline: {grant.deadline_note or grant.deadline or 'unknown'}\n"
        f"  501(c)(3) required: {grant.requires_501c3}\n  Eligibility bucket: {grant.bucket}\n"
        f"  Fit/eligibility notes: {grant.fit_notes or 'n/a'}\n\n"
        "Score DID's near-term likelihood of winning this grant."
    )


def score_grant(
    client: anthropic.Anthropic,
    grant: Grant,
    has_fiscal_sponsor: bool = DID_HAS_FISCAL_SPONSOR,
) -> dict:
    resp = client.messages.create(
        model=MODEL_REASONING,
        max_tokens=1500,
        system=_SYSTEM,
        messages=[{"role": "user", "content": _prompt(grant, has_fiscal_sponsor)}],
        output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
    )
    text = next((b.text for b in resp.content if b.type == "text"), "{}")
    data = json.loads(text)
    data["score"] = max(0, min(100, int(data.get("score", 0))))
    return data
