# 01 — System Architecture

## 1. Goals

Build a production-grade, Amap-class mapping backend **entirely from free/open-source
components**, capable of powering a React Native navigation app. The founding principle from
the research doc:

> The routing graph, coordinate system correctness, and map-matching pipeline are the
> unglamorous plumbing that determines whether your "AI-powered ETA" is trustworthy — build
> those first, add the ML layer once the data pipeline actually works.

## 2. Architectural decisions (summary)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Routing engine | **Valhalla** | Single engine that natively provides routing, matrix, isochrones, and **HMM map-matching** (`/trace_route`, `/trace_attributes`). Avoids running OSRM + a separate matcher. BSD-2. |
| D2 | Geocoding (phase 1) | **Custom PostGIS search** | Forward/reverse geocoding + autocomplete directly over our OSM import using `pg_trgm` + `tsvector` + H3. Zero extra infra, fully scriptable, good enough for city scale. Photon/Nominatim is the phase-2 upgrade path (ADR-0004). |
| D3 | Vector tiles | **Martin** | Single Rust binary serving MVT straight from PostGIS tables/views. Simplest maintained path from our OSM import to rendered tiles. |
| D4 | Spatial storage | **PostgreSQL + PostGIS** | De-facto standard, osm2pgsql support, H3 + pg_trgm extensions, relational querying. |
| D5 | API gateway | **TypeScript + Fastify** | One language across client (RN) and gateway; OpenAPI out of the box; fast. |
| D6 | Data source | **OpenStreetMap** via Geofabrik India extract + osmium city extraction | Free, ODbL, covers routing + POIs + basemap. GCJ-02 handling documented for China scenarios (ADR-0006). |
| D7 | Caching | **Redis** | Route/geocode caching + rate limiting; cheap, standard. |

## 3. Component inventory

### 3.1 Valhalla (routing + map-matching)
- Image: `ghcr.io/valhalla/valhalla-scripted:latest`
- Data: OSM `.pbf` dropped into `/custom_files`; container builds contraction-hierarchy-style routing tiles (`valhalla_build_tiles`) on first start, then serves on `:8002`.
- Endpoints consumed by the gateway:
  - `/route` — turn-by-turn (auto/bicycle/pedestrian).
  - `/sources_to_targets` — many-to-many distance/time matrix.
  - `/isochrone` — reachability contours.
  - `/trace_route` — HMM map-matching of a GPS trace to the road network.
  - `/trace_attributes` — matched path geometry + speeds (feeds the future traffic layer).
- Config: `docker/valhalla/valhalla.json` (service limits, Meili map-match tuning).

### 3.2 PostgreSQL + PostGIS (POIs, places, tiles)
- Image: `postgis/postgis:16-3.4`
- Loaded by `osm2pgsql` (flex output → `planet_osm_*` tables).
- We add a curated `sara` schema:
  - `sara.places` — materialized view of named features (POIs + places) with `tsvector`, trigram, and H3 indexes (geocoding + POI search).
  - `sara.tile_*` — MVT-friendly views served by Martin.
- `docker/postgis/init/01-extensions.sql`, `02-poi-schema.sql`.

### 3.3 Martin (vector tiles)
- Image: `ghcr.io/maplibre/martin:latest`
- Serves `sara.tile_*` / `planet_osm_*` as Mapbox Vector Tiles (MVT) from PostGIS at `:3000`.
- Config: `docker/martin/martin.yaml`.

### 3.4 API gateway (ours)
- Code: `backend/api/` — Fastify + TypeScript.
- Responsibilities:
  - Validate/normalize requests, translate to each engine's format.
  - Standard GeoJSON-ish response envelope.
  - `/health` incl. dependency status.
  - OpenAPI docs at `/docs` (`@fastify/swagger`).
  - Redis cache for geocode + route; rate limiting.
- Forwards to Valhalla/PostGIS/Martin; never exposes engine internals to the client.

### 3.5 Redis (cache)
- Image: `redis:7-alpine`. Route responses (short TTL), geocode (long TTL), API rate limits.

## 4. Data flow

### 4.1 Offline pipeline (one-time / periodic)
```
Geofabrik india-latest.osm.pbf (~1.4 GB)
        │  scripts/fetch-region.ps1
        ▼
docker/data/india-latest.osm.pbf
        │  scripts/extract-region.sh (osmium bbox)  lon 79.82..80.25, lat 22.95..23.36
        ▼
docker/data/jabalpur.osm.pbf  (~10-40 MB)
        ├─► Valhalla: /custom_files/jabalpur.osm.pbf ──► builds routing tiles
        └─► osm2pgsql ──► PostGIS planet_osm_* ──► sara.places (refresh) ──► Martin tiles
```

### 4.2 Request paths
- **Route**: `GET /v1/route` → gateway → Valhalla `/route` → normalized response (+ cached in Redis).
- **Map-match**: `POST /v1/trace/route` → gateway → Valhalla `/trace_route` (HMM) → matched polyline + per-segment confidence.
- **Geocode**: `GET /v1/geocode?q=` → gateway → PostGIS `sara.places` (pg_trgm + tsvector ranking).
- **Reverse**: `GET /v1/geocode/reverse` → PostGIS nearest feature.
- **POI**: `GET /v1/poi/search|nearby` → PostGIS `sara.places` (H3 bbox prefilter + `ST_DWithin`).
- **Tiles**: `GET /v1/tiles/{z}/{x}/{y}.mvt` → gateway (auth/log) → Martin.

## 5. Cross-cutting concerns

- **Coordinates**: WGS-84 (EPSG:4326) throughout; GCJ-02 transform documented as a pluggable
  gateway concern for China (ADR-0006).
- **Observability**: JSON request logs (`pino`); `/health` dependency checks; ready for
  Prometheus metrics in phase 2.
- **Security**: internal service network (`sara-net`), gateway is the only public ingress;
  `POSTGRES_PASSWORD`/tokens via `.env`.
- **Cost**: everything here runs on a single laptop (Docker Desktop); scales horizontally
  later (Valhalla is stateless per instance, PostGIS → read replicas).

## 6. Deployment topology

```
[sara-net bridge network]
 ├── api        :8080  (public ingress)
 ├── valhalla   :8002  (internal)
 ├── postgis    :5432  (internal, healthcheck)
 ├── martin     :3000  (internal)
 └── redis      :6379  (internal)
```
