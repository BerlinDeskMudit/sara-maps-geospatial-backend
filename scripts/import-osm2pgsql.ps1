# Imports the region PBF with osm2pgsql (planet_osm_* tables, EPSG:4326),
# applies the curated sara schema, populates sara.places, and restarts Martin
# so it discovers the sara.tile_* views.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ps-lib.ps1')

$root = Get-RepoRoot
Ensure-EnvFile | Out-Null
Load-EnvFile (Join-Path $root '.env')

$region = Get-EnvOrDefault 'REGION_NAME' 'jabalpur'
$regionPbf = Join-Path $root "docker\data\$region.osm.pbf"
if (-not (Test-Path -LiteralPath $regionPbf)) {
  throw "Region PBF not found at $regionPbf. Run scripts/extract-region.ps1 first."
}

Write-Host "== osm2pgsql import =="
Invoke-DockerCompose @('--profile', 'import', 'run', '--rm', 'osm2pgsql')

Write-Host "== Applying sara schema =="
Invoke-DockerCompose @('exec', '-T', 'postgis', 'psql',
  '-U', (Get-EnvOrDefault 'POSTGRES_USER' 'sara'),
  '-d', (Get-EnvOrDefault 'POSTGRES_DB' 'sara'),
  '-v', 'ON_ERROR_STOP=1', '-f', '/sara/sara-schema.sql')

Write-Host "== Populating sara.places =="
Invoke-DockerCompose @('exec', '-T', 'postgis', 'psql',
  '-U', (Get-EnvOrDefault 'POSTGRES_USER' 'sara'),
  '-d', (Get-EnvOrDefault 'POSTGRES_DB' 'sara'),
  '-c', 'REFRESH MATERIALIZED VIEW sara.places;')

Write-Host "== Restarting Martin to discover sara.tile_* views =="
Invoke-DockerCompose @('restart', 'martin')

Write-Host "Import complete."
