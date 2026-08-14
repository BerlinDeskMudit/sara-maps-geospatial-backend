# ADR-0006: Coordinate systems & GCJ-02

Status: **Accepted**

## Context
WGS-84 is the global standard (GPS, OSM). China mandates **GCJ-02** ("Mars coordinates") for
public mapping; Baidu adds BD-09 on top. The research doc calls coordinate correctness the
non-negotiable plumbing.

## Decision
- **Store and compute in WGS-84 (EPSG:4326) only.** All PostGIS geometry, Valhalla I/O, and API
  lat/lon are WGS-84.
- GCJ-02/BD-09 conversion is a **pluggable presentation-layer transform** in the gateway,
  enabled per-region (e.g., a `china` mode) for a future China product. No China product is in
  scope for phase 1.
- Shipping coordinate-offset code for licensed Chinese data is out of scope; the reverse-
  engineered transform is only for research reference.

## Consequences
- Single source of truth for coordinates → no accidental mixing of datum (the classic maps bug).
- If/when China support starts, add `CoordTransformService` behind an interface; the API client
  (RN) receives local-standard coordinates as configured.
