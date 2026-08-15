# 04 — API Specification

Base URL: `http://localhost:8080` · OpenAPI interactive docs: `/docs` (Swagger UI).
All coordinates are **WGS-84** `lat,lon` decimals. Errors use RFC-7807-style bodies.

Common error shape:
```json
{ "error": { "code": "BAD_REQUEST", "message": "origin is required", "details": {} } }
```

---

## Health

### `GET /health`
Status of gateway + dependencies.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "dependencies": {
    "valhalla": { "status": "up", "latency_ms": 12 },
    "postgis":  { "status": "up", "latency_ms": 4 },
    "martin":   { "status": "up", "latency_ms": 8 },
    "redis":    { "status": "up", "latency_ms": 1 }
  }
}
```

---

## Geocoding

### `GET /v1/geocode?q=<text>&limit=5&center=lat,lon&radius=2000`
Forward geocode. `center`+`radius` optional for locality bias.

```json
{
  "results": [
    {
      "id": 1234567,
      "name": "Rani Durgavati University",
      "category": "amenity",
      "subcategory": "university",
      "address": {},
      "center": { "lat": 23.1556, "lon": 79.9413 },
      "score": 0.92,
      "type": "place"
    }
  ]
}
```

### `GET /v1/geocode/reverse?lat=23.1556&lon=79.9413&radius=500`
Nearest named place to the point.

```json
{ "place": { "name": "Rani Durgavati University", "category": "amenity", "center": { "lat": 23.1556, "lon": 79.9413 }, "distance_m": 40 } }
```

---

## Routing

### `GET /v1/route?origin=lat,lon&destination=lat,lon&mode=auto`
`mode`: `auto | bicycle | pedestrian`. Optional `avoid_tolls=true`, `alternatives=true`.

```json
{
  "summary": { "distance_km": 5.4, "duration_min": 18.2 },
  "geometry": "encoded polyline (encoded polyline algorithm 5)",
  "maneuvers": [
    {
      "instruction": "Head northwest on Napier Town",
      "type": 1, "distance_km": 0.3, "duration_min": 1.1,
      "start": { "lat": 23.1556, "lon": 79.9413 }
    }
  ],
  "via_points": [ { "lat": 23.1556, "lon": 79.9413 } ]
}
```

### `POST /v1/route`
Body: `{ "origin": "lat,lon", "destination": "lat,lon", "waypoints": ["lat,lon", ...], "mode": "auto" }` — multi-waypoint.

### `GET /v1/matrix?locations=lat,lon;lat,lon&mode=auto`
Semi-colon separated locations; returns N×N durations/distance.
```json
{ "rows": [ { "durations_s": [0, 420, 900], "distances_m": [0, 2600, 5800] }, ... ] }
```

### `GET /v1/isochrone?center=lat,lon&contours=10,20,30&mode=auto`
`contours` in minutes. Returns GeoJSON polygon(s).
```json
{ "features": [ { "contour": 10, "geometry": { "type": "MultiPolygon", "coordinates": [...] } } ] }
```

---

## Map-matching

### `POST /v1/trace/route`
Body:
```json
{
  "trace": [ { "lat": 23.1556, "lon": 79.9413, "time": 1690000000 }, ... ],
  "mode": "auto",
  "radius": 35
}
```
Returns snapped geometry + confidence:
```json
{
  "geometry": "encoded polyline",
  "confidence": 0.87,
  "matched_points": [ { "lat": 23.1554, "lon": 79.9415 } ],
  "edges": [ { "id": 123, "speed": 38, "length_m": 120 } ]
}
```

---

## POI search

### `GET /v1/poi/search?q=cafe&center=lat,lon&radius=2000&limit=20`
Autocomplete + search. Ranking: trigram similarity × proximity.
```json
{ "results": [ { "name": "Cafe Coffee Day", "category": "shop", "subcategory": "coffee", "center": { "lat": 23.15, "lon": 79.94 }, "distance_m": 210 } ] }
```

### `GET /v1/poi/nearby?lat=..&lon=..&radius=1500&category=amenity&subcategory=hospital&limit=20`
Nearby POIs, optional category filter. Same response shape.

---

## Vector tiles

### `GET /v1/tiles/{z}/{x}/{y}.mvt`
Proxy to Martin. Returns `application/x-protobuf` MVT. Layers: `sara.tile_points`,
`sara.tile_roads`, `sara.tile_areas`. Compatible with MapLibre GL.

---

## Rate limiting & caching

- Gateway rate limit: 120 req/min per IP (in-memory store via `@fastify/rate-limit`), headers `X-RateLimit-*`.
- Geocode/route/isochrone responses cached per the table in `docs/03-data-models.md §4`.
