# ─────────────────────────────────────────────────────────────
# start-tunnel.ps1 — Start a Cloudflared quick tunnel (Windows)
# Usage: .\scripts\start-tunnel.ps1 [-Port 3000]
# ─────────────────────────────────────────────────────────────

param(
  [int]$Port = 3000
)

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue

if (-not $cloudflared) {
  Write-Host "❌  cloudflared not found." -ForegroundColor Red
  Write-Host "    Download: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation"
  exit 1
}

Write-Host "🚇  Starting Cloudflared tunnel → http://localhost:$Port" -ForegroundColor Cyan
Write-Host "    The public URL will appear below once the tunnel is ready."
Write-Host ""

cloudflared tunnel --url "http://localhost:$Port" --no-autoupdate
