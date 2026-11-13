"""PublicAgent: the website/dashboard chat, reachable by anyone.

Unlike the Telegram grant agent it has NO tools. The whole knowledge file goes in the system prompt
(it is small), then a single model call is made. That is deterministic (a small local model cannot
"forget" to call a tool), cheaper (one call), and safe (nothing to act on: no Notion, Telegram, drafting).
"""

from __future__ import annotations

from did_agent.config import Settings
from did_agent.llm.client import make_client
from did_agent.tools.site_knowledge import PUBLIC_SYSTEM_PROMPT, load_sections

_MAX_REPLY_TOKENS = 400


def build_messages(user_text: str, history: list[dict] | None = None) -> list[dict]:
    """System prompt + all site facts + recent history + the user's message. Pure; used by tests."""
    # The facts block is request-independent, so the prefix is identical across requests (Ollama prefix cache).
    facts = "\n\n".join(f"## {h}\n{b}" for h, b in load_sections()) or (
        "Site knowledge file is missing; answer from general org profile only."
    )
    system = (
        PUBLIC_SYSTEM_PROMPT
        + "\n\nFACTS ABOUT DID (the only source you may use; if the answer is not here, say you do not know):\n"
        + facts
    )
    messages: list[dict] = [{"role": "system", "content": system}]
    # llama3.2:3b via Ollama's OpenAI endpoint cannot set num_ctx per request (host default may be 4096)
    # and the facts take ~1.9k tokens, so keep history short.
    messages.extend((history or [])[-6:])
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
