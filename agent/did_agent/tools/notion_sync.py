"""notion_sync (Phase 2): read / write / upsert grants in the Notion grants DB."""

from __future__ import annotations

from did_agent.config import Settings
from did_agent.llm.client import SimpleTool

_SCHEMA = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["list", "get", "upsert"],
            "description": "list = all grants; get = one by funder/program; upsert = create-or-update",
        },
        "funder": {"type": "string", "description": "Funder/Program name (key for get/upsert)"},
        "fields": {
            "type": "object",
            "description": "For upsert: any of amount, deadline (ISO date), status, fit, "
            "requires_501c3, next_action, link, score",
        },
    },
    "required": ["action"],
}


def build(settings: Settings) -> SimpleTool:
    def run(tool_input: dict) -> str:
        raise NotImplementedError(
            "Phase 2 — wire notion-client with NOTION_TOKEN/NOTION_GRANTS_DB_ID; "
            "seed from ../Rimawi/grants.csv."
        )

    return SimpleTool(
        name="notion_sync",
        description="Read, look up, or upsert grant opportunities in the DID Notion grants database "
        "(the source of truth). Use this before answering any question about grant data.",
        input_schema=_SCHEMA,
        func=run,
    )
