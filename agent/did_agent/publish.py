"""Publish the grants + news dashboard (Phase 7).

Renders a self-contained `dashboard/grants-dashboard.html` (data embedded, no server / no CORS —
double-clickable) from Notion (if configured) or the seed CSV, plus RSS news.

Usage (from agent/, venv active):
  python -m did_agent.publish              # Notion if set up, else CSV; includes news
  python -m did_agent.publish --no-news    # skip the (network) news fetch
  python -m did_agent.publish --csv PATH   # force a specific CSV source

Re-run after scrapes/scoring to refresh. Task Scheduler can run it on a cadence.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

from did_agent.config import load_settings
from did_agent.models import Grant, load_grants_csv

_AGENT_DIR = Path(__file__).resolve().parents[1]
_TEMPLATE = _AGENT_DIR / "dashboard" / "template.html"
_OUTPUT = _AGENT_DIR / "dashboard" / "grants-dashboard.html"
_DEFAULT_CSV = _AGENT_DIR.parent / "data" / "grants.csv"


def _grant_dict(g: Grant) -> dict:
    return {
        "funder": g.funder, "type": g.type, "amount": g.amount, "amount_note": g.amount_note,
        "deadline": g.deadline, "deadline_note": g.deadline_note, "requires_501c3": g.requires_501c3,
        "bucket": g.bucket, "status": g.status, "score": g.score, "link": g.link, "fit_notes": g.fit_notes,
    }


def _load_grants(settings, csv_override: str | None) -> tuple[list[Grant], str]:
    if csv_override:
        return load_grants_csv(csv_override), f"CSV ({csv_override})"
    if settings.notion_grants_data_source_id:
        from did_agent.notion_store import NotionStore  # deferred (only when Notion configured)

        return NotionStore(settings).list_grants(), "Notion"
    return load_grants_csv(_DEFAULT_CSV), "CSV seed"


def publish(csv_override: str | None = None, include_news: bool = True, now_iso: str | None = None) -> Path:
    settings = load_settings()
    grants, source = _load_grants(settings, csv_override)

    news: list[dict] = []
    if include_news:
        from did_agent.clients import feeds  # deferred

        news = [{"source": n["source"], "title": n["title"], "link": n["link"]} for n in feeds.fetch_digest()]

    data = {
        "generated_at": now_iso or datetime.now().isoformat(timespec="minutes"),
        "source": source,
        "grants": [_grant_dict(g) for g in grants],
        "news": news,
    }
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")  # keep </script> safe
    html = _TEMPLATE.read_text(encoding="utf-8").replace("__DATA__", payload)
    _OUTPUT.write_text(html, encoding="utf-8")
    return _OUTPUT


def main(argv: list[str]) -> None:
    csv_override = None
    include_news = True
    i = 0
    while i < len(argv):
        if argv[i] == "--no-news":
            include_news = False
        elif argv[i] == "--csv" and i + 1 < len(argv):
            csv_override = argv[i + 1]
            i += 1
        i += 1
    out = publish(csv_override, include_news)
    print(f"Wrote {out}  (open it in a browser — data is embedded, no server needed).")


if __name__ == "__main__":
    main(sys.argv[1:])
