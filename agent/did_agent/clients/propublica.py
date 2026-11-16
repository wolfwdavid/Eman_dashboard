"""ProPublica Nonprofit Explorer client — free, no-auth funder prospecting.

The only genuinely free structured funder dataset (Candid/Instrumentl are paywalled). Use it to find
foundations by state + keyword, then read their 990 filings to profile giving. These are *leads to
research*, not open opportunities — the tool surfaces them, it does not auto-add them to the grants DB.
"""

from __future__ import annotations

import requests

_BASE = "https://projects.propublica.org/nonprofits/api/v2"
_HEADERS = {"User-Agent": "DID-grant-agent/1.0"}
# shortcut: fixed list of 11 city names, Queens uses many more postal city names; upgrade to a zip-code or county filter if leads are missed
_NYC_CITIES = {
    "NEW YORK", "BROOKLYN", "BRONX", "STATEN ISLAND", "QUEENS", "FLUSHING", "JAMAICA",
    "LONG ISLAND CITY", "ASTORIA", "FOREST HILLS", "JACKSON HEIGHTS",
}


def search_funders(query: str, state: str = "NY", private_foundation: bool = True, limit: int = 15, nyc_only: bool = True) -> list[dict]:
    """Search nonprofits by keyword + state. c_code 3 = 501(c)(3); private foundations file 990-PF.

    nyc_only keeps only organizations whose city is an NYC borough/neighborhood name.

    Returns compact dicts: {name, ein, ntee, state, subsection}.
    """
    params = {"q": query, "state[id]": state}
    if private_foundation:
        params["c_code[id]"] = 3  # 501(c)(3)
    resp = requests.get(f"{_BASE}/search.json", params=params, headers=_HEADERS, timeout=30)
    resp.raise_for_status()
    orgs = resp.json().get("organizations", []) or []
    if nyc_only:
        orgs = [o for o in orgs if (o.get("city") or "").upper() in _NYC_CITIES]
    out = []
    for o in orgs[:limit]:
        out.append(
            {
                "name": o.get("name", ""),
                "ein": o.get("ein"),
                "ntee": o.get("ntee_code"),
                "state": o.get("state"),
                "subsection": o.get("subseccd"),
            }
        )
    return out


def organization(ein: str | int) -> dict:
    """Full org record incl. filings (990/990-PF financials) for the given EIN."""
    resp = requests.get(f"{_BASE}/organizations/{ein}.json", headers=_HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()
