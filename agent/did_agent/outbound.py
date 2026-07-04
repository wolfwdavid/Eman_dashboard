"""Bridge for sending Telegram messages from the (threaded) agent tool loop.

The agent runs in a worker thread (`asyncio.to_thread`), so it can't `await` the bot directly. We stash
the Application + its event loop at startup and schedule sends onto that loop with
`run_coroutine_threadsafe`. Scheduled reminders/digests use the JobQueue directly and don't need this.
"""

from __future__ import annotations

import asyncio

_app = None
_loop: asyncio.AbstractEventLoop | None = None


def register(app, loop: asyncio.AbstractEventLoop) -> None:
    global _app, _loop
    _app = app
    _loop = loop


def send(chat_id: int, text: str) -> bool:
    """Send from any thread. Returns False if the bot isn't running or the send fails."""
    if _app is None or _loop is None:
        return False
    fut = asyncio.run_coroutine_threadsafe(_app.bot.send_message(chat_id=chat_id, text=text), _loop)
    try:
        fut.result(timeout=15)
        return True
    except Exception:
        return False
