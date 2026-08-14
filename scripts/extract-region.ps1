# Extracts the city-region PBF from the Geofabrik India extract with osmium
# (docker image mschilde/osmium-tool), then seeds the Valhalla build directory.
# Idempotent unless -Force is given.
param(
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ps-lib.ps1')

$root = Get-RepoRoot
Ensure-EnvFile | Out-Null
Load-EnvFile (Join-Path $root '.env')

$region = Get-EnvOrDefault 'REGION_NAME' 'jabalpur'
$bbox = Get-EnvOrDefault 'REGION_BBOX' '79.82,22.95,80.25,23.36'
$dataDir = Join-Path $root 'docker\data'
$india = Join-Path $dataDir 'india-latest.osm.pbf'
$out = Join-Path $dataDir "$region.osm.pbf"

if (-not (Test-Path -LiteralPath $india)) {
  throw "India PBF not found at $india. Run scripts/fetch-region.ps1 first."
}
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

if ((Test-Path -LiteralPath $out) -and -not $Force) {
  Write-Host "Extract already exists: $out. Use -Force to re-extract."
} else {
  $winPath = $dataDir.Replace('\', '/')
  Write-Host "Extracting bbox $bbox from India extract ..."
  & docker run --rm -v "${winPath}:/data" mschilde/osmium-tool `
    osmium extract --overwrite -b $bbox -o "/data/$region.osm.pbf" /data/india-latest.osm.pbf
  if ($LASTEXITCODE -ne 0) { throw "osmium extract failed (exit $LASTEXITCODE)" }
}

$vhDir = Join-Path $dataDir 'valhalla'
New-Item -ItemType Directory -Force -Path $vhDir | Out-Null
Copy-Item -LiteralPath $out -Destination (Join-Path $vhDir "$region.osm.pbf") -Force
Copy-Item -LiteralPath (Join-Path $root 'docker\valhalla\valhalla.json') `
  -Destination (Join-Path $vhDir 'valhalla.json') -Force
Write-Host "Seeded Valhalla build dir: $vhDir"
