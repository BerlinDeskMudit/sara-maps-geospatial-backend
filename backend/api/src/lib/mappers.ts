import { AppError } from './errors.js';
import { type LatLng, decodePolyline, encodePolyline, round } from './geo.js';

export interface RouteManeuver {
  instruction: string;
  type: number;
  distance_km: number;
  duration_min: number;
  start: LatLng;
}

export interface RouteResult {
  summary: { distance_km: number; duration_min: number };
  geometry: string;
  maneuvers: RouteManeuver[];
  via_points: LatLng[];
}

export function mapRoute(data: unknown): RouteResult {
  const trip = (data as { trip?: { legs?: any[]; summary?: any; locations?: any[] } })
    .trip;
  if (!trip) {
    throw new AppError('ROUTE_ERROR', 'routing engine returned no trip', 502);
  }
  const legs = trip.legs ?? [];
  const points: LatLng[] = [];
  for (const leg of legs) {
    points.push(...decodePolyline(leg?.shape ?? '', 6));
  }
  const geometry = encodePolyline(points, 5);
  const distanceKm = round(trip.summary?.length ?? 0);
  const durationMin = round((trip.summary?.time ?? 0) / 60);
  const maneuvers: RouteManeuver[] = [];
  for (const leg of legs) {
    const shape = decodePolyline(leg?.shape ?? '', 6);
    for (const m of leg?.maneuvers ?? []) {
      maneuvers.push({
        instruction: m?.instruction ?? '',
        type: m?.type ?? 0,
        distance_km: round(m?.length ?? 0),
        duration_min: round((m?.time ?? 0) / 60),
        start: shape[m?.begin_shape_index ?? 0] ?? shape[0] ?? { lat: 0, lon: 0 },
      });
    }
  }
  const viaPoints: LatLng[] = (trip.locations ?? []).map((l) => ({
    lat: l?.lat ?? 0,
    lon: l?.lon ?? 0,
  }));
  return {
    summary: { distance_km: distanceKm, duration_min: durationMin },
    geometry,
    maneuvers,
    via_points: viaPoints,
  };
}

export interface MatrixRow {
  durations_s: number[];
  distances_m: number[];
}

export function mapMatrix(data: unknown): { rows: MatrixRow[] } {
  const stt = (data as { sources_to_targets?: any[] }).sources_to_targets ?? [];
  return {
    rows: stt.map((row) => {
      const pairs = Array.isArray(row) ? row : [];
      return {
        durations_s: pairs.map((p) =>
          typeof p?.time === 'number' ? Math.round(p.time) : 0,
        ),
        distances_m: pairs.map((p) =>
          typeof p?.distance === 'number' ? Math.round(p.distance * 1000) : 0,
        ),
      };
    }),
  };
}

export interface IsochroneFeature {
  contour: number;
  geometry: unknown;
}

export function mapIsochrone(data: unknown): { features: IsochroneFeature[] } {
  const features = (data as { features?: any[] }).features ?? [];
  return {
    features: features.map((f) => ({
      contour: f?.properties?.contour ?? 0,
      geometry: f?.geometry ?? null,
    })),
  };
}

export interface TraceEdge {
  id: number;
  speed: number;
  length_m: number;
}

export interface TraceResult {
  geometry: string;
  confidence: number | null;
  matched_points: LatLng[];
  edges: TraceEdge[];
}

export function mapTrace(data: unknown): TraceResult {
  const matched = (data as { matched?: any }).matched;
  if (!matched) {
    throw new AppError('TRACE_ERROR', 'map-matching returned no match', 502);
  }
  const points = decodePolyline(matched.shape ?? '', 6);
  return {
    geometry: encodePolyline(points, 5),
    confidence: matched.confidence_score ?? null,
    matched_points: points,
    edges: (matched.edges ?? []).map((e: any) => ({
      id: e?.id ?? 0,
      speed: e?.speed ?? 0,
      length_m: e?.length ?? 0,
    })),
  };
}
