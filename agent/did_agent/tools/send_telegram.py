"""send_telegram (Phase 6): outbound Telegram message (reminders, digest, proactive replies)."""

from __future__ import annotations

from did_agent.config import Settings
from did_agent.llm.client import SimpleTool

_SCHEMA = {
    "type": "object",
    "properties": {
        "text": {"type": "string", "description": "Message body (Telegram markdown ok)"},
        "chat_id": {
            "type": "integer",
            "description": "Target chat; defaults to Eman's configured chat if omitted",
        },
    },
    "required": ["text"],
}


def build(settings: Settings) -> SimpleTool:
    def run(tool_input: dict) -> str:
        raise NotImplementedError(
            "Phase 6 — send via the bot's Application; default chat_id = first allowed id. "
            "Used by the scheduler for reminders + the Monday 9AM digest."
        )

    return SimpleTool(
        name="send_telegram",
        description="Send a Telegram message to Eman (e.g. a deadline reminder or digest). "
        "Use for proactive/outbound messages, not for replying to the current turn.",
        input_schema=_SCHEMA,
        func=run,
    )
