$ErrorActionPreference = "Stop"

$env:HOST = "0.0.0.0"
$env:PORT = "4317"

Write-Host ""
Write-Host "Starting Job Agent in private beta mode..."
Write-Host "Server host: $env:HOST"
Write-Host "Server port: $env:PORT"
Write-Host ""
Write-Host "Keep this terminal open while beta testers are using the app."
Write-Host "Open a second terminal and run:"
Write-Host ".\start-beta-tunnel.ps1"
Write-Host ""

npm start
