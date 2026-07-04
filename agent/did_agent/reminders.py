"""Reminder + digest logic (Phase 6) — pure functions over grants + a reference date.

Kept free of Telegram/Notion so the cadence rules are unit-testable with a fixed 'today'.
Cadence (per the brief): a grant is reminded every day it sits within REMINDER_LEAD_DAYS of its
deadline, until it's filled (Submitted/Applied) or the deadline passes.
"""

from __future__ import annotations

from datetime import date

from did_agent.models import Grant

# Statuses that mean "no more reminders" — filled or out of consideration.
_TERMINAL = {"Submitted", "Applied", "Skipped", "Not eligible", "Declined"}


def _deadline_date(g: Grant) -> date | None:
    if not g.deadline:
        return None
    try:
        return date.fromisoformat(g.deadline)
    except ValueError:
        return None


def days_until(g: Grant, today: date) -> int | None:
    d = _deadline_date(g)
    return (d - today).days if d else None


def due_reminders(grants: list[Grant], today: date, lead_days: int = 7) -> list[Grant]:
    """Grants inside the reminder window (0..lead_days days out) that still need action."""
    out = []
    for g in grants:
        n = days_until(g, today)
        if n is None or n < 0 or n > lead_days:
            continue
        if g.status in _TERMINAL:
            continue
        out.append(g)
    out.sort(key=lambda g: days_until(g, today) or 0)
    return out


def format_reminder(due: list[Grant], today: date) -> str:
    if not due:
        return ""
    lines = ["⏰ *Grant deadlines within 7 days:*"]
    for g in due:
        n = days_until(g, today)
        when = "DUE TODAY" if n == 0 else f"{n} day{'s' if n != 1 else ''} left"
        amt = f"${g.amount:,.0f}" if g.amount else (g.amount_note or "")
        lines.append(f"• *{g.funder}* — {when} ({g.deadline}){f', {amt}' if amt else ''}")
        if g.next_action:
            lines.append(f"   ↳ {g.next_action}")
        if g.link:
            lines.append(f"   {g.link}")
    return "\n".join(lines)


def format_digest(grants: list[Grant], news_items: list[dict], today: date, lead_days: int = 7) -> str:
    """The Monday 9AM digest: what's due soon, top actionable prospects, and a few headlines."""
    parts = [f"📊 *DID grants — Monday digest ({today.isoformat()})*"]

    due = due_reminders(grants, today, lead_days)
    if due:
        parts.append(format_reminder(due, today))
    else:
        parts.append("No deadlines within 7 days.")

    # Actionable-now prospects (OPEN_NOW), highest score first, that aren't done.
    actionable = [
        g for g in grants
        if g.bucket == "OPEN_NOW" and g.status not in _TERMINAL
    ]
    actionable.sort(key=lambda g: (g.score is None, -(g.score or 0)))
    if actionable:
        parts.append("\n*Actionable now (open, no 501c3 blocker):*")
        for g in actionable[:5]:
            sc = f" — {g.score:.0f}/100" if g.score is not None else ""
            parts.append(f"• {g.funder}{sc}")

    if news_items:
        parts.append("\n*Grant/news headlines:*")
        for it in news_items[:5]:
            parts.append(f"• [{it.get('source', '')}] {it.get('title', '')}")

    return "\n".join(parts)
