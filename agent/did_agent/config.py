"""Env-backed settings for the DID grant agent.

The reasoning brain is any OpenAI-compatible endpoint. Default = a LOCAL Ollama server
(free, private — grant data never leaves the machine). The same settings point at Groq or
Gemini's OpenAI-compatible endpoints by changing LLM_BASE_URL + LLM_MODEL_* + LLM_API_KEY.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()  # read .env if present; real env vars take precedence


def _csv_ints(raw: str | None) -> list[int]:
    if not raw:
        return []
    return [int(p.strip()) for p in raw.split(",") if p.strip()]


@dataclass(frozen=True)
class Settings:
    # LLM provider (OpenAI-compatible; default local Ollama)
    llm_base_url: str
    llm_api_key: str
    llm_model_reasoning: str
    llm_model_router: str
    # Telegram
    telegram_bot_token: str
    telegram_allowed_chat_ids: list[int]
    # Notion
    notion_token: str
    notion_grants_data_source_id: str
    notion_parent_page_id: str
    # Google Docs (optional)
    google_service_account_json: str
    google_template_doc_id: str
    google_output_folder_id: str = ""
    # Behavior
    timezone: str = "America/New_York"
    reminder_lead_days: int = 7
    whisper_model: str = "base"  # local speech-to-text for voice notes (faster-whisper)

    @property
    def telegram_allow_all(self) -> bool:
        """Dev-only: empty allowlist = respond to any chat."""
        return not self.telegram_allowed_chat_ids

    def missing(self) -> list[str]:
        """Required secrets to *start* the bot. The LLM is a local server (no secret needed)."""
        required = {
            "TELEGRAM_BOT_TOKEN": self.telegram_bot_token,
            "NOTION_TOKEN": self.notion_token,
        }
        return [k for k, v in required.items() if not v]


def load_settings() -> Settings:
    return Settings(
        llm_base_url=os.getenv("LLM_BASE_URL", "http://localhost:11434/v1"),
        llm_api_key=os.getenv("LLM_API_KEY", "ollama"),  # Ollama ignores it; SDK needs non-empty
        llm_model_reasoning=os.getenv("LLM_MODEL_REASONING", "llama3.1:8b"),
        llm_model_router=os.getenv("LLM_MODEL_ROUTER", "llama3.2:3b"),
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
        whisper_model=os.getenv("WHISPER_MODEL", "base"),
    )
