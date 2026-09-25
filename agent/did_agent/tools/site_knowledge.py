"""site_knowledge: answer questions about DID itself from a curated knowledge file.

Replaces what the old Wix chat widget used to field (services, prices, booking, bio, events,
contact). Pure lookup, no LLM call: the knowledge file is split on `## ` headings and the
best-matching sections are returned for the model to answer from.
"""

from __future__ import annotations

import re
from pathlib import Path

from did_agent.config import Settings
from did_agent.llm.client import SimpleTool

KNOWLEDGE_PATH = Path(__file__).resolve().parents[2] / "knowledge" / "did-site-knowledge.md"

_SCHEMA = {
    "type": "object",
    "properties": {
        "topic": {
            "type": "string",
            "description": "What is being asked about DID, e.g. 'services and prices', 'how to book Eman', "
            "'Eman bio', 'events', 'contact email', 'podcast', 'website pages'. Use 'all' for an overview.",
        },
    },
    "required": ["topic"],
}

_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "for", "in", "on", "is", "are", "what", "who", "how",
    "do", "does", "did", "dids", "with", "about", "me", "i", "you", "we", "our", "your", "it", "at",
    "by", "be", "can", "any", "there", "please", "tell", "info", "information", "diversity",
    "includes", "disability",
}

_MAX_SECTIONS = 2


def _tokens(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    out = set()
    for w in words:
        if w in _STOPWORDS or len(w) < 3:
            continue
        out.add(w)
        if w.endswith("s") and len(w) > 3:  # crude plural fold: prices -> price
            out.add(w[:-1])
    return out


def load_sections(path: Path = KNOWLEDGE_PATH) -> list[tuple[str, str]]:
    """Return [(heading, body)] for each `## ` section of the knowledge file."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return []
    sections: list[tuple[str, str]] = []
    current: str | None = None
    buf: list[str] = []
    for line in text.splitlines():
        if line.startswith("## "):
            if current is not None:
                sections.append((current, "\n".join(buf).strip()))
            current = line[3:].strip()
            buf = []
        elif current is not None:
            buf.append(line)
    if current is not None:
        sections.append((current, "\n".join(buf).strip()))
    return sections


def lookup(topic: str, sections: list[tuple[str, str]] | None = None) -> str:
    """Best-matching sections for `topic`, or the section index when nothing matches."""
    sections = load_sections() if sections is None else sections
    if not sections:
        return "Site knowledge file is missing; answer from general org profile only."
    index = "Sections available: " + "; ".join(h for h, _ in sections)
    if not topic or topic.strip().lower() in {"all", "overview", "everything"}:
        return index + "\n\n" + sections[0][1]

    want = _tokens(topic)
    scored: list[tuple[float, int]] = []
    for i, (heading, body) in enumerate(sections):
        head_hits = len(want & _tokens(heading))
        body_hits = len(want & _tokens(body))
        score = head_hits * 3 + body_hits
        if score:
            scored.append((score, i))
    if not scored:
        return "No section matched. " + index
    scored.sort(key=lambda s: (-s[0], s[1]))
    picked = [sections[i] for _, i in scored[:_MAX_SECTIONS]]
    return "\n\n".join(f"## {h}\n{b}" for h, b in picked)


def build(settings: Settings) -> SimpleTool:  # settings unused; kept for the registry contract
    def run(tool_input: dict) -> str:
        return lookup(str(tool_input.get("topic", "")))

    return SimpleTool(
        name="site_knowledge",
        description="Look up facts about Diversity Includes Disability itself: mission, Eman's bio, the four "
        "services, listed prices and how to book, contact email, website pages, past events, the podcast, "
        "and creative work. Call this before answering any question about DID; answer only from what it "
        "returns and say so when a fact is not there.",
        input_schema=_SCHEMA,
        func=run,
    )
