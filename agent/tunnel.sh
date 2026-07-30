#!/bin/bash
# Start a Cloudflare quick tunnel for the chat API and publish the URL.
# Run by launchd (com.did.tunnel.plist) — restarts on failure.

set -euo pipefail

PORT="${CHAT_API_PORT:-8080}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="$REPO_DIR/agent/dashboard/chat-config.json"
LOG_FILE="/tmp/did-tunnel.log"

echo "$(date) Starting cloudflared tunnel for port $PORT…" >> "$LOG_FILE"

# cloudflared prints the tunnel URL to stderr. Capture it.
cloudflared tunnel --url "http://127.0.0.1:$PORT" 2>&1 | while IFS= read -r line; do
    echo "$line" >> "$LOG_FILE"
    # Look for the tunnel URL line (e.g., "https://xxx.trycloudflare.com")
    if echo "$line" | grep -qoE 'https://[a-z0-9-]+\.trycloudflare\.com'; then
        URL=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com')
        echo "$(date) Tunnel URL: $URL" >> "$LOG_FILE"
        # Write config for the dashboard widget
        echo "{\"api_url\": \"$URL\"}" > "$CONFIG_FILE"
        # Push updated config to GitHub so the Pages version picks it up
        cd "$REPO_DIR"
        git add agent/dashboard/chat-config.json
        git commit -m "chore: update tunnel URL for dashboard chatbot" --allow-empty 2>/dev/null || true
        git push 2>/dev/null || true
        echo "$(date) Pushed chat-config.json to GitHub." >> "$LOG_FILE"
    fi
done
