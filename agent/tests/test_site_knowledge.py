"""Tests for the site_knowledge tool (pure lookup, no network, no LLM)."""

from __future__ import annotations

from pathlib import Path

from did_agent.tools import site_knowledge as sk

SECTIONS = sk.load_sections()


def test_knowledge_file_exists_and_has_sections():
    assert sk.KNOWLEDGE_PATH.is_file(), sk.KNOWLEDGE_PATH
    headings = [h for h, _ in SECTIONS]
    assert len(headings) >= 8
    for h in ("Contact", "Services and what we do", "Founder: Eman Rimawi-Doster"):
        assert h in headings, headings


def test_no_secrets_in_knowledge_file():
    import re

    text = sk.KNOWLEDGE_PATH.read_text(encoding="utf-8")
    assert not re.search(r"\b\d{2}-\d{7}\b", text), "EIN-shaped number found"
    assert not re.search(r"\b\d{3}[-. ]\d{3}[-. ]\d{4}\b", text), "phone number found"
    for banned in ("ntn_", "sk-", "secret_", "password", "api key", "bot token"):
        assert banned not in text.lower(), banned


def test_pricing_question_returns_pricing_section():
    out = sk.lookup("how much does a speaking engagement cost")
    assert "Pricing and booking" in out
    assert "$100" in out


def test_contact_question_returns_email():
    out = sk.lookup("what is the contact email?")
    assert "diversityincludesdisability@gmail.com" in out


def test_bio_question():
    out = sk.lookup("who is Eman Rimawi")
    assert "Founder: Eman Rimawi-Doster" in out
    assert "Access-A-Ride" in out


def test_events_question():
    out = sk.lookup("upcoming events open mic")
    assert "Scribe Vibes" in out


def test_overview_returns_index_and_mission():
    out = sk.lookup("all")
    assert "Sections available:" in out
    assert "intersectional disability equity" in out.lower()


def test_no_match_returns_index_not_empty():
    out = sk.lookup("zxqv quantum chromodynamics")
    assert out.startswith("No section matched.")
    assert "Sections available:" in out


def test_returns_at_most_two_sections():
    out = sk.lookup("Eman services events contact podcast art website")
    assert out.count("\n## ") <= sk._MAX_SECTIONS


def test_missing_file_is_handled(tmp_path: Path):
    assert sk.load_sections(tmp_path / "nope.md") == []
    assert "missing" in sk.lookup("anything", sections=[])


def test_tool_builds_and_runs():
    tool = sk.build(settings=None)  # settings unused by this tool
    assert tool.name == "site_knowledge"
    assert "$100" in tool.run({"topic": "prices"})
