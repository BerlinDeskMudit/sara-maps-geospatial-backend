import { AppError } from './errors.js';

export interface LatLng {
  lat: number;
  lon: number;
}

const LAT_LON_RE = /^\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*$/;

export function parseLatLon(value: string, name = 'coordinate'): LatLng {
  const m = LAT_LON_RE.exec(value);
  if (!m) {
    throw new AppError('BAD_REQUEST', `${name} must be a "lat,lon" pair`);
  }
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new AppError('BAD_REQUEST', `${name} is outside valid WGS-84 ranges`);
  }
  return { lat, lon };
}

export function parseMode(value: string): 'auto' | 'bicycle' | 'pedestrian' {
  if (value === 'auto' || value === 'bicycle' || value === 'pedestrian') {
    return value;
  }
  throw new AppError('BAD_REQUEST', 'mode must be one of auto|bicycle|pedestrian');
}

export function parseLocations(value: string, name = 'locations'): LatLng[] {
  const parts = value.split(';').filter((s) => s.trim().length > 0);
  if (parts.length < 1) {
    throw new AppError('BAD_REQUEST', `${name} must contain at least one lat,lon`);
  }
  return parts.map((p, i) => parseLatLon(p, `${name}[${i}]`));
}

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Encoded polyline (Google algorithm). Default precision 5 (public API),
// precision 6 for Valhalla shapes.
export function encodePolyline(points: LatLng[], precision = 5): string {
  const factor = 10 ** precision;
  const out: string[] = [];
  let prevLat = 0;
  let prevLon = 0;
  for (const p of points) {
    encodeValue(Math.round(p.lat * factor) - prevLat, out);
    encodeValue(Math.round(p.lon * factor) - prevLon, out);
    prevLat = Math.round(p.lat * factor);
    prevLon = Math.round(p.lon * factor);
  }
  return out.join('');
}

function encodeValue(value: number, out: string[]): void {
  let v = value < 0 ? ~(value << 1) : value << 1;
  while (v >= 0x20) {
    out.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63));
    v >>= 5;
  }
  out.push(String.fromCharCode(v + 63));
}

export function decodePolyline(encoded: string, precision = 5): LatLng[] {
  const factor = 10 ** precision;
  const points: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  while (i < encoded.length) {
    const dl = decodeValue(encoded, i);
    i = dl.end;
    const d2 = decodeValue(encoded, i);
    i = d2.end;
    lat += dl.value;
    lon += d2.value;
    points.push({ lat: lat / factor, lon: lon / factor });
  }
  return points;
}

function decodeValue(
  encoded: string,
  start: number,
): { value: number; end: number } {
  let shift = 0;
  let result = 0;
  let i = start;
  let byte: number;
  do {
    byte = encoded.charCodeAt(i++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  return { value: result & 1 ? ~(result >> 1) : result >> 1, end: i };
}

export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
