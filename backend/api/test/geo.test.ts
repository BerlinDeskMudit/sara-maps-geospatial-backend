import { describe, expect, it } from 'vitest';
import {
  decodePolyline,
  encodePolyline,
  haversine,
  parseLatLon,
  round,
} from '../src/lib/geo.js';

describe('parseLatLon', () => {
  it('parses valid pairs', () => {
    expect(parseLatLon('23.15,79.94')).toEqual({ lat: 23.15, lon: 79.94 });
    expect(parseLatLon('-33.86, 151.20')).toEqual({ lat: -33.86, lon: 151.2 });
  });

  it('rejects malformed input', () => {
    expect(() => parseLatLon('23.15 79.94')).toThrow();
    expect(() => parseLatLon('abc,def')).toThrow();
    expect(() => parseLatLon('91,10')).toThrow();
    expect(() => parseLatLon('10,181')).toThrow();
  });
});

describe('polyline', () => {
  it('round-trips through precision 5', () => {
    const points = [
      { lat: 38.5, lon: -120.2 },
      { lat: 40.7, lon: -120.95 },
      { lat: 43.252, lon: -126.453 },
    ];
    const encoded = encodePolyline(points, 5);
    expect(encoded).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodePolyline(encoded, 5)).toEqual(points);
  });

  it('round-trips at precision 6 (Valhalla)', () => {
    const points = [
      { lat: 23.1556, lon: 79.9413 },
      { lat: 23.159, lon: 79.951 },
    ];
    expect(decodePolyline(encodePolyline(points, 6), 6)).toEqual(points);
  });
});

describe('haversine', () => {
  it('computes a degree-longitude distance at this latitude', () => {
    const d = haversine(
      { lat: 23.1556, lon: 79.9413 },
      { lat: 23.1556, lon: 79.9513 },
    );
    // 0.01 deg lon * 111.32 km/deg * cos(23.16) ~= 1022 m
    expect(d).toBeCloseTo(1022, 0);
  });
});

describe('round', () => {
  it('rounds to 2 decimals', () => {
    expect(round(5.4321)).toBe(5.43);
  });
});
