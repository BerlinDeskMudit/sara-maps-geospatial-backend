# ADR-0002: Data source — OpenStreetMap

Status: **Accepted**

## Context
Free, production-grade map data for routing, POIs, and basemap. Licensed commercial sources
(Amap/Baidu) are out of scope for an open-source build.

## Decision
- Primary source: **OpenStreetMap** (ODbL).
- Acquisition: **Geofabrik** country extract (`india-latest.osm.pbf`) once, then **osmium**
  extracts the configured city bounding box (default: Jabalpur) into a small PBF used by all
  engines.
- Alternative city extracts (Mumbai/Bombay, New Delhi) are pre-cut by **BBBike**; the scripts
  accept any PBF URL, so swapping regions is a config change.

## Consequences
- No commercial data licensing cost; ODbL attribution in README/UI.
- OSM coverage varies by region — acceptable for India's major cities; revisit for China
  (coverage + GCJ-02 mandate, see ADR-0006).
- Data pipeline must be idempotent and scripted (Geofabrik downloads are large; keep the
  source PBF optional/cached).
