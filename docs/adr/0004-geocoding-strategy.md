# ADR-0004: Geocoding strategy

Status: **Accepted (phase 1)**, revisit in phase 2

## Context
Forward + reverse geocoding and POI autocomplete. Full-fidelity open-source options
(Nominatim, Photon) are heavy: Nominatim requires a PostGIS import of its own schema and can
take hours for a country; Photon needs a Nominatim-derived dump or DB.

## Decision (phase 1)
Implement geocoding/search **in the gateway over our existing OSM import** (`sara.places`):
- Forward: `pg_trgm` fuzzy + `tsvector` ranking, optional center/radius bias.
- Reverse: nearest named feature (`ST_DWithin` + `<->`).
- POI search: same view with category filters.
Zero extra infrastructure; fully scriptable; city-scale performance (< 150 ms).

## Consequences
- Fast bootstrap, no Nominatim/Photon ops burden in phase 1.
- Trade-off: address-housenumber level geocoding and international coverage are weaker than
  Nominatim/Photon.
- Phase 2 upgrade path: add **Photon** (lightweight, OSM-derived) behind the same `/v1/geocode`
  interface; gateway picks provider by query type. The `GeocoderClient` interface keeps this
  swap isolated.
