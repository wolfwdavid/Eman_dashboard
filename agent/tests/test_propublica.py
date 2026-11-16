"""Offline tests for the ProPublica funder search (requests monkeypatched)."""

from __future__ import annotations

from did_agent.clients import propublica


class _Resp:
    def raise_for_status(self):
        pass

    def json(self):
        return {"organizations": [{"name": "A", "city": "Brooklyn"}, {"name": "B", "city": "Albany"}, {"name": "C"}]}


def test_nyc_only(monkeypatch):
    monkeypatch.setattr(propublica.requests, "get", lambda *a, **k: _Resp())
    assert [o["name"] for o in propublica.search_funders("x")] == ["A"]
    assert [o["name"] for o in propublica.search_funders("x", nyc_only=False)] == ["A", "B", "C"]
