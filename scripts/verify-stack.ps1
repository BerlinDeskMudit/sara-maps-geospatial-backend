# Smoke-tests the running stack: container status, key HTTP endpoints, and
# PostGIS row counts. Does not fail on missing API endpoints (the gateway may
# still be under construction); it reports per check.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ps-lib.ps1')

$root = Get-RepoRoot
Ensure-EnvFile | Out-Null
Load-EnvFile (Join-Path $root '.env')

$apiPort = Get-EnvOrDefault 'API_PORT' '8080'
$vhPort = Get-EnvOrDefault 'VALHALLA_PORT' '8002'
$martinPort = Get-EnvOrDefault 'MARTIN_PORT' '3000'
$pgUser = Get-EnvOrDefault 'POSTGRES_USER' 'sara'
$pgDb = Get-EnvOrDefault 'POSTGRES_DB' 'sara'

Write-Host "== Containers =="
docker compose --env-file (Join-Path $root '.env') -f (Join-Path $root 'docker\compose.yml') ps

function Test-Endpoint {
  param([string]$Name, [string]$Url)
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
    Write-Host "[OK]   $Name -> $($r.StatusCode)"
  } catch {
    Write-Host "[FAIL] $Name -> $($_.Exception.Message)"
  }
}

Write-Host "== HTTP endpoints =="
Test-Endpoint 'API /health'       "http://localhost:$apiPort/health"
Test-Endpoint 'API geocode'       "http://localhost:$apiPort/v1/geocode?q=railway%20station"
Test-Endpoint 'Valhalla /status'  "http://localhost:$vhPort/status"
Test-Endpoint 'Martin /health'    "http://localhost:$martinPort/health"
Test-Endpoint 'Martin /catalog'   "http://localhost:$martinPort/catalog"

Write-Host "== PostGIS row counts =="
docker compose --env-file (Join-Path $root '.env') -f (Join-Path $root 'docker\compose.yml') exec -T postgis psql `
  -U $pgUser -d $pgDb -c `
  "SELECT (SELECT count(*) FROM planet_osm_point) AS osm_points, (SELECT count(*) FROM planet_osm_line) AS osm_lines, (SELECT count(*) FROM planet_osm_polygon) AS osm_polygons, (SELECT count(*) FROM sara.places) AS sara_places;"
