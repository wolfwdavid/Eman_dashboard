"""draft_application (Phase 5): fill a Google Docs template from grant + DID org profile."""

from __future__ import annotations

from pathlib import Path

from openai import OpenAI

from did_agent.clients import google_docs
from did_agent.config import Settings
from did_agent.llm.client import SimpleTool, make_client
from did_agent.models import Grant
from did_agent.notion_store import NotionStore
from did_agent.scoring import DID_ORG_PROFILE

_MISSION = (
    "Diversity Includes Disability advances disability equity through representation modeling, "
    "training, consulting, and speaking — centering the lived experience of disabled people."
)

_SCHEMA = {
    "type": "object",
    "properties": {
        "funder": {"type": "string", "description": "Funder/Program to draft an application for"},
        "notes": {"type": "string", "description": "Optional extra guidance from Eman"},
    },
    "required": ["funder"],
}


def _clean_name(funder: str) -> str:
    return funder.replace("[grants.gov]", "").strip()


_INTAKE_PATH = Path(__file__).resolve().parents[2] / "eman-voice-intake.md"


def _load_intake() -> str:
    """Eman's own answers (voice/text). Primary source of truth for drafts when present."""
    try:
        return _INTAKE_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def _draft_narrative(client: OpenAI, model: str, grant: Grant, notes: str) -> str:
    intake = _load_intake()
    intake_block = (
        f"EMAN'S INTAKE (her own words — use these facts and voice; do NOT invent details not here or "
        f"in the org profile; ignore any unanswered prompts):\n{intake}\n\n"
        if intake
        else ""
    )
    prompt = (
        f"ORG:\n{DID_ORG_PROFILE}\n\n{intake_block}GRANT: {grant.funder}\n"
        f"Amount: {grant.amount_note or grant.amount}\nFit notes: {grant.fit_notes or 'n/a'}\n"
        f"Extra guidance from the applicant: {notes or 'none'}\n\n"
        "Write a 150-200 word project summary for DID's application to THIS funder — concrete, mission-aligned, "
        "tailored to what this funder cares about, and in Eman's voice. Only state facts grounded in the org "
        "profile or intake above — never fabricate programs, numbers, or partners. Plain prose, no headers, "
        "first person plural."
    )
    resp = client.chat.completions.create(
        model=model,
        temperature=0.4,
        messages=[
            {"role": "system", "content": "You draft concise, fundable grant-application narratives for a small disability-equity nonprofit, grounded strictly in the facts provided."},
            {"role": "user", "content": prompt},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


def build(settings: Settings) -> SimpleTool:
    client = make_client(settings)
    store = NotionStore(settings)

    def run(tool_input: dict) -> str:
        funder = tool_input.get("funder")
        if not funder:
            return "draft_application requires a 'funder'."
        if not settings.google_service_account_json or not settings.google_template_doc_id:
            return (
                "Google Docs isn't configured yet. Set GOOGLE_SERVICE_ACCOUNT_JSON and "
                "GOOGLE_TEMPLATE_DOC_ID (a template Doc with {{placeholders}}, shared with the SA)."
            )
        grant = store.get_grant(funder)
        if grant is None:
            return f"No grant named '{funder}' in Notion."

        narrative = _draft_narrative(client, settings.llm_model_reasoning, grant, tool_input.get("notes", ""))
        fields = {
            "org_legal_name": "Diversity Includes Disability",
            "ein": "EIN pending (501(c)(3) application in progress)",
            "fiscal_sponsor": "Pursuing fiscal sponsorship (Fund for the City of NY / NY Community Trust)",
            "grant_name": _clean_name(grant.funder),
            "funder": _clean_name(grant.funder),
            "amount_requested": grant.amount_note or (f"${grant.amount:,.0f}" if grant.amount else "TBD"),
            "deadline": grant.deadline_note or grant.deadline or "see funder",
            "project_summary": narrative,
            "mission": _MISSION,
        }
        url = google_docs.fill_application(
            settings.google_service_account_json,
            settings.google_template_doc_id,
            settings.google_output_folder_id,
            fields,
            title=f"DID application — {_clean_name(grant.funder)}",
        )
        return f"Draft created for '{funder}': {url}\n(Review before submitting — nothing is auto-submitted.)"

    return SimpleTool(
        name="draft_application",
        description="Create a first-draft grant application as an editable Google Doc by filling a template "
        "from the grant's details, a tailored Opus-written project summary, and DID's org profile. Returns "
        "the shareable Doc link. Never auto-submits.",
        input_schema=_SCHEMA,
        func=run,
    )
