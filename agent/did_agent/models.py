"""Grant data model + Notion property mapping + messy-string normalizers.

The source CSV has free-text Amount ("$5,000-$20,000 (avg $10,000)") and Deadline
("2026-06-30 (decision by Oct 31)") fields. We parse a best-effort structured value AND keep the
raw text, so nothing is lost. Select values are validated against fixed option sets (writing an
unknown select name would auto-create a junk option in Notion).
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

# --- Notion property names (single source of truth; store + tools import these) ---
PROP_FUNDER = "Funder / Program"
PROP_TYPE = "Type"
PROP_AMOUNT = "Amount"
PROP_AMOUNT_NOTE = "Amount Note"
PROP_DEADLINE = "Deadline"
PROP_DEADLINE_NOTE = "Deadline Note"
PROP_501C3 = "501c3 Required"
PROP_BUCKET = "Eligibility Bucket"
PROP_FIT = "Fit Notes"
PROP_STATUS = "Status"
PROP_NEXT = "Next Action"
PROP_LINK = "Link"
PROP_SCORE = "Score"
PROP_RATIONALE = "Score Rationale"
PROP_SOURCE = "Source"

# --- Fixed select option sets ---
TYPE_OPTIONS = ["Grant", "Federal", "Foundation", "Micro-grant", "Research tool", "Other"]
C3_OPTIONS = ["Yes", "No", "Or fiscal sponsor", "Unknown"]
# DID-specific eligibility given 501(c)(3) PENDING:
BUCKET_OPTIONS = ["OPEN_NOW", "VIA_FISCAL_SPONSOR", "AFTER_501C3", "NOT_ELIGIBLE", "UNKNOWN"]
STATUS_OPTIONS = [
    "New", "To research", "Reviewing", "In progress", "Applied", "Active funder",
    "Recurring", "Submitted", "Skipped", "Not eligible", "Declined",
]
SOURCE_OPTIONS = ["CSV seed", "grants.gov", "foundation", "news", "manual"]

_RICH_TEXT_MAX = 2000  # Notion single rich_text run cap


# --- normalizers ---------------------------------------------------------------

def parse_amount(raw: str) -> float | None:
    """Best-effort dollar figure. Prefers an explicit 'avg', else the max in a range."""
    if not raw:
        return None
    nums = [float(x.replace(",", "")) for x in re.findall(r"\$\s*([\d,]+(?:\.\d+)?)", raw)]
    if not nums:
        return None
    low = raw.lower()
    if "avg" in low:
        m = re.search(r"avg[^\d$]*\$?\s*([\d,]+(?:\.\d+)?)", low)
        if m:
            return float(m.group(1).replace(",", ""))
    return max(nums)


def parse_deadline(raw: str) -> str | None:
    """Extract an ISO date (YYYY-MM-DD) if the string contains one; else None."""
    if not raw:
        return None
    m = re.search(r"(\d{4}-\d{2}-\d{2})", raw)
    return m.group(1) if m else None


def normalize_501c3(raw: str) -> str:
    low = (raw or "").strip().lower()
    if not low:
        return "Unknown"
    starts_no = low.startswith("no")
    # A leading "No" (DID can engage now) wins over a downstream "potential fiscal sponsor" mention.
    if "fiscal sponsor" in low and not starts_no:
        return "Or fiscal sponsor"
    if starts_no:
        return "No"
    if "yes" in low:  # catches "Likely yes", "Yes required"
        return "Yes"
    if any(k in low for k in ("unknown", "unclear", "tbd", "n/a")):
        return "Unknown"
    if re.search(r"\bno\b", low):
        return "No"
    return "Unknown"


def bucket_from_501c3(c3: str) -> str:
    return {
        "No": "OPEN_NOW",
        "Or fiscal sponsor": "VIA_FISCAL_SPONSOR",
        "Yes": "AFTER_501C3",
    }.get(c3, "UNKNOWN")


def _closest(value: str, options: list[str], default: str) -> str:
    """Case-insensitive match against an allowed set; substring fallback; else default."""
    if not value:
        return default
    v = value.strip().lower()
    for opt in options:
        if opt.lower() == v:
            return opt
    for opt in options:
        if opt.lower() in v or v in opt.lower():
            return opt
    return default


def normalize_status(raw: str) -> str:
    return _closest(raw, STATUS_OPTIONS, "New")


def normalize_type(raw: str) -> str:
    return _closest(raw, TYPE_OPTIONS, "Grant")


# --- model ---------------------------------------------------------------------

@dataclass
class Grant:
    funder: str
    type: str = "Grant"
    amount: float | None = None
    amount_note: str = ""
    deadline: str | None = None  # ISO date
    deadline_note: str = ""
    requires_501c3: str = "Unknown"
    bucket: str = "UNKNOWN"
    fit_notes: str = ""
    status: str = "New"
    next_action: str = ""
    link: str = ""
    score: float | None = None
    rationale: str = ""
    source: str = "manual"

    @classmethod
    def from_csv_row(cls, row: dict[str, str]) -> "Grant":
        funder = (row.get("Funder / Program") or "").strip()
        amount_raw = (row.get("Amount") or "").strip()
        deadline_raw = (row.get("Deadline") or "").strip()
        c3 = normalize_501c3(row.get("501(c)(3) Required", ""))
        return cls(
            funder=funder,
            type=normalize_type(row.get("Type", "")),
            amount=parse_amount(amount_raw),
            amount_note=amount_raw,
            deadline=parse_deadline(deadline_raw),
            deadline_note=deadline_raw,
            requires_501c3=c3,
            bucket=bucket_from_501c3(c3),
            fit_notes=(row.get("Fit / Eligibility") or "").strip(),
            status=normalize_status(row.get("Status", "")),
            next_action=(row.get("Next Action") or "").strip(),
            link=(row.get("Link") or "").strip(),
            source="CSV seed",
        )

    def to_notion_properties(self) -> dict:
        """Build the Notion property-values payload. Omits empties so upserts don't clobber."""
        props: dict = {
            PROP_FUNDER: {"title": [{"text": {"content": self.funder[:_RICH_TEXT_MAX]}}]},
            PROP_TYPE: {"select": {"name": _closest(self.type, TYPE_OPTIONS, "Other")}},
            PROP_501C3: {"select": {"name": _closest(self.requires_501c3, C3_OPTIONS, "Unknown")}},
            PROP_BUCKET: {"select": {"name": _closest(self.bucket, BUCKET_OPTIONS, "UNKNOWN")}},
            PROP_STATUS: {"select": {"name": _closest(self.status, STATUS_OPTIONS, "New")}},
            PROP_SOURCE: {"select": {"name": _closest(self.source, SOURCE_OPTIONS, "manual")}},
        }
        if self.amount is not None:
            props[PROP_AMOUNT] = {"number": self.amount}
        if self.amount_note:
            props[PROP_AMOUNT_NOTE] = _rt(self.amount_note)
        if self.deadline:
            props[PROP_DEADLINE] = {"date": {"start": self.deadline}}
        if self.deadline_note:
            props[PROP_DEADLINE_NOTE] = _rt(self.deadline_note)
        if self.fit_notes:
            props[PROP_FIT] = _rt(self.fit_notes)
        if self.next_action:
            props[PROP_NEXT] = _rt(self.next_action)
        props[PROP_LINK] = {"url": self.link or None}
        if self.score is not None:
            props[PROP_SCORE] = {"number": self.score}
        if self.rationale:
            props[PROP_RATIONALE] = _rt(self.rationale)
        return props

    @classmethod
    def from_notion_page(cls, page: dict) -> "Grant":
        p = page.get("properties", {})
        return cls(
            funder=_read_title(p.get(PROP_FUNDER)),
            type=_read_select(p.get(PROP_TYPE)) or "Grant",
            amount=_read_number(p.get(PROP_AMOUNT)),
            amount_note=_read_rt(p.get(PROP_AMOUNT_NOTE)),
            deadline=_read_date(p.get(PROP_DEADLINE)),
            deadline_note=_read_rt(p.get(PROP_DEADLINE_NOTE)),
            requires_501c3=_read_select(p.get(PROP_501C3)) or "Unknown",
            bucket=_read_select(p.get(PROP_BUCKET)) or "UNKNOWN",
            fit_notes=_read_rt(p.get(PROP_FIT)),
            status=_read_select(p.get(PROP_STATUS)) or "New",
            next_action=_read_rt(p.get(PROP_NEXT)),
            link=_read_url(p.get(PROP_LINK)),
            score=_read_number(p.get(PROP_SCORE)),
            rationale=_read_rt(p.get(PROP_RATIONALE)),
            source=_read_select(p.get(PROP_SOURCE)) or "manual",
        )


# --- Notion value helpers ------------------------------------------------------

def _rt(text: str) -> dict:
    return {"rich_text": [{"text": {"content": (text or "")[:_RICH_TEXT_MAX]}}]}


def _read_title(prop: dict | None) -> str:
    if not prop:
        return ""
    return "".join(t.get("plain_text", "") for t in prop.get("title", []))


def _read_rt(prop: dict | None) -> str:
    if not prop:
        return ""
    return "".join(t.get("plain_text", "") for t in prop.get("rich_text", []))


def _read_select(prop: dict | None) -> str | None:
    if not prop:
        return None
    sel = prop.get("select")
    return sel.get("name") if sel else None


def _read_number(prop: dict | None) -> float | None:
    return prop.get("number") if prop else None


def _read_url(prop: dict | None) -> str:
    return (prop.get("url") or "") if prop else ""


def _read_date(prop: dict | None) -> str | None:
    if not prop:
        return None
    d = prop.get("date")
    return d.get("start") if d else None


def load_grants_csv(path: str | Path) -> list[Grant]:
    rows: list[Grant] = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            g = Grant.from_csv_row(row)
            if g.funder:
                rows.append(g)
    return rows
