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
    assert "site_knowledge" not in p
    assert "answer only from the facts below" in p
    assert "diversityincludesdisability@gmail.com" in p
    assert "never claim to book" in p
    assert "no other tools" in p


def test_system_prompt_carries_every_section_and_is_visitor_safe():
    msgs = public_agent.build_messages("What does Diversity Includes Disability do?")
    sysm = msgs[0]["content"]
    assert msgs[0]["role"] == "system"
    assert "advances intersectional disability equity" in sysm
    assert "Four core services" in sysm
    assert "Pricing and booking" in sysm and "$100" in sysm
    low = sysm.lower()
    assert "placeholder" not in low and "SITE FACTS" not in sysm and "call site_knowledge" not in low
    assert msgs[-1] == {"role": "user", "content": "What does Diversity Includes Disability do?"}


def test_system_prompt_is_identical_across_questions():
    assert public_agent.build_messages("How much is a talk?")[0] == public_agent.build_messages("Who is Eman?")[0]


def test_history_is_capped_at_six():
    hist = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"m{i}"} for i in range(10)]
    msgs = public_agent.build_messages("q", hist)
    assert len(msgs) == 8
    assert msgs[1:7] == hist[-6:]


def test_messages_keep_history_between_system_and_user():
    hist = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]
    msgs = public_agent.build_messages("contact email?", hist)
    assert msgs[1:3] == hist
    assert "diversityincludesdisability@gmail.com" in msgs[0]["content"]


def test_public_agent_has_no_tools_attribute():
    assert not hasattr(public_agent.PublicAgent, "_registry")
