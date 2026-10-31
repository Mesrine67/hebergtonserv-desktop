# Runs only after Tauri signed NSIS/MSI artifacts and runner-manager.exe were uploaded.
# Exposes the experimental raw Windows executable plus checksums of GitHub-hosted files.
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($env:GITHUB_REF_NAME)) { throw 'Release tag missing.' }
if ([string]::IsNullOrWhiteSpace($env:GH_TOKEN)) { throw 'GitHub release permission missing.' }
$tag = $env:GITHUB_REF_NAME
$app = 'src-tauri/target/release/hebergtonserv-desktop.exe'
if (-not (Test-Path -LiteralPath $app)) { throw 'Compiled Tauri application not found.' }
New-Item -ItemType Directory -Path 'dist-standalone' -Force | Out-Null
$name = "HebergTonServ-Desktop-$tag-windows-x64-standalone-experimental.exe"
$portable = Join-Path 'dist-standalone' $name
Copy-Item -LiteralPath $app -Destination $portable -Force
if ((Get-Item -LiteralPath $portable).Length -lt 1000000) {
  throw 'Standalone application executable is unexpectedly small.'
}
& gh release upload $tag $portable --clobber
if ($LASTEXITCODE -ne 0) { throw 'Failed to upload standalone executable.' }
New-Item -ItemType Directory -Path 'dist-release' -Force | Out-Null
& gh release download $tag --dir dist-release
if ($LASTEXITCODE -ne 0) { throw 'Failed to retrieve release assets for hashing.' }
$files = @(Get-ChildItem 'dist-release' -File | Sort-Object Name)
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
$checksum = Join-Path 'dist-release' 'SHA256SUMS.txt'
[IO.File]::WriteAllLines($checksum, [string[]]$lines, [Text.Encoding]::ASCII)
if ((Get-Content $checksum).Count -ne 7) { throw 'Invalid checksum file.' }
& gh release upload $tag $checksum --clobber
if ($LASTEXITCODE -ne 0) { throw 'Failed to upload SHA256SUMS.txt.' }
Write-Output "Generated seven SHA256 checksums for $tag."
