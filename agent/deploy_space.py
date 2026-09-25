"""Deploy this agent folder to a Hugging Face Docker Space.

Usage (from the agent/ directory, with `hf auth login` done or HF_TOKEN set):
    python deploy_space.py [--space WolfDavid/did-grant-agent] [--private]

What it does:
  1. Creates the Space if it does not exist (Docker SDK, public unless --private).
  2. Uploads this folder, honouring .dockerignore-style exclusions (never .env, .venv, secrets).
  3. Prints the Space URL and the direct API URL for dashboard/chat-config.json.

Secrets are NOT set here. Add them once in the Space's Settings -> Variables and secrets
(see README.md "Hosting on a Hugging Face Space"). Re-running only uploads changed files.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from huggingface_hub import HfApi

DEFAULT_SPACE = "WolfDavid/did-grant-agent"
IGNORE = [
    ".venv/**", "venv/**", "**/__pycache__/**", "*.pyc", ".pytest_cache/**",
    ".env", "*.env", "secrets/**", "service_account*.json", "google_service_account*.json", "*.key",
    "*.log", "data/local/**", "dashboard/grants-dashboard.html", "dashboard/data/**",
    "tests/**", ".git/**", "deploy_space.py",
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--space", default=DEFAULT_SPACE)
    ap.add_argument("--private", action="store_true")
    args = ap.parse_args()

    api = HfApi()
    who = api.whoami()["name"]
    api.create_repo(args.space, repo_type="space", space_sdk="docker", private=args.private, exist_ok=True)
    here = Path(__file__).resolve().parent
    api.upload_folder(
        folder_path=str(here),
        repo_id=args.space,
        repo_type="space",
        ignore_patterns=IGNORE,
        commit_message="Deploy DID grant agent",
    )
    owner, name = args.space.split("/", 1)
    print(f"Deployed as {who} -> https://huggingface.co/spaces/{args.space}")
    print(f"Direct API URL for dashboard/chat-config.json: https://{owner.lower()}-{name.lower()}.hf.space")


if __name__ == "__main__":
    main()
