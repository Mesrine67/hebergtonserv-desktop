# Build a standalone Windows executable for the existing CLI/TUI.
# Uses Bun's embedded runtime, so users do not need Node.js or Bun to run it.
param(
  [string]$OutputDirectory = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $root "dist-runner" }
$bun = Get-Command bun -ErrorAction SilentlyContinue
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
# Reproduce Explorer double-click (no arguments), using redirected input to exit safely.
$inputPath = Join-Path $OutputDirectory ".runner-launch-input.txt"
$stdoutPath = Join-Path $OutputDirectory ".runner-launch-out.txt"
$stderrPath = Join-Path $OutputDirectory ".runner-launch-err.txt"
try {
  [IO.File]::WriteAllText($inputPath, "q" + [Environment]::NewLine)
  $proc = Start-Process -FilePath $output -NoNewWindow -RedirectStandardInput $inputPath -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
  if (-not $proc.WaitForExit(10000)) {
    Stop-Process -Id $proc.Id -Force
    throw "Lancement sans argument bloqué après 10 secondes."
  }
  $launchText = [IO.File]::ReadAllText($stdoutPath)
  if (-not $launchText.Contains("Runner Manager") -or -not $launchText.Contains("Statut")) {
    throw "Le lancement sans argument n'affiche pas le menu interactif."
  }
  if ($null -ne $proc.ExitCode -and $proc.ExitCode -ne 0) {
    throw "Le gestionnaire s'est fermé avec le code $($proc.ExitCode)."
  }
} finally {
  Remove-Item $inputPath,$stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue
}
Write-Output $output
