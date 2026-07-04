"""One-time Notion setup: create the grants database, then seed it from grants.csv.

Usage (from agent/, with .venv active and .env filled):
  python -m did_agent.bootstrap create           # creates the DB, prints NOTION_GRANTS_DATA_SOURCE_ID
  python -m did_agent.bootstrap seed [csv_path]   # upserts rows (default: repo data/grants.csv)

After `create`, paste the printed data-source id into .env, then run `seed`.
Idempotent: `seed` upserts by funder name, so re-running updates rather than duplicating.
"""

from __future__ import annotations

import sys
from pathlib import Path

from did_agent.config import load_settings
from did_agent.models import load_grants_csv
from did_agent.notion_store import NotionStore

_DEFAULT_CSV = Path(__file__).resolve().parents[2] / "data" / "grants.csv"


def cmd_create() -> None:
    store = NotionStore(load_settings())
    ds_id = store.create_database()
    print("\nCreated the DID grants database.")
    print("Add this line to your .env, then run `python -m did_agent.bootstrap seed`:\n")
    print(f"NOTION_GRANTS_DATA_SOURCE_ID={ds_id}\n")


def cmd_seed(csv_path: Path) -> None:
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")
    store = NotionStore(load_settings())
    grants = load_grants_csv(csv_path)
    print(f"Seeding {len(grants)} grants from {csv_path} ...")
    for i, g in enumerate(grants, 1):
        store.upsert(g)
        print(f"  [{i:>2}/{len(grants)}] {g.funder[:60]}  ({g.bucket})")
    print("Done.")


def main(argv: list[str]) -> None:
    if not argv or argv[0] not in {"create", "seed"}:
        raise SystemExit("Usage: python -m did_agent.bootstrap {create|seed [csv_path]}")
    if argv[0] == "create":
        cmd_create()
    else:
        csv_path = Path(argv[1]) if len(argv) > 1 else _DEFAULT_CSV
        cmd_seed(csv_path)


if __name__ == "__main__":
    main(sys.argv[1:])
