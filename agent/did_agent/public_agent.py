"""PublicAgent: the website/dashboard chat, reachable by anyone.

Unlike the Telegram grant agent it has NO tools. For every message it looks up the matching
sections of knowledge/did-site-knowledge.md itself and puts them in the system prompt, then makes a
single model call. That is deterministic (a small local model cannot "forget" to call the tool),
cheaper (one call instead of two), and safe (nothing to act on: no Notion, Telegram, drafting).
"""

from __future__ import annotations

from did_agent.config import Settings
from did_agent.llm.client import make_client
from did_agent.tools.site_knowledge import PUBLIC_SYSTEM_PROMPT, lookup

_MAX_REPLY_TOKENS = 400


def build_messages(user_text: str, history: list[dict] | None = None) -> list[dict]:
    """System prompt + retrieved site facts + history + the user's message. Pure; used by tests."""
    facts = lookup(user_text)
    system = (
        PUBLIC_SYSTEM_PROMPT
        + "\n\nSITE FACTS (the only source you may use; if the answer is not here, say you do not know):\n"
        + facts
    )
    messages: list[dict] = [{"role": "system", "content": system}]
    messages.extend(history or [])
    messages.append({"role": "user", "content": user_text})
    return messages


class PublicAgent:
    """Same `respond(user_text, history)` contract as llm.client.Agent, so chat_api can use either."""

    def __init__(self, settings: Settings) -> None:
        self._client = make_client(settings)
        self._model = settings.llm_model_reasoning

    def respond(self, user_text: str, history: list[dict] | None = None) -> str:
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=build_messages(user_text, history),
            temperature=0,
            max_tokens=_MAX_REPLY_TOKENS,
        )
        return (resp.choices[0].message.content or "").strip()
