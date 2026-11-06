param([switch]$PersistForGitHub)
$ErrorActionPreference = 'Stop'
$volume = Get-Volume -DriveLetter E -ErrorAction Stop
if ($volume.FileSystemLabel -ne 'INATECK_STORAGE_1' -or $volume.FileSystem -ne 'NTFS' -or $volume.SizeRemaining -lt 50GB) {
  throw 'E: must be the NTFS volume INATECK_STORAGE_1 with at least 50 GB free.'
}
$root = 'E:\DevCaches\hebergtonserv-desktop'
$npmConfig = Join-Path $root 'npm.npmrc'
$paths = @{
  CARGO_HOME = Join-Path $root 'cargo-home'
  CARGO_TARGET_DIR = Join-Path $root 'cargo-target'
  PNPM_STORE_DIR = Join-Path $root 'pnpm-store'
  npm_config_cache = Join-Path $root 'npm-cache'
  NPM_CONFIG_PREFIX = Join-Path $root 'npm-global'
  NPM_CONFIG_USERCONFIG = $npmConfig
}
foreach ($name in $paths.Keys | Where-Object { $_ -ne 'NPM_CONFIG_USERCONFIG' }) {
  New-Item -ItemType Directory -Path $paths[$name] -Force | Out-Null
}
Set-Content -LiteralPath $npmConfig -Value "cache=$($paths.npm_config_cache.Replace('\','/'))`nprefix=$($paths.NPM_CONFIG_PREFIX.Replace('\','/'))" -Encoding utf8
foreach ($name in $paths.Keys) { [Environment]::SetEnvironmentVariable($name, $paths[$name], 'Process') }
# Remove Hermes from this process only so command resolution cannot cross into that unrelated product.
$env:PATH = (($env:PATH -split ';' | Where-Object { $_ -and $_ -notmatch '(?i)\\AppData\\Local\\hermes(?:\\|$)' }) -join ';')
if ($PersistForGitHub) {
  foreach ($name in $paths.Keys) { "$name=$($paths[$name])" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append }
}
Write-Output "Application caches configured under $root"
