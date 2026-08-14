# Building a Maps App like Amap (Gaode/高德地图) — Research Papers, Blogs & Resources

Unlike Netflix, Amap/AutoNavi (owned by Alibaba) doesn't run a public engineering blog with deep technical write-ups — most of what's public is either academic papers from their research arm, third-party teardown articles, or the closely analogous published work from Google Maps, Baidu Maps, and Uber (who all solve the same problems and do publish openly). This list leans on those.

A maps app breaks down into: **map rendering/tiles, geocoding & search, route planning, real-time traffic & ETA prediction, GPS map-matching, and geospatial indexing.** Below, organized in build order.

---

## 1. What Amap Actually Is (context first)

- <cite index="42-1">Gaode Maps (Amap), developed by AutoNavi (a subsidiary of Alibaba Group), offers real-time traffic updates, route planning, and navigation for driving, walking, biking, and public transit, with over 700 million users covering 90% of car owners in China as of 2024</cite>.
- <cite index="39-1">Amap holds China's National Class-A Navigation and Surveying License, compiles traffic data from government systems, satellite tracking, and crowdsourced user reports, and supports toll avoidance, truck restrictions, and indoor navigation inside malls/stations/airports</cite>.
- Amap's own research paper on multimodal map understanding: **"GeoDecoder: Empowering Multimodal Map Understanding"** (GaoDe Map / Alibaba, arXiv 2401.15118) — <cite index="37-1">a multimodal model built on a BeitGPT-style architecture that renders road/building geometry from the base map and integrates external data like symbol markers, drive trajectories, and heatmaps directly through the rendering pipeline instead of hand-engineered features</cite>. This is the one direct primary-source Amap paper — worth reading even if narrow in scope.

---

## 2. Route Planning / Shortest Path — the algorithmic core

This is the single most important subsystem. Naive Dijkstra doesn't scale to continental road networks with sub-second query requirements — every production system (Amap, Google Maps, Baidu Maps) uses hierarchical preprocessing.

**Foundational algorithms, read in this order:**
1. **Dijkstra (1959)** and **A\* (Hart, Nilsson, Raphael, 1968)** — baseline, know these cold first.
2. **Geisberger, Sanders, Schultes, Delling — "Contraction Hierarchies: Faster and Simpler Hierarchical Routing in Road Networks"**, WEA 2008. <cite index="45-1">Orders nodes by importance and builds a hierarchy by iteratively contracting the least important node, replacing shortest paths through it with shortcuts; queries use bidirectional search where the forward search only follows edges toward more important nodes</cite>. <cite index="52-1">This is one of the most widely adopted route-planning techniques in production, used in systems like Google Maps</cite>, and almost certainly conceptually similar to what Amap runs internally.
3. **Sanders & Schultes — "Engineering Highway Hierarchies"** and **"Highway Hierarchies Hasten Exact Shortest Path Queries"** — the precursor work CH builds on.
4. **Buchhold, Sanders, Wagner — "Real-Time Traffic Assignment Using Engineered Customizable Contraction Hierarchies"**, ACM JEA 2019 — <cite index="46-1">separates the static road network graph from frequently-changing edge weights, so live traffic updates don't require rebuilding the whole hierarchy — critical for real-time ETA/routing</cite>.
5. **Bläsius, Buchhold, Wagner, Zeitz, Zündorf — Customizable Contraction Hierarchies survey (2025)** — good consolidated reference once you've read the above. Explainer notes: `https://curiouscoding.nl/posts/cch/`
6. **Delling, Goldberg, Pajor, Werneck — "Customizable Route Planning"** — handles personalized cost functions (e.g., avoid tolls, truck restrictions) without full re-preprocessing, directly relevant to Amap's toll-avoidance/truck-limit features.
7. For POI/nearest-neighbor queries on top of your routing graph: **"Nearest-Neighbor Queries in Customizable Contraction Hierarchies and Applications"** (arXiv 2103.10359) — <cite index="49-1">achieves ~25ms k-nearest-POI query times on a continental road network, fast enough for interactive search-as-you-type UX</cite>.

---

## 3. Real-Time ETA & Traffic Prediction — the ML layer

This is where Amap actually differentiates on UX ("saves you 10-20 minutes in rush hour"). <cite index="41-1">Amap has reduced data-processing latency to under 200ms for critical navigation functions and uses predictive analytics that anticipate congestion patterns hours in advance based on weather, construction, and large-scale events</cite>.

**Must-read papers:**
- **Derrow-Pinion, She, Wong, et al. — "ETA Prediction with Graph Neural Networks in Google Maps"**, CIKM 2021 (arXiv 2108.11482). <cite index="58-1">Presents a GNN-based ETA estimator deployed in production at Google Maps, built on standard Graph Network building blocks in an encode-process-decode architecture, using MetaGradients to stabilize training across uneven query batches</cite>. <cite index="53-1">This work — a DeepMind/Google Maps collaboration — improved real-time ETA accuracy by up to 50% in cities like Berlin, Jakarta, São Paulo, Sydney, and Tokyo</cite>. This is the single best paper to study for the ETA subsystem — read it fully, not just the abstract.
- **DeepMind blog companion piece** (less technical, good for intuition first): `https://deepmind.google/blog/traffic-prediction-with-advanced-graph-neural-networks/`
- **Fang, Huang, Wang, et al. — "DuETA: Traffic Congestion Propagation Pattern Modeling via Efficient Graph Learning for ETA Prediction at Baidu Maps"**, arXiv 2208.06979 — the closest direct Chinese-market analog to what Amap likely runs; models how congestion propagates across road segments, not just static per-segment prediction.
- **Li, Yu, Shahabi, Liu — "Diffusion Convolutional Recurrent Neural Network: Data-Driven Traffic Forecasting" (DCRNN)**, ICLR 2018 — foundational spatio-temporal traffic forecasting paper, predates the GNN-ETA work above and is cited by nearly everything since.
- **Yu, Yin, Zhu — "Spatio-Temporal Graph Convolutional Networks (STGCN)"**, IJCAI 2018 — another widely-cited traffic-forecasting architecture, good to compare against DCRNN.
- **Yuan, Li, Bao, Feng — "Effective Travel Time Estimation: When Historical Trajectories over Road Networks Matter"**, SIGMOD 2020 — a non-GNN, trajectory-based ETA approach; useful contrast to the graph-learning papers above.

---

## 4. GPS Map-Matching — turning noisy GPS pings into a road-snapped path

Every "blue dot" on your map and every "you are here, on this road" moment depends on this. Also required for building your own traffic-speed dataset from user GPS traces (which is how Amap/Baidu/Google actually source live traffic data in the first place).

- **Newson & Krumm — "Hidden Markov Map Matching Through Noise and Sparseness"**, ACM SIGSPATIAL 2009 (Microsoft Research). <cite index="67-1">Introduces a Hidden Markov Model approach to match a time-stamped sequence of noisy lat/long points to the most likely road route, elegantly handling both GPS measurement noise and road network topology</cite>. This is THE canonical map-matching paper — <cite index="63-1">it established itself as the mainstream/default approach for the entire field</cite>. Read this one first and treat everything else as a refinement.
- **Cui, Bian, Wang — "Hidden Markov Map Matching Based on Trajectory Segmentation with Heading Homogeneity"**, GeoInformatica 2021 — <cite index="62-1">addresses the degradation of standard HMM map-matching in dense urban road networks by first segmenting GPS trajectories based on heading homogeneity before matching</cite>, i.e. exactly the problem you'd hit in dense Chinese cities like Beijing/Shenzhen.
- For low-frequency/sparse GPS sampling (a real issue with battery-saving location modes on phones): "An effective Time-Aware Map Matching process for low sampling GPS data" (arXiv 1603.07376).

---

## 5. Geospatial Indexing — how you query "what roads/POIs are near this point" fast

- **R-tree (Guttman, 1984)** — the original spatial index, still foundational.
- **Uber's H3 hexagonal hierarchical geospatial index** — read the design doc/whitepaper on GitHub (`uber/h3`), and the accompanying Uber Engineering blog post "H3: Uber's Hexagonal Hierarchical Spatial Index." This is what most modern location platforms (including ride-hailing-adjacent features Amap also has) use instead of raw R-trees for things like surge zones, POI clustering, and coarse spatial joins.
- **Google's S2 geometry library** — alternative to H3, uses a hierarchical decomposition of the sphere into cells; read the S2 docs/whitepaper if you want to compare design tradeoffs against H3.
- **Geohash** — simplest of the three, good to understand as a baseline before H3/S2.

---

## 6. Map Rendering & Tiles

- **Mapbox's "Vector Tiles" spec (Mapbox Vector Tile / MVT)** — the de facto open standard for how modern map clients (including, almost certainly, Amap's own stack conceptually) transmit and render map geometry efficiently at different zoom levels.
- **OpenStreetMap's tile-rendering pipeline docs** (`wiki.openstreetmap.org` — "Slippy Map," "Tile usage policy," Mapnik rendering stack) — the best fully-open reference implementation you can actually read source code for, since Amap's own renderer isn't public.
- Look at **MapLibre GL** (open-source fork of Mapbox GL JS) source code directly — this is the fastest way to understand real client-side vector tile rendering, since it's the actual production code, not a paper.

---

## 7. Books

- **"Designing Data-Intensive Applications" — Martin Kleppmann.** Same as the streaming list — you need this regardless of what you're building; covers the storage/indexing/replication theory underlying your POI database and traffic-data pipeline.
- **"Geographic Information Systems and Science" — Longley, Goodchild, Maguire, Rhind.** The standard GIS textbook; gives you the map-projection, coordinate-system, and spatial-data-model background that most engineers skip and then get bitten by later (e.g. Amap uses GCJ-02, a deliberately offset coordinate system mandated by Chinese law — you need to understand *why* this exists before you touch Chinese mapping data).
- **"Network Routing: Algorithms, Protocols, and Architectures" — Medhi & Ramasamy** — broader networking context, useful if you're also building the underlying data-transport layer.

---

## 8. A China-Specific Detail You Cannot Skip

If you're specifically cloning Amap's model (not Google Maps'), you need to understand:
- **GCJ-02 coordinate system** ("Mars Coordinates") — China's mandated obfuscated coordinate system for public mapping. All Chinese map providers (Amap, Baidu, Tencent) must offset raw WGS-84 GPS coordinates through this before display, by law. Search "GCJ-02 WGS-84 conversion algorithm" for the (reverse-engineered, since it's not officially published) conversion formulas — this is a real, non-optional engineering constraint if you want an Amap-like China product.
- **Baidu also uses its own further-offset BD-09** on top of GCJ-02, for reference/contrast.
- Amap's **National Class-A Navigation and Surveying License** requirement — <cite index="39-1">this is a regulatory license</cite> gating who's even legally allowed to publish detailed Chinese map data; relevant if you're evaluating build-vs-license-data-from-Amap for a real product, not just a learning exercise.

---

## 9. Practical / Hands-On Resources

- **OSRM (Open Source Routing Machine)** — open-source C++ routing engine implementing Contraction Hierarchies; read the source, it's the fastest way to go from the CH papers above to working code.
- **GraphHopper** — another open-source routing engine (Java), good second reference implementation with different design tradeoffs.
- **OpenStreetMap data** (`planet.osm` extracts, or regional extracts via Geofabrik) — free road network data to prototype against before you'd ever need a licensed Amap/Baidu dataset.
- **Amap Open Platform API docs** (`lbs.amap.com`) — if you just want to integrate with Amap rather than clone it, this is the direct developer documentation; also useful as a spec of what feature surface you'd need to replicate.
- **expo-gaode-map** (GitHub, actively maintained 2026) — <cite index="36-1">a China-ready React Native/Expo wrapper around the AMap SDK covering maps, location, search, navigation, and offline maps</cite> — useful as a reference for what a real client integration surface looks like, and for spinning up a working China-map prototype fast if that's your actual goal rather than building the backend from scratch.

---

## Suggested Reading/Build Order

1. Kleppmann's *DDIA* (storage/indexing theory) — same as always, do this first
2. GIS textbook chapters on coordinate systems + GCJ-02 conversion — before you touch any China-specific data
3. Dijkstra/A\* → Contraction Hierarchies papers → prototype with OSRM on OpenStreetMap data
4. Newson & Krumm map-matching paper → implement basic HMM map-matching on your own GPS traces
5. H3 or S2 → build your spatial indexing layer for POI search and nearby queries
6. Vector tile spec + MapLibre GL source → build your rendering client
7. DCRNN/STGCN → ETA GNN paper (Google Maps) → DuETA (Baidu) → build your traffic prediction layer last, once you have real trajectory data flowing through map-matching to train on

Same lesson as the streaming list: the routing graph, coordinate system correctness, and map-matching pipeline are the unglamorous plumbing that determines whether your "AI-powered ETA" is trustworthy — build those first, add the ML layer once the data pipeline actually works.
