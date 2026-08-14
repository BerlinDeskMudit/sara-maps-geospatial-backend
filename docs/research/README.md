# Research Index

Maps the bibliography in `amap-maps-app-system-design-resources.md` (repo root) to our build.
Each entry: what it is, why we care, and where it lands in Sara Maps.

## 1. Routing core (build first)

| Source | Use in Sara Maps |
|---|---|
| Dijkstra (1959) / A* (Hart et al. 1968) | Baseline understanding only — Valhalla implements the real algorithms. |
| Geisberger et al., "Contraction Hierarchies", WEA 2008 | Conceptual basis of Valhalla/OSRM. Docs: `docs/01-architecture.md`, `docs/adr/0003`. |
| Sanders & Schultes, "Engineering Highway Hierarchies" | Precursor to CH; background. |
| Buchhold et al., "Real-Time Traffic Assignment Using Engineered Customizable CH", ACM JEA 2019 | Motivates **time-dependent routing via traffic archives** — phase 2 (`docs/07`). |
| Bläsius et al., "Customizable Contraction Hierarchies" survey 2025 + https://curiouscoding.nl/posts/cch/ | Reference for cost-function customization (toll/truck avoidance). |
| Delling et al., "Customizable Route Planning" | Personalized costings → Valhalla `costing_options` mapping. |
| "Nearest-Neighbor Queries in Customizable CH" (arXiv 2103.10359) | POI search-as-you-type perf target (~25 ms) — our `sara.places` indexes chase this. |

## 2. ETA & traffic (phase 3)

| Source | Use |
|---|---|
| Derrow-Pinion et al., "ETA Prediction with GNNs in Google Maps", CIKM 2021 (arXiv 2108.11482) | Primary architecture for `/v1/eta` model. |
| DeepMind blog (link in source doc) | Non-technical intuition. |
| DuETA (Baidu, arXiv 2208.06979) | Congestion-propagation modeling (closest to Amap). |
| DCRNN, ICLR 2018; STGCN, IJCAI 2018 | Baseline segment forecasters. |
| Yuan et al., "Effective Travel Time Estimation... Historical Trajectories", SIGMOD 2020 | Trajectory-based ETA contrast. |

## 3. Map-matching (implemented via Valhalla Meili)

| Source | Use |
|---|---|
| Newson & Krumm, "HMM Map Matching Through Noise and Sparseness", SIGSPATIAL 2009 | The canonical algorithm; Valhalla's `/trace_route` is an HMM — our `docs/03` edge model mirrors it. |
| Cui et al., "HMM Map Matching Based on Trajectory Segmentation with Heading Homogeneity", GeoInformatica 2021 | Dense-urban improvement; phase 2 tuning. |
| "Time-Aware Map Matching for low sampling GPS data" (arXiv 1603.07376) | Battery-saver sparse traces; phase 2. |

## 4. Geospatial indexing (PostGIS + H3)

| Source | Use |
|---|---|
| Guttman, "R-Trees", 1984 | Background for PostGIS GIST. |
| Uber H3 (design doc + blog) | `sara.places` H3 clustering; heatmaps/surge (phase 2). |
| Google S2 | Comparison reference for H3 choice. |
| Geohash | Baseline understanding. |

## 5. Rendering & tiles

| Source | Use |
|---|---|
| Mapbox Vector Tile spec | Format we serve via Martin. |
| OSM tile pipeline docs (slippy map, Mapnik) | Reference implementation. |
| MapLibre GL (open source) | Client-side renderer reference for the RN app. |
| **Martin** docs | Our tile server (`docs/adr/0005`). |

## 6. Books

- **DDIA** (Kleppmann) — storage/replication theory behind PostGIS/Redis design.
- **GIS & Science** (Longley et al.) — projections & coordinate systems → ADR-0006.
- **Network Routing** (Medhi & Ramasamy) — optional networking context.

## 7. China-specific

- GCJ-02 / BD-09 — see ADR-0006. Amap National Class-A license = regulatory gate, not an
  engineering problem; out of scope for an open-source build.
- `expo-gaode-map` — reference client surface if a China UI is ever attempted.

## Tooling references (open source, used directly)

- Valhalla: https://github.com/valhalla/valhalla · API: https://valhalla.github.io/valhalla
- osmium-tool: https://osmcode.org/osmium-tool/manual.html
- osm2pgsql: https://osm2pgsql.org · Docker: `iboates/osm2pgsql`
- Martin: https://martin.maplibre.org · https://github.com/maplibre/martin
- PostGIS H3: https://github.com/zachasme/h3-pg
- Geofabrik: https://download.geofabrik.de/asia/india.html
- BBBike extracts: https://download.bbbike.org/osm/bbbike/
