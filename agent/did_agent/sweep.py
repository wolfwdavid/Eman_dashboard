"""Mon/Wed/Fri grant sweep logic: weekday constants, new-grant diff, state file, drafts, message format.

Pure stdlib + models/reminders (no Telegram/Notion) so it is unit-testable offline.
"""

from __future__ import annotations

import asyncio
import dataclasses
import json
import logging
import os
import tempfile
from collections.abc import Awaitable, Callable
from datetime import date
from pathlib import Path

from did_agent.models import Grant
from did_agent.reminders import _TERMINAL, days_until

log = logging.getLogger("did_agent.sweep")

# python-telegram-bot 22.x JobQueue.run_daily numbering: 0 = Sunday ... 6 = Saturday
# (see telegram/ext/_jobqueue.py _CRON_MAPPING). NOT the Python weekday() numbering.
SUNDAY, MONDAY_N, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY = range(7)
MONDAY = (MONDAY_N,)
MON_WED_FRI = (MONDAY_N, WEDNESDAY, FRIDAY)

TELEGRAM_LIMIT = 4096

DEFAULT_STATE_PATH = Path(
    os.environ.get("SWEEP_STATE_PATH")
    or Path(__file__).resolve().parents[1] / "data" / "local" / "sweep_state.json"
)

_DEFAULT_NEXT = {
    "OPEN_NOW": "Review fit and start a draft",
    "VIA_FISCAL_SPONSOR": "Confirm fiscal sponsor can apply",
    "AFTER_501C3": "Park until 501(c)(3) is approved",
    "NOT_ELIGIBLE": "No action - not eligible",
}


def _key(funder: str) -> str:
    return funder.strip().casefold()


def new_grants(before: set[str] | list[Grant], after: list[Grant]) -> list[Grant]:
    """Grants in `after` whose funder is absent from `before` (order preserved).

    `before` is either a list of grants or a set of already-normalized funder keys.
    """
    seen = set(before) if isinstance(before, (set, frozenset)) else {_key(g.funder) for g in before}
    out: list[Grant] = []
    for g in after:
        k = _key(g.funder)
        if k not in seen:
            seen.add(k)
            out.append(g)
    return out


def seen_keys(grants: list[Grant]) -> set[str]:
    """Normalized funder keys for a list of grants."""
    return {_key(g.funder) for g in grants}


def sweep_new(previous_seen: set[str] | None, before: list[Grant], after: list[Grant]) -> list[Grant]:
    """New = not in the previous sweep's `seen`; fall back to the pre-scrape list when there is none."""
    return new_grants(previous_seen if previous_seen is not None else before, after)


def load_previous_seen(path: str | Path) -> set[str] | None:
    """The `seen` keys from the last sweep's state file, whatever its date; None if unavailable."""
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        seen = data["seen"]
        if not isinstance(seen, list) or not all(isinstance(k, str) for k in seen):
            return None
        return set(seen)
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return None


def save_state(
    path: str | Path, today: date, new: list[Grant], seen: set[str] | None = None
) -> None:
    """Atomically write the sweep result. A new sweep starts with no drafts recorded."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict = {"date": today.isoformat(), "new": [dataclasses.asdict(g) for g in new]}
    if seen is not None:
        payload["seen"] = sorted(seen)
    _write_json(path, payload)


def _write_json(path: Path, payload: dict) -> None:
    """Atomic write: temp file in the same directory, then os.replace."""
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def load_state(path: str | Path, today: date) -> list[Grant] | None:
    """Return today's new grants, or None if the file is missing/corrupt/not from today."""
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        if data.get("date") != today.isoformat():
            return None
        fields = {f.name for f in dataclasses.fields(Grant)}
        return [Grant(**{k: v for k, v in item.items() if k in fields}) for item in data["new"]]
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return None


def save_drafts(path: str | Path, today: date, drafts: dict[str, str], note: str = "") -> bool:
    """Record today's draft links (funder -> URL) and note in today's sweep state file.

    The rest of the file is kept as it is. Returns False, writing nothing, when the file
    is missing, unreadable or not from today's sweep: drafts belong to one sweep.
    """
    path = Path(path)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or data.get("date") != today.isoformat():
            return False
        data["drafts"] = dict(drafts)
        data["draft_note"] = note
        _write_json(path, data)
        return True
    except (OSError, ValueError):
        return False


def load_drafts(path: str | Path, today: date) -> tuple[dict[str, str], str] | None:
    """Today's recorded (drafts, note), or None if none were recorded for today's sweep.

    None also covers a missing, corrupt or old-format file (one written before drafts
    were stored), so the caller simply creates the drafts.
    """
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        if data.get("date") != today.isoformat():
            return None
        drafts = data["drafts"]
        note = data.get("draft_note", "")
        if not isinstance(drafts, dict) or not isinstance(note, str):
            return None
        if not all(isinstance(k, str) and isinstance(v, str) for k, v in drafts.items()):
            return None
        return dict(drafts), note
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return None


async def todays_drafts(
    path: str | Path,
    today: date,
    cache: dict,
    lock: asyncio.Lock,
    create: Callable[[], Awaitable[tuple[dict[str, str], str]]],
) -> tuple[dict[str, str], str]:
    """Today's (drafts, note), creating them at most once however many callers ask.

    The 8:45 message runs once per chat and those jobs overlap, so the whole
    look-up-or-create step is serialized by `lock` and checked again inside it. Lookup
    order: `cache` (this process), then the state file (survives a restart), and only
    then `create()`, whose result is stored in both. `cache` is a dict with the keys
    date, drafts and note.
    """
    async with lock:
        if cache.get("date") != today:
            found = load_drafts(path, today)
            if found is None:
                found = await create()
                if not save_drafts(path, today, *found):
                    log.warning("sweep: could not record today's draft links in %s", path)
            cache.update(date=today, drafts=found[0], note=found[1])
        return cache["drafts"], cache["note"]


def top_open_now(new: list[Grant], today: date, n: int = 3) -> list[Grant]:
    """Best `n` actionable OPEN_NOW grants: score desc, deadline asc, then funder.

    A grant whose deadline is before `today` is left out: a draft for it would cost an
    LLM call and a Google Doc for nothing. A deadline of today still counts. Grants with
    no usable deadline date stay eligible and sort after the dated ones of equal score.
    """
    # (grant, days left) with days left None for a grant that has no usable deadline date.
    cands = [(g, days_until(g, today)) for g in new if g.bucket == "OPEN_NOW" and g.status not in _TERMINAL]
    cands = [(g, left) for g, left in cands if left is None or left >= 0]
    cands.sort(
        key=lambda c: (
            c[0].score is None,
            -(c[0].score or 0),
            c[1] is None,
            c[1] or 0,
            c[0].funder,
        )
    )
    return [g for g, _ in cands[:n]]


def _block(g: Grant, today: date) -> str:
    amt = f"${g.amount:,.0f}" if g.amount else (g.amount_note or "TBD")
    dl = g.deadline or g.deadline_note or "none listed"
    n = days_until(g, today)
    if n is not None:
        dl += " (DUE TODAY)" if n == 0 else f" ({n} day{'s' if n != 1 else ''} left)" if n > 0 else " (passed)"
    nxt = g.next_action or _DEFAULT_NEXT.get(g.bucket, "Research eligibility")
    lines = [
        f"- {g.funder}",
        f"  Amount: {amt}",
        f"  Deadline: {dl}",
        f"  Eligibility: {g.bucket}",
    ]
    if g.link:
        lines.append(f"  Link: {g.link}")
    lines.append(f"  Next step: {nxt}")
    return "\n".join(lines)


def format_sweep_message(
    new: list[Grant],
    drafts: dict[str, str],
    today: date,
    state_ok: bool = True,
    draft_note: str = "",
) -> str:
    """Plain-text 8:45 message (no Markdown: funder names/URLs contain special characters)."""
    d = today.isoformat()
    if not state_ok:
        return f"Sweep result unavailable for {d} - nothing to report."
    if not new:
        return f"No new grants since the last sweep ({d})."

    header = f"New grants since the last sweep ({d}): {len(new)}"
    footer_parts: list[str] = []
    if drafts:
        footer_parts.append("Drafts ready:\n" + "\n".join(f"{f}: {u}" for f, u in drafts.items()))
    if draft_note:
        footer_parts.append(draft_note)
    footer = "\n\n".join(footer_parts)

    blocks = [_block(g, today) for g in new]

    def assemble(k: int) -> str:
        parts = [header, "\n\n".join(blocks[:k])]
        if k < len(blocks):
            parts.append(f"+{len(blocks) - k} more")
        if footer:
            parts.append(footer)
        return "\n\n".join(p for p in parts if p)

    k = len(blocks)
    text = assemble(k)
    while len(text) > TELEGRAM_LIMIT and k > 0:
        k -= 1
        text = assemble(k)
    return text[:TELEGRAM_LIMIT]
