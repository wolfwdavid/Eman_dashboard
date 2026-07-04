"""schedule (Phase 6): on-demand reminder / digest / upcoming-deadline views.

The proactive daily reminders + Monday 9AM digest are fired automatically by the bot's JobQueue
(see main.py). This tool lets Eman ask for the same views on demand ("what's due?", "give me the digest").
"""

from __future__ import annotations

from datetime import date

from did_agent import reminders
from did_agent.clients import feeds
from did_agent.config import Settings
from did_agent.llm.client import SimpleTool
from did_agent.notion_store import NotionStore

_SCHEMA = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["run_daily_reminders", "run_weekly_digest", "list_upcoming"],
            "description": "Which view to compute now",
        },
    },
    "required": ["action"],
}


def build(settings: Settings) -> SimpleTool:
    store = NotionStore(settings)

    def run(tool_input: dict) -> str:
        action = tool_input.get("action")
        today = date.today()
        try:
            grants = store.list_grants()
        except Exception as exc:
            return f"Notion not ready ({exc}). Run `bootstrap create` + `seed` first."

        if action == "run_daily_reminders":
            due = reminders.due_reminders(grants, today, settings.reminder_lead_days)
            return reminders.format_reminder(due, today) or "No grant deadlines within the next 7 days."

        if action == "run_weekly_digest":
            news = feeds.fetch_digest()
            return reminders.format_digest(grants, news, today, settings.reminder_lead_days)

        if action == "list_upcoming":
            dated = [(reminders.days_until(g, today), g) for g in grants]
            upcoming = sorted((x for x in dated if x[0] is not None and x[0] >= 0), key=lambda x: x[0])
            if not upcoming:
                return "No dated upcoming deadlines."
            return "\n".join(f"{n}d: {g.funder} ({g.deadline})" for n, g in upcoming[:15])

        return f"Unknown action: {action}"

    return SimpleTool(
        name="schedule",
        description="Compute reminder/digest views on demand: daily deadline reminders (within 7 days), the "
        "Monday grants+news digest, or a list of upcoming dated deadlines.",
        input_schema=_SCHEMA,
        func=run,
    )
