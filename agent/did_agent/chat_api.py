"""Localhost HTTP API for the dashboard chatbot.

Exposes:
  POST /chat  — submit a message, get back a job_id immediately
  POST /chat/transcribe — upload a short audio clip, get back {"text": ...}
  GET  /chat/<job_id> — poll for the result (pending / done)
  GET  /*     — serve dashboard static files

Async design: Cloudflare quick tunnels have a 100s timeout, but Ollama
inference takes 2-3 min. So POST /chat returns instantly with a job_id;
the client polls GET /chat/<id> every few seconds until the reply is ready.

Runs a stdlib ThreadingHTTPServer in a daemon thread — zero new dependencies.
Only binds to 127.0.0.1 (public access via Cloudflare tunnel).
"""

from __future__ import annotations

import ipaddress
import json
import logging
import mimetypes
import os
import socket
import tempfile
import threading
import time
import uuid
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from did_agent import voice
from did_agent.config import Settings
from did_agent.llm.client import Agent

log = logging.getLogger("did_agent.chat_api")

_HISTORY: dict[str, list[dict]] = {}
_HISTORY_TURNS = 12
_DASHBOARD_DIR = Path(__file__).resolve().parent.parent / "dashboard"

# Job store: job_id -> {"status": "pending"|"done"|"error", "reply": str}
_JOBS: dict[str, dict] = {}

# --- /chat/transcribe limits (D-15) -----------------------------------------
MAX_AUDIO_BYTES = 1_048_576
# Base MIME type (lowercase, parameters stripped) -> temp file suffix. The suffix is
# only ever taken from this map, never from the client (T-08-09). audio/aac is left
# out on purpose: hosted Whisper does not list it.
_AUDIO_EXT = {
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/opus": ".ogg",
    "audio/mp4": ".mp4",
    "audio/x-m4a": ".m4a",
    "audio/m4a": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/flac": ".flac",
}
_RATE_LIMIT = 10
_RATE_WINDOW = 60.0
_MAX_TRACKED_IPS = 5000
_WHISPER_SLOTS = 2
# Wall-clock budget for receiving one whole upload body, counted across every read. The
# per-read socket timeout alone lets a client send a byte every few seconds forever.
_BODY_DEADLINE = 20.0
# Wall-clock budget for one transcription. Past it the request gets 504 and gives its
# Whisper slot back.
_TRANSCRIBE_DEADLINE = 60.0
# How much of an upload we will not read is discarded, and for how long, after the reply.
_LINGER_BYTES = 65536
_LINGER_SECONDS = 0.5


def _unlink(path: str) -> None:
    try:
        os.unlink(path)
    except OSError:
        pass


class _RateLimiter:
    """In-memory sliding-window limiter, safe to share between handler threads."""

    def __init__(self, limit: int = _RATE_LIMIT, window: float = _RATE_WINDOW, clock=time.monotonic):
        self.limit = limit
        self.window = window
        self._clock = clock
        self._hits: dict[str, deque] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = self._clock()
        with self._lock:
            if len(self._hits) > _MAX_TRACKED_IPS:
                self._prune(now)
            hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True

    def retry_after(self, key: str) -> int:
        now = self._clock()
        with self._lock:
            hits = self._hits.get(key)
            if not hits:
                return 1
            return max(1, int(self.window - (now - hits[0]) + 0.999))

    def _prune(self, now: float) -> None:
        stale = [k for k, h in self._hits.items() if not h or now - h[-1] >= self.window]
        for k in stale:
            del self._hits[k]


# Explicit proxy-side ranges. ip.is_private is too broad: it also covers documentation
# and other reserved blocks that a public client can legitimately connect from.
_TRUSTED_PEERS = tuple(
    ipaddress.ip_network(n)
    for n in ("127.0.0.0/8", "::1/128", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7")
)


def _parse_ip(value: str):
    try:
        return ipaddress.ip_address(value.strip())
    except ValueError:
        return None


def client_ip(peer: str, headers) -> str:
    """Return the rate-limit key for a request.

    Trust rule (T-08-05): the forwarded headers are honoured only when the socket peer
    is loopback or private, i.e. our own cloudflared / Docker proxy. A public peer could
    forge them, so for those the socket address wins. From X-Forwarded-For we take the
    RIGHTMOST entry, the hop our own proxy appended, which the client cannot spoof.
    """
    peer_ip = _parse_ip(peer or "")
    if peer_ip is None or not any(peer_ip in net for net in _TRUSTED_PEERS if net.version == peer_ip.version):
        return peer
    cf = headers.get("CF-Connecting-IP")
    if cf:
        parsed = _parse_ip(cf)
        if parsed is not None:
            return str(parsed)
    xff = headers.get("X-Forwarded-For")
    if xff:
        parsed = _parse_ip(xff.split(",")[-1])
        if parsed is not None:
            return str(parsed)
    return peer


def _make_handler(
    agent: Agent,
    settings: Settings,
    limiter=None,
    whisper_slots=None,
    body_deadline: float = _BODY_DEADLINE,
    transcribe_deadline: float = _TRANSCRIBE_DEADLINE,
):
    """Create a request handler class closed over the agent and settings."""
    token = settings.chat_api_token
    limiter = limiter or _RateLimiter()
    whisper_slots = whisper_slots or threading.BoundedSemaphore(_WHISPER_SLOTS)

    class Handler(BaseHTTPRequestHandler):
        # Per-read socket timeout (T-08-08). Upload bodies are additionally held to a
        # total deadline in _read_body.
        timeout = 30

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors_headers()
            self.end_headers()

        def do_GET(self):
            path = self.path.split("?")[0].lstrip("/")

            # Poll for job result: GET /chat/<job_id>
            if path.startswith("chat/"):
                job_id = path[5:]
                job = _JOBS.get(job_id)
                if not job:
                    self._json_response(404, {"error": "Unknown job"})
                    return
                self._json_response(200, job)
                # Clean up completed jobs after retrieval
                if job["status"] in ("done", "error"):
                    _JOBS.pop(job_id, None)
                return

            # Serve static files from the dashboard directory.
            if not path or path == "/":
                path = "grants-dashboard.html"
            fp = (_DASHBOARD_DIR / path).resolve()
            if not str(fp).startswith(str(_DASHBOARD_DIR)) or not fp.is_file():
                self.send_error(404)
                return
            ctype = mimetypes.guess_type(str(fp))[0] or "application/octet-stream"
            data = fp.read_bytes()
            self.send_response(200)
            self._cors_headers()
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _token_ok(self) -> bool:
            # Token auth — skip for Cloudflare tunnel requests.
            if token and "trycloudflare.com" not in (self.headers.get("Host") or ""):
                return self.headers.get("Authorization", "") == f"Bearer {token}"
            return True

        def _authorized(self) -> bool:
            if self._token_ok():
                return True
            self._json_response(401, {"error": "Unauthorized"})
            return False

        def _read_body(self, n: int, keep: bool = True) -> tuple[str, bytes]:
            """Read `n` body bytes under one wall-clock deadline for the whole body.

            Returns ("ok", data), ("timeout", b"") when the deadline passes first, or
            ("eof", b"") when the client stops or the socket fails. With keep=False the
            bytes are discarded as they arrive. Anything but "ok" leaves the stream in an
            unknown position, so the connection is marked for closing.
            """
            deadline_at = time.monotonic() + body_deadline
            buf = bytearray()
            got = 0
            status = "ok"
            try:
                while got < n:
                    left = deadline_at - time.monotonic()
                    if left <= 0:
                        status = "timeout"
                        break
                    self.connection.settimeout(left)
                    chunk = self.rfile.read1(min(65536, n - got))
                    if not chunk:
                        status = "eof"
                        break
                    got += len(chunk)
                    if keep:
                        buf += chunk
            except TimeoutError:
                status = "timeout"
            except OSError:
                status = "eof"
            finally:
                try:
                    self.connection.settimeout(self.timeout)
                except OSError:
                    pass
            if status != "ok":
                self.close_connection = True
                return status, b""
            return status, bytes(buf)

        def _drain_body(self) -> None:
            """Discard a declared upload of at most MAX_AUDIO_BYTES before an early reply.

            Closing a socket that still holds unread request data makes some stacks reset
            the connection, so the client sees a network error instead of the status code.
            Oversize uploads are never read: that path drops the connection instead. The
            read is held to the same total deadline as a real upload; a body that is still
            arriving when it passes is abandoned and the connection closed.
            """
            try:
                remaining = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                return
            if remaining > MAX_AUDIO_BYTES:
                self.close_connection = True
                return
            if remaining > 0:
                self._read_body(remaining, keep=False)

        def _linger(self) -> None:
            """After replying to an upload we will not read, give the client a moment to see it.

            Closing while request bytes are still arriving resets the connection on some
            stacks and the reply is lost with it. So finish our side, then discard a small,
            fixed amount of what is in flight (_LINGER_BYTES within _LINGER_SECONDS) and close.
            """
            self.close_connection = True
            deadline_at = time.monotonic() + _LINGER_SECONDS
            got = 0
            try:
                self.wfile.flush()
                self.connection.shutdown(socket.SHUT_WR)
                # Straight from the socket: rfile refuses to read again after a timeout.
                while got < _LINGER_BYTES:
                    left = deadline_at - time.monotonic()
                    if left <= 0:
                        break
                    self.connection.settimeout(left)
                    chunk = self.connection.recv(min(65536, _LINGER_BYTES - got))
                    if not chunk:
                        break
                    got += len(chunk)
            except OSError:
                pass

        def _reject_upload(self, code: int, data: dict, extra_headers: dict | None = None) -> None:
            self._drain_body()
            self._json_response(code, data, extra_headers)

        def do_POST(self):
            route = self.path.split("?")[0]
            if route == "/chat/transcribe":
                self._handle_transcribe()
                return
            if route != "/chat":
                self.send_error(404)
                return
            if not self._authorized():
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length)) if length else {}
            except (json.JSONDecodeError, ValueError):
                self.send_error(400, "Invalid JSON")
                return

            message = (body.get("message") or "").strip()
            if not message:
                self._json_response(400, {"error": "message is required"})
                return

            session = body.get("session_id", "dashboard")
            job_id = uuid.uuid4().hex[:12]
            _JOBS[job_id] = {"status": "pending"}

            # Run inference in a background thread so we respond within seconds.
            def _run():
                history = _HISTORY.get(session, [])
                try:
                    reply = agent.respond(message, history)
                    _HISTORY[session] = (
                        history + [{"role": "user", "content": message}, {"role": "assistant", "content": reply}]
                    )[-_HISTORY_TURNS:]
                    _JOBS[job_id] = {"status": "done", "reply": reply or "(no reply)"}
                except Exception:
                    log.exception("agent.respond failed in chat API")
                    _JOBS[job_id] = {"status": "error", "reply": "Agent error — try again."}

            threading.Thread(target=_run, daemon=True).start()
            self._json_response(202, {"job_id": job_id})

        def _handle_transcribe(self):
            if not self._token_ok():
                self._reject_upload(401, {"error": "Unauthorized"})
                return
            ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            suffix = _AUDIO_EXT.get(ctype)
            if suffix is None:
                self._reject_upload(415, {"error": "Unsupported media type"})
                return
            key = client_ip(self.client_address[0], self.headers)
            if not limiter.allow(key):
                self._reject_upload(
                    429,
                    {"error": "Too many requests"},
                    {"Retry-After": str(limiter.retry_after(key))},
                )
                return
            raw_len = self.headers.get("Content-Length")
            if raw_len is None:
                self._json_response(411, {"error": "Content-Length required"})
                return
            try:
                n = int(raw_len)
            except ValueError:
                self._json_response(400, {"error": "Invalid Content-Length"})
                return
            if n <= 0:
                self._json_response(400, {"error": "Empty body"})
                return
            if n > MAX_AUDIO_BYTES:
                # Answer without reading the body and drop the connection (T-08-06).
                self.close_connection = True
                self._json_response(413, {"error": "Audio too large"})
                return
            # The whole body is in memory before a Whisper slot is taken, so a slow
            # sender can only tie up its own connection, never a slot.
            status, body = self._read_body(n)
            if status != "ok":
                code, data = (
                    (408, {"error": "Upload too slow"}) if status == "timeout" else (400, {"error": "Incomplete body"})
                )
                try:
                    self._json_response(code, data, {"Connection": "close"})
                except OSError:
                    return  # the client has already gone
                if status == "timeout":
                    self._linger()
                return
            if not whisper_slots.acquire(blocking=False):
                self._json_response(503, {"error": "Server busy, try again"})
                return
            try:
                code, payload = self._transcribe(body, suffix)
            finally:
                whisper_slots.release()
            self._json_response(code, payload)

        def _transcribe(self, body: bytes, suffix: str) -> tuple[int, dict]:
            """Run Whisper on `body` under transcribe_deadline; returns (status, payload).

            The call runs in a worker thread so the handler can stop waiting at the
            deadline. The worker deletes the temp file as soon as the backend returns,
            which is before the handler is woken, so a client that has seen a reply can
            rely on the audio no longer being on disk (T-08-12). After a 504 the handler
            deletes the file itself; the worker repeats that when the abandoned call
            finally returns, for platforms that refuse to delete a file still in use.
            """
            try:
                fd, path = tempfile.mkstemp(suffix=suffix)
            except OSError:
                log.exception("transcribe: could not create temp file")
                return 502, {"error": "Transcription failed"}
            try:
                with os.fdopen(fd, "wb") as fh:
                    fh.write(body)
            except OSError:
                log.exception("transcribe: could not write temp file")
                _unlink(path)
                return 502, {"error": "Transcription failed"}

            result: dict = {}
            done = threading.Event()

            def work() -> None:
                try:
                    result["text"] = voice.transcribe(
                        path,
                        settings.whisper_model,
                        settings.whisper_base_url,
                        settings.whisper_api_key,
                        timeout=transcribe_deadline,
                    )
                except Exception:
                    log.exception("transcribe failed")
                finally:
                    _unlink(path)
                    done.set()

            threading.Thread(target=work, daemon=True, name="transcribe").start()
            if not done.wait(transcribe_deadline):
                log.warning("transcribe exceeded %.0fs; giving up on it", transcribe_deadline)
                _unlink(path)
                return 504, {"error": "Transcription timed out"}
            if "text" not in result:
                return 502, {"error": "Transcription failed"}
            return 200, {"text": (result["text"] or "").strip()}

        def _cors_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

        def _json_response(self, code: int, data: dict, extra_headers: dict | None = None):
            payload = json.dumps(data).encode()
            self.send_response(code)
            self._cors_headers()
            for name, value in (extra_headers or {}).items():
                self.send_header(name, value)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, fmt, *args):
            log.debug(fmt, *args)

    return Handler


def start(agent: Agent, settings: Settings) -> None:
    """Start the chat API server in a daemon thread."""
    host, port = settings.chat_api_host, settings.chat_api_port
    handler = _make_handler(agent, settings)
    try:
        server = ThreadingHTTPServer((host, port), handler)
    except OSError as exc:
        log.warning("Chat API could not bind to %s:%d: %s", host, port, exc)
        return
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever, daemon=True, name="chat-api")
    thread.start()
    log.info("Chat API listening on http://%s:%d/chat", host, port)
