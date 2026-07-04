"""Entrypoint: start the Telegram bot wired to the Claude agent + reminder scheduler.

Run:  python -m did_agent.main
Windows Task Scheduler runs `supervisor.bat` ("At log on"), which restarts this on any exit.

Windows notes (RESEARCH.md): blocking `run_polling(stop_signals=None)` — do NOT wrap in `asyncio.run`;
`stop_signals=None` is required (ProactorEventLoop has no add_signal_handler); ONE polling process per
token (else 409 Conflict). JobQueue needs the `[job-queue]` extra.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date
from datetime import time as dtime
from zoneinfo import ZoneInfo

from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from did_agent import outbound, reminders
from did_agent.clients import feeds
from did_agent.config import load_settings
from did_agent.llm.client import ClaudeAgent, ToolRegistry
from did_agent.notion_store import NotionStore
from did_agent.tools import register_all

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("did_agent")

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
    store = NotionStore(settings)
    tz = ZoneInfo(settings.timezone)

    # --- scheduled jobs (proactive sends) ---
    async def deadline_sweep(ctx: ContextTypes.DEFAULT_TYPE) -> None:
        grants = await asyncio.to_thread(store.list_grants)
        text = reminders.format_reminder(
            reminders.due_reminders(grants, date.today(), settings.reminder_lead_days), date.today()
        )
        if text:
            await ctx.bot.send_message(chat_id=ctx.job.chat_id, text=text, parse_mode="Markdown")

    async def weekly_digest(ctx: ContextTypes.DEFAULT_TYPE) -> None:
        grants = await asyncio.to_thread(store.list_grants)
        news = await asyncio.to_thread(feeds.fetch_digest)
        text = reminders.format_digest(grants, news, date.today(), settings.reminder_lead_days)
        await ctx.bot.send_message(chat_id=ctx.job.chat_id, text=text, parse_mode="Markdown")

    async def _post_init(app) -> None:
        outbound.register(app, asyncio.get_running_loop())
        targets = settings.telegram_allowed_chat_ids
        if not targets:
            log.warning("No TELEGRAM_ALLOWED_CHAT_IDS — proactive reminders/digest disabled until set.")
            return
        if not settings.notion_grants_data_source_id:
            log.warning("No NOTION_GRANTS_DATA_SOURCE_ID — scheduler idle until Notion is set up (bootstrap).")
            return
        jq = app.job_queue  # requires python-telegram-bot[job-queue]
        for cid in targets:
            jq.run_daily(deadline_sweep, time=dtime(9, 0, tzinfo=tz), chat_id=cid, name=f"reminders-{cid}")
            jq.run_daily(weekly_digest, time=dtime(9, 0, tzinfo=tz), days=(0,), chat_id=cid, name=f"digest-{cid}")
        log.info("Scheduled daily reminders + Monday 9AM digest for %d chat(s).", len(targets))

    # --- handlers ---
    async def on_start(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
        if not _allowed(update, settings.telegram_allowed_chat_ids, settings.telegram_allow_all):
            return
        chat_id = update.effective_chat.id if update.effective_chat else "?"
        log.info("Authorized /start from chat_id=%s", chat_id)
        await update.message.reply_text(
            "Hi Eman — I'm your DID grant assistant. Ask me to find, score, or draft grants, or check "
            f"what's due soon. I'll also nudge you before deadlines and send a Monday digest. "
            f"(Your chat id is {chat_id}.)"
        )

    async def on_message(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
        if not _allowed(update, settings.telegram_allowed_chat_ids, settings.telegram_allow_all):
            log.warning("Ignoring message from unauthorized chat %s", getattr(update.effective_chat, "id", "?"))
            return
        if not update.message or not update.message.text:
            return
        chat_id = update.effective_chat.id
        text = update.message.text
        history = _HISTORY.get(chat_id, [])
        await update.message.chat.send_action("typing")
        try:
            reply = await asyncio.to_thread(agent.respond, text, history)
        except Exception:
            log.exception("agent.respond failed")
            await update.message.reply_text("Something went wrong handling that — try again in a moment.")
            return
        history = (
            history + [{"role": "user", "content": text}, {"role": "assistant", "content": reply}]
        )[-_HISTORY_TURNS:]
        _HISTORY[chat_id] = history
        await update.message.reply_text(reply or "(no reply)")

    app = ApplicationBuilder().token(settings.telegram_bot_token).post_init(_post_init).build()
    app.add_handler(CommandHandler("start", on_start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))

    log.info("DID grant agent starting (long-polling). Tools: %s", [t["name"] for t in registry.specs()])
    app.run_polling(stop_signals=None)


if __name__ == "__main__":
    main()
