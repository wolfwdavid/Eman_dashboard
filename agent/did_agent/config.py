"""Env-backed settings for the DID grant agent.

All secrets come from the environment (loaded from a git-ignored `.env`).
Nothing secret is ever hard-coded or logged.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()  # read .env if present; real env vars take precedence

# Model IDs — do not append date suffixes.
MODEL_REASONING = "claude-opus-4-8"   # scoring, drafting, RFP reading
MODEL_ROUTER = "claude-haiku-4-5"     # cheap intent classification


def _csv_ints(raw: str | None) -> list[int]:
    if not raw:
        return []
    out: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if part:
            out.append(int(part))
    return out


@dataclass(frozen=True)
class Settings:
    anthropic_api_key: str
    telegram_bot_token: str
    telegram_allowed_chat_ids: list[int]
    notion_token: str
    notion_grants_data_source_id: str  # resolved once via bootstrap; cache in .env
    notion_parent_page_id: str         # page (shared with the integration) to create the DB under
    google_service_account_json: str
    google_template_doc_id: str
    google_output_folder_id: str = ""
    timezone: str = "America/New_York"
    reminder_lead_days: int = 7

    @property
    def telegram_allow_all(self) -> bool:
        """Dev-only: empty allowlist = respond to any chat."""
        return not self.telegram_allowed_chat_ids

    def missing(self) -> list[str]:
        """Return names of required secrets that are empty (for a friendly startup error)."""
        # Required to *start* the bot. NOTION_GRANTS_DATA_SOURCE_ID is not here: it's filled by
        # `bootstrap create` and only needed when a Notion tool actually runs.
        required = {
            "ANTHROPIC_API_KEY": self.anthropic_api_key,
            "TELEGRAM_BOT_TOKEN": self.telegram_bot_token,
            "NOTION_TOKEN": self.notion_token,
        }
        return [k for k, v in required.items() if not v]


def load_settings() -> Settings:
    return Settings(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
        telegram_allowed_chat_ids=_csv_ints(os.getenv("TELEGRAM_ALLOWED_CHAT_IDS")),
        notion_token=os.getenv("NOTION_TOKEN", ""),
        notion_grants_data_source_id=os.getenv("NOTION_GRANTS_DATA_SOURCE_ID", ""),
        notion_parent_page_id=os.getenv("NOTION_PARENT_PAGE_ID", ""),
        google_service_account_json=os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", ""),
        google_template_doc_id=os.getenv("GOOGLE_TEMPLATE_DOC_ID", ""),
        google_output_folder_id=os.getenv("GOOGLE_OUTPUT_FOLDER_ID", ""),
        timezone=os.getenv("TIMEZONE", "America/New_York"),
        reminder_lead_days=int(os.getenv("REMINDER_LEAD_DAYS", "7")),
    )
