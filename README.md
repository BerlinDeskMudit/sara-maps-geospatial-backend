# Sara Maps

An open-source, Amap/Gaode-class mapping platform backend built entirely from free and open-source geospatial software. Designed to power the **Sara Maps** mobile app (React Native UI).

> "The routing graph, coordinate system correctness, and map-matching pipeline are the unglamorous plumbing that determines whether your 'AI-powered ETA' is trustworthy — build those first." — *system-design-resources.md*

## What's inside

| Layer | Technology | Why |
|---|---|---|
| Routing + map-matching + matrix + isochrones | **Valhalla** (`ghcr.io/valhalla/valhalla-scripted`) | Contraction-Hierarchy-class engine (the "Google Maps" approach) with built-in HMM map-matching, `sources_to_targets`, isochrones, trace endpoints. One service covers routing AND map-matching. |
| Geocoding / POI search | **PostgreSQL + PostGIS + pg_trgm + H3** | Our own forward/reverse geocoding + search-as-you-type over OSM data. No heavy Nominatim/Photon infra needed for phase 1. |
| Vector tiles | **Martin** (`ghcr.io/maplibre/martin`) | Rust tile server streaming MVT directly from PostGIS. |
| OSM → PostGIS | **osm2pgsql** | ETL for the POI/network database. |
| OSM → routing graph | osmium + Valhalla builder | Region extraction and tile build. |
| API gateway (ours) | **TypeScript + Fastify** | Unified REST API for the mobile client; orchestrates all services; OpenAPI docs. |
| Cache / rate-limit | **Redis** | Geocode + route result caching, per-key rate limits. |

## Quick start

```powershell
# 1. Environment
Copy-Item .env.example .env          # review ports/credentials

# 2. Fetch region data (downloads Geofabrik India ~1.4GB once, extracts Jabalpur)
./scripts/fetch-region.ps1 -Region jabalpur

# 3. Build & start the platform
docker compose -f docker/compose.yml up -d --build

# 4. Import OSM data into PostGIS (POIs + tiles)
./scripts/import-osm2pgsql.ps1

# 5. Wait for Valhalla to finish building routing tiles, then verify
./scripts/verify-stack.ps1
```

Full walkthrough: `docs/05-infrastructure.md`. Design docs live in [`docs/`](docs/README.md).

## Public API surface

Base URL (local): `http://localhost:8080`

| Method | Path | Description | Backing service |
|---|---|---|---|
| GET | `/health` | Service + dependency health | API |
| GET | `/v1/geocode?q=` | Forward geocode (search places) | PostGIS |
| GET | `/v1/geocode/reverse?lat=&lon=` | Reverse geocode | PostGIS |
| GET | `/v1/route?origin=..&destination=..` | Turn-by-turn route | Valhalla `/route` |
| GET | `/v1/matrix?locations=` | Distance/time matrix | Valhalla `/sources_to_targets` |
| GET | `/v1/isochrone?center=&contours=` | Reachability contours | Valhalla `/isochrone` |
| POST | `/v1/trace/route` | HMM map-matching of GPS traces | Valhalla `/trace_route` |
| GET | `/v1/poi/search?q=&center=&radius=` | POI search-as-you-type | PostGIS |
| GET | `/v1/poi/nearby?lat=&lon=&radius=` | Nearby POIs | PostGIS |
| GET | `/v1/tiles/{z}/{x}/{y}.mvt` | Vector tiles | Martin |
| GET | `/docs` | OpenAPI Swagger UI | API |

## Roadmap (highlights)

- **Phase 1 (now)** — Platform up: routing, map-matching, matrix, isochrones, geocoding, POI search, vector tiles.
- **Phase 2** — Photon/Nominatim for address-grade geocoding, GCJ-02 transform service, H3 clustering & heatmaps, traffic archive + speed data from map-matched traces, caching & rate limiting.
- **Phase 3** — GNN-based ETA/traffic prediction (Google ETA / DuETA architectures), indoor mapping, transit routing (GTFS).

See `docs/06-roadmap.md`.

## License

MIT. Map data © OpenStreetMap contributors (ODbL). See `docs/research/` for attribution and the original research bibliography.
