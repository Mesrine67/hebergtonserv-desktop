# Runs only after Tauri signed NSIS/MSI artifacts and runner-manager.exe were uploaded.
# Exposes the experimental raw Windows executable plus checksums of GitHub-hosted files.
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($env:GH_TOKEN)) { throw 'GitHub release permission missing.' }
$tag = $env:RELEASE_TAG
if ([string]::IsNullOrWhiteSpace($tag)) { $tag = $env:GITHUB_REF_NAME }
if ([string]::IsNullOrWhiteSpace($tag)) { throw 'Release tag missing.' }
$targetRoot = $env:CARGO_TARGET_DIR
if ([string]::IsNullOrWhiteSpace($targetRoot)) { $targetRoot = 'src-tauri/target' }
$app = Join-Path $targetRoot 'release/hebergtonserv-desktop.exe'
if (-not (Test-Path -LiteralPath $app) -and $targetRoot -ne 'src-tauri/target') {
  $app = 'src-tauri/target/release/hebergtonserv-desktop.exe'
}
if (-not (Test-Path -LiteralPath $app)) { throw 'Compiled Tauri application not found.' }
$staging = $env:RELEASE_STAGING_DIR
if ([string]::IsNullOrWhiteSpace($staging)) { $staging = 'dist-release' }
New-Item -ItemType Directory -Path $staging -Force | Out-Null
$name = "HebergTonServ-Desktop-$tag-windows-x64-standalone-experimental.exe"
$portable = Join-Path $staging $name
Copy-Item -LiteralPath $app -Destination $portable -Force
if ((Get-Item -LiteralPath $portable).Length -lt 1000000) {
  throw 'Standalone application executable is unexpectedly small.'
}
& gh release upload $tag $portable --clobber
if ($LASTEXITCODE -ne 0) { throw 'Failed to upload standalone executable.' }
$downloadArgs = @('release', 'download', $tag, '--dir', $staging, '--clobber')
& gh @downloadArgs
if ($LASTEXITCODE -ne 0) { throw 'Failed to retrieve release assets for hashing.' }
$files = @(Get-ChildItem $staging -File | Sort-Object Name)
if ($files.Count -ne 7) { throw "Expected exactly seven primary assets. Found $($files.Count)" }
$names = @($files | ForEach-Object { $_.Name })
foreach ($required in @('latest.json', 'hebergtonserv-runner-manager.exe', $name)) {
  if ($names -notcontains $required) { throw "Missing release asset: $required" }
}
foreach ($pattern in @('*setup.exe','*setup.exe.sig','*.msi','*.msi.sig')) {
  if (-not @($names | Where-Object { $_ -like $pattern }).Count) {
    throw "Missing signed artifact: $pattern"
  }
}
$lines = @($files | ForEach-Object {
  $digest = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  "$digest  $($_.Name)"
})
$checksum = Join-Path $staging 'SHA256SUMS.txt'
[IO.File]::WriteAllLines($checksum, [string[]]$lines, [Text.Encoding]::ASCII)
if ((Get-Content $checksum).Count -ne 7) { throw 'Invalid checksum file.' }
& gh release upload $tag $checksum --clobber
if ($LASTEXITCODE -ne 0) { throw 'Failed to upload SHA256SUMS.txt.' }
Write-Output "Generated seven SHA256 checksums for $tag."
