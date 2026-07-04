"""grants.gov client — public, no-auth Search2 + fetchOpportunity (schema verified live 2026).

search2 returns oppHits (id/number/title/agency/openDate/closeDate MM-DD-YYYY/cfdaList) but NO award
amounts and NO applicant-eligibility codes — those require fetchOpportunity, whose payload nests under
`synopsis` (posted) or `forecast` (forecasted): applicantTypes[{id,description}], awardCeiling/Floor,
estimatedFunding, applicantEligibilityDesc.

Eligibility buckets for a 501(c)(3)-PENDING org:
  OPEN_NOW    = has code 13 (nonprofit w/o 501c3), 99 (unrestricted), or 25 (other)
  AFTER_501C3 = restricted to code 12 only (needs an ISSUED IRS determination letter)
  NOT_ELIGIBLE= only govt/tribal/education/for-profit codes
"""

from __future__ import annotations

import time
from datetime import datetime

import requests

from did_agent.models import Grant

_SEARCH = "https://api.grants.gov/v1/api/search2"
_FETCH = "https://api.grants.gov/v1/api/fetchOpportunity"
_HEADERS = {"Content-Type": "application/json", "User-Agent": "DID-grant-agent/1.0"}
_VIEW = "https://www.grants.gov/search-results-detail/{id}"
_THROTTLE = 1.0  # self-throttle ~1 req/s (no documented limit, be polite)

OPEN_NOW_CODES = {"13", "99", "25"}
AFTER_501C3_CODES = {"12"}


def search(keyword: str, statuses: str = "forecasted|posted", rows: int = 50, max_records: int = 150) -> list[dict]:
    """Paginated Search2 sweep. Returns raw oppHits (unfiltered — bucket client-side after fetch)."""
    out: list[dict] = []
    start = 0
    while len(out) < max_records:
        body = {
            "keyword": keyword,
            "oppStatuses": statuses,       # pipe-separated string, NOT a JSON array
            "rows": rows,
            "startRecordNum": start,       # request offset (response echoes it as startRecord)
            "eligibilities": "",
            "agencies": "",
            "aln": "",
            "fundingCategories": "",
        }
        resp = requests.post(_SEARCH, json=body, headers=_HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json().get("data", {})
        hits = data.get("oppHits", [])
        out.extend(hits)
        start += rows
        if not hits or start >= data.get("hitCount", 0):
            break
        time.sleep(_THROTTLE)
    return out[:max_records]


def fetch(opportunity_id: str) -> dict:
    """Full opportunity detail. Returns the synopsis (posted) or forecast (forecasted) sub-object."""
    resp = requests.post(_FETCH, json={"opportunityId": str(opportunity_id)}, headers=_HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json().get("data", {})
    return data.get("synopsis") or data.get("forecast") or {}


def applicant_codes(detail: dict) -> set[str]:
    return {str(a.get("id")) for a in detail.get("applicantTypes", []) if a.get("id")}


def bucket(codes: set[str]) -> str:
    if codes & OPEN_NOW_CODES:
        return "OPEN_NOW"
    if codes and codes <= AFTER_501C3_CODES:
        return "AFTER_501C3"
    if codes:
        return "NOT_ELIGIBLE"
    return "UNKNOWN"


def _iso(mmddyyyy: str) -> str | None:
    if not mmddyyyy:
        return None
    for fmt in ("%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(mmddyyyy.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _num(v) -> float | None:
    """grants.gov returns missing money as the string 'none' / '' / None — coerce safely."""
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() in ("none", "n/a", "null"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _amount(detail: dict) -> tuple[float | None, str]:
    ceil = _num(detail.get("awardCeiling"))
    floor = _num(detail.get("awardFloor"))
    est = _num(detail.get("estimatedFunding"))
    val = next((c for c in (ceil, est, floor) if c and c > 0), None)
    note_parts = []
    if floor and ceil:
        note_parts.append(f"${int(floor):,}-${int(ceil):,} per award")
    elif ceil:
        note_parts.append(f"up to ${int(ceil):,} per award")
    if est and est > 0:
        note_parts.append(f"~${int(est):,} total")
    return val, "; ".join(note_parts)


def to_grant(hit: dict, detail: dict) -> Grant:
    codes = applicant_codes(detail)
    amount, amount_note = _amount(detail)
    number = hit.get("number", "")
    return Grant(
        funder=f"[grants.gov] {hit.get('title', '').strip()}"[:200],
        type="Federal",
        amount=amount,
        amount_note=amount_note or "see opportunity",
        deadline=_iso(hit.get("closeDate", "")),
        deadline_note=hit.get("closeDate", "") or (detail.get("responseDateDesc") or ""),
        requires_501c3="No" if bucket(codes) == "OPEN_NOW" else ("Yes" if bucket(codes) == "AFTER_501C3" else "Unknown"),
        bucket=bucket(codes),
        fit_notes=f"{hit.get('agency', '')} · {number} · CFDA {','.join(hit.get('cfdaList', []) or [])}".strip(" ·"),
        status="New",
        next_action="Review eligibility + fit; decide whether to pursue",
        link=_VIEW.format(id=hit.get("id", "")),
        source="grants.gov",
    )
