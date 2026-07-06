#!/usr/bin/env bash
# macOS / Linux restart loop (analog of supervisor.bat). Keeps the bot alive across crashes.
# Run it under launchd on macOS — see OLLAMA-MAC-SETUP.md. Single instance only (one poller per token).
cd "$(dirname "$0")" || exit 1
while true; do
  ./.venv/bin/python -m did_agent.main
  echo "[supervisor] bot exited, restarting in 5s..."
  sleep 5
done
