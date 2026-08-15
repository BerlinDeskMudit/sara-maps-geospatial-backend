import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp, type RedisLike } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { AppError } from '../src/lib/errors.js';
import { encodePolyline } from '../src/lib/geo.js';
import type { PgClient } from '../src/clients/postgres.js';
import type { ValhallaClient } from '../src/clients/valhalla.js';

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

const traceAttrs = {
  shape: shape6,
  confidence_score: 0.87,
  matched_points: tracePoints,
  edges: [{ id: 123, speed: 38, length: 0.1205 }],
};

const isoResponse = {
  features: [
    { properties: { contour: 10 }, geometry: { type: 'MultiPolygon', coordinates: [] } },
  ],
};

function testConfig() {
  return loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', PORT: '0' });
}

function fakePg(overrides: Partial<PgClient> = {}): PgClient {
  const base = {
    ping: async () => undefined,
    geocode: async () => [],
    reverseGeocode: async () => null,
    nearby: async () => [],
    close: async () => undefined,
  };
  return { ...base, ...overrides } as unknown as PgClient;
}

function fakeValhalla(overrides: Partial<ValhallaClient> = {}): ValhallaClient {
  const base = {
    ping: async () => undefined,
    post: async () => ({}),
  };
  return { ...base, ...overrides } as unknown as ValhallaClient;
}

function fakeRedis(store = new Map<string, string>(), open = true): RedisLike {
  return {
    isOpen: open,
    async get(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    async set(key: string, value: string) {
      store.set(key, value);
      return 'OK';
    },
    async ping() {
      return 'PONG';
    },
    async quit() {
      return 'OK';
    },
  };
}

async function makeApp(opts: {
  pg?: PgClient;
  valhalla?: ValhallaClient;
  redis?: RedisLike;
} = {}) {
  const app = await buildApp({
    config: testConfig(),
    pg: opts.pg ?? fakePg(),
    valhalla: opts.valhalla ?? fakeValhalla(),
    redis: opts.redis ?? fakeRedis(new Map(), false),
  });
  return app;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('health', () => {
  it('reports ok when all dependencies are up', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('OK', { status: 200 })));
    const app = await makeApp({ redis: fakeRedis() });
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
      expect(res.json().dependencies).toEqual(
        expect.objectContaining({
          postgis: { status: 'up', latency_ms: expect.any(Number) },
          valhalla: { status: 'up', latency_ms: expect.any(Number) },
          martin: { status: 'up', latency_ms: expect.any(Number) },
          redis: { status: 'up', latency_ms: expect.any(Number) },
        }),
      );
    } finally {
      await app.close();
    }
  });

  it('returns 503 degraded when a dependency is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('OK', { status: 200 })));
    const app = await makeApp({ pg: fakePg({ ping: async () => { throw new Error('pg down'); } }) });
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(503);
      expect(res.json().status).toBe('degraded');
      expect(res.json().dependencies.postgis.status).toBe('down');
    } finally {
      await app.close();
    }
  });
});

describe('geocode', () => {
  it('maps forward geocode rows', async () => {
    const pg = fakePg({
      geocode: async () => [
        {
          id: 'N1',
          name: 'Test Hospital',
          category: 'amenity',
          subcategory: 'hospital',
          lat: 23.1,
          lon: 79.9,
          score: 0.5,
        },
      ],
    });
    const app = await makeApp({ pg });
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/geocode?q=hospital' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        results: [
          {
            id: 'N1',
            name: 'Test Hospital',
            category: 'amenity',
            subcategory: 'hospital',
            address: {},
            center: { lat: 23.1, lon: 79.9 },
            score: 0.5,
            type: 'place',
          },
        ],
      });
    } finally {
      await app.close();
    }
  });

  it('returns 404 when reverse geocode has no match', async () => {
    const app = await makeApp({ pg: fakePg({ reverseGeocode: async () => null }) });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/geocode/reverse?lat=23&lon=79',
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    } finally {
      await app.close();
    }
  });

  it('rejects requests missing required params', async () => {
    const app = await makeApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/geocode' });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});

describe('route', () => {
  it('maps a route and forwards the Valhalla request', async () => {
    const post = vi.fn(async () => trip);
    const app = await makeApp({ valhalla: fakeValhalla({ post }) });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/route?origin=23.1556,79.9413&destination=23.159,79.951&mode=auto',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.summary).toEqual({ distance_km: 5.4, duration_min: 18.2 });
      expect(body.maneuvers).toHaveLength(1);
      expect(body.maneuvers[0].instruction).toBe('Head northwest');
      expect(body.via_points).toEqual(tracePoints);
      expect(post).toHaveBeenCalledWith(
        '/route',
        expect.objectContaining({
          costing: 'auto',
          locations: tracePoints,
          units: 'kilometers',
        }),
      );
    } finally {
      await app.close();
    }
  });

  it('supports waypoints via POST', async () => {
    const post = vi.fn(async () => trip);
    const app = await makeApp({ valhalla: fakeValhalla({ post }) });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/route',
        payload: {
          origin: '23.1556,79.9413',
          destination: '23.159,79.951',
          waypoints: ['23.157,79.947'],
          mode: 'pedestrian',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = post.mock.calls[0][1] as { locations: unknown[] };
      expect(body.locations).toHaveLength(3);
    } finally {
      await app.close();
    }
  });

  it('caches identical requests', async () => {
    const post = vi.fn(async () => trip);
    const store = new Map<string, string>();
    const app = await makeApp({ valhalla: fakeValhalla({ post }), redis: fakeRedis(store) });
    try {
      const url = '/v1/route?origin=23.1556,79.9413&destination=23.159,79.951&mode=auto';
      const first = await app.inject({ method: 'GET', url });
      const second = await app.inject({ method: 'GET', url });
      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(second.json()).toEqual(first.json());
      expect(post).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('passes through downstream 5xx status codes', async () => {
    const post = vi.fn(async () => {
      throw new AppError('VALHALLA_UNREACHABLE', 'routing engine unavailable', 503);
    });
    const app = await makeApp({ valhalla: fakeValhalla({ post }) });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/route?origin=23.1556,79.9413&destination=23.159,79.951',
      });
      expect(res.statusCode).toBe(503);
      expect(res.json().error.code).toBe('VALHALLA_UNREACHABLE');
    } finally {
      await app.close();
    }
  });

  it('returns 400 for malformed coordinates', async () => {
    const app = await makeApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/route?origin=abc&destination=23.159,79.951',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('BAD_REQUEST');
    } finally {
      await app.close();
    }
  });
});

describe('matrix', () => {
  it('maps sources_to_targets', async () => {
    const post = vi.fn(async () => ({
      sources_to_targets: [[{ time: 0, distance: 0 }, { time: 60, distance: 1.2 }]],
    }));
    const app = await makeApp({ valhalla: fakeValhalla({ post }) });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/matrix?locations=23.1,79.9;23.2,79.95',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        rows: [{ durations_s: [0, 60], distances_m: [0, 1200] }],
      });
    } finally {
      await app.close();
    }
  });

  it('rejects fewer than two locations', async () => {
    const app = await makeApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/matrix?locations=23.1,79.9',
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});

describe('isochrone', () => {
  it('maps contours and caches the result', async () => {
    const post = vi.fn(async () => isoResponse);
    const store = new Map<string, string>();
    const app = await makeApp({ valhalla: fakeValhalla({ post }), redis: fakeRedis(store) });
    try {
      const url = '/v1/isochrone?center=23.1,79.9&contours=10,20';
      const first = await app.inject({ method: 'GET', url });
      const second = await app.inject({ method: 'GET', url });
      expect(first.statusCode).toBe(200);
      expect(first.json().features).toEqual([
        { contour: 10, geometry: { type: 'MultiPolygon', coordinates: [] } },
      ]);
      expect(second.json()).toEqual(first.json());
      expect(post).toHaveBeenCalledWith(
        '/isochrone',
        expect.objectContaining({
          contours: [{ time: 10 }, { time: 20 }],
          polygons: true,
        }),
      );
      expect(post).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('rejects non-numeric contours', async () => {
    const app = await makeApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/isochrone?center=23.1,79.9&contours=abc',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('BAD_REQUEST');
    } finally {
      await app.close();
    }
  });
});

describe('trace', () => {
  it('forwards an encoded polyline to trace_attributes', async () => {
    const post = vi.fn(async () => traceAttrs);
    const app = await makeApp({ valhalla: fakeValhalla({ post }) });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/trace/route',
        payload: { trace: tracePoints, mode: 'auto', radius: 35 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.confidence).toBe(0.87);
      expect(body.matched_points).toEqual(tracePoints);
      expect(body.edges).toEqual([{ id: 123, speed: 38, length_m: 121 }]);
      expect(post).toHaveBeenCalledWith(
        '/trace_attributes',
        expect.objectContaining({
          encoded_polyline: shape6,
          shape_match: 'map_snap',
          costing: 'auto',
        }),
      );
    } finally {
      await app.close();
    }
  });
});

describe('poi', () => {
  it('searches and maps POI results', async () => {
    const pg = fakePg({
      geocode: async () => [
        {
          id: 'N2',
          name: 'Cafe Coffee Day',
          category: 'shop',
          subcategory: 'coffee',
          lat: 23.15,
          lon: 79.94,
          distance_m: 210,
        },
      ],
    });
    const app = await makeApp({ pg });
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/poi/search?q=cafe' });
      expect(res.statusCode).toBe(200);
      expect(res.json().results[0]).toEqual({
        name: 'Cafe Coffee Day',
        category: 'shop',
        subcategory: 'coffee',
        center: { lat: 23.15, lon: 79.94 },
        distance_m: 210,
      });
    } finally {
      await app.close();
    }
  });

  it('returns nearby POIs with category filter', async () => {
    const nearby = vi.fn(async () => [
      {
        id: 'N3',
        name: 'Railway Station',
        category: 'amenity',
        subcategory: 'train_station',
        lat: 23.16,
        lon: 79.93,
        distance_m: 500,
      },
    ]);
    const app = await makeApp({ pg: fakePg({ nearby }) });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/poi/nearby?lat=23.16&lon=79.93&category=amenity',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().results).toHaveLength(1);
      expect(nearby).toHaveBeenCalledWith(
        expect.objectContaining({ lat: 23.16, lon: 79.93, category: 'amenity' }),
      );
    } finally {
      await app.close();
    }
  });
});

describe('tiles', () => {
  it('proxies an allowed source and streams the body', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe('http://localhost:3000/tile_points/0/0/0');
      return new Response('MVT-data', {
        status: 200,
        headers: { 'content-type': 'application/x-protobuf' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const app = await makeApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/tiles/0/0/0.mvt' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/x-protobuf');
      expect(res.headers['cache-control']).toBe('public, max-age=86400');
      expect(res.body).toBe('MVT-data');
    } finally {
      await app.close();
    }
  });

  it('rejects unknown tile sources', async () => {
    const app = await makeApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/tiles/nope/0/0/0.mvt' });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('BAD_REQUEST');
    } finally {
      await app.close();
    }
  });
});

describe('404 handler', () => {
  it('returns the standard error envelope', async () => {
    const app = await makeApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/nope' });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    } finally {
      await app.close();
    }
  });
});
