# Build a standalone Windows executable for the existing CLI/TUI.
# Uses Bun's embedded runtime, so users do not need Node.js or Bun to run it.
param(
  [string]$OutputDirectory = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $root "dist-runner" }
$bun = Get-Command bun.exe -ErrorAction SilentlyContinue
if (-not $bun) {
  $candidate = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
  if (-not (Test-Path -LiteralPath $candidate)) {
    throw "Bun absent. Installer Bun avant de compiler runner-manager.exe."
  }
  $bunExe = $candidate
} else {
  $bunExe = $bun.Source
}
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$output = Join-Path $OutputDirectory "hebergtonserv-runner-manager.exe"
& $bunExe build (Join-Path $PSScriptRoot "runner.mjs") --compile --target bun-windows-x64 --outfile $output
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output)) {
  throw "Compilation de runner-manager.exe impossible."
}
$helpText = & $output --help
if ($LASTEXITCODE -ne 0 -or -not ($helpText -match "Runner Manager")) {
  throw "Le binaire généré ne répond pas correctement à --help."
}
$statusJson = & $output status --json --offline --runner-dir (Join-Path $OutputDirectory "absent") | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $statusJson.offline -ne $true -or $statusJson.executableFound -ne $false) {
  throw "Validation hors ligne du binaire échouée."
}
Write-Output $output
