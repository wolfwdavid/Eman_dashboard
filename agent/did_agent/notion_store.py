"""Notion grants store — pinned to the 2025-09-03 data-source API model.

Key facts (from RESEARCH.md):
  - A database contains one or more *data sources*; schema/query/insert live on the data source.
  - Query with `data_sources.query(data_source_id=...)` (the old `databases.query` now 400s).
  - Create pages with parent `{"type": "data_source_id", "data_source_id": DS_ID}`.
  - ~3 req/s rate limit -> small sleep in batch loops. SDK auto-retries 429s.
  - No native upsert -> query-by-title then create-or-update. Share the DB with the integration first.
"""

from __future__ import annotations

import time

from notion_client import Client
from notion_client.helpers import iterate_paginated_api

from did_agent.config import Settings
from did_agent.models import (
    BUCKET_OPTIONS,
    C3_OPTIONS,
    PROP_501C3,
    PROP_AMOUNT,
    PROP_AMOUNT_NOTE,
    PROP_BUCKET,
    PROP_DEADLINE,
    PROP_DEADLINE_NOTE,
    PROP_FIT,
    PROP_FUNDER,
    PROP_LINK,
    PROP_NEXT,
    PROP_RATIONALE,
    PROP_SCORE,
    PROP_SOURCE,
    PROP_STATUS,
    PROP_TYPE,
    SOURCE_OPTIONS,
    STATUS_OPTIONS,
    TYPE_OPTIONS,
    Grant,
)

_BATCH_SLEEP = 0.35  # stay under ~3 req/s in loops


def _select_schema(options: list[str]) -> dict:
    return {"select": {"options": [{"name": o} for o in options]}}


# The database schema (property *definitions* — distinct from property *values*).
SCHEMA: dict = {
    PROP_FUNDER: {"title": {}},
    PROP_TYPE: _select_schema(TYPE_OPTIONS),
    PROP_AMOUNT: {"number": {"format": "dollar"}},
    PROP_AMOUNT_NOTE: {"rich_text": {}},
    PROP_DEADLINE: {"date": {}},
    PROP_DEADLINE_NOTE: {"rich_text": {}},
    PROP_501C3: _select_schema(C3_OPTIONS),
    PROP_BUCKET: _select_schema(BUCKET_OPTIONS),
    PROP_FIT: {"rich_text": {}},
    PROP_STATUS: _select_schema(STATUS_OPTIONS),
    PROP_NEXT: {"rich_text": {}},
    PROP_LINK: {"url": {}},
    PROP_SCORE: {"number": {}},
    PROP_RATIONALE: {"rich_text": {}},
    PROP_SOURCE: _select_schema(SOURCE_OPTIONS),
}


class NotionStore:
    def __init__(self, settings: Settings) -> None:
        self._client = Client(auth=settings.notion_token)
        self._ds_id = settings.notion_grants_data_source_id
        self._parent_page_id = settings.notion_parent_page_id

    # --- one-time setup -------------------------------------------------------
    def create_database(self, title: str = "DID Grants Tracker") -> str:
        """Create the grants database under NOTION_PARENT_PAGE_ID; return its data_source_id.

        Print/store the returned id in .env as NOTION_GRANTS_DATA_SOURCE_ID.
        """
        if not self._parent_page_id:
            raise RuntimeError("Set NOTION_PARENT_PAGE_ID (a page shared with the integration) first.")
        resp = self._client.databases.create(
            parent={"type": "page_id", "page_id": self._parent_page_id},
            title=[{"type": "text", "text": {"content": title}}],
            initial_data_source={"properties": SCHEMA},
        )
        ds_id = self._extract_data_source_id(resp)
        self._ds_id = ds_id
        return ds_id

    def _extract_data_source_id(self, db_obj: dict) -> str:
        sources = db_obj.get("data_sources")
        if sources:
            return sources[0]["id"]
        # Fall back to a fresh retrieve if create didn't echo data_sources.
        retrieved = self._client.databases.retrieve(database_id=db_obj["id"])
        return retrieved["data_sources"][0]["id"]

    def _require_ds(self) -> str:
        if not self._ds_id:
            raise RuntimeError(
                "NOTION_GRANTS_DATA_SOURCE_ID not set. Run `python -m did_agent.bootstrap create` first."
            )
        return self._ds_id

    # --- CRUD -----------------------------------------------------------------
    def query_by_funder(self, funder: str) -> dict | None:
        resp = self._client.data_sources.query(
            data_source_id=self._require_ds(),
            filter={"property": PROP_FUNDER, "title": {"equals": funder}},
            page_size=1,
        )
        results = resp.get("results", [])
        return results[0] if results else None

    def upsert(self, grant: Grant) -> str:
        """Create-or-update by exact funder title. Returns the page id."""
        props = grant.to_notion_properties()
        existing = self.query_by_funder(grant.funder)
        if existing:
            self._client.pages.update(page_id=existing["id"], properties=props)
            page_id = existing["id"]
        else:
            page = self._client.pages.create(
                parent={"type": "data_source_id", "data_source_id": self._require_ds()},
                properties=props,
            )
            page_id = page["id"]
        time.sleep(_BATCH_SLEEP)
        return page_id

    def list_grants(self) -> list[Grant]:
        ds = self._require_ds()
        return [
            Grant.from_notion_page(page)
            for page in iterate_paginated_api(self._client.data_sources.query, data_source_id=ds)
        ]

    def get_grant(self, funder: str) -> Grant | None:
        page = self.query_by_funder(funder)
        return Grant.from_notion_page(page) if page else None
