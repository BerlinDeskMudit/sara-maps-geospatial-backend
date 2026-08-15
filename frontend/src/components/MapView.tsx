import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { decodePolyline } from '../lib/geo';
import type { IsochroneFeature, LatLng, MatrixRow, PinRole, PoiResult } from '../lib/types';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

export interface Overlays {
  route?: { geometry: string; distance_km: number; duration_min: number } | null;
  isochrones?: IsochroneFeature[] | null;
  pois?: PoiResult[] | null;
  trace?: { geometry: string; raw: LatLng[]; matched: LatLng[] } | null;
  matrix?: { rows: MatrixRow[]; locations: LatLng[] } | null;
}

export interface Pins {
  origin?: LatLng;
  destination?: LatLng;
  waypoint?: LatLng;
  center?: LatLng;
  rev?: LatLng;
}

export interface FlyTo {
  lat: number;
  lon: number;
  zoom: number;
  nonce: number;
}

interface Props {
  overlays: Overlays;
  pins: Pins;
  flyTo?: FlyTo | null;
  onPick: (ll: LatLng) => void;
  onCursor: (c: { lat: number; lon: number; zoom: number } | null) => void;
}

const PIN_LABELS: Record<PinRole, string> = {
  origin: 'A',
  destination: 'B',
  waypoint: 'W',
  center: 'C',
  rev: 'R',
};

const ll = (p: LatLng): [number, number] => [p.lon, p.lat];

function setLayerData(map: maplibregl.Map, sourceId: string, data: unknown) {
  const src = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (src) src.setData(data as Parameters<maplibregl.GeoJSONSource['setData']>[0]);
}

function ensureOverlayLayers(map: maplibregl.Map) {
  const sources: Array<[string, unknown]> = [
    ['route-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }],
    ['iso', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }],
    ['poi', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }],
    ['trace', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }],
    ['matrix-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }],
    ['matrix-pts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }],
  ];
  for (const [id, spec] of sources) {
    if (!map.getSource(id)) map.addSource(id, spec as never);
  }
  const layers: Array<maplibregl.LayerSpecification> = [
    {
      id: 'route-line',
      type: 'line',
      source: 'route-line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#1a73e8',
        'line-width': 5,
        'line-opacity': 0.92,
      },
    },
    {
      id: 'iso-fill',
      type: 'fill',
      source: 'iso',
      paint: { 'fill-color': '#9334e6', 'fill-opacity': 0.12 },
    },
    {
      id: 'iso-line',
      type: 'line',
      source: 'iso',
      paint: { 'line-color': '#9334e6', 'line-width': 2, 'line-dasharray': [3, 2] },
    },
    {
      id: 'poi-circles',
      type: 'circle',
      source: 'poi',
      paint: {
        'circle-radius': 5,
        'circle-color': '#f9ab00',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    },
    {
      id: 'trace-raw',
      type: 'line',
      source: 'trace',
      filter: ['==', ['get', 'kind'], 'raw'],
      paint: {
        'line-color': '#ffffff',
        'line-width': 1.5,
        'line-opacity': 0.35,
        'line-dasharray': [1, 2],
      },
    },
    {
      id: 'trace-matched',
      type: 'line',
      source: 'trace',
      filter: ['==', ['get', 'kind'], 'matched'],
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': '#188038',
        'line-width': 4.5,
        'line-opacity': 0.95,
      },
    },
    {
      id: 'trace-pts',
      type: 'circle',
      source: 'trace',
      filter: ['==', ['get', 'kind'], 'pt'],
      paint: {
        'circle-radius': 3,
        'circle-color': '#188038',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1,
      },
    },
    {
      id: 'matrix-lines',
      type: 'line',
      source: 'matrix-lines',
      paint: {
        'line-color': '#009688',
        'line-width': ['interpolate', ['linear'], ['get', 'd'], 0, 1, 1, 3],
        'line-opacity': ['interpolate', ['linear'], ['get', 'd'], 0, 0.18, 1, 0.7],
        'line-dasharray': [4, 3],
      },
    },
    {
      id: 'matrix-pts',
      type: 'circle',
      source: 'matrix-pts',
      paint: {
        'circle-radius': 6,
        'circle-color': '#009688',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5,
      },
    },
  ];
  for (const spec of layers) {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  }
}

export default function MapView({ overlays, pins, flyTo, onPick, onCursor }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRefs = useRef<Record<string, maplibregl.Marker[]>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const container = containerRef.current;
    const markers = markerRefs;
    const map = new maplibregl.Map({
      container,
      center: [79.948, 23.174],
      zoom: 12.6,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          basemap: {
            type: 'raster',
            tileSize: 256,
            tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          },
          roads: { type: 'vector', tiles: ['/api/v1/tiles/tile_roads/{z}/{x}/{y}.mvt'], maxzoom: 16 },
          areas: { type: 'vector', tiles: ['/api/v1/tiles/tile_areas/{z}/{x}/{y}.mvt'], maxzoom: 16 },
          points: { type: 'vector', tiles: ['/api/v1/tiles/tile_points/{z}/{x}/{y}.mvt'], maxzoom: 16 },
        },
        layers: [
          { id: 'basemap', type: 'raster', source: 'basemap' },
          {
            id: 'areas',
            type: 'fill',
            source: 'areas',
            'source-layer': 'tile_areas',
            paint: { 'fill-color': '#c8e6c9', 'fill-opacity': 0.4 },
          },
          {
            id: 'roads-casing',
            type: 'line',
            source: 'roads',
            'source-layer': 'tile_roads',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#ffffff', 'line-width': 7 },
          },
          {
            id: 'roads',
            type: 'line',
            source: 'roads',
            'source-layer': 'tile_roads',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': [
                'match',
                ['get', 'class'],
                'motorway', '#e53935',
                'trunk', '#e53935',
                'primary', '#fb8c00',
                'secondary', '#fdd835',
                'tertiary', '#c0ca33',
                '#90a4ae',
              ],
              'line-width': [
                'match',
                ['get', 'class'],
                'motorway', 4.5,
                'trunk', 4,
                'primary', 3.2,
                'secondary', 2.6,
                'tertiary', 2,
                1.6,
              ],
            },
          },
          {
            id: 'points',
            type: 'circle',
            source: 'points',
            'source-layer': 'tile_points',
            paint: {
              'circle-radius': 3.5,
              'circle-color': '#1976d2',
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 1,
            },
          },
          {
            id: 'point-labels',
            type: 'symbol',
            source: 'points',
            'source-layer': 'tile_points',
            layout: {
              'text-field': ['get', 'name'],
              'text-size': 10,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
              'text-allow-overlap': false,
            },
            paint: { 'text-color': '#263238', 'text-halo-color': '#fff', 'text-halo-width': 1 },
          },
        ],
      },
    });
    mapRef.current = map;

    const move = () => {
      const c = map.getCenter();
      onCursor({ lat: c.lat, lon: c.lng, zoom: map.getZoom() });
    };
    map.on('load', move);
    map.on('move', move);
    containerRef.current.addEventListener('mouseleave', () => onCursor(null), { passive: true });
    map.on('click', (e) => {
      onPick({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    map.on('styledata', () => {
      if (map.isStyleLoaded()) ensureOverlayLayers(map);
    });
    map.on('load', () => {
      ensureOverlayLayers(map);
      setReady(true);
    });
    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        showZoom: true,
        visualizePitch: false,
      }),
      'bottom-right',
    );

    return () => {
      onCursor(null);
      markers.current.pins?.forEach((m) => m.remove());
      markers.current.pins = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // flyTo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: flyTo.zoom, duration: 800 });
  }, [flyTo]);

  // markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    ensureOverlayLayers(map);
    const markers = markerRefs.current;
    const config: Array<[PinRole, LatLng | undefined, string]> = [
      ['origin', pins.origin, 'origin'],
      ['destination', pins.destination, 'destination'],
      ['waypoint', pins.waypoint, 'waypoint'],
      ['center', pins.center, 'center'],
      ['rev', pins.rev, 'rev'],
    ];
    markers.pins?.forEach((m) => m.remove());
    const created: maplibregl.Marker[] = [];
    for (const [role, p, kind] of config) {
      if (!p) continue;
      const el = document.createElement('div');
      el.className = `map-pin pin-${kind}`;
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = `<span class="pin-tag">${PIN_LABELS[role]}</span>`;
      const m = new maplibregl.Marker({ element: el })
        .setLngLat([p.lon, p.lat])
        .addTo(map);
      created.push(m);
    }
    markers.pins = created;
  }, [pins, ready]);

  // route overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    ensureOverlayLayers(map);
    const r = overlays.route;
    const features = r
      ? [
          {
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'LineString' as const, coordinates: decodePolyline(r.geometry, 5).map(ll) },
          },
        ]
      : [];
    setLayerData(map, 'route-line', { type: 'FeatureCollection', features });
    if (r) {
      const coords = decodePolyline(r.geometry, 5).map(ll);
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0], coords[0]),
      );
      map.fitBounds(bounds, { padding: { top: 60, right: 440, bottom: 60, left: 40 } });
    }
  }, [overlays.route, ready]);

  // isochrone overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    ensureOverlayLayers(map);
    const iso = overlays.isochrones;
    const features = (iso ?? []).map((f: IsochroneFeature) => ({
      type: 'Feature' as const,
      properties: { contour: f.contour },
      geometry: f.geometry ?? { type: 'MultiPolygon', coordinates: [] },
    }));
    setLayerData(map, 'iso', { type: 'FeatureCollection', features });
    if (iso && iso.length > 0) {
      const coords: [number, number][] = [];
      const walk = (g: GeoJSON.Geometry | null) => {
        if (!g) return;
        if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach((p) => coords.push(p as [number, number]))));
        if (g.type === 'Polygon') g.coordinates.forEach((ring) => ring.forEach((p) => coords.push(p as [number, number])));
      };
      iso.forEach((f) => walk(f.geometry));
      if (coords.length > 1) {
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(coords[0], coords[0]),
        );
        map.fitBounds(bounds, { padding: { top: 60, right: 440, bottom: 60, left: 40 } });
      }
    }
  }, [overlays.isochrones, ready]);

  // poi overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    ensureOverlayLayers(map);
    const pois = overlays.pois;
    const features = (pois ?? []).map((p: PoiResult) => ({
      type: 'Feature' as const,
      properties: { name: p.name, sub: p.subcategory },
      geometry: { type: 'Point' as const, coordinates: ll(p.center) },
    }));
    setLayerData(map, 'poi', { type: 'FeatureCollection', features });
  }, [overlays.pois, ready]);

  // trace overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    ensureOverlayLayers(map);
    const t = overlays.trace;
    const features = t
      ? [
          { type: 'Feature' as const, properties: { kind: 'raw' }, geometry: { type: 'LineString' as const, coordinates: t.raw.map(ll) } },
          { type: 'Feature' as const, properties: { kind: 'matched' }, geometry: { type: 'LineString' as const, coordinates: decodePolyline(t.geometry, 5).map(ll) } },
          ...t.matched.map((p) => ({
            type: 'Feature' as const,
            properties: { kind: 'pt' },
            geometry: { type: 'Point' as const, coordinates: ll(p) },
          })),
        ]
      : [];
    setLayerData(map, 'trace', { type: 'FeatureCollection', features });
  }, [overlays.trace, ready]);

  // matrix overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    ensureOverlayLayers(map);
    const m = overlays.matrix;
    if (!m || m.locations.length === 0) {
      setLayerData(map, 'matrix-lines', { type: 'FeatureCollection', features: [] });
      setLayerData(map, 'matrix-pts', { type: 'FeatureCollection', features: [] });
      return;
    }
    const maxD = Math.max(...m.rows.flatMap((r) => r.durations_s).filter((n) => n > 0), 1);
    const lines: GeoJSON.Feature[] = [];
    m.rows.forEach((row, i) => {
      row.durations_s.forEach((d, j) => {
        if (i === j || d <= 0) return;
        lines.push({
          type: 'Feature',
          properties: { d: d / maxD },
          geometry: {
            type: 'LineString',
            coordinates: [ll(m.locations[i]), ll(m.locations[j])],
          },
        });
      });
    });
    const pts: GeoJSON.Feature[] = m.locations.map((p) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: ll(p) },
    }));
    setLayerData(map, 'matrix-lines', { type: 'FeatureCollection', features: lines });
    setLayerData(map, 'matrix-pts', { type: 'FeatureCollection', features: pts });
    const bounds = m.locations.reduce(
      (b, p) => b.extend(ll(p)),
      new maplibregl.LngLatBounds(ll(m.locations[0]), ll(m.locations[0])),
    );
    map.fitBounds(bounds, { padding: { top: 60, right: 440, bottom: 60, left: 40 } });
  }, [overlays.matrix, ready]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-canvas" />
      <div className="map-credit">MVT · martin / route · valhalla / POI · postgis</div>
    </div>
  );
}
