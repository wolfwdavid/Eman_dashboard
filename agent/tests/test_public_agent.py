"""The public website chat must be tool-free and always grounded in the site facts."""

from __future__ import annotations

from did_agent import public_agent
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


def test_messages_inject_matching_facts_for_a_price_question():
    msgs = public_agent.build_messages("How much does a speaking engagement cost?")
    assert msgs[0]["role"] == "system"
    assert "SITE FACTS" in msgs[0]["content"]
    assert "$100" in msgs[0]["content"]
    assert msgs[-1] == {"role": "user", "content": "How much does a speaking engagement cost?"}


def test_messages_keep_history_between_system_and_user():
    hist = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]
    msgs = public_agent.build_messages("contact email?", hist)
    assert msgs[1:3] == hist
    assert "diversityincludesdisability@gmail.com" in msgs[0]["content"]


def test_public_agent_has_no_tools_attribute():
    assert not hasattr(public_agent.PublicAgent, "_registry")
