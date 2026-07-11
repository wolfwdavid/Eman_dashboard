"""LLM layer — OpenAI-compatible tool-calling loop (works with local Ollama, or Groq/Gemini).

The reasoning model drives an agentic loop; a small router model does cheap intent classification.
Provider is chosen entirely by config (base_url + model names), so nothing here is vendor-locked.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Callable, Protocol

from openai import OpenAI

from did_agent.config import Settings

_MAX_TOOL_ITERATIONS = 12


def make_client(settings: Settings) -> OpenAI:
    return OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key or "ollama")


class Tool(Protocol):
    name: str
    description: str
    input_schema: dict

    def run(self, tool_input: dict) -> str: ...


@dataclass
class SimpleTool:
    name: str
    description: str
    input_schema: dict
    func: Callable[[dict], str]

    def run(self, tool_input: dict) -> str:
        return self.func(tool_input)


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def specs(self) -> list[dict]:
        """OpenAI function-tool format."""
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.input_schema,
                },
            }
            for t in self._tools.values()
        ]

    def dispatch(self, name: str, tool_input: dict) -> tuple[str, bool]:
        tool = self._tools.get(name)
        if tool is None:
            return f"Unknown tool: {name}", True
        try:
            return tool.run(tool_input), False
        except NotImplementedError as exc:
            return f"Tool '{name}' not implemented yet: {exc}", True
        except Exception as exc:
            return f"Tool '{name}' error: {exc}", True


SYSTEM_PROMPT = (
    "You are the grant assistant for Diversity Includes Disability (DID), Eman Rimawi's "
    "disability-equity nonprofit. DID is an S-corp LLC with 501(c)(3) status PENDING — this gates "
    "grant eligibility: some grants need a fiscal sponsor, some are open now. Be concise and direct; "
    "Eman reads your replies on Telegram. Use tools to look up, organize, score, and draft grants; "
    "never invent grant data — read it from Notion. When you finish, lead with the outcome. "
    "IMPORTANT: whatever text you return is automatically delivered as the reply to the person who "
    "messaged you — you do NOT need a chat id to answer, and you must never ask the user for one. "
    "Do not call send_telegram to answer the current message; it is only for extra, out-of-band sends."
)


class Agent:
    def __init__(self, settings: Settings, registry: ToolRegistry) -> None:
        self._client = make_client(settings)
        self._model = settings.llm_model_reasoning
        self._router_model = settings.llm_model_router
        self._registry = registry

    def route_intent(self, text: str) -> str:
        """Cheap classifier: what does this message want? (routing hint, not gospel)."""
        resp = self._client.chat.completions.create(
            model=self._router_model,
            max_tokens=16,
            temperature=0,
            messages=[
                {
                    "role": "system",
                    "content": "Classify the grant-assistant message into ONE label: "
                    "find_grants | score | draft | status | reminder_setting | chitchat | other. "
                    "Reply with only the label.",
                },
                {"role": "user", "content": text},
            ],
        )
        label = (resp.choices[0].message.content or "other").strip()
        return label.split()[0] if label else "other"

    def respond(self, user_text: str, history: list[dict] | None = None) -> str:
        """Run the agentic tool loop for one user turn; return the final text reply."""
        messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(history or [])
        messages.append({"role": "user", "content": user_text})

        for _ in range(_MAX_TOOL_ITERATIONS):
            resp = self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                tools=self._registry.specs(),
                tool_choice="auto",
                temperature=0,
            )
            msg = resp.choices[0].message
            if not msg.tool_calls:
                return msg.content or ""

            messages.append(
                {
                    "role": "assistant",
                    "content": msg.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                        }
                        for tc in msg.tool_calls
                    ],
                }
            )
            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                out, _is_error = self._registry.dispatch(tc.function.name, args)
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": out})

        return "I hit the tool-iteration limit before finishing — try narrowing the request."
