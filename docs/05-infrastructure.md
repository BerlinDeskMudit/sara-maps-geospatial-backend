# 05 — Infrastructure

## 1. Services (`docker/compose.yml`)

| Service | Image | Port | Volumes | Notes |
|---|---|---|---|---|
| `api` | build `backend/api` | `8080:8080` | — | our gateway; healthcheck `/health` |
| `valhalla` | `ghcr.io/valhalla/valhalla-scripted:latest` | — (internal `8002`) | `valhalla_files:/custom_files` | builds routing tiles from PBF on first start |
| `postgis` | `postgis/postgis:16-3.4` | — (internal `5432`) | `pgdata:/var/lib/postgresql/data`, `./docker/postgis/init:/docker-entrypoint-initdb.d` | extensions + `sara` schema auto-created |
| `martin` | `ghcr.io/maplibre/martin:latest` | — (internal `3000`) | `./docker/martin/martin.yaml:/config/martin.yaml` | reads PostGIS directly |
| `redis` | `redis:7-alpine` | — (internal `6379`) | `redisdata:/data` | cache + rate limit |

Internal network `sara-net`. Only `api` publishes to the host.

## 2. Data acquisition & import

Everything is scripted and idempotent.

### 2.1 Fetch (`scripts/fetch-region.ps1`)
- Downloads `https://download.geofabrik.de/asia/india-latest.osm.pbf` (~1.4 GB) once to
  `docker/data/`.
- Skips if already present (checksum optional).

### 2.2 Extract (`scripts/extract-region.ps1` / `.sh`)
- Uses `osmium` (container `osmcode/osmium-tool`) to extract Jabalpur bounding box
  `lon 79.82..80.25, lat 22.95..23.36` → `docker/data/jabalpur.osm.pbf` (tens of MB).
- Region/bbox configurable via `.env` (`REGION_NAME`, `REGION_BBOX`, `REGION_GEOM`).

### 2.3 Valhalla tile build
- `docker compose up valhalla` with `docker/data/jabalpur.osm.pbf` present (copy step handled
  by an init helper). The scripted image builds routing tiles automatically on first start,
  then serves `:8002`.
- Rebuild after data change: `docker compose up -d --force-recreate valhalla` with
  `use_tiles_ignore_pbf=False`.

### 2.4 OSM → PostGIS (`scripts/import-osm2pgsql.ps1`)
- Runs `iboates/osm2pgsql:latest` (container) against `postgis`:
  `osm2pgsql --flex --output=flex --cache 2000 docker/data/jabalpur.osm.pbf`.
- Then applies `docker/postgis/init/02-poi-schema.sql` (creates `sara.places`,
  refreshes materialized view, builds indexes).

### 2.5 Martin tiles
- `martin` reads `sara.tile_*` views; no separate build step. Restart after import:
  `docker compose restart martin`.

## 3. Local runbook (Windows/PowerShell)

```powershell
Copy-Item .env.example .env                 # tweak creds if desired
./scripts/fetch-region.ps1                  # ~1.4 GB download (once)
./scripts/extract-region.ps1                # -> docker/data/jabalpur.osm.pbf
docker compose -f docker/compose.yml up -d --build
./scripts/import-osm2pgsql.ps1              # load PostGIS
./scripts/verify-stack.ps1                  # e2e smoke tests
```

Valhalla's first boot builds tiles (5-15 min for a city); monitor:
```powershell
docker compose -f docker/compose.yml logs -f valhalla
```

## 4. Configuration (`docker/compose.yml` env)

| Variable | Default | Meaning |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `sara` / `sara` / `sara` | PostGIS creds |
| `DATABASE_URL` | `postgresql://sara:sara@postgis:5432/sara` | gateway + osm2pgsql + martin |
| `VALHALLA_URL` | `http://valhalla:8002` | internal |
| `MARTIN_URL` | `http://martin:3000` | internal |
| `REDIS_URL` | `redis://redis:6379` | internal |
| `REGION_NAME` | `jabalpur` | region id |
| `REGION_BBOX` | `79.82,22.95,80.25,23.36` | sw_lng,sw_lat,ne_lng,ne_lat |
| `INDIA_PBF_URL` | `https://download.geofabrik.de/asia/india-latest.osm.pbf` | source |

## 5. Production notes (phase 2)

- Separate PostGIS data volume lifecycle; backups (`pg_dump`), PITR.
- Valhalla behind an L7 proxy; multiple replicas with shared tile volume.
- Replace Redis with managed/cache-aside + edge cache for tiles.
- CI: build image, run integration tests against compose, tag/push.
