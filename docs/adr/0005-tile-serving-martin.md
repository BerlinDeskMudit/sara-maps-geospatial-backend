# ADR-0005: Vector tile serving — Martin

Status: **Accepted**

## Context
The client renders maps from vector tiles (research doc §6). We need MVT served from the same
OSM import we already load into PostGIS.

## Options
1. **tileserver-gl / MBTiles** — needs a pre-built tileset (extra ETL, extra storage).
2. **Mapnik / custom rendering** — heavy C++ pipeline, build complexity.
3. **Martin** — Rust binary; serves MVT **directly from PostGIS tables/views** at runtime;
   no build step; supports table/function sources; actively maintained by MapLibre org.

## Decision
**Martin** (`ghcr.io/maplibre/martin:latest`) configured with our `sara.tile_*` views.

## Consequences
- Tiles are always in sync with the database (refresh `sara.tile_*` → tiles update; no tile build).
- Trade-off: tile generation happens per-request in PostGIS; fine for city scale, mitigated by
  client-side tile caching; OpenMapTiles schema upgrade in phase 2 improves styling fidelity.
- Martin sits on the internal network; only the gateway proxies `/v1/tiles/*` (auth, logging).
