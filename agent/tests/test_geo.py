"""Offline tests for the NYC-first helpers."""

from __future__ import annotations

from did_agent.geo import is_international, is_nyc
from did_agent.models import Grant


def test_is_nyc():
    assert is_nyc(Grant(funder="New York Community Trust"))
    assert is_nyc(Grant(funder="Some Fund", fit_notes="serves BROOKLYN families"))
    assert not is_nyc(Grant(funder="Sunnyside Foundation", fit_notes="Newark and synchronycs"))
    assert not is_nyc(Grant(funder="Plain Fund"))


def test_is_international():
    assert is_international({"agencyCode": "DOS-PRM"})
    assert is_international({"agencyCode": "usaid-x"})
    assert is_international({"agency": "U.S. Mission to Kenya"})
    assert is_international({"title": "Embassy Small Grants"})
    assert is_international({"agency": "Department of State"})
    assert is_international({"agency": "Agency for International Development"})
    assert not is_international({"agencyCode": "HHS-ACL", "agency": "Administration for Community Living"})
    assert not is_international({})
