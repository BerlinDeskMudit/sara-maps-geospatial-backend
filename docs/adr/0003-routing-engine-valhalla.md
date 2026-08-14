# ADR-0003: Routing & map-matching engine — Valhalla

Status: **Accepted**

## Context
The routing core is the most important subsystem (research doc §2: CH-class preprocessing).
We also need HMM map-matching (§4) and, eventually, time-dependent routing from traffic data.

## Options considered
1. **OSRM** — extremely fast CH routing, but no map-matching, no isochrones; needs a separate
   matcher service (e.g. `mapbox/valhalla`-style or bespoke HMM).
2. **GraphHopper** — Java, has routing + matrix + isochrone + map-matching modules; heavier
   JVM footprint, less battle-tested traffic archive story.
3. **Valhalla** — C++, one engine: `/route`, `/sources_to_targets`, `/isochrone`,
   `/trace_route` (HMM), `/trace_attributes`, and native **traffic archive** support for
   time-dependent routing (used by Mapbox in production).

## Decision
**Valhalla** (BSD-2), run via the official scripted Docker image.

## Consequences
- One service covers routing, matrix, isochrones, and map-matching — fewer moving parts.
- `/trace_attributes` output feeds the traffic/ETA pipeline (docs/07).
- Trade-off vs OSRM: slightly higher memory (~2–4 GB tiles) and slower cold queries; fine for
  city scale and phase 1.
- If OSRM-level raw throughput is ever needed, the gateway isolates engines behind the route
  client (swap = config change).
