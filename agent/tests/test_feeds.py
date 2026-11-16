"""Offline tests for the digest feeds (feedparser monkeypatched)."""

from __future__ import annotations

from types import SimpleNamespace

from did_agent.clients import feeds


def _e(title):
    return SimpleNamespace(title=title, link="http://x", published="")


def test_nyc_feeds_filtered_and_first(monkeypatch):
    data = {
        "http://nyc": [_e("Staff news"), _e("Grantee Spotlight: X"), _e("2026 Award Recipient"), _e("New grant round"), _e("Apply by May")],
        "http://other": [_e("Staff news")],
    }
    monkeypatch.setattr(feeds.feedparser, "parse", lambda url: SimpleNamespace(entries=data[url]))
    out = feeds.fetch_digest([("NYFA", "http://nyc"), ("Disability Scoop", "http://other")], per_feed=2)
    assert [(i["source"], i["title"]) for i in out] == [
        ("NYFA", "New grant round"),
        ("NYFA", "Apply by May"),
        ("Disability Scoop", "Staff news"),
    ]


def test_nyc_feeds_listed_first():
    assert [s for s, _ in feeds.DIGEST_FEEDS[:3]] == ["New York Community Trust", "CitizensNYC", "NYFA"]
