"""Google Docs application drafting — service-account "copy then merge".

Drive v3 `files.copy` duplicates a template Doc holding {{placeholders}}, then Docs v1
`documents.batchUpdate` `replaceAllText` swaps each token; returns the edit URL.

Google client imports are deferred into `fill_application` so the pure request-builder
(`build_replace_requests`) and this module import without google-api-python-client installed
(it's only needed at actual send time).

Gotchas baked in (from RESEARCH.md): enable BOTH Drive + Docs APIs; use the full `drive` scope (not
`drive.file`) so a shared template is visible; `batchUpdate` is atomic so every replaceText must be a
string; SA-created files live in the SA's own Drive — share to a person or a person-owned folder.
"""

from __future__ import annotations

_SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
]

# Placeholders the template Doc should contain (as literal {{token}} text).
PLACEHOLDERS = [
    "org_legal_name", "ein", "fiscal_sponsor", "grant_name", "funder",
    "amount_requested", "deadline", "project_summary", "mission",
]


def build_replace_requests(fields: dict) -> list[dict]:
    """Pure: turn {token: value} into Docs replaceAllText requests. Coerces every value to str."""
    reqs = []
    for key, val in fields.items():
        reqs.append(
            {
                "replaceAllText": {
                    "containsText": {"text": "{{%s}}" % key, "matchCase": True},
                    "replaceText": "" if val is None else str(val),
                }
            }
        )
    return reqs


def fill_application(
    service_account_json: str,
    template_id: str,
    output_folder_id: str,
    fields: dict,
    title: str,
) -> str:
    """Copy the template, replace placeholders, return the editable Doc URL."""
    from google.oauth2 import service_account  # deferred
    from googleapiclient.discovery import build  # deferred

    creds = service_account.Credentials.from_service_account_file(service_account_json, scopes=_SCOPES)
    drive = build("drive", "v3", credentials=creds)
    docs = build("docs", "v1", credentials=creds)

    body = {"name": title}
    if output_folder_id:
        body["parents"] = [output_folder_id]
    copy = drive.files().copy(fileId=template_id, body=body, fields="id", supportsAllDrives=True).execute()
    doc_id = copy["id"]

    requests = build_replace_requests(fields)
    if requests:
        docs.documents().batchUpdate(documentId=doc_id, body={"requests": requests}).execute()
    return f"https://docs.google.com/document/d/{doc_id}/edit"
