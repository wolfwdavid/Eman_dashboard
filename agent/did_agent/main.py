"""Entrypoint: start the Telegram bot wired to the Claude agent.

Run:  python -m did_agent.main
Windows Task Scheduler runs `supervisor.bat` ("At log on"), which restarts this on any exit.

Phase 1 scope: Eman messages the bot -> Claude (Opus 4.8) replies, with tool scaffolding in place.
Tool bodies + the JobQueue schedules (T-7 reminders, Monday 9AM digest) land in later phases.

Windows notes (from RESEARCH.md): use the blocking `run_polling(stop_signals=None)` pattern — do NOT
wrap it in `asyncio.run` (double-loop error), and `stop_signals=None` is required because the default
ProactorEventLoop has no `add_signal_handler`. Only ONE polling process per token (else 409 Conflict).
"""

from __future__ import annotations

import asyncio
import logging

from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from did_agent.config import load_settings
from did_agent.llm.client import ClaudeAgent, ToolRegistry
from did_agent.tools import register_all

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("did_agent")

# Short per-chat rolling history (in-memory; persistence can move to Notion/SQLite later).
_HISTORY: dict[int, list[dict]] = {}
_HISTORY_TURNS = 12


def _allowed(update: Update, allowed_ids: list[int], allow_all: bool) -> bool:
    chat = update.effective_chat
    return allow_all or (chat is not None and chat.id in allowed_ids)


def main() -> None:
    settings = load_settings()
    missing = settings.missing()
    if missing:
        raise SystemExit(
            "Missing required secrets in .env: " + ", ".join(missing) + ". Copy .env.example -> .env."
        )

    registry = ToolRegistry()
    register_all(registry, settings)
    agent = ClaudeAgent(settings, registry)

    async def on_start(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
        if not _allowed(update, settings.telegram_allowed_chat_ids, settings.telegram_allow_all):
            return
        # The chat_id is required for later unsolicited sends (reminders/digest) — surface it so
        # it can be added to TELEGRAM_ALLOWED_CHAT_IDS / persisted in Phase 6.
        chat_id = update.effective_chat.id if update.effective_chat else "?"
        log.info("Authorized /start from chat_id=%s", chat_id)
        await update.message.reply_text(
            "Hi Eman — I'm your DID grant assistant. Ask me to find, score, or draft grants, "
            f"or check what's due soon. (Your chat id is {chat_id}.)"
        )

    async def on_message(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
        if not _allowed(update, settings.telegram_allowed_chat_ids, settings.telegram_allow_all):
            log.warning(
                "Ignoring message from unauthorized chat %s",
                getattr(update.effective_chat, "id", "?"),
            )
            return
        if not update.message or not update.message.text:
            return
        chat_id = update.effective_chat.id
        text = update.message.text
        history = _HISTORY.get(chat_id, [])

        await update.message.chat.send_action("typing")
        try:
            # agent.respond is a synchronous (blocking) SDK loop — run it off the event loop.
            reply = await asyncio.to_thread(agent.respond, text, history)
        except Exception:  # never crash the bot on one bad turn
            log.exception("agent.respond failed")
            await update.message.reply_text("Something went wrong handling that — try again in a moment.")
            return

        history = (
            history + [{"role": "user", "content": text}, {"role": "assistant", "content": reply}]
        )[-_HISTORY_TURNS:]
        _HISTORY[chat_id] = history
        await update.message.reply_text(reply or "(no reply)")

    app = ApplicationBuilder().token(settings.telegram_bot_token).build()
    app.add_handler(CommandHandler("start", on_start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))

    log.info("DID grant agent starting (long-polling). Tools: %s", [t["name"] for t in registry.specs()])
    # Blocking; manages its own event loop. stop_signals=None -> Windows/Proactor safe.
    app.run_polling(stop_signals=None)


if __name__ == "__main__":
    main()
