"""Chat history is per session: one visitor's conversation never reaches another's context."""

from __future__ import annotations

import http.client
import json
import threading
import time
from http.server import ThreadingHTTPServer
from types import SimpleNamespace

import pytest

from did_agent import chat_api

A = "tab-aaaaaaaaaaaaaaaaaaaa"
B = "tab-bbbbbbbbbbbbbbbbbbbb"


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


class RecordingAgent:
    """Remembers the history each question was answered with."""

    def __init__(self) -> None:
        self.seen: dict[str, list[dict]] = {}

    def respond(self, message, history):
        self.seen[message] = list(history)
        return f"echo: {message}"


# --- SessionStore -------------------------------------------------------------


def test_valid_session_accepts_only_well_formed_tokens():
    assert chat_api.valid_session(A) == A
    for bad in (None, "", "dashboard", "uptime", "short", "x" * 65, "has space in it 12345", 12345, ["a"]):
        assert chat_api.valid_session(bad) is None


def test_sessions_are_isolated():
    store = chat_api.SessionStore()
    store.put(A, [{"role": "user", "content": "from A"}])
    assert store.get(B) == []
    assert store.get(A) == [{"role": "user", "content": "from A"}]


def test_no_session_means_no_memory():
    store = chat_api.SessionStore()
    store.put(None, [{"role": "user", "content": "anonymous"}])
    assert store.get(None) == []
    assert len(store) == 0


def test_get_returns_a_copy():
    store = chat_api.SessionStore()
    store.put(A, [{"role": "user", "content": "one"}])
    store.get(A).append({"role": "user", "content": "leak"})
    assert len(store.get(A)) == 1


def test_history_is_trimmed_to_the_turn_limit():
    store = chat_api.SessionStore()
    store.put(A, [{"role": "user", "content": str(i)} for i in range(50)])
    kept = store.get(A)
    assert len(kept) == chat_api._HISTORY_TURNS
    assert kept[-1]["content"] == "49"


def test_idle_sessions_expire():
    clock = FakeClock()
    store = chat_api.SessionStore(idle_seconds=60, clock=clock)
    store.put(A, [{"role": "user", "content": "hi"}])
    clock.now += 59
    assert store.get(A) != []  # still fresh, and this read renews it
    clock.now += 59
    assert store.get(A) != []
    clock.now += 61
    assert store.get(A) == []
    assert len(store) == 0


def test_store_is_bounded_and_evicts_least_recently_used():
    clock = FakeClock()
    store = chat_api.SessionStore(max_sessions=3, clock=clock)
    ids = [f"tab-{i:020d}" for i in range(4)]
    for sid in ids[:3]:
        clock.now += 1
        store.put(sid, [{"role": "user", "content": sid}])
    clock.now += 1
    store.get(ids[0])  # touch the oldest so ids[1] becomes least recently used
    clock.now += 1
    store.put(ids[3], [{"role": "user", "content": ids[3]}])
    assert len(store) == 3
    assert store.get(ids[1]) == []
    assert store.get(ids[0]) != [] and store.get(ids[3]) != []


# --- over HTTP ----------------------------------------------------------------


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setattr(chat_api, "_SESSIONS", chat_api.SessionStore())
    agent = RecordingAgent()
    settings = SimpleNamespace(
        chat_api_token="",
        chat_trust_cf_connecting_ip=False,
        chat_api_host="127.0.0.1",
        chat_api_port=0,
        whisper_model="base",
        whisper_base_url="",
        whisper_api_key="",
    )
    handler = chat_api._make_handler(
        agent=agent,
        settings=settings,
        limiter=chat_api._RateLimiter(limit=10, window=60.0),
        whisper_slots=threading.BoundedSemaphore(2),
    )
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    port = httpd.server_address[1]

    def request(method: str, path: str, payload: dict | None = None):
        c = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
        try:
            body = json.dumps(payload).encode() if payload is not None else None
            c.request(method, path, body=body, headers={"Content-Type": "application/json"} if body else {})
            r = c.getresponse()
            return r.status, json.loads(r.read() or b"{}")
        finally:
            c.close()

    def ask(message: str, session=None) -> str:
        payload = {"message": message}
        if session is not None:
            payload["session_id"] = session
        status, data = request("POST", "/chat", payload)
        assert status == 202
        for _ in range(100):
            status, job = request("GET", f"/chat/{data['job_id']}")
            if job.get("status") == "done":
                return job["reply"]
            time.sleep(0.02)
        raise AssertionError("job did not finish")

    yield SimpleNamespace(ask=ask, agent=agent)
    httpd.shutdown()
    httpd.server_close()


def test_two_visitors_do_not_share_history(api):
    api.ask("my name is Ana", A)
    api.ask("what did I just say", B)
    assert api.agent.seen["what did I just say"] == []


def test_same_visitor_keeps_their_own_history(api):
    api.ask("first question", A)
    api.ask("second question", A)
    history = api.agent.seen["second question"]
    assert [m["content"] for m in history] == ["first question", "echo: first question"]


def test_requests_without_a_session_id_have_no_memory(api):
    api.ask("first anonymous question")
    api.ask("second anonymous question")
    assert api.agent.seen["second anonymous question"] == []


@pytest.mark.parametrize("bad", ["dashboard", "uptime", "x", 42, "a b c d e f g h i j k l m n"])
def test_malformed_session_ids_have_no_memory(api, bad):
    api.ask("one", bad)
    api.ask("two", bad)
    assert api.agent.seen["two"] == []
