import type {
  ApiErrorBody,
  GeocodeResult,
  HealthResponse,
  IsochroneFeature,
  MatrixRow,
  PoiResult,
  ReverseGeocodeResult,
  RouteMode,
  RouteResult,
  TraceResult,
} from './types';

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  latencyMs: number;
  body: T | ApiErrorBody;
}

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      latencyMs: Math.round(performance.now() - started),
      body: {
        statusCode: 0,
        code: 'NETWORK_ERROR',
        error: 'Network',
        message: err instanceof Error ? err.message : String(err),
      } satisfies ApiErrorBody,
    };
  }
  const latencyMs = Math.round(performance.now() - started);
  const text = await res.text();
  let json: T | ApiErrorBody;
  try {
    json = text ? JSON.parse(text) : ({} as T);
  } catch {
    json = {
      statusCode: res.status,
      code: 'INVALID_JSON',
      error: res.statusText,
      message: text.slice(0, 200),
    } satisfies ApiErrorBody;
  }
  return { ok: res.ok, status: res.status, latencyMs, body: json };
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
};

export const api = {
  health: () => call<HealthResponse>('GET', `/health${qs({})}`),

  route: (
    origin: string,
    destination: string,
    mode: RouteMode,
    alternatives = false,
    waypoints: string[] = [],
  ) => {
    if (waypoints.length > 0) {
      return call<RouteResult>('POST', '/v1/route', {
        origin,
        destination,
        mode,
        alternatives,
        waypoints,
      });
    }
    return call<RouteResult>(
      'GET',
      `/v1/route${qs({ origin, destination, mode, alternatives })}`,
    );
  },

  isochrone: (center: string, contours: string, mode: RouteMode) =>
    call<{ features: IsochroneFeature[] }>(
      'GET',
      `/v1/isochrone${qs({ center, contours, mode })}`,
    ),

  geocode: (q: string, center?: string, limit = 5) =>
    call<{ results: GeocodeResult[] }>(
      'GET',
      `/v1/geocode${qs({ q, center, limit })}`,
    ),

  reverseGeocode: (lat: number, lon: number, radius = 500) =>
    call<ReverseGeocodeResult>(
      'GET',
      `/v1/geocode/reverse${qs({ lat, lon, radius })}`,
    ),

  poiSearch: (q: string, center?: string, radius = 2000, limit = 20) =>
    call<{ results: PoiResult[] }>(
      'GET',
      `/v1/poi/search${qs({ q, center, radius, limit })}`,
    ),

  poiNearby: (lat: number, lon: number, radius = 1500, category?: string, limit = 20) =>
    call<{ results: PoiResult[] }>(
      'GET',
      `/v1/poi/nearby${qs({ lat, lon, radius, category, limit })}`,
    ),

  matrix: (locations: string, mode: RouteMode) =>
    call<{ rows: MatrixRow[] }>(
      'GET',
      `/v1/matrix${qs({ locations, mode })}`,
    ),

  trace: (trace: { lat: number; lon: number }[], mode: RouteMode, radius = 100) =>
    call<TraceResult>('POST', '/v1/trace/route', {
      trace,
      mode,
      radius,
    }),
};
