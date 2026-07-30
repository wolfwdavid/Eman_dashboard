"""Localhost HTTP API for the dashboard chatbot.

Exposes POST /chat accepting JSON {"message": "..."} and returning {"reply": "..."}.
Also serves the dashboard directory as static files (GET /*).
Runs a stdlib HTTPServer in a daemon thread — zero new dependencies.
Only binds to 127.0.0.1 (local access only; public access via Cloudflare tunnel).

When CHAT_API_TOKEN is set, POST /chat requires Authorization: Bearer <token>.
"""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from did_agent.config import Settings
from did_agent.llm.client import Agent

log = logging.getLogger("did_agent.chat_api")

_HISTORY: dict[str, list[dict]] = {}
_HISTORY_TURNS = 12
_DASHBOARD_DIR = Path(__file__).resolve().parent.parent / "dashboard"


def _make_handler(agent: Agent, settings: Settings):
    """Create a request handler class closed over the agent and settings."""
    token = settings.chat_api_token

    class Handler(BaseHTTPRequestHandler):
        def do_OPTIONS(self):
            self.send_response(204)
            self._cors_headers()
            self.end_headers()

        def do_GET(self):
            # Serve static files from the dashboard directory.
            path = self.path.split("?")[0].lstrip("/")
            if not path or path == "/":
                path = "grants-dashboard.html"
            fp = (_DASHBOARD_DIR / path).resolve()
            # Security: don't serve files outside the dashboard dir.
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

        def do_POST(self):
            if self.path.split("?")[0] != "/chat":
                self.send_error(404)
                return
            # Token auth (when CHAT_API_TOKEN is configured).
            if token:
                auth = self.headers.get("Authorization", "")
                if auth != f"Bearer {token}":
                    self._json_response(401, {"error": "Unauthorized"})
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
            history = _HISTORY.get(session, [])

            try:
                reply = agent.respond(message, history)
            except Exception:
                log.exception("agent.respond failed in chat API")
                self._json_response(500, {"error": "Agent error — try again."})
                return

            _HISTORY[session] = (
                history + [{"role": "user", "content": message}, {"role": "assistant", "content": reply}]
            )[-_HISTORY_TURNS:]

            self._json_response(200, {"reply": reply or "(no reply)"})

        def _cors_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

        def _json_response(self, code: int, data: dict):
            payload = json.dumps(data).encode()
            self.send_response(code)
            self._cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, fmt, *args):
            log.debug(fmt, *args)

    return Handler


def start(agent: Agent, settings: Settings) -> None:
    """Start the chat API server in a daemon thread."""
    port = settings.chat_api_port
    handler = _make_handler(agent, settings)
    try:
        server = HTTPServer(("127.0.0.1", port), handler)
    except OSError as exc:
        log.warning("Chat API could not bind to port %d: %s", port, exc)
        return
    thread = threading.Thread(target=server.serve_forever, daemon=True, name="chat-api")
    thread.start()
    log.info("Chat API listening on http://127.0.0.1:%d/chat", port)
