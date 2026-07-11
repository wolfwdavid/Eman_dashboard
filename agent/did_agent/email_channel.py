"""Email channel: poll a Gmail inbox over IMAP, answer via the agent, reply over SMTP.

Stdlib only (imaplib/smtplib/email). Sync code — main.py calls poll_once via
asyncio.to_thread from a repeating JobQueue job. The connection is opened and
closed on every poll (60s cadence) so there is no stale-connection state.

Access control: only senders in EMAIL_ALLOWED_SENDERS get replies. Everyone
else is logged and marked seen with NO auto-reply (no backscatter spam).
"""

from __future__ import annotations

import imaplib
import logging
import re
import smtplib
from email import message_from_bytes
from email.message import EmailMessage, Message
from email.utils import parseaddr

log = logging.getLogger("did_agent.email")

_HISTORY_TURNS = 12  # mirrors _HISTORY_TURNS in main.py
_BODY_CAP = 4000  # chars of body fed to the agent
_ON_WROTE_RE = re.compile(r"^On .*wrote:\s*$")
_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(html: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?</\1>", "", html)
    text = re.sub(r"(?i)<br\s*/?>|</p>", "\n", text)
    text = _TAG_RE.sub("", text)
    return text


def _extract_body(msg: Message) -> str:
    """Prefer text/plain; fall back to stripped text/html. Drop quoted history."""
    plain, html = None, None
    parts = msg.walk() if msg.is_multipart() else [msg]
    for part in parts:
        ctype = part.get_content_type()
        if ctype not in ("text/plain", "text/html") or part.get_filename():
            continue
        payload = part.get_payload(decode=True)
        if payload is None:
            continue
        charset = part.get_content_charset() or "utf-8"
        text = payload.decode(charset, errors="replace")
        if ctype == "text/plain" and plain is None:
            plain = text
        elif ctype == "text/html" and html is None:
            html = text
    body = plain if plain is not None else _strip_html(html or "")
    # Drop quoted reply history: "> ..." lines and the "On ... wrote:" marker onward.
    lines: list[str] = []
    for line in body.splitlines():
        if _ON_WROTE_RE.match(line.strip()):
            break
        if line.lstrip().startswith(">"):
            continue
        lines.append(line)
    return "\n".join(lines).strip()[:_BODY_CAP]


def _send_reply(settings, original: Message, to_addr: str, body: str) -> None:
    reply = EmailMessage()
    reply["From"] = settings.email_address
    reply["To"] = to_addr
    subject = original.get("Subject", "") or ""
    reply["Subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
    msg_id = original.get("Message-ID")
    if msg_id:
        reply["In-Reply-To"] = msg_id
        refs = original.get("References", "")
        reply["References"] = f"{refs} {msg_id}".strip()
    reply.set_content(body)
    with smtplib.SMTP_SSL(settings.email_smtp_host, 465) as smtp:
        smtp.login(settings.email_address, settings.email_app_password)
        smtp.send_message(reply)


def _handle_message(settings, agent, history: dict[str, list], raw: bytes) -> None:
    msg = message_from_bytes(raw)
    sender = parseaddr(msg.get("From", ""))[1].lower()
    if sender == settings.email_address:
        return  # loop guard: our own mail
    if sender not in settings.email_allowed_senders:
        log.info("Unauthorized email from %s — ignored (no reply).", sender or "<unknown>")
        return
    text = _extract_body(msg)
    if not text:
        log.info("Empty email body from %s — skipped.", sender)
        return
    log.info("Email from %s (%d chars) — asking agent…", sender, len(text))
    turns = history.get(sender, [])
    reply = agent.respond(text, turns)
    history[sender] = (
        turns + [{"role": "user", "content": text}, {"role": "assistant", "content": reply}]
    )[-_HISTORY_TURNS:]
    _send_reply(settings, msg, sender, reply or "(no reply)")
    log.info("Replied to %s.", sender)


def poll_once(settings, agent, history: dict[str, list]) -> None:
    """One IMAP poll: fetch UNSEEN messages, answer allowed senders, mark all seen."""
    with imaplib.IMAP4_SSL(settings.email_imap_host) as imap:
        imap.login(settings.email_address, settings.email_app_password)
        imap.select("INBOX")
        status, data = imap.search(None, "UNSEEN")
        if status != "OK":
            log.warning("IMAP UNSEEN search failed: %s", status)
            return
        for num in data[0].split():
            try:
                status, fetched = imap.fetch(num, "(RFC822)")
                if status != "OK" or not fetched or fetched[0] is None:
                    log.warning("IMAP fetch failed for message %s", num)
                    continue
                _handle_message(settings, agent, history, fetched[0][1])
            except Exception:
                log.exception("Failed handling email %s", num)
            finally:
                # Always mark seen so a poison message can't loop forever.
                imap.store(num, "+FLAGS", "\\Seen")
