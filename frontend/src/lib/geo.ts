import type { LatLng, PoiResult } from './types';

export function decodePolyline(str: string, precision: number): LatLng[] {
  const factor = Math.pow(10, precision);
  const pts: LatLng[] = [];
  let idx = 0;
  let lat = 0;
  let lon = 0;
  while (idx < str.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(idx++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(idx++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlon = result & 1 ? ~(result >> 1) : result >> 1;
    lon += dlon;
    pts.push({ lat: lat / factor, lon: lon / factor });
  }
  return pts;
}

export function encodePolyline(coords: LatLng[], precision: number): string {
  const factor = Math.pow(10, precision);
  let out = '';
  let prevLat = 0;
  let prevLon = 0;
  for (const c of coords) {
    const lat = Math.round(c.lat * factor);
    const lon = Math.round(c.lon * factor);
    let dlat = lat - prevLat;
    let dlon = lon - prevLon;
    prevLat = lat;
    prevLon = lon;
    dlat = dlat < 0 ? ~(dlat << 1) : dlat << 1;
    dlon = dlon < 0 ? ~(dlon << 1) : dlon << 1;
    let chunk = 0x20 | (dlat & 0x1f);
    while (chunk >= 0x20) {
      out += String.fromCharCode(63 + chunk);
      dlat >>= 5;
      chunk = dlat ? 0x20 | (dlat & 0x1f) : dlat;
    }
    out += String.fromCharCode(63 + chunk);
    chunk = 0x20 | (dlon & 0x1f);
    while (chunk >= 0x20) {
      out += String.fromCharCode(63 + chunk);
      dlon >>= 5;
      chunk = dlon ? 0x20 | (dlon & 0x1f) : dlon;
    }
    out += String.fromCharCode(63 + chunk);
  }
  return out;
}

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const rand = (seed: number) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

export function genTrace(a: LatLng, b: LatLng, steps = 48): LatLng[] {
  const rnd = rand(Math.floor(Math.abs(a.lat * 1e6) + Math.abs(b.lon * 1e6)));
  const pts: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const jitter = 0.00028 * (rnd() - 0.5);
    const jitter2 = 0.00028 * (rnd() - 0.5);
    const wobble = Math.sin(t * Math.PI * 3.2) * 0.00012;
    pts.push({
      lat: a.lat + (b.lat - a.lat) * t + jitter + wobble,
      lon: a.lon + (b.lon - a.lon) * t + jitter2,
    });
  }
  return pts;
}

export const asLatLng = (s: string): LatLng | null => {
  const [lat, lon] = s.split(',').map((x) => Number(x.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
};

export const fmtLatLon = (p: LatLng) =>
  `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;

export function nearestPoi(ll: LatLng, pois: PoiResult[], maxM = 2500): PoiResult | null {
  let best: PoiResult | null = null;
  let bestD = maxM;
  for (const p of pois) {
    const d = haversineM(ll, p.center);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
