"""NYC-first helpers: is a grant NYC-based, is a grants.gov hit an international program."""

from __future__ import annotations

import re

_NYC = re.compile(r"\b(nyc|new york|brooklyn|bronx|queens|manhattan|staten island|harlem)\b", re.I)
_INTL_AGENCY = re.compile(
    r"\b(U\.S\. Mission|Embassy|Consulate|Department of State|Agency for International Development)\b", re.I
)


def is_nyc(grant) -> bool:
    """True when the funder or fit notes name NYC or a borough (whole words, case-insensitive)."""
    return bool(_NYC.search(f"{grant.funder} {grant.fit_notes}"))


def is_international(hit: dict) -> bool:
    """True for a grants.gov search hit run by State Dept / USAID / an embassy (work abroad)."""
    if (hit.get("agencyCode") or "").upper().startswith(("DOS", "USAID")):
        return True
    return bool(_INTL_AGENCY.search(f"{hit.get('agency') or ''} {hit.get('title') or ''}"))
