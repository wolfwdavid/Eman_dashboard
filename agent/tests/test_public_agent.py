"""The public website chat must only ever see the read-only site_knowledge tool."""

from __future__ import annotations

from did_agent.llm.client import ToolRegistry
from did_agent.tools import register_public
from did_agent.tools.site_knowledge import PUBLIC_SYSTEM_PROMPT


def test_public_registry_has_only_site_knowledge():
    reg = ToolRegistry()
    register_public(reg, settings=None)  # site_knowledge ignores settings
    names = [t["function"]["name"] for t in reg.specs()]
    assert names == ["site_knowledge"]


def test_public_prompt_forbids_actions_and_points_to_email():
    p = PUBLIC_SYSTEM_PROMPT.lower()
    assert "site_knowledge" in p
    assert "diversityincludesdisability@gmail.com" in p
    assert "never claim to book" in p
    assert "no other tools" in p
