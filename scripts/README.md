# Sara Maps — scripts

PowerShell pipeline (Windows/Docker Desktop). All scripts read `.env` (created
from `.env.example` on first run).

| Script | Purpose |
|---|---|
| `fetch-region.ps1` | Download Geofabrik India extract (~1.4 GB, one-time) to `docker/data/india-latest.osm.pbf`. |
| `extract-region.ps1` | osmium bbox extract of `REGION_NAME` from India → `docker/data/<region>.osm.pbf`; seeds `docker/data/valhalla/`. |
| `import-osm2pgsql.ps1` | osm2pgsql import → apply `sara` schema → refresh `sara.places` → restart Martin. |
| `verify-stack.ps1` | Container status, HTTP endpoint checks, PostGIS row counts. |
| `ps-lib.ps1` | Shared helpers (env loading, compose wrapper). Dot-sourced by the others. |

Recommended order:

```
docker compose --env-file .env -f docker/compose.yml up -d postgis redis   # infra first
scripts\fetch-region.ps1          # ~1.4 GB download
scripts\extract-region.ps1        # city extract + valhalla seed
docker compose --env-file .env -f docker/compose.yml up -d                  # build tiles, start martin/api
scripts\import-osm2pgsql.ps1      # import + schema + refresh + martin restart
scripts\verify-stack.ps1          # smoke test
```
