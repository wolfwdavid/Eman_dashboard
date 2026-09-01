# Start a Cloudflare quick tunnel for the chat API and publish the URL.
# Windows analog of tunnel.sh — run by Task Scheduler ("At log on", restart on failure).
#
# Quick tunnels get a fresh random *.trycloudflare.com hostname on every start, so the
# URL is written to dashboard/chat-config.json and pushed to GitHub; the ChatWidget on
# both Pages sites reads that file to find the API.

$ErrorActionPreference = 'Continue'

$Port       = if ($env:CHAT_API_PORT) { $env:CHAT_API_PORT } else { '8080' }
$AgentDir   = $PSScriptRoot
$RepoDir    = Split-Path -Parent $AgentDir
$ConfigFile = Join-Path $AgentDir 'dashboard\chat-config.json'
$LogFile    = Join-Path $env:TEMP 'did-tunnel.log'

function Write-Log($msg) {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" | Add-Content -Path $LogFile -Encoding utf8
}

Write-Log "Starting cloudflared tunnel for port $Port..."

# Only republish when the hostname actually changes. cloudflared prints its banner
# (including the URL) more than once, and the bash version pushed a commit each time.
$lastUrl = ''
if (Test-Path $ConfigFile) {
    try { $lastUrl = (Get-Content $ConfigFile -Raw | ConvertFrom-Json).api_url } catch { $lastUrl = '' }
}

# cloudflared writes the URL to stderr; 2>&1 folds it into the pipeline.
& cloudflared tunnel --url "http://127.0.0.1:$Port" 2>&1 | ForEach-Object {
    $line = $_.ToString()
    Add-Content -Path $LogFile -Value $line -Encoding utf8

    if ($line -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
        $url = $Matches[0]
        if ($url -eq $lastUrl) { return }
        $lastUrl = $url

        Write-Log "Tunnel URL: $url"
        # ConvertTo-Json keeps the shape identical to what tunnel.sh wrote.
        @{ api_url = $url } | ConvertTo-Json -Compress | Set-Content -Path $ConfigFile -Encoding utf8

        Push-Location $RepoDir
        try {
            git add agent/dashboard/chat-config.json 2>&1 | Out-Null
            git commit -m "chore: update tunnel URL for dashboard chatbot" 2>&1 | Out-Null
            git push 2>&1 | Out-Null
            Write-Log "Pushed chat-config.json to GitHub."
        } catch {
            Write-Log "Push failed (tunnel still up, widget will use a stale URL): $_"
        } finally {
            Pop-Location
        }
    }
}

Write-Log "cloudflared exited."
