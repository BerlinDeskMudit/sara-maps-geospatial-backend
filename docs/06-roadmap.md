# 06 — Roadmap

Sequencing mirrors the research doc's "build order": routing/coords/map-matching plumbing
first, ML last — only once real trajectory data flows.

## Phase 1 — Platform (this repo, current)

- [x] Architecture + requirements + API spec (docs/)
- [x] Docker stack: Valhalla, PostGIS, Martin, Redis
- [x] Data pipeline: Geofabrik India → osmium → Jabalpur PBF
- [x] API gateway (Fastify/TS): geocode, reverse, route, matrix, isochrone, map-match, POI search, tiles
- [ ] GCJ-02 transform helper (WGS-84 ↔ GCJ-02) for China datasets
- [ ] OpenMapTiles schema for production-quality vector tiles
- [ ] Address-grade geocoding via Photon/Nominatim (ADR-0004)

## Phase 2 — Data & scale

- **Traffic speed archive**: consume `/trace_attributes` on app GPS traces → per-edge speed
  histograms in `traffic.segments` → build Valhalla `.tar` traffic archives → time-dependent routing.
- **Caching & rate-limit hardening** (Redis), edge tile cache.
- **H3 analytics**: POI clustering, density heatmaps, surge-style zones.
- **Spatial replication**: PostGIS read replicas; Valhalla multi-instance.
- **Auth**: API keys per client (React Native) — JWT.
- **CI/CD**: GitHub Actions build + integration tests on compose.

## Phase 3 — Intelligence (ML)

Traffic/ETA model stack designed in `docs/07-eta-traffic-ml.md`:
- DCRNN / STGCN baselines for segment speed forecasting.
- Google-Maps-style **GNN ETA** (encode-process-decode, arXiv 2108.11482) using map-matched
  trajectories + time/weather features as training data.
- DuETA-style congestion-propagation modeling (arXiv 2208.06979).
- Production serving: TensorFlow Serving / ONNX Runtime, online updates from live traces.

## Non-goals (for now)

Indoor mapping, transit GTFS routing, offline map packs, China GCJ-02 licensed data.
