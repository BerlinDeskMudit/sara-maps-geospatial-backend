# 03 — Data Models

## 1. Conventions

- **Coordinate system**: WGS-84 (EPSG:4326), stored as `geometry(Point,4326)`. Distance
  queries use `geography` casts (metres). GCJ-02 is a display/transform concern, never
  storage (ADR-0006).
- **Text search**: `pg_trgm` GIN index for fuzzy/prefix matching + `tsvector` for ranking.
- **Spatial clustering**: phase 1 uses **geohash** (`ST_GeoHash(way, 9)`, text column + BTREE).
  H3 (via `h3-pg`, res 8/9) is deferred to phase 2 for heatmaps, surge zones and coarse
  spatial joins. Index key = `ST_GeoHash(way, 9)`; H3 upgrade path is a column swap.

## 2. OSM import (osm2pgsql, default `pgsql` output)

Tables created in `public` by osm2pgsql and used downstream (imported with `-l` so all
geometry is already EPSG:4326; tags stored as `hstore`):

| Table | Contents | Used by |
|---|---|---|
| `planet_osm_point` | point features (POIs, labels) | `sara.places`, tiles |
| `planet_osm_line` | linear features (roads, streams) | tiles |
| `planet_osm_polygon` | area features (buildings, landuse) | `sara.places` (centroid), tiles |
| `planet_osm_roads` | major roads (subset) | tiles (low-zoom) |

Every table carries `osm_id`, `name`, `tags` (hstore), and geometry `way`.

## 3. Curated schema — `sara`

### 3.1 `sara.places` (materialized view) — geocoding + POI search

```sql
sara.places (
  id           text,            -- global feature id ('N<osmid>' | 'W<osmid>')
  osm_id       bigint,
  element_type text,            -- 'N' | 'W'
  name         text,            -- primary name
  category     text,            -- 'amenity' | 'shop' | 'leisure' | 'tourism' | 'office' | 'place' | 'highway' | 'building'
  subcategory  text,            -- e.g. 'cafe', 'restaurant', 'fuel', 'hospital'
  tags         hstore,          -- full OSM tags
  way          geometry(Point,4326),  -- centroid for polygons
  way_lat      double precision,      -- denormalised for geohash
  way_lon      double precision,
  geohash      text             -- ST_GeoHash(way, 9)
)
```

Indexes:
- `GIN(lower(name) gin_trgm_ops)` — fuzzy autocomplete.
- `GIN(to_tsvector('simple', name))` — ranked word search.
- `GIST(way)` — spatial.
- `BTREE(geohash)` — cell prefilter for locality queries.
- `BTREE(category, subcategory)` — POI filtering.

Build query: union of `planet_osm_point` (element_type N) and centroid of
`planet_osm_polygon` (element_type W) where `name` is not null and a known category key
exists; `place`/`highway` features included for forward/reverse geocode.

### 3.2 `sara.tile_*` (views) — Martin MVT layers

| View | Source | Filter | Rendered as |
|---|---|---|---|
| `sara.tile_points` | `planet_osm_point` | named features | labels/POI dots |
| `sara.tile_roads` | `planet_osm_line` | `highway` present | roads |
| `sara.tile_areas` | `planet_osm_polygon` | `building`/`landuse`/`natural` | buildings/land |

Each exposes `osm_id` (feature id), `name`, `category`, and `way` geometry. Martin emits
`ST_AsMVT`.

## 4. Cache model (Redis)

| Key pattern | TTL | Value |
|---|---|---|
| `geo:fwd:{hash(q,limit)}` | 24 h | geocode response JSON |
| `geo:rev:{hash(lat,lon,radius)}` | 24 h | reverse geocode JSON |
| `route:{hash(orig,dest,mode,costings)}` | 2 min | route JSON |
| `isochrone:{hash(...)}` | 15 min | contour JSON |

Redis is used for response caching only; API rate limiting is in-memory
(`@fastify/rate-limit`, one window per process).

## 5. Future models (phase 2/3)

- `traffic.segments` — edge_id → speed buckets/time-bucket histogram, fed by `/trace_attributes`.
- `traffic.archives` — Valhalla `.tar` traffic extracts rebuilt from matcher output.
- `eta.models` — model registry + training dataset pointers (`docs/07-eta-traffic-ml.md`).
- GCJ-02 offset metadata table for China regions.
