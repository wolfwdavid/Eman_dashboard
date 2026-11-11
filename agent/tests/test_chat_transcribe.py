"""Offline tests for POST /chat/transcribe and its abuse controls (VOICE-05, D-15).

A real ThreadingHTTPServer is started on 127.0.0.1:0 with voice.transcribe faked,
so no Whisper, Telegram or Notion call is ever made.
"""

from __future__ import annotations

import http.client
import json
import os
import socket
import threading
import time
from http.server import ThreadingHTTPServer
from types import SimpleNamespace

import pytest

from did_agent import chat_api


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class FakeAgent:
    def respond(self, message, history):
        return f"echo: {message}"


def _settings(token: str = "") -> SimpleNamespace:
    return SimpleNamespace(
        chat_api_token=token,
        chat_api_host="127.0.0.1",
        chat_api_port=0,
        whisper_model="base",
        whisper_base_url="",
        whisper_api_key="",
    )


class Recorder:
    """Stands in for voice.transcribe and remembers what it saw."""

    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.result = "show recurring grants"
        self.error: Exception | None = None
        self.gate: threading.Event | None = None
        self.entered = threading.Event()

    def __call__(self, audio_path, model_name="base", base_url="", api_key=""):
        self.calls.append(
            {
                "path": audio_path,
                "existed": os.path.exists(audio_path),
                "size": os.path.getsize(audio_path) if os.path.exists(audio_path) else -1,
                "model": model_name,
            }
        )
        self.entered.set()
        if self.gate is not None:
            self.gate.wait(timeout=10)
        if self.error is not None:
            raise self.error
        return f"  {self.result}  "


class Server:
    def __init__(self, token: str = "") -> None:
        self.clock = FakeClock()
        self.limiter = chat_api._RateLimiter(limit=10, window=60.0, clock=self.clock)
        self.slots = threading.BoundedSemaphore(2)
        handler = chat_api._make_handler(
            agent=FakeAgent(), settings=_settings(token), limiter=self.limiter, whisper_slots=self.slots
        )
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.httpd.daemon_threads = True
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def conn(self) -> http.client.HTTPConnection:
        return http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)

    def post(self, body: bytes = b"audio-bytes", ctype: str | None = "audio/webm;codecs=opus", headers=None):
        hdrs = dict(headers or {})
        if ctype is not None:
            hdrs["Content-Type"] = ctype
        c = self.conn()
        try:
            c.request("POST", "/chat/transcribe", body=body, headers=hdrs)
            r = c.getresponse()
            data = r.read()
            return r.status, dict(r.getheaders()), data
        finally:
            c.close()

    def close(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


@pytest.fixture
def rec(monkeypatch):
    r = Recorder()
    monkeypatch.setattr(chat_api.voice, "transcribe", r)
    return r


@pytest.fixture
def server(rec):
    s = Server()
    yield s
    s.close()


def _json(data: bytes) -> dict:
    return json.loads(data.decode())


def _header(headers: dict, name: str):
    for k, v in headers.items():
        if k.lower() == name.lower():
            return v
    return None


# --- happy path -------------------------------------------------------------


def test_happy_path_returns_text_and_cleans_up(server, rec):
    status, headers, data = server.post(b"x" * 100, "audio/webm;codecs=opus")
    assert status == 200
    assert _json(data) == {"text": "show recurring grants"}
    assert len(rec.calls) == 1
    call = rec.calls[0]
    assert call["path"].endswith(".webm")
    assert call["existed"] is True
    assert call["size"] == 100
    assert call["model"] == "base"
    assert not os.path.exists(call["path"])
    assert _header(headers, "Access-Control-Allow-Origin") == "*"


@pytest.mark.parametrize(
    "ctype,suffix",
    [
        ("audio/ogg", ".ogg"),
        ("audio/mp4;codecs=mp4a.40.2", ".mp4"),
        ("audio/mpeg", ".mp3"),
        ("audio/wav", ".wav"),
        ("audio/x-m4a", ".m4a"),
        ("AUDIO/WebM", ".webm"),
    ],
)
def test_suffix_comes_from_mime_map(server, rec, ctype, suffix):
    status, _, _ = server.post(b"abc", ctype)
    assert status == 200
    assert rec.calls[0]["path"].endswith(suffix)


def test_suffix_map_has_no_aac():
    assert "audio/aac" not in chat_api._AUDIO_EXT
    assert chat_api._AUDIO_EXT["audio/webm"] == ".webm"


# --- content type -----------------------------------------------------------


@pytest.mark.parametrize("ctype", ["text/plain", "application/json", None, "audio/aac"])
def test_non_audio_content_type_is_415(server, rec, ctype):
    status, headers, data = server.post(b"abc", ctype)
    assert status == 415
    assert rec.calls == []
    assert _header(headers, "Access-Control-Allow-Origin") == "*"
    assert "error" in _json(data)


def test_415_does_not_count_toward_limit(server, rec):
    for _ in range(15):
        assert server.post(b"abc", "text/plain")[0] == 415
    assert server.post(b"abc")[0] == 200


# --- size and length --------------------------------------------------------


def test_oversize_is_413_without_reading_body(server, rec):
    assert chat_api.MAX_AUDIO_BYTES == 1_048_576
    c = server.conn()
    try:
        c.request(
            "POST",
            "/chat/transcribe",
            body=b"abc",
            headers={"Content-Type": "audio/webm", "Content-Length": "1_048_577".replace("_", "")},
        )
        r = c.getresponse()
        r.read()
        assert r.status == 413
    finally:
        c.close()
    assert rec.calls == []


def test_exactly_max_bytes_is_accepted(server, rec):
    status, _, _ = server.post(b"\0" * 1_048_576, "audio/webm")
    assert status == 200
    assert rec.calls[0]["size"] == 1_048_576


def test_missing_content_length_is_411(server, rec):
    s = socket.create_connection(("127.0.0.1", server.port), timeout=10)
    try:
        s.sendall(
            b"POST /chat/transcribe HTTP/1.1\r\nHost: x\r\nContent-Type: audio/webm\r\nConnection: close\r\n\r\n"
        )
        raw = b""
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            raw += chunk
    finally:
        s.close()
    assert raw.startswith(b"HTTP/1.0 411") or raw.startswith(b"HTTP/1.1 411")
    assert rec.calls == []


def test_zero_content_length_is_400(server, rec):
    status, _, _ = server.post(b"", "audio/webm")
    assert status == 400
    assert rec.calls == []


def test_non_integer_content_length_is_400(server, rec):
    s = socket.create_connection(("127.0.0.1", server.port), timeout=10)
    try:
        s.sendall(
            b"POST /chat/transcribe HTTP/1.1\r\nHost: x\r\nContent-Type: audio/webm\r\n"
            b"Content-Length: abc\r\nConnection: close\r\n\r\n"
        )
        raw = s.recv(4096)
    finally:
        s.close()
    assert b" 400 " in raw.split(b"\r\n")[0]


# --- rate limit -------------------------------------------------------------


def test_eleventh_request_is_429_with_retry_after_then_window_reopens(server, rec):
    for _ in range(10):
        assert server.post()[0] == 200
    status, headers, _ = server.post()
    assert status == 429
    retry = _header(headers, "Retry-After")
    assert retry is not None and int(retry) >= 1
    assert _header(headers, "Access-Control-Allow-Origin") == "*"
    server.clock.advance(61)
    assert server.post()[0] == 200


def test_413_and_400_count_toward_limit(server, rec):
    for _ in range(5):
        assert server.post(b"", "audio/webm")[0] == 400
    for _ in range(5):
        c = server.conn()
        try:
            c.request(
                "POST",
                "/chat/transcribe",
                body=b"a",
                headers={"Content-Type": "audio/webm", "Content-Length": "1048577"},
            )
            assert c.getresponse().status == 413
        finally:
            c.close()
    assert server.post()[0] == 429


def test_independent_budgets_per_forwarded_client(server, rec):
    a = {"CF-Connecting-IP": "203.0.113.9"}
    b = {"CF-Connecting-IP": "203.0.113.10"}
    for _ in range(10):
        assert server.post(headers=a)[0] == 200
    assert server.post(headers=a)[0] == 429
    for _ in range(10):
        assert server.post(headers=b)[0] == 200
    assert server.post(headers=b)[0] == 429


# --- client_ip --------------------------------------------------------------


@pytest.mark.parametrize("peer", ["127.0.0.1", "172.18.0.2"])
def test_client_ip_trusts_cf_header_from_private_peer(peer):
    assert chat_api.client_ip(peer, {"CF-Connecting-IP": "203.0.113.9"}) == "203.0.113.9"


def test_client_ip_uses_rightmost_forwarded_for():
    headers = {"X-Forwarded-For": "198.51.100.1, 203.0.113.7"}
    assert chat_api.client_ip("127.0.0.1", headers) == "203.0.113.7"


def test_client_ip_ignores_headers_from_public_peer():
    headers = {"CF-Connecting-IP": "203.0.113.9", "X-Forwarded-For": "203.0.113.7"}
    assert chat_api.client_ip("198.51.100.50", headers) == "198.51.100.50"


def test_client_ip_falls_back_on_invalid_header():
    assert chat_api.client_ip("127.0.0.1", {"CF-Connecting-IP": "not-an-ip"}) == "127.0.0.1"
    assert chat_api.client_ip("127.0.0.1", {"X-Forwarded-For": "1.2.3.4, not-an-ip"}) == "127.0.0.1"


def test_client_ip_no_headers_returns_peer():
    assert chat_api.client_ip("127.0.0.1", {}) == "127.0.0.1"


# --- failures ---------------------------------------------------------------


def test_whisper_failure_is_generic_502_and_cleans_up(server, rec):
    rec.error = RuntimeError("boom")
    status, _, data = server.post()
    assert status == 502
    assert _json(data) == {"error": "Transcription failed"}
    assert b"boom" not in data
    assert not os.path.exists(rec.calls[0]["path"])


def test_busy_whisper_slots_return_503(server, rec):
    assert server.slots.acquire(blocking=False)
    assert server.slots.acquire(blocking=False)
    status, _, data = server.post()
    assert status == 503
    assert "error" in _json(data)
    assert rec.calls == []
    server.slots.release()
    server.slots.release()
    assert server.post()[0] == 200


# --- auth -------------------------------------------------------------------


def test_token_required_when_configured(rec):
    s = Server(token="secret")
    try:
        assert s.post()[0] == 401
        assert s.post(headers={"Authorization": "Bearer wrong"})[0] == 401
        assert s.post(headers={"Authorization": "Bearer secret"})[0] == 200
    finally:
        s.close()


# --- preflight and regression ----------------------------------------------


def test_preflight_options(server):
    c = server.conn()
    try:
        c.request("OPTIONS", "/chat/transcribe")
        r = c.getresponse()
        r.read()
        assert r.status == 204
        assert "Content-Type" in (r.getheader("Access-Control-Allow-Headers") or "")
    finally:
        c.close()


def test_chat_post_and_poll_unchanged(server):
    c = server.conn()
    try:
        c.request("POST", "/chat", body=json.dumps({"message": "hi"}), headers={"Content-Type": "application/json"})
        r = c.getresponse()
        body = _json(r.read())
        assert r.status == 202
        job_id = body["job_id"]
    finally:
        c.close()
    deadline = time.time() + 5
    result = None
    while time.time() < deadline:
        c = server.conn()
        try:
            c.request("GET", f"/chat/{job_id}")
            r = c.getresponse()
            result = _json(r.read())
        finally:
            c.close()
        if result.get("status") == "done":
            break
        time.sleep(0.05)
    assert result == {"status": "done", "reply": "echo: hi"}


def test_unknown_post_path_still_404(server):
    c = server.conn()
    try:
        c.request("POST", "/nope", body=b"x")
        r = c.getresponse()
        r.read()
        assert r.status == 404
    finally:
        c.close()


def test_slow_transcribe_does_not_block_polling(server, rec):
    rec.gate = threading.Event()
    result: dict = {}

    def slow():
        result["status"] = server.post()[0]

    t = threading.Thread(target=slow, daemon=True)
    t.start()
    assert rec.entered.wait(timeout=5)
    c = server.conn()
    try:
        started = time.time()
        c.request("GET", "/chat/unknown-id")
        r = c.getresponse()
        data = _json(r.read())
        assert r.status == 404
        assert data == {"error": "Unknown job"}
        assert time.time() - started < 2
    finally:
        c.close()
        rec.gate.set()
    t.join(timeout=5)
    assert result["status"] == 200


# --- _RateLimiter unit tests ------------------------------------------------


def test_limiter_allows_ten_rejects_eleventh():
    clock = FakeClock()
    lim = chat_api._RateLimiter(limit=10, window=60.0, clock=clock)
    assert all(lim.allow("a") for _ in range(10))
    assert lim.allow("a") is False
    assert lim.allow("b") is True
    assert lim.retry_after("a") >= 1


def test_limiter_window_expiry_readmits():
    clock = FakeClock()
    lim = chat_api._RateLimiter(limit=2, window=60.0, clock=clock)
    assert lim.allow("a") and lim.allow("a")
    assert lim.allow("a") is False
    clock.advance(30)
    assert lim.retry_after("a") == 30
    clock.advance(31)
    assert lim.allow("a") is True


def test_limiter_prunes_stale_keys_over_cap():
    clock = FakeClock()
    lim = chat_api._RateLimiter(limit=10, window=60.0, clock=clock)
    for i in range(chat_api._MAX_TRACKED_IPS + 10):
        lim.allow(f"ip-{i}")
    clock.advance(120)
    lim.allow("fresh")
    assert len(lim._hits) < 100
