"""Claude client: an Opus 4.8 agentic tool-use loop + a Haiku 4.5 intent router.

Grounded in the current Anthropic SDK surface:
  - Opus 4.8 / Haiku 4.5 model ids (no date suffix).
  - Adaptive thinking (`thinking={"type": "adaptive"}`) — `budget_tokens` is rejected on 4.8.
  - Manual agentic loop so we can gate/log tool calls (human-in-the-loop friendly).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Callable, Protocol

import anthropic

from did_agent.config import MODEL_REASONING, MODEL_ROUTER, Settings

_MAX_TOOL_ITERATIONS = 12


class Tool(Protocol):
    name: str
    description: str
    input_schema: dict

    def run(self, tool_input: dict) -> str: ...


@dataclass
class SimpleTool:
    """Adapter so a plain function can be registered as a Claude tool."""

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
        """The `tools=[...]` payload for the Messages API."""
        return [
            {"name": t.name, "description": t.description, "input_schema": t.input_schema}
            for t in self._tools.values()
        ]

    def dispatch(self, name: str, tool_input: dict) -> tuple[str, bool]:
        """Return (result_text, is_error)."""
        tool = self._tools.get(name)
        if tool is None:
            return f"Unknown tool: {name}", True
        try:
            return tool.run(tool_input), False
        except NotImplementedError as exc:
            return f"Tool '{name}' not implemented yet: {exc}", True
        except Exception as exc:  # surfaced back to Claude so it can adapt
            return f"Tool '{name}' error: {exc}", True


SYSTEM_PROMPT = (
    "You are the grant assistant for Diversity Includes Disability (DID), Eman Rimawi's "
    "disability-equity nonprofit. DID is an S-corp LLC with 501(c)(3) status PENDING — this gates "
    "grant eligibility: some grants need a fiscal sponsor, some are open now. Be concise and direct; "
    "Eman reads your replies on Telegram. Use tools to look up, organize, score, and draft grants; "
    "never invent grant data — read it from Notion. When you finish, lead with the outcome."
)


class ClaudeAgent:
    def __init__(self, settings: Settings, registry: ToolRegistry) -> None:
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self._registry = registry

    def route_intent(self, text: str) -> str:
        """Cheap Haiku classifier: what does this message want? (routing hint, not gospel)."""
        resp = self._client.messages.create(
            model=MODEL_ROUTER,
            max_tokens=32,
            system="Classify the user's grant-assistant message into ONE label: "
            "find_grants | score | draft | status | reminder_setting | chitchat | other. "
            "Reply with only the label.",
            messages=[{"role": "user", "content": text}],
        )
        label = next((b.text for b in resp.content if b.type == "text"), "other")
        return label.strip().split()[0] if label.strip() else "other"

    def respond(self, user_text: str, history: list[dict] | None = None) -> str:
        """Run the Opus agentic loop for one user turn; return the final text reply."""
        messages: list[dict] = list(history or [])
        messages.append({"role": "user", "content": user_text})

        for _ in range(_MAX_TOOL_ITERATIONS):
            resp = self._client.messages.create(
                model=MODEL_REASONING,
                max_tokens=8000,
                thinking={"type": "adaptive"},
                system=SYSTEM_PROMPT,
                tools=self._registry.specs(),
                messages=messages,
            )
            messages.append({"role": "assistant", "content": resp.content})

            if resp.stop_reason != "tool_use":
                return next((b.text for b in resp.content if b.type == "text"), "")

            results = []
            for block in resp.content:
                if block.type == "tool_use":
                    out, is_error = self._registry.dispatch(block.name, block.input)
                    results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": out,
                            "is_error": is_error,
                        }
                    )
            messages.append({"role": "user", "content": results})

        return "I hit the tool-iteration limit before finishing — try narrowing the request."
