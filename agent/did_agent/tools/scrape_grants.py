"""scrape_grants (Phase 3): find new opportunities — grants.gov (federal) + ProPublica + RSS news.

Federal opportunities are normalized and upserted into Notion (the source of truth). Foundation
prospects (ProPublica) and news items are surfaced for review, not auto-added (they're leads, not
open calls). Degrades gracefully if the Notion DB isn't set up yet.
"""

from __future__ import annotations

from collections import Counter

from did_agent.clients import feeds, grants_gov, propublica
from did_agent.config import Settings
from did_agent.llm.client import SimpleTool
from did_agent.notion_store import NotionStore

_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {"type": "string", "description": "Keywords, e.g. 'disability' or 'accessibility nonprofit'"},
        "sources": {
            "type": "array",
            "items": {"type": "string", "enum": ["grants_gov", "foundations", "news"]},
            "description": "Which source families to search (default: all three)",
        },
        "max_results": {"type": "integer", "default": 8, "description": "Max federal opps to fetch+save"},
    },
    "required": ["query"],
}


def build(settings: Settings) -> SimpleTool:
    store = NotionStore(settings)

    def run(tool_input: dict) -> str:
        query = tool_input.get("query", "disability")
        sources = tool_input.get("sources") or ["grants_gov", "foundations", "news"]
        max_results = int(tool_input.get("max_results", 8))
        lines: list[str] = []

        if "grants_gov" in sources:
            try:
                hits = grants_gov.search(query, max_records=max_results * 2)
                grants = []
                for h in hits[:max_results]:
                    try:
                        grants.append(grants_gov.to_grant(h, grants_gov.fetch(h["id"])))
                    except Exception:
                        continue
                saved = unsaved = 0
                for g in grants:
                    try:
                        store.upsert(g)
                        saved += 1
                    except Exception:
                        unsaved += 1
                dist = dict(Counter(g.bucket for g in grants))
                note = f", {unsaved} not saved (run `bootstrap create` to set up Notion)" if unsaved else ""
                lines.append(f"grants.gov: {len(grants)} federal opps for '{query}' {dist}; saved {saved}{note}")
                for g in [x for x in grants if x.bucket == "OPEN_NOW"][:5]:
                    due = g.deadline or g.deadline_note or "—"
                    lines.append(f"  OPEN_NOW: {g.funder[:58]} | {g.amount_note} | due {due}")
            except Exception as exc:
                lines.append(f"grants.gov: error — {exc}")

        if "foundations" in sources:
            try:
                leads = propublica.search_funders(query)
                lines.append(f"ProPublica funder leads (NY 501c3): {len(leads)} — research, not auto-added:")
                for l in leads[:6]:
                    lines.append(f"  {l['name'][:58]} (EIN {l['ein']})")
            except Exception as exc:
                lines.append(f"foundations: error — {exc}")

        if "news" in sources:
            try:
                items = feeds.fetch_digest()
                lines.append(f"News/RFP feed items: {len(items)}")
                for it in items[:5]:
                    lines.append(f"  [{it['source']}] {it['title'][:68]}")
            except Exception as exc:
                lines.append(f"news: error — {exc}")

        return "\n".join(lines) if lines else "No sources selected."

    return SimpleTool(
        name="scrape_grants",
        description="Search external sources for new grant opportunities relevant to a disability-equity "
        "nonprofit: grants.gov (federal, auto-saved to Notion with eligibility buckets), ProPublica "
        "(foundation funder leads), and RSS news feeds. Returns a summary of what was found and saved.",
        input_schema=_SCHEMA,
        func=run,
    )
