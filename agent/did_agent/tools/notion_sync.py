"""notion_sync (Phase 2): read / look up / upsert grants in the Notion grants DB (source of truth)."""

from __future__ import annotations

from did_agent.config import Settings
from did_agent.llm.client import SimpleTool
from did_agent.models import (
    Grant,
    bucket_from_501c3,
    normalize_501c3,
    parse_amount,
    parse_deadline,
)
from did_agent.notion_store import NotionStore

_SCHEMA = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["list", "get", "upsert"],
            "description": "list = all grants; get = one by funder; upsert = create-or-update by funder",
        },
        "funder": {"type": "string", "description": "Funder/Program name (key for get/upsert)"},
        "fields": {
            "type": "object",
            "description": "For upsert: any of amount, deadline (ISO or free text), status, fit, "
            "requires_501c3, bucket, next_action, link, score, rationale, type",
        },
    },
    "required": ["action"],
}


def _to_float(v) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return parse_amount(str(v))


def _apply_fields(g: Grant, fields: dict) -> None:
    if "type" in fields:
        g.type = str(fields["type"])
    if "amount" in fields:
        g.amount = _to_float(fields["amount"])
        g.amount_note = str(fields["amount"])
    if "deadline" in fields:
        raw = str(fields["deadline"])
        g.deadline = parse_deadline(raw) or (raw if len(raw) == 10 and raw[4] == "-" else None)
        g.deadline_note = raw
    if "status" in fields:
        g.status = str(fields["status"])
    if "fit" in fields:
        g.fit_notes = str(fields["fit"])
    if "requires_501c3" in fields:
        g.requires_501c3 = normalize_501c3(str(fields["requires_501c3"]))
        g.bucket = bucket_from_501c3(g.requires_501c3)
    if "bucket" in fields:
        g.bucket = str(fields["bucket"])
    if "next_action" in fields:
        g.next_action = str(fields["next_action"])
    if "link" in fields:
        g.link = str(fields["link"])
    if "score" in fields:
        g.score = _to_float(fields["score"])
    if "rationale" in fields:
        g.rationale = str(fields["rationale"])


def _fmt(g: Grant) -> str:
    amt = f"${g.amount:,.0f}" if g.amount is not None else (g.amount_note or "?")
    due = g.deadline or (g.deadline_note or "—")
    score = f" score={g.score:.0f}" if g.score is not None else ""
    return f"- {g.funder} | {g.bucket} | due {due} | {amt} | {g.status}{score}"


def build(settings: Settings) -> SimpleTool:
    store = NotionStore(settings)  # Client construction does not hit the network

    def run(tool_input: dict) -> str:
        action = tool_input.get("action")
        if action == "list":
            grants = store.list_grants()
            if not grants:
                return "No grants in Notion yet. Seed with `python -m did_agent.bootstrap seed`."
            grants.sort(key=lambda g: g.deadline or "9999-99-99")
            head = grants[:40]
            body = "\n".join(_fmt(g) for g in head)
            more = f"\n… and {len(grants) - len(head)} more." if len(grants) > len(head) else ""
            return f"{len(grants)} grants:\n{body}{more}"

        if action == "get":
            funder = tool_input.get("funder")
            if not funder:
                return "get requires a 'funder'."
            g = store.get_grant(funder)
            if not g:
                return f"No grant found named '{funder}'."
            return (
                f"{g.funder}\n  type: {g.type}\n  amount: {g.amount_note or g.amount}\n"
                f"  deadline: {g.deadline_note or g.deadline}\n  501c3: {g.requires_501c3}\n"
                f"  bucket: {g.bucket}\n  status: {g.status}\n  fit: {g.fit_notes}\n"
                f"  next: {g.next_action}\n  score: {g.score}\n  link: {g.link}"
            )

        if action == "upsert":
            funder = tool_input.get("funder")
            if not funder:
                return "upsert requires a 'funder'."
            g = store.get_grant(funder) or Grant(funder=funder, source="manual")
            _apply_fields(g, tool_input.get("fields") or {})
            store.upsert(g)
            return f"Saved '{funder}' ({g.bucket}, {g.status})."

        return f"Unknown action: {action}"

    return SimpleTool(
        name="notion_sync",
        description="Read, look up, or upsert grant opportunities in the DID Notion grants database "
        "(the source of truth). Always use this before answering questions about grant data, and to "
        "record changes (status, next action, score).",
        input_schema=_SCHEMA,
        func=run,
    )
