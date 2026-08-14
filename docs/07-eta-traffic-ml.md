# 07 — Traffic & ETA (ML Phase 3)

> **Rule**: no ML until the plumbing works. The ETA model is only as trustworthy as the
> map-matching + traffic-segment pipeline feeding it (research doc, §8).

## 1. Where traffic data comes from

1. Mobile clients send GPS traces → `POST /v1/trace/route` (HMM map-matching).
2. Matched result includes per-edge geometry + speeds (`/trace_attributes`).
3. Gateway/worker aggregates per **edge id × 5-min bucket** into `traffic.segments`:

```
traffic.segments (
  edge_id      bigint,
  time_bucket  timestamptz,          -- floor to 5 min
  speed_pct    numeric[],             -- percentiles [p5,p25,p50,p75,p95]
  speed_avg    numeric,
  count        int,
  day_of_week  smallint, hour smallint,
  PRIMARY KEY (edge_id, time_bucket)
)
```

4. Periodically export Valhalla **traffic archives** (`traffic.tar`) from the aggregate table
   to enable time-dependent routing (`/route` with `date_time`).

## 2. Model pipeline (three stages, per research doc)

### 2.1 Segment-level forecasting (baselines first)
- **DCRNN** (arXiv 1707.01926, ICLR 2018) — diffusion-convolutional GRU, spatio-temporal.
- **STGCN** (arXiv 1709.04875, IJCAI 2018) — spatio-temporal GCN.
- Input: historical speed matrices over road graph; output: next-K 5-min speed forecasts.
- Tooling: PyTorch + PyTorch Geometric; graph built from Valhalla tiles' edge topology.

### 2.2 ETA prediction (production)
- **Google Maps GNN ETA** (arXiv 2108.11482, CIKM 2021) — encode-process-decode Graph
  Network over route subgraphs; features: link class, length, historic speeds, time-of-day,
  weather, driver/route props; MetaGradients for batch stabilization.
- **DuETA** (Baidu, arXiv 2208.06979) — congestion *propagation* patterns across road
  segments; closest analog to Amap's live ETA.
- Serving: route-time feature extraction from Valhalla `/route` + `traffic.segments` →
  model → ETA. Target latency < 50 ms.

### 2.3 Evaluation
- MAE/MAPE vs. actual travel time; A/B vs. Valhalla's built-in time-dependent estimates.
- Golden set: map-matched traces with known start/end time deltas.

## 3. Dataset strategy

- Phase 1–2: synthetic traces (route + simulated noise) to validate pipeline.
- Phase 2+: opt-in real traces from the React Native app (privacy: aggregate-only, no PII).
- Public OSM-based congestion datasets (e.g., Uber Movement-like) as calibration.

## 4. Architecture

```
traces ─► map-match ─► traffic.segments ─► valhalla traffic.tar (time-dependent routing)
                                     └─► feature store ─► GNN ETA model ─► /v1/eta
```
