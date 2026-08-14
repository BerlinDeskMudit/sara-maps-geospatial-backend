import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '../lib/errors.js';
import { cacheGet, cacheSet, hashKey } from '../lib/cache.js';
import { type LatLng, parseLatLon, parseMode } from '../lib/geo.js';
import { mapRoute } from '../lib/mappers.js';

const getSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['origin', 'destination'],
  properties: {
    origin: { type: 'string' },
    destination: { type: 'string' },
    mode: { type: 'string', default: 'auto' },
    avoid_tolls: { type: 'boolean', default: false },
    alternatives: { type: 'boolean', default: false },
  },
};

const postSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['origin', 'destination'],
  properties: {
    origin: { type: 'string' },
    destination: { type: 'string' },
    waypoints: { type: 'array', items: { type: 'string' }, default: [] },
    mode: { type: 'string', default: 'auto' },
    avoid_tolls: { type: 'boolean', default: false },
    alternatives: { type: 'boolean', default: false },
  },
};

function toValhallaLocation(loc: LatLng) {
  return { lat: loc.lat, lon: loc.lon };
}

function buildRouteBody(opts: {
  locations: LatLng[];
  mode: 'auto' | 'bicycle' | 'pedestrian';
  avoidTolls: boolean;
  alternatives: boolean;
}) {
  const { locations, mode, avoidTolls, alternatives } = opts;
  return {
    locations: locations.map(toValhallaLocation),
    costing: mode,
    costing_options: { [mode]: { use_tolls: !avoidTolls } },
    units: 'kilometers',
    language: 'en-US',
    directions_options: { units: 'kilometers' },
    ...(alternatives ? { alternates: 2 } : {}),
  };
}

export const route: FastifyPluginAsync = async (fastify) => {
  const { valhalla, config } = fastify.sara;

  const handleRoute = async (opts: {
    origin: LatLng;
    destination: LatLng;
    waypoints: LatLng[];
    mode: 'auto' | 'bicycle' | 'pedestrian';
    avoidTolls: boolean;
    alternatives: boolean;
  }) => {
    const locations = [opts.origin, ...opts.waypoints, opts.destination];
    const cacheKey = hashKey([
      'route',
      JSON.stringify({
        locations,
        mode: opts.mode,
        avoidTolls: opts.avoidTolls,
        alternatives: opts.alternatives,
      }),
    ]);
    const cached = await cacheGet(fastify.sara.redis, cacheKey);
    if (cached) return JSON.parse(cached) as unknown;

    const data = await valhalla.post(
      '/route',
      buildRouteBody({
        locations,
        mode: opts.mode,
        avoidTolls: opts.avoidTolls,
        alternatives: opts.alternatives,
      }),
    );
    const result = mapRoute(data);
    await cacheSet(fastify.sara.redis, cacheKey, JSON.stringify(result), config.routeCacheTtlS);
    return result;
  };

  fastify.get('/v1/route', { schema: { querystring: getSchema } }, async (request) => {
    const qs = request.query as {
      origin: string;
      destination: string;
      mode?: string;
      avoid_tolls?: boolean;
      alternatives?: boolean;
    };
    const origin = parseLatLon(qs.origin, 'origin');
    const destination = parseLatLon(qs.destination, 'destination');
    const mode = parseMode(qs.mode ?? 'auto');
    return handleRoute({
      origin,
      destination,
      waypoints: [],
      mode,
      avoidTolls: qs.avoid_tolls === true,
      alternatives: qs.alternatives === true,
    });
  });

  fastify.post('/v1/route', { schema: { body: postSchema } }, async (request) => {
    const body = request.body as {
      origin: string;
      destination: string;
      waypoints?: string[];
      mode?: string;
      avoid_tolls?: boolean;
      alternatives?: boolean;
    };
    const origin = parseLatLon(body.origin, 'origin');
    const destination = parseLatLon(body.destination, 'destination');
    const waypoints = (body.waypoints ?? []).map((w, i) =>
      parseLatLon(w, `waypoints[${i}]`),
    );
    if (waypoints.length > 10) {
      throw new AppError('BAD_REQUEST', 'too many waypoints (max 10)');
    }
    const mode = parseMode(body.mode ?? 'auto');
    return handleRoute({
      origin,
      destination,
      waypoints,
      mode,
      avoidTolls: body.avoid_tolls === true,
      alternatives: body.alternatives === true,
    });
  });
};
