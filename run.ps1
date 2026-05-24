$Node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path $Node)) {
  Write-Error "Codex Node runtime was not found at $Node"
  exit 1
}

& $Node "$PSScriptRoot\run.mjs" @args
