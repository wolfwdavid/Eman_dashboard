"""send_telegram (Phase 6): outbound Telegram message from the agent tool loop."""

from __future__ import annotations

from did_agent import outbound
from did_agent.config import Settings
from did_agent.llm.client import SimpleTool

_SCHEMA = {
    "type": "object",
    "properties": {
        "text": {"type": "string", "description": "Message body (Telegram Markdown ok)"},
        "chat_id": {"type": "integer", "description": "Target chat; defaults to Eman's configured chat"},
    },
    "required": ["text"],
}


def build(settings: Settings) -> SimpleTool:
    default_chat = settings.telegram_allowed_chat_ids[0] if settings.telegram_allowed_chat_ids else None

    def run(tool_input: dict) -> str:
        text = tool_input.get("text")
        if not text:
            return "send_telegram requires 'text'."
        chat_id = tool_input.get("chat_id") or default_chat
        if not chat_id:
            return "No target chat_id (set TELEGRAM_ALLOWED_CHAT_IDS or pass chat_id)."
        return "Sent." if outbound.send(int(chat_id), text) else "Could not send (bot not running / unknown chat)."

    return SimpleTool(
        name="send_telegram",
        description="Send a proactive Telegram message to Eman (e.g. a one-off reminder). For replying to "
        "the current message, just return your answer — this is only for extra/out-of-band sends.",
        input_schema=_SCHEMA,
        func=run,
    )
