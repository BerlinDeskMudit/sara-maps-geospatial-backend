export interface LatLng {
  lat: number;
  lon: number;
}

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

export interface MatrixRow {
  durations_s: number[];
  distances_m: number[];
}

export interface IsochroneFeature {
  contour: number;
  geometry: GeoJSON.Geometry | null;
}

export interface PoiResult {
  name: string;
  category: string;
  subcategory: string;
  center: LatLng;
  distance_m: number;
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

export interface GeocodeResult {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  address: Record<string, unknown>;
  center: LatLng;
  score: number;
  type: string;
}

export interface ReverseGeocodeResult {
  place: {
    name: string;
    category: string;
    subcategory: string;
    center: LatLng;
    distance_m: number;
  };
}

export interface HealthDependency {
  status: string;
  latency_ms: number;
}

export interface HealthResponse {
  status: string;
  dependencies: Record<string, HealthDependency>;
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export type RouteMode = 'auto' | 'bicycle' | 'pedestrian';

export type PinRole = 'origin' | 'destination' | 'waypoint' | 'center' | 'rev';
