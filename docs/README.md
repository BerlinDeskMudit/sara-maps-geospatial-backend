# Sara Maps — Design Documentation

Source of truth for how Sara Maps is architected, why, and how to run/change it.

| Doc | What it covers |
|---|---|
| [`01-architecture.md`](01-architecture.md) | System architecture, components, data flow, decisions at a glance |
| [`02-requirements.md`](02-requirements.md) | Functional + non-functional requirements |
| [`03-data-models.md`](03-data-models.md) | PostGIS schema, OSM mapping, H3 indexing, cache keys |
| [`04-api-spec.md`](04-api-spec.md) | Public REST API reference with examples |
| [`05-infrastructure.md`](05-infrastructure.md) | Docker stack, data acquisition, operations runbook |
| [`06-roadmap.md`](06-roadmap.md) | Phased delivery plan |
| [`07-eta-traffic-ml.md`](07-eta-traffic-ml.md) | Traffic + ETA ML phase design (GNN) |
| [`adr/`](adr/) | Architecture Decision Records |
| [`research/`](research/) | Research bibliography + paper notes mapped to the source doc |

## Quick orientation

Sara Maps is a **maps platform**, not a single service. It composes battle-tested open
source geospatial engines (Valhalla, PostGIS, Martin) behind our own thin, typed API
gateway written in TypeScript/Fastify. The mobile client (React Native) talks only to the
gateway.

```
React Native app
      │  REST / MVT
      ▼
┌─────────────────┐   geocode/poi   ┌──────────┐
│  API gateway    ├────────────────►│ PostGIS  │── H3/pg_trgm/tsvector ──► OSM data
│  (Fastify/TS)   │                 └──────────┘
└──┬──┬──┬──┬──┬──┘                       ▲
   │  │  │  │  └── tiles ──────────┐      │ osm2pgsql
   │  │  │  └─ trace (map-matching)│      │
   │  │  └──── matrix/isochrone    │   ┌──┴─────────────┐
   │  └─────── route               └──►│ Valhalla       │── OSM .pbf
   └────────── geocode/search           └────────────────┘   ▲
   (cache: Redis)                                   osmium extract (Jabalpur)
                                                    ▲
                                          Geofabrik India extract
```
