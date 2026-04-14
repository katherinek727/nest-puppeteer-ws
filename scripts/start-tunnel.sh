#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# start-tunnel.sh — Start a Cloudflared quick tunnel manually
# Usage: ./scripts/start-tunnel.sh [port]
# ─────────────────────────────────────────────────────────────

PORT=${1:-3000}

if ! command -v cloudflared &> /dev/null; then
  echo "❌  cloudflared not found."
  echo "    Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation"
  exit 1
fi

echo "🚇  Starting Cloudflared tunnel → http://localhost:${PORT}"
echo "    The public URL will appear below once the tunnel is ready."
echo ""

cloudflared tunnel --url "http://localhost:${PORT}" --no-autoupdate
