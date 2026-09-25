#!/usr/bin/env bash
# Deploy / update the DID agent on the Oracle VM from the laptop.
#   deploy/oracle/deploy.sh <vm-public-ip> [path-to-ssh-key]
# - waits for cloud-init to finish on first run
# - copies agent/.env (never printed) to the VM
# - pulls the latest main and (re)builds the stack
set -euo pipefail
IP="${1:?vm public ip}"
KEY="${2:-$HOME/.ssh/did-agent-oci}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 ubuntu@$IP"
HERE="$(cd "$(dirname "$0")/../.." && pwd)"   # agent/

echo "== waiting for first-boot setup =="
for i in $(seq 1 60); do
  if $SSH 'test -f /var/lib/cloud/did-agent-ready' 2>/dev/null; then echo "ready"; break; fi
  sleep 20
done

echo "== syncing code =="
$SSH 'cd /opt/did-agent && git pull -q --ff-only'

echo "== copying .env (contents not shown) =="
scp -q -i "$KEY" "$HERE/.env" "ubuntu@$IP:/opt/did-agent/agent/.env"
$SSH 'chmod 600 /opt/did-agent/agent/.env'

echo "== building + starting =="
$SSH 'cd /opt/did-agent/agent && sudo docker compose -f deploy/oracle/docker-compose.yml up -d --build'
$SSH 'sudo docker compose -f /opt/did-agent/agent/deploy/oracle/docker-compose.yml ps'
echo "== recent agent log =="
$SSH 'sudo docker logs --tail 30 did-agent'
