import { describe, expect, it } from 'vitest';
import { mapIsochrone, mapMatrix, mapRoute, mapTrace } from '../src/lib/mappers.js';
import { AppError, toErrorBody } from '../src/lib/errors.js';
import { decodePolyline, encodePolyline } from '../src/lib/geo.js';

const tracePoints = [
  { lat: 23.1556, lon: 79.9413 },
  { lat: 23.159, lon: 79.951 },
];
const shape6 = encodePolyline(tracePoints, 6);

const trip = {
  trip: {
    locations: tracePoints,
    summary: { length: 5.4, time: 1092 },
    legs: [
      {
        shape: shape6,
        maneuvers: [
          {
            instruction: 'Head northwest',
            type: 1,
            length: 2.2,
            time: 450,
            begin_shape_index: 0,
          },
        ],
      },
    ],
  },
};

describe('mapRoute', () => {
  it('maps a Valhalla trip to the public shape', () => {
    const result = mapRoute(trip);
    expect(result.summary.distance_km).toBe(5.4);
    expect(result.summary.duration_min).toBe(18.2);
    expect(result.maneuvers).toHaveLength(1);
    expect(result.maneuvers[0].instruction).toBe('Head northwest');
    expect(result.maneuvers[0].start).toEqual(tracePoints[0]);
    expect(result.via_points).toEqual(tracePoints);
    // re-encoded geometry must still decode to the same shape points
    const decoded = decodePolyline(result.geometry, 5);
    expect(decoded[0].lat).toBeCloseTo(23.1556, 3);
  });

  it('throws when no trip present', () => {
    expect(() => mapRoute({})).toThrow(AppError);
  });
});

describe('mapMatrix', () => {
  it('maps sources_to_targets rows', () => {
    const data = {
      sources_to_targets: [
        [
          { from_index: 0, to_index: 0, time: 0, distance: 0.0 },
          { from_index: 0, to_index: 1, time: 823, distance: 6.974 },
        ],
      ],
    };
    expect(mapMatrix(data)).toEqual({
      rows: [{ durations_s: [0, 823], distances_m: [0, 6974] }],
    });
  });

  it('coerces nulls to 0', () => {
    const data = {
      sources_to_targets: [
        [{ time: null, distance: null }, { time: 10, distance: 0.5 }],
      ],
    };
    expect(mapMatrix(data).rows[0]).toEqual({
      durations_s: [0, 10],
      distances_m: [0, 500],
    });
  });
});

describe('mapIsochrone', () => {
  it('maps contour features', () => {
    const data = {
      features: [
        {
          properties: { contour: 10 },
          geometry: { type: 'MultiPolygon', coordinates: [] },
        },
      ],
    };
    expect(mapIsochrone(data)).toEqual({
      features: [{ contour: 10, geometry: { type: 'MultiPolygon', coordinates: [] } }],
    });
  });
});

describe('mapTrace', () => {
  it('maps trace_attributes response (top-level fields)', () => {
    const data = {
      units: 'kilometers',
      shape: shape6,
      confidence_score: 0.87,
      matched_points: tracePoints,
      edges: [{ id: 123, speed: 38, length: 0.1205 }],
    };
    const result = mapTrace(data);
    expect(result.confidence).toBe(0.87);
    expect(result.edges).toEqual([{ id: 123, speed: 38, length_m: 121 }]);
    expect(result.matched_points).toEqual(tracePoints);
    expect(result.geometry).toBe(encodePolyline(tracePoints, 5));
  });

  it('falls back to nested matched object', () => {
    const data = {
      matched: {
        shape: shape6,
        confidence_score: 0.5,
        matched_points: tracePoints,
        edges: [],
      },
    };
    const result = mapTrace(data);
    expect(result.confidence).toBe(0.5);
    expect(result.matched_points).toEqual(tracePoints);
  });
});

describe('toErrorBody', () => {
  it('formats AppError with its code and details', () => {
    const err = new AppError('BAD_REQUEST', 'bad lat', 400, { lat: 99 });
    expect(toErrorBody(err)).toEqual({
      error: { code: 'BAD_REQUEST', message: 'bad lat', details: { lat: 99 } },
    });
  });

  it('hides internals for 500s', () => {
    expect(toErrorBody(new Error('boom'))).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error', details: {} },
    });
  });
});
