"""Row data with Markdown specials must not break Telegram's legacy Markdown parser."""

from __future__ import annotations

import asyncio
import re
from datetime import date

from telegram.error import BadRequest

from did_agent.main import _send_md
from did_agent.models import Grant
from did_agent.reminders import format_digest, format_reminder

TODAY = date(2026, 11, 13)
URL = "https://docs.google.com/document/d/1bLo6ETX5dTVqA0Byw9zpnrxGilltqLBQEhq_1Ta9utE/edit"


def _grant() -> Grant:
    return Grant(
        funder="[grants.gov] A_B *C*",
        deadline="2026-11-15",
        status="New",
        bucket="OPEN_NOW",
        next_action=f"Draft in {URL}",
        link=URL,
        amount_note="a_b",
    )


def _assert_safe(text: str) -> None:
    bare = re.sub(r"\\.", "", text)  # drop every backslash-escape pair
    assert "_" not in bare and "`" not in bare and "[" not in bare
    assert bare.count("*") % 2 == 0


def test_format_reminder_escapes_row_data():
    text = format_reminder([_grant()], TODAY)
    assert "*Grant deadlines within 7 days:*" in text
    _assert_safe(text)


def test_format_digest_escapes_row_data_and_news():
    text = format_digest([_grant()], [{"source": "src_x", "title": "T_1 *x*"}], TODAY)
    assert "Actionable now" in text
    _assert_safe(text)


class _Bot:
    def __init__(self, fail_first: bool) -> None:
        self.fail_first = fail_first
        self.calls: list[dict] = []

    async def send_message(self, **kw):
        self.calls.append(kw)
        if self.fail_first and len(self.calls) == 1:
            raise BadRequest("can't parse entities")


def test_send_md_falls_back_to_plain_text():
    bot = _Bot(fail_first=True)
    asyncio.run(_send_md(bot, 1, "t_x"))
    assert len(bot.calls) == 2
    assert bot.calls[0]["parse_mode"] == "Markdown"
    assert "parse_mode" not in bot.calls[1]
    assert bot.calls[0]["text"] == bot.calls[1]["text"] == "t_x"


def test_send_md_single_call_when_accepted():
    bot = _Bot(fail_first=False)
    asyncio.run(_send_md(bot, 1, "t_x"))
    assert len(bot.calls) == 1
