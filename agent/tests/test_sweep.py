"""Offline tests for the Mon/Wed/Fri sweep logic (pure functions, fixed date, no network/Notion)."""

from __future__ import annotations

import asyncio
import json
from datetime import date

from did_agent import sweep
from did_agent.models import Grant

TODAY = date(2026, 11, 13)
PTB_NAMES = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")


def g(funder, **kw):
    return Grant(funder=funder, **kw)


def test_weekday_constants_match_ptb_numbering():
    assert sweep.MONDAY != (0,)
    assert ",".join(PTB_NAMES[d] for d in sweep.MONDAY) == "mon"
    assert ",".join(PTB_NAMES[d] for d in sweep.MON_WED_FRI) == "mon,wed,fri"
    assert PTB_NAMES[sweep.SUNDAY] == "sun" and PTB_NAMES[sweep.SATURDAY] == "sat"


def test_new_grants_diff():
    before = [g("Alpha Fund"), g("Beta Fund")]
    after = [g("alpha fund "), g("Gamma"), g("Delta")]  # Beta removed, Alpha re-cased
    assert [x.funder for x in sweep.new_grants(before, after)] == ["Gamma", "Delta"]
    assert sweep.new_grants(after, after) == []


def test_state_round_trip(tmp_path):
    path = tmp_path / "nested" / "dir" / "state.json"
    new = [g("A", amount=5000.0, bucket="OPEN_NOW", score=80.0)]
    sweep.save_state(path, TODAY, new)
    assert json.loads(path.read_text())["date"] == "2026-11-13"
    loaded = sweep.load_state(path, TODAY)
    assert loaded == new
    assert not list(path.parent.glob("*.tmp"))


def test_load_state_degrades(tmp_path):
    path = tmp_path / "state.json"
    assert sweep.load_state(path, TODAY) is None  # missing
    path.write_text("{not json", encoding="utf-8")
    assert sweep.load_state(path, TODAY) is None  # corrupt
    sweep.save_state(path, date(2026, 11, 11), [g("A")])
    assert sweep.load_state(path, TODAY) is None  # stale
    sweep.save_state(path, TODAY, [])
    assert sweep.load_state(path, TODAY) == []  # empty but valid


def test_top_open_now_selection():
    new = [
        g("NoScoreLate", bucket="OPEN_NOW"),
        g("Low", bucket="OPEN_NOW", score=40.0),
        g("HighLate", bucket="OPEN_NOW", score=90.0, deadline="2026-12-31"),
        g("HighSoon", bucket="OPEN_NOW", score=90.0, deadline="2026-12-01"),
        g("Sponsor", bucket="VIA_FISCAL_SPONSOR", score=99.0),
        g("Done", bucket="OPEN_NOW", score=99.0, status="Skipped"),
    ]
    top = sweep.top_open_now(new, TODAY)
    assert [x.funder for x in top] == ["HighSoon", "HighLate", "Low"]
    assert [x.funder for x in sweep.top_open_now(new, TODAY, n=4)][-1] == "NoScoreLate"


def test_top_open_now_skips_passed_deadlines():
    new = [
        g("LongGone", bucket="OPEN_NOW", score=99.0, deadline="2026-01-15"),
        g("Yesterday", bucket="OPEN_NOW", score=99.0, deadline="2026-11-12"),
        g("Undated", bucket="OPEN_NOW", score=90.0),
        g("Rolling", bucket="OPEN_NOW", score=90.0, deadline_note="rolling"),
        g("DueToday", bucket="OPEN_NOW", score=90.0, deadline="2026-11-13"),
        g("NextMonth", bucket="OPEN_NOW", score=90.0, deadline="2026-12-13"),
    ]
    top = sweep.top_open_now(new, TODAY, n=10)
    # Passed deadlines are out; a deadline today still counts; undated ones follow the dated.
    assert [x.funder for x in top] == ["DueToday", "NextMonth", "Rolling", "Undated"]
    assert sweep.top_open_now(new[:2], TODAY) == []
    # On the day the earliest deadline falls, none has passed and nothing is skipped.
    assert len(sweep.top_open_now(new, date(2026, 1, 15), n=10)) == 6


def test_seen_round_trip_and_atomic(tmp_path):
    path = tmp_path / "state.json"
    sweep.save_state(path, TODAY, [g("A")], sweep.seen_keys([g("A "), g("B")]))
    assert sweep.load_previous_seen(path) == {"a", "b"}
    assert sweep.load_state(path, TODAY) == [g("A")]
    assert not list(tmp_path.glob("*.tmp"))


def test_previous_seen_ignores_date(tmp_path):
    path = tmp_path / "state.json"
    sweep.save_state(path, date(2026, 11, 9), [], {"old grant"})
    assert sweep.load_state(path, TODAY) is None  # stale for the 8:45 job
    assert sweep.load_previous_seen(path) == {"old grant"}  # but usable as baseline


def test_previous_seen_unavailable(tmp_path):
    path = tmp_path / "state.json"
    assert sweep.load_previous_seen(path) is None  # missing
    path.write_text("{oops", encoding="utf-8")
    assert sweep.load_previous_seen(path) is None  # corrupt
    path.write_text(json.dumps({"date": "2026-11-09", "new": []}), encoding="utf-8")
    assert sweep.load_previous_seen(path) is None  # old format, no seen
    assert sweep.load_state(path, date(2026, 11, 9)) == []  # old format still loads


def test_drafts_round_trip_keeps_the_rest_of_the_state(tmp_path):
    path = tmp_path / "state.json"
    sweep.save_state(path, TODAY, [g("A")], {"a"})
    assert sweep.load_drafts(path, TODAY) is None  # nothing recorded yet
    assert sweep.save_drafts(path, TODAY, {"A": "https://docs.example/1"}, "one failed") is True
    assert sweep.load_drafts(path, TODAY) == ({"A": "https://docs.example/1"}, "one failed")
    assert sweep.load_state(path, TODAY) == [g("A")]
    assert sweep.load_previous_seen(path) == {"a"}
    assert sweep.load_drafts(path, date(2026, 11, 16)) is None  # another day's drafts are not reused
    assert not list(tmp_path.glob("*.tmp"))


def test_empty_drafts_are_still_recorded(tmp_path):
    path = tmp_path / "state.json"
    sweep.save_state(path, TODAY, [])
    assert sweep.save_drafts(path, TODAY, {}, "") is True
    assert sweep.load_drafts(path, TODAY) == ({}, "")


def test_drafts_degrade(tmp_path):
    path = tmp_path / "state.json"
    assert sweep.load_drafts(path, TODAY) is None  # missing
    assert sweep.save_drafts(path, TODAY, {"A": "u"}, "") is False
    assert not path.exists()  # drafts never create a state file on their own
    path.write_text("{oops", encoding="utf-8")
    assert sweep.load_drafts(path, TODAY) is None  # corrupt
    assert sweep.save_drafts(path, TODAY, {"A": "u"}, "") is False
    old = json.dumps({"date": "2026-11-13", "new": []})
    path.write_text(old, encoding="utf-8")
    assert sweep.load_drafts(path, TODAY) is None  # old format, no drafts
    assert sweep.load_state(path, TODAY) == []  # and it still loads
    path.write_text(json.dumps({"date": "2026-11-13", "new": [], "drafts": ["x"]}), encoding="utf-8")
    assert sweep.load_drafts(path, TODAY) is None  # wrong shape
    stale = json.dumps({"date": "2026-11-11", "new": []})
    path.write_text(stale, encoding="utf-8")
    assert sweep.save_drafts(path, TODAY, {"A": "u"}, "") is False  # not today's sweep
    assert path.read_text(encoding="utf-8") == stale


def test_a_new_sweep_starts_without_drafts(tmp_path):
    path = tmp_path / "state.json"
    sweep.save_state(path, date(2026, 11, 11), [g("A")])
    sweep.save_drafts(path, date(2026, 11, 11), {"A": "u"}, "")
    sweep.save_state(path, TODAY, [g("B")])
    assert sweep.load_drafts(path, TODAY) is None


class DraftMaker:
    """Stands in for the Google Docs step; yields to the event loop like the real one."""

    def __init__(self) -> None:
        self.calls = 0

    async def __call__(self):
        self.calls += 1
        n = self.calls
        await asyncio.sleep(0.01)
        return {"A": f"https://docs.example/{n}"}, ""


def _cache() -> dict:
    return {"date": None, "drafts": {}, "note": ""}


def test_todays_drafts_are_created_once_for_concurrent_chats(tmp_path):
    path = tmp_path / "state.json"
    sweep.save_state(path, TODAY, [g("A")])
    make = DraftMaker()

    async def run():
        cache, lock = _cache(), asyncio.Lock()
        return await asyncio.gather(*(sweep.todays_drafts(path, TODAY, cache, lock, make) for _ in range(3)))

    results = asyncio.run(run())
    assert make.calls == 1
    assert results == [({"A": "https://docs.example/1"}, "")] * 3
    assert sweep.load_drafts(path, TODAY) == ({"A": "https://docs.example/1"}, "")


def test_todays_drafts_survive_a_restart(tmp_path):
    path = tmp_path / "state.json"
    sweep.save_state(path, TODAY, [g("A")])
    make = DraftMaker()
    first = asyncio.run(sweep.todays_drafts(path, TODAY, _cache(), asyncio.Lock(), make))
    # A restart loses the in-memory cache; the links come back from the state file.
    again = asyncio.run(sweep.todays_drafts(path, TODAY, _cache(), asyncio.Lock(), make))
    assert make.calls == 1
    assert again == first == ({"A": "https://docs.example/1"}, "")


def test_todays_drafts_are_made_again_for_the_next_sweep(tmp_path):
    path = tmp_path / "state.json"
    make = DraftMaker()
    cache, lock = _cache(), asyncio.Lock()
    sweep.save_state(path, date(2026, 11, 11), [g("A")])
    asyncio.run(sweep.todays_drafts(path, date(2026, 11, 11), cache, lock, make))
    sweep.save_state(path, TODAY, [g("A")])
    assert asyncio.run(sweep.todays_drafts(path, TODAY, cache, lock, make)) == ({"A": "https://docs.example/2"}, "")
    assert make.calls == 2


def test_todays_drafts_still_returned_when_they_cannot_be_saved(tmp_path):
    make = DraftMaker()
    cache, lock = _cache(), asyncio.Lock()
    missing = tmp_path / "nowhere" / "state.json"

    async def run():
        return await asyncio.gather(*(sweep.todays_drafts(missing, TODAY, cache, lock, make) for _ in range(2)))

    assert asyncio.run(run()) == [({"A": "https://docs.example/1"}, "")] * 2
    assert make.calls == 1  # the in-memory cache still covers this run


def test_sweep_new_uses_previous_seen_over_before():
    # Midnight scrape added "Midnight" after the last sweep; before/after at 6AM are identical.
    previous = {"alpha"}
    before = [g("Alpha"), g("Midnight")]
    after = [g("Alpha"), g("Midnight")]
    assert [x.funder for x in sweep.sweep_new(previous, before, after)] == ["Midnight"]


def test_sweep_new_falls_back_to_before():
    before = [g("Alpha")]
    after = [g("Alpha"), g("Fresh")]
    assert [x.funder for x in sweep.sweep_new(None, before, after)] == ["Fresh"]


def test_message_unavailable():
    msg = sweep.format_sweep_message([], {}, TODAY, state_ok=False)
    assert msg == "Sweep result unavailable for 2026-11-13 - nothing to report."


def test_message_no_new():
    assert sweep.format_sweep_message([], {}, TODAY) == "No new grants since the last sweep (2026-11-13)."


def test_message_with_grants_and_drafts():
    new = [
        g("Alpha", amount=5000.0, deadline="2026-11-20", bucket="OPEN_NOW", link="https://a.example"),
        g("Beta", amount_note="varies", deadline_note="rolling", bucket="AFTER_501C3", next_action="Wait for EIN"),
        g("Gamma"),
    ]
    msg = sweep.format_sweep_message(new, {"Alpha": "https://docs.example/1"}, TODAY)
    assert "New grants since the last sweep (2026-11-13): 3" in msg
    assert "$5,000" in msg and "7 days left" in msg and "https://a.example" in msg
    assert "varies" in msg and "rolling" in msg and "Wait for EIN" in msg
    assert "Review fit and start a draft" in msg  # OPEN_NOW default
    assert "TBD" in msg and "none listed" in msg
    assert "Drafts ready" in msg and "Alpha: https://docs.example/1" in msg


def test_message_without_drafts_and_with_note():
    new = [g("Alpha", bucket="OPEN_NOW")]
    msg = sweep.format_sweep_message(new, {}, TODAY, draft_note="Draft links unavailable: Google Docs is not configured.")
    assert "Drafts ready" not in msg
    assert "Draft links unavailable: Google Docs is not configured." in msg


def test_message_trimmed_to_telegram_limit():
    new = [g(f"Funder {i}", bucket="OPEN_NOW", link="https://x.example/" + "p" * 200) for i in range(60)]
    msg = sweep.format_sweep_message(new, {}, TODAY)
    assert len(msg) <= 4096
    assert "more" in msg.splitlines()[-1] or "+" in msg
