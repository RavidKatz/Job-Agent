$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$Port = 4317
$Url = "http://127.0.0.1:$Port"
$HealthUrl = "$Url/api/health"
$Node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path $Node)) {
  $Node = "node"
}

function Test-JobAgent {
  try {
    $response = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 2
    return $response.ok -eq $true
  } catch {
    return $false
  }
}

if (-not (Test-JobAgent)) {
  Write-Host "Starting Job Agent..."
  Start-Process -FilePath $Node -ArgumentList @("server.mjs") -WorkingDirectory $ProjectRoot -WindowStyle Hidden | Out-Null

  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-JobAgent) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    throw "Job Agent did not start on $Url"
  }
}

Write-Host "Opening $Url"
Start-Process $Url
