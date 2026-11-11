"""Mon/Wed/Fri grant sweep logic: weekday constants, new-grant diff, state file, message format.

Pure stdlib + models/reminders (no Telegram/Notion) so it is unit-testable offline.
"""

from __future__ import annotations

import dataclasses
import json
import os
import tempfile
from datetime import date
from pathlib import Path

from did_agent.models import Grant
from did_agent.reminders import _TERMINAL, days_until

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
    """Atomically write the sweep result (temp file + os.replace)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict = {"date": today.isoformat(), "new": [dataclasses.asdict(g) for g in new]}
    if seen is not None:
        payload["seen"] = sorted(seen)
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


def top_open_now(new: list[Grant], n: int = 3) -> list[Grant]:
    """Best `n` actionable OPEN_NOW grants: score desc, deadline asc, then funder."""
    cands = [g for g in new if g.bucket == "OPEN_NOW" and g.status not in _TERMINAL]
    cands.sort(
        key=lambda g: (
            g.score is None,
            -(g.score or 0),
            g.deadline is None,
            g.deadline or "",
            g.funder,
        )
    )
    return cands[:n]


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
