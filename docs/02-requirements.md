# 02 — Requirements

## 1. Context

Sara Maps targets the feature surface of a modern turn-by-turn map app (Amap/Gaode, Google
Maps, MapMyIndia class) on the backend. The mobile client is React Native. **Phase 1 builds
the backend only.**

## 2. Functional requirements

### FR-1 Routing
- FR-1.1 Route between two `lat,lon` points for `auto`, `bicycle`, `pedestrian`.
- FR-1.2 Multi-waypoint routes and route customization (avoid tolls/ferries/highways later).
- FR-1.3 Turn-by-turn maneuvers with geometry + instructions.
- FR-1.4 Many-to-many distance/time matrix (`/v1/matrix`).
- FR-1.5 Isochrones: reachable area within N minutes.

### FR-2 Map-matching
- FR-2.1 Snap a noisy, time-stamped GPS trace to the road network (HMM).
- FR-2.2 Return matched geometry, per-point confidence, matched edge IDs (for traffic).
- FR-2.3 Handle sparse (low-frequency) traces gracefully.

### FR-3 Geocoding & POI search
- FR-3.1 Forward geocode: text → place candidates ranked by relevance.
- FR-3.2 Reverse geocode: `lat,lon` → nearest named place.
- FR-3.3 Search-as-you-type POI autocomplete with optional center + radius.
- FR-3.4 Nearby POI query by category + radius.
- FR-3.5 POI categories derived from OSM tags (amenity/shop/leisure/tourism/office/highway).

### FR-4 Tiles
- FR-4.1 Serve Mapbox Vector Tiles (MVT) at `/v1/tiles/{z}/{x}/{y}.mvt`.
- FR-4.2 Layers: points (POIs/labels), lines (roads), polygons (buildings/landuse) — phase-1
  pragmatic set; roadmap to OpenMapTiles schema.

### FR-5 Platform
- FR-5.1 Unified OpenAPI-documented gateway (React Native consumes it).
- FR-5.2 `/health` with dependency status.
- FR-5.3 One-command data bootstrap (fetch → extract → import → build).

## 3. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-1 | Route P95 latency | < 300 ms (Valhalla internal, local network) |
| NFR-2 | Geocode / POI search P95 | < 150 ms at city scale |
| NFR-3 | Matrix (10×10) P95 | < 1 s |
| NFR-4 | Availability | 99.9% of engine APIs healthy in compose healthchecks |
| NFR-5 | Reproducibility | `docker compose up` + scripts = working stack on any machine |
| NFR-6 | Security | Only gateway exposed; secrets via `.env`, never committed |
| NFR-7 | Cost | 100% free/open source; runs on a laptop |
| NFR-8 | Extensibility | Engines swap-able behind the gateway (ADR-0003) |

## 4. Out of scope (phase 1)

- Live traffic feeds & GNN ETA (phase 3 — `docs/07-eta-traffic-ml.md`).
- Indoor mapping, transit (GTFS) routing.
- GCJ-02/China licensing and data (documented only).
- User accounts, favorites, offline map packs.
- Map styles/rendering (client concern; tiles provided here).
