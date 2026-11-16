---
status: complete
---
# Quick 261116-dc6 Summary

The DID bot now puts NYC funders first and stops saving international federal grants.

## What changed
- `did_agent/geo.py`: `is_nyc(grant)` (funder + fit notes name NYC, New York or a borough) and `is_international(hit)` (grants.gov hit from State Dept, USAID, an embassy or a U.S. Mission).
- `tools/scrape_grants.py`: international hits are dropped before fetch and save; the summary line reports the count when above 0.
- `sweep.top_open_now`, `sweep.format_sweep_message`, `reminders.format_digest`: NYC grants first, previous order kept inside each group.
- `scoring._SYSTEM`: geography rule (NYC / New York State strong fit, work outside the US scores under 10). `DID_ORG_PROFILE` unchanged.
- `clients/feeds.py`: New York Community Trust, CitizensNYC and NYFA feeds first, kept only when the title has a whole grant word (grant, rfp, funding, fellowship, apply, application, deadline).
- `clients/propublica.py`: `nyc_only=True` keeps leads whose city is one of 11 NYC city names.

## Commits
- 5333682: the change and its tests
- bce6567: feed title filter on whole words, "award" removed

## Result
Full suite: 149 passed.

Live read-only check on 2026-11-16:
- grants.gov: 11 of 48 hits for the three daily queries were U.S. Mission programs and are skipped.
- ProPublica "disability": 25 New York State results, 12 left after the NYC filter (the API does return `city`).
- Feeds: all six parse.

## Not done / known limits
- Not pushed and not deployed to the VM.
- The remaining federal hits are still mostly research programs (NIH, NSF, DOE); the owner did not ask to stop the federal sweep.
- The scorer prompt rule was not tried against the VM model; the NYC-first order does not depend on it.
- Rows already in Notion are not re-scored.
