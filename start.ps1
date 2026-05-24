$Node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path $Node)) {
  $Node = "node"
}

Write-Host ""
Write-Host "Starting Job Agent..."
Write-Host "Open this URL in your browser: http://localhost:4317"
Write-Host "Keep this terminal open while using the app."
Write-Host ""

& $Node "$PSScriptRoot\server.mjs" @args
