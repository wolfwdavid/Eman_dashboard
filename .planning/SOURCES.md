# Data Sources — Eman_dashboard / DID Grant Automation

## Notion (source of truth)

**Diversity Includes Disability — Eman Rimawi** (private, access-gated):

https://app.notion.com/p/Diversity-Includes-Disability-Eman-Rimawi-289f9c30ac5180828513c4dea1a9fb25

Contents: org profile, weekly meeting notes (Oct 2025 → Apr 2026), grant reservoir,
funder contact log, detailed grant write-ups.

> ⚠️ **Security:** The Notion page contains plaintext passwords, portal logins, EINs, and a
> home address. These are EXCLUDED from every file in this repo. **Never commit or push raw
> Notion content** — grant/funder *data only*. Some repo remotes are public.
>
> For programmatic agent access, authenticate with the **Notion MCP OAuth token** stored in a
> vault credential — NOT the `ntn_` integration REST key (different auth systems).

## Existing local dataset

- `../Rimawi/grants.csv` — 28 opportunities + 11 research tools (see `../Rimawi/RESUME.md`)
- `../Rimawi/grant-tracker.html` — self-contained accessible tracker

## Key constraint

DID is an S-corp LLC with **501(c)(3) PENDING** — this gates grant eligibility. Unlock =
fiscal sponsor (Fund for the City of NY / NY Community Trust pathway).
