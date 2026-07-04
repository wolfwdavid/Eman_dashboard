"""scrape_grants (Phase 3): find new grant opportunities from grants.gov + foundations + news."""

from __future__ import annotations

from did_agent.config import Settings
from did_agent.llm.client import SimpleTool

_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {"type": "string", "description": "Keywords, e.g. 'disability nonprofit NYC'"},
        "sources": {
            "type": "array",
            "items": {"type": "string", "enum": ["grants_gov", "foundations", "news"]},
            "description": "Which source families to search (default: all)",
        },
        "max_results": {"type": "integer", "default": 25},
    },
    "required": ["query"],
}


def build(settings: Settings) -> SimpleTool:
    def run(tool_input: dict) -> str:
        raise NotImplementedError(
            "Phase 3 — grants.gov Search2 API + foundation crawlers + RSS news; "
            "dedup/normalize; tag 501c3 eligibility; write new opps via notion_sync."
        )

    return SimpleTool(
        name="scrape_grants",
        description="Search external sources (grants.gov federal API, foundation listings, grant news) "
        "for new opportunities relevant to a disability-equity nonprofit, normalize them, and record "
        "new ones in Notion. Returns a summary of what was found/added.",
        input_schema=_SCHEMA,
        func=run,
    )
