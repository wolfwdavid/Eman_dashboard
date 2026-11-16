"""Offline test: international grants.gov hits never reach fetch or Notion."""

from __future__ import annotations

from did_agent.models import Grant
from did_agent.tools import scrape_grants


class _Store:
    def __init__(self, *_):
        self.saved = []

    def upsert(self, g):
        self.saved.append(g)


def test_international_hits_skipped(monkeypatch):
    fetched = []
    monkeypatch.setattr(scrape_grants, "NotionStore", _Store)
    monkeypatch.setattr(
        scrape_grants.grants_gov,
        "search",
        lambda q, max_records=0: [{"id": "1", "agencyCode": "DOS-PRM"}, {"id": "2", "agencyCode": "HHS-ACL"}],
    )
    monkeypatch.setattr(scrape_grants.grants_gov, "fetch", lambda i: fetched.append(i) or {})
    monkeypatch.setattr(scrape_grants.grants_gov, "to_grant", lambda h, d: Grant(funder="HHS " + h["id"]))
    out = scrape_grants.build(None).func({"query": "x", "sources": ["grants_gov"]})
    assert fetched == ["2"]
    assert "1 international skipped" in out
    # zero skipped: the count is not shown
    monkeypatch.setattr(scrape_grants.grants_gov, "search", lambda q, max_records=0: [{"id": "2", "agencyCode": "HHS"}])
    assert "skipped" not in scrape_grants.build(None).func({"query": "x", "sources": ["grants_gov"]})
