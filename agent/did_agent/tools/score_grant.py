"""score_grant (Phase 4): estimate award likelihood (0-100) with rationale; persist to Notion."""

from __future__ import annotations

import anthropic

from did_agent.config import Settings
from did_agent.llm.client import SimpleTool
from did_agent.notion_store import NotionStore
from did_agent.scoring import score_grant as run_score

_SCHEMA = {
    "type": "object",
    "properties": {
        "funder": {"type": "string", "description": "Funder/Program to score (looked up in Notion)"},
    },
    "required": ["funder"],
}


def build(settings: Settings) -> SimpleTool:
    # api_key or None -> SDK resolves ambient creds (env / ant profile) when .env is empty.
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)
    store = NotionStore(settings)

    def run(tool_input: dict) -> str:
        funder = tool_input.get("funder")
        if not funder:
            return "score_grant requires a 'funder'."
        grant = store.get_grant(funder)
        if grant is None:
            return f"No grant named '{funder}' in Notion — scrape or add it first."
        result = run_score(client, grant)
        grant.score = float(result["score"])
        factors = "; ".join(result.get("key_factors", []))
        grant.rationale = f"{result['rationale']}"
        if factors:
            grant.rationale += f"  [factors: {factors}]"
        store.upsert(grant)  # merge-then-write: only score + rationale change
        act = "actionable now" if result.get("actionable_now") else "NOT actionable yet"
        return (
            f"Scored '{funder}': {result['score']}/100 ({result['likelihood']}, {act}).\n"
            f"{result['rationale']}"
        )

    return SimpleTool(
        name="score_grant",
        description="Estimate the near-term likelihood (0-100) that DID would be awarded a given grant, "
        "with a plain-language rationale, factoring in the 501(c)(3)-pending constraint and fiscal-sponsor "
        "status. Persists the score + rationale to Notion.",
        input_schema=_SCHEMA,
        func=run,
    )
