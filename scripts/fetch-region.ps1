# Downloads the Geofabrik India extract (~1.4 GB, one-time) used as the source
# for the city-region extract. Idempotent unless -Force is given.
param(
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ps-lib.ps1')

$root = Get-RepoRoot
Ensure-EnvFile | Out-Null
Load-EnvFile (Join-Path $root '.env')

$url = Get-EnvOrDefault 'INDIA_PBF_URL' 'https://download.geofabrik.de/asia/india-latest.osm.pbf'
$dataDir = Join-Path $root 'docker\data'
$dest = Join-Path $dataDir 'india-latest.osm.pbf'

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

if ((Test-Path -LiteralPath $dest) -and -not $Force) {
  $len = (Get-Item -LiteralPath $dest).Length
  Write-Host "Already downloaded: $dest ($([math]::Round($len / 1MB, 1)) MB). Use -Force to re-download."
  exit 0
}

Write-Host "Downloading $url ..."
& curl.exe -L --fail --retry 3 --progress-bar -o $dest $url
if ($LASTEXITCODE -ne 0) { throw "curl failed with exit $LASTEXITCODE" }

$len = (Get-Item -LiteralPath $dest).Length
Write-Host "Saved $dest ($([math]::Round($len / 1MB, 1)) MB)"
