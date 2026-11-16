"""RSS grant/news feeds for the weekly digest — parsed with feedparser, resilient to dead feeds."""

from __future__ import annotations

import re

import feedparser

# Free feeds for the Monday digest. Resilient: a dead/blocked feed is skipped, not fatal.
# (Cloudflare-protected sources like PND's RFP page are intentionally omitted — they 403 bots.)
DIGEST_FEEDS = [
    ("New York Community Trust", "https://www.nycommunitytrust.org/feed/"),
    ("CitizensNYC", "https://www.citizensnyc.org/feed"),
    ("NYFA", "https://www.nyfa.org/feed/"),
    ("grants.gov new opps", "https://grants.gov/rss/GG_NewOppByCategory.xml"),
    ("Disability Scoop", "https://www.disabilityscoop.com/feed/"),
    ("Chronicle of Philanthropy", "https://www.philanthropy.com/feed"),
]

# NYC funder feeds are blogs: keep only grant-related titles, else the headlines are noise.
_NYC_SOURCES = {"New York Community Trust", "CitizensNYC", "NYFA"}
_GRANT_TITLE = re.compile(r"grant|rfp|funding|fellowship|award|apply|application|deadline", re.I)


def fetch_digest(feeds: list[tuple[str, str]] | None = None, per_feed: int = 5) -> list[dict]:
    """Return recent entries across feeds: {source, title, link, published}. Never raises on a bad feed."""
    feeds = feeds or DIGEST_FEEDS
    items: list[dict] = []
    for source, url in feeds:
        try:
            parsed = feedparser.parse(url)
        except Exception:
            continue
        entries = parsed.entries
        if source in _NYC_SOURCES:  # filter by title first, then take the newest per_feed matches
            entries = [e for e in entries if _GRANT_TITLE.search(getattr(e, "title", ""))]
        for e in entries[:per_feed]:
            title = getattr(e, "title", "").strip()
            link = getattr(e, "link", "").strip()
            if title:
                items.append(
                    {
                        "source": source,
                        "title": title,
                        "link": link,
                        "published": getattr(e, "published", "") or getattr(e, "updated", ""),
                    }
                )
    return items
