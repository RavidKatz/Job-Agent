$ErrorActionPreference = "Stop"

$LocalUrl = "http://localhost:4317"

Write-Host ""
Write-Host "Opening a temporary public tunnel for Job Agent..."
Write-Host "Local app URL: $LocalUrl"
Write-Host ""

$Cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue

if ($Cloudflared) {
  Write-Host "Using cloudflared."
  Write-Host ""
  Write-Host "Copy the generated https://...trycloudflare.com link and send it to beta testers."
  Write-Host "Keep this terminal open. The link stops working when this terminal is closed."
  Write-Host ""
  cloudflared tunnel --url $LocalUrl
  exit $LASTEXITCODE
}

Write-Host "cloudflared was not found on this computer."
Write-Host ""
Write-Host "Option A: install Cloudflare Tunnel, then run this script again."
Write-Host "Download:"
Write-Host "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
Write-Host ""
Write-Host "Option B: use ngrok instead."
Write-Host "After starting the beta server, run:"
Write-Host "ngrok http 4317"
Write-Host ""
Write-Host "Send the generated https://...ngrok-free.app link to beta testers."
Write-Host ""
