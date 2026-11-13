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
import os
import tempfile
from datetime import date, datetime
from datetime import time as dtime
from zoneinfo import ZoneInfo

from telegram import Update
from telegram.error import BadRequest
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from did_agent import chat_api, email_channel, outbound, publish, reminders, sweep, voice
from did_agent.clients import feeds
from did_agent.config import load_settings
from did_agent.llm.client import Agent, ToolRegistry, make_client
from did_agent.notion_store import NotionStore
from did_agent.public_agent import PublicAgent
from did_agent.tools import draft_application, register_all
from did_agent.tools.scrape_grants import build as build_scrape

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# httpx logs every request URL at INFO, and Telegram API URLs embed the bot token.
# Keep its chatter (and the secret) out of the log; errors still surface at WARNING+.
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("did_agent")

_HISTORY: dict[int, list[dict]] = {}
_HISTORY_TURNS = 12


def _allowed(update: Update, allowed_ids: list[int], allow_all: bool) -> bool:
    chat = update.effective_chat
    if allow_all or (chat is not None and chat.id in allowed_ids):
        return True
    # Log rejected ids so a new user (e.g. Eman's first /start) can be added to the allowlist.
    user = update.effective_user
    log.info(
        "Unauthorized message from chat_id=%s (%s @%s) — add to TELEGRAM_ALLOWED_CHAT_IDS to authorize.",
        chat.id if chat else "?",
        (user.full_name if user else "?"),
        (user.username if user else "?"),
    )
    return False


async def _send_md(bot, chat_id, text: str) -> None:
    """Send as Markdown; if Telegram rejects the entities, resend the same text as plain text."""
    try:
        await bot.send_message(chat_id=chat_id, text=text, parse_mode="Markdown")
    except BadRequest:
        log.warning("Markdown send rejected; resending as plain text", exc_info=True)
        await bot.send_message(chat_id=chat_id, text=text)


def main() -> None:
    settings = load_settings()
    missing = settings.missing()
    if missing:
        raise SystemExit(
            "Missing required secrets in .env: " + ", ".join(missing) + ". Copy .env.example -> .env."
        )

    registry = ToolRegistry()
    register_all(registry, settings)
    agent = Agent(settings, registry)
    # The dashboard chat is reachable by anyone on the public URL: it gets a tool-free agent that answers
    # only from the site knowledge file (see public_agent.py), never the grant tools.
    chat_api.start(PublicAgent(settings), settings)
    store = NotionStore(settings)
    scrape_tool = build_scrape(settings)
    tz = ZoneInfo(settings.timezone)

    # --- scheduled jobs (proactive sends) ---
    async def deadline_sweep(ctx: ContextTypes.DEFAULT_TYPE) -> None:
        grants = await asyncio.to_thread(store.list_grants)
        text = reminders.format_reminder(
            reminders.due_reminders(grants, date.today(), settings.reminder_lead_days), date.today()
        )
        if text:
            await _send_md(ctx.bot, ctx.job.chat_id, text)

    async def weekly_digest(ctx: ContextTypes.DEFAULT_TYPE) -> None:
        grants = await asyncio.to_thread(store.list_grants)
        news = await asyncio.to_thread(feeds.fetch_digest)
        text = reminders.format_digest(grants, news, date.today(), settings.reminder_lead_days)
        await _send_md(ctx.bot, ctx.job.chat_id, text)

    async def _run_queries() -> None:
        for q in ("disability", "accessibility", "assistive technology"):
            try:
                await asyncio.to_thread(scrape_tool.run, {"query": q, "sources": ["grants_gov"], "max_results": 8})
            except Exception:
                log.exception("daily scrape failed for query %r", q)

    async def morning_sweep(_ctx: ContextTypes.DEFAULT_TYPE) -> None:
        # Mon/Wed/Fri 6AM ET: same queries as the midnight scrape; record which grants are new.
        log.info("Morning grant sweep starting…")
        try:
            before = await asyncio.to_thread(store.list_grants)
        except Exception:
            log.exception("sweep: could not read grants before scrape; no state written")
            return
        await _run_queries()
        try:
            after = await asyncio.to_thread(store.list_grants)
        except Exception:
            log.exception("sweep: could not read grants after scrape; no state written")
            return
        # "New" = not present at the previous sweep (the midnight scrape adds grants in between).
        previous_seen = sweep.load_previous_seen(sweep.DEFAULT_STATE_PATH)
        new = sweep.sweep_new(previous_seen, before, after)
        try:
            sweep.save_state(sweep.DEFAULT_STATE_PATH, datetime.now(tz).date(), new, sweep.seen_keys(after))
        except Exception:
            log.exception("sweep: could not save state")
        try:
            await asyncio.to_thread(publish.publish, None, True, None)
        except Exception:
            log.exception("dashboard refresh failed")
        log.info("Morning grant sweep done: %d new grant(s).", len(new))

    _drafts_cache: dict = {"date": None, "drafts": {}, "note": ""}
    _drafts_lock = asyncio.Lock()

    async def _create_drafts(new: list, today: date) -> tuple[dict[str, str], str]:
        # One Google Doc per top OPEN_NOW grant. Only ever called through sweep.todays_drafts.
        drafts: dict[str, str] = {}
        note = ""
        top = sweep.top_open_now(new, today)
        if top:
            if settings.google_service_account_json and settings.google_template_doc_id:
                client = make_client(settings)
                failed: list[str] = []
                for g in top:
                    try:
                        drafts[g.funder] = await asyncio.to_thread(
                            draft_application.create_draft, settings, client, g
                        )
                    except Exception:
                        log.exception("sweep draft failed for %r", g.funder)
                        failed.append(g.funder)
                if failed:
                    note = "Could not create a draft for: " + ", ".join(failed) + "."
            else:
                note = "Draft links unavailable: Google Docs is not configured."
        return drafts, note

    async def morning_message(ctx: ContextTypes.DEFAULT_TYPE) -> None:
        # Mon/Wed/Fri 8:45AM ET per chat: summary of the sweep + Google Doc drafts for top OPEN_NOW grants.
        today = datetime.now(tz).date()
        new = sweep.load_state(sweep.DEFAULT_STATE_PATH, today)
        if new is None:
            text = sweep.format_sweep_message([], {}, today, state_ok=False)
        else:
            # These jobs run once per chat and overlap; todays_drafts makes the drafts once
            # and every chat, and any later run that day, gets the same links.
            drafts, note = await sweep.todays_drafts(
                sweep.DEFAULT_STATE_PATH, today, _drafts_cache, _drafts_lock, lambda: _create_drafts(new, today)
            )
            text = sweep.format_sweep_message(new, drafts, today, draft_note=note)
        await ctx.bot.send_message(chat_id=ctx.job.chat_id, text=text)

    async def daily_scrape(_ctx: ContextTypes.DEFAULT_TYPE) -> None:
        # Midnight ET, silent: find new grants, save to Notion, refresh the dashboard.
        log.info("Daily midnight scrape starting…")
        await _run_queries()
        try:
            await asyncio.to_thread(publish.publish, None, True, None)
        except Exception:
            log.exception("dashboard refresh failed")
        log.info("Daily midnight scrape done.")

    async def _post_init(app) -> None:
        outbound.register(app, asyncio.get_running_loop())
        jq = app.job_queue  # requires python-telegram-bot[job-queue]
        if settings.email_enabled:
            email_history: dict[str, list[dict]] = {}

            async def email_poll(_ctx: ContextTypes.DEFAULT_TYPE) -> None:
                try:
                    await asyncio.to_thread(email_channel.poll_once, settings, agent, email_history)
                except Exception:
                    log.exception("email poll failed")

            jq.run_repeating(email_poll, interval=settings.email_poll_seconds, first=10, name="email-poll")
            log.info(
                "Email channel enabled: polling %s every %ss.",
                settings.email_address,
                settings.email_poll_seconds,
            )
        else:
            log.info("Email channel disabled (EMAIL_ADDRESS/EMAIL_APP_PASSWORD/EMAIL_ALLOWED_SENDERS not set).")
        if not settings.notion_grants_data_source_id:
            log.warning("No NOTION_GRANTS_DATA_SOURCE_ID — scheduler idle until bootstrap.")
            return
        # misfire_grace_time: jobs routinely fire ~1s late; default 1s grace silently skips them.
        grace = {"misfire_grace_time": 3600}
        jq.run_daily(daily_scrape, time=dtime(0, 0, tzinfo=tz), name="daily-scrape", job_kwargs=grace)
        log.info("Scheduled daily midnight (%s) grant scrape.", settings.timezone)
        jq.run_daily(morning_sweep, time=dtime(6, 0, tzinfo=tz), days=sweep.MON_WED_FRI, name="morning-sweep", job_kwargs=grace)
        log.info("Scheduled Mon/Wed/Fri 6:00AM (%s) grant sweep.", settings.timezone)
        targets = settings.telegram_allowed_chat_ids
        if not targets:
            log.warning("No TELEGRAM_ALLOWED_CHAT_IDS — proactive reminders/digest disabled until set.")
            return
        for cid in targets:
            jq.run_daily(deadline_sweep, time=dtime(9, 0, tzinfo=tz), chat_id=cid, name=f"reminders-{cid}", job_kwargs=grace)
            jq.run_daily(weekly_digest, time=dtime(9, 0, tzinfo=tz), days=sweep.MONDAY, chat_id=cid, name=f"digest-{cid}", job_kwargs=grace)
            jq.run_daily(morning_message, time=dtime(8, 45, tzinfo=tz), days=sweep.MON_WED_FRI, chat_id=cid, name=f"sweep-message-{cid}", job_kwargs=grace)
        log.info(
            "Scheduled daily reminders + Monday 9AM digest + Mon/Wed/Fri 8:45AM sweep message for %d chat(s).",
            len(targets),
        )

    # --- handlers ---
    async def on_start(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
        if not _allowed(update, settings.telegram_allowed_chat_ids, settings.telegram_allow_all):
            # Not silent on /start: tell the person their id so David can authorize them.
            if update.message:
                await update.message.reply_text(
                    f"Hi! I'm the DID grant assistant, but I don't know you yet. "
                    f"Your chat id is {update.effective_chat.id} — send it to David so he can add you."
                )
            return
        chat_id = update.effective_chat.id if update.effective_chat else "?"
        log.info("Authorized /start from chat_id=%s", chat_id)
        await update.message.reply_text(
            "Hi Eman — I'm your DID grant assistant. Ask me to find, score, or draft grants, or check "
            f"what's due soon. I'll also nudge you before deadlines and send a Monday digest. "
            f"(Your chat id is {chat_id}.)"
        )

    async def _reply_with_agent(update: Update, chat_id: int, text: str) -> None:
        history = _HISTORY.get(chat_id, [])
        await update.message.chat.send_action("typing")
        try:
            reply = await asyncio.to_thread(agent.respond, text, history)
        except Exception:
            log.exception("agent.respond failed")
            await update.message.reply_text("Something went wrong handling that — try again in a moment.")
            return
        _HISTORY[chat_id] = (
            history + [{"role": "user", "content": text}, {"role": "assistant", "content": reply}]
        )[-_HISTORY_TURNS:]
        await update.message.reply_text(reply or "(no reply)")

    async def on_message(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
        if not _allowed(update, settings.telegram_allowed_chat_ids, settings.telegram_allow_all):
            log.warning("Ignoring message from unauthorized chat %s", getattr(update.effective_chat, "id", "?"))
            return
        if not update.message or not update.message.text:
            return
        await _reply_with_agent(update, update.effective_chat.id, update.message.text)

    async def on_voice(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
        if not _allowed(update, settings.telegram_allowed_chat_ids, settings.telegram_allow_all):
            return
        if not update.message or not update.message.voice:
            return
        chat_id = update.effective_chat.id
        await update.message.chat.send_action("typing")
        path = None
        try:
            tg_file = await update.message.voice.get_file()
            fd, path = tempfile.mkstemp(suffix=".ogg")
            os.close(fd)
            await tg_file.download_to_drive(path)
            text = await asyncio.to_thread(
                voice.transcribe,
                path,
                settings.whisper_model,
                settings.whisper_base_url,
                settings.whisper_api_key,
            )
        except Exception:
            log.exception("voice transcription failed")
            await update.message.reply_text("Couldn't transcribe that voice note — try again, or send text.")
            return
        finally:
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except OSError:
                    pass
        if not text:
            await update.message.reply_text("I couldn't make out any words — try again?")
            return
        await update.message.reply_text(f'🎤 heard: "{text}"')
        await _reply_with_agent(update, chat_id, text)

    app = ApplicationBuilder().token(settings.telegram_bot_token).post_init(_post_init).build()
    app.add_handler(CommandHandler("start", on_start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))
    app.add_handler(MessageHandler(filters.VOICE, on_voice))

    log.info(
        "DID grant agent starting (long-polling). Tools: %s",
        [t["function"]["name"] for t in registry.specs()],
    )
    app.run_polling(stop_signals=None)


if __name__ == "__main__":
    main()
