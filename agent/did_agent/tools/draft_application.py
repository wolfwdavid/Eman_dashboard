"""draft_application (Phase 5): fill a Google Docs template from grant + org profile."""

from __future__ import annotations

from did_agent.config import Settings
from did_agent.llm.client import SimpleTool

_SCHEMA = {
    "type": "object",
    "properties": {
        "funder": {"type": "string", "description": "Funder/Program to draft an application for"},
        "notes": {"type": "string", "description": "Optional extra guidance from Eman"},
    },
    "required": ["funder"],
}


def build(settings: Settings) -> SimpleTool:
    def run(tool_input: dict) -> str:
        raise NotImplementedError(
            "Phase 5 — copy GOOGLE_TEMPLATE_DOC_ID via Drive API, replaceAllText {{placeholders}} "
            "from grant + DID org profile (Claude-drafted narrative), return editable Doc URL."
        )

    return SimpleTool(
        name="draft_application",
        description="Create a first-draft grant application as an editable Google Doc by filling a "
        "template from the grant's details and DID's org profile. Returns the shareable Doc link.",
        input_schema=_SCHEMA,
        func=run,
    )
