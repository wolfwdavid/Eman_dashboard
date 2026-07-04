"""schedule (Phase 6): deadline reminders (T-7 daily) + Monday 9AM grants/news digest."""

from __future__ import annotations

from did_agent.config import Settings
from did_agent.llm.client import SimpleTool

_SCHEMA = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["run_daily_reminders", "run_weekly_digest", "list_upcoming"],
            "description": "What scheduled job to run or inspect",
        },
    },
    "required": ["action"],
}


def build(settings: Settings) -> SimpleTool:
    def run(tool_input: dict) -> str:
        raise NotImplementedError(
            "Phase 6 — reminder cadence: for each grant with a deadline within REMINDER_LEAD_DAYS, "
            "message Eman daily until Status=filled or the deadline passes. Weekly: Monday 9AM "
            "(settings.timezone) grants+news digest. Fired by Windows Task Scheduler entries."
        )

    return SimpleTool(
        name="schedule",
        description="Run or inspect the reminder/digest jobs: daily deadline reminders (within the "
        "lead window, until filled or past due) and the Monday 9AM grants + news digest.",
        input_schema=_SCHEMA,
        func=run,
    )
