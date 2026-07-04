"""score_grant (Phase 4): estimate award likelihood (0-100) with rationale."""

from __future__ import annotations

from did_agent.config import Settings
from did_agent.llm.client import SimpleTool

_SCHEMA = {
    "type": "object",
    "properties": {
        "funder": {"type": "string", "description": "Funder/Program to score (looked up in Notion)"},
    },
    "required": ["funder"],
}


def build(settings: Settings) -> SimpleTool:
    def run(tool_input: dict) -> str:
        raise NotImplementedError(
            "Phase 4 — score on mission fit, 501c3/fiscal-sponsor eligibility, amount realism, "
            "deadline feasibility, competition; write score + rationale back via notion_sync."
        )

    return SimpleTool(
        name="score_grant",
        description="Estimate the likelihood (0-100) that DID would be awarded a given grant, with a "
        "short rationale, factoring in the 501(c)(3)-pending constraint. Persists the score to Notion.",
        input_schema=_SCHEMA,
        func=run,
    )
