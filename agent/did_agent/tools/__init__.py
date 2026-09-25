"""The seven custom tools the agent calls. Registered into a ToolRegistry.

Each tool module exposes `build(settings) -> SimpleTool`. Bodies are implemented per phase:
  P2 notion_sync · P3 scrape_grants · P4 score_grant · P5 draft_application ·
  P6 send_telegram + schedule · site_knowledge (DID facts, replaces the old Wix chat).
"""

from __future__ import annotations

from did_agent.config import Settings
from did_agent.llm.client import ToolRegistry
from did_agent.tools import (
    draft_application,
    notion_sync,
    schedule,
    score_grant,
    scrape_grants,
    send_telegram,
    site_knowledge,
)


def register_all(registry: ToolRegistry, settings: Settings) -> None:
    for mod in (
        notion_sync,
        scrape_grants,
        score_grant,
        draft_application,
        send_telegram,
        schedule,
        site_knowledge,
    ):
        registry.register(mod.build(settings))


def register_public(registry: ToolRegistry, settings: Settings) -> None:
    """Tools for the PUBLIC website chat: read-only site facts only. No Notion, Telegram, drafting or scraping."""
    registry.register(site_knowledge.build(settings))
