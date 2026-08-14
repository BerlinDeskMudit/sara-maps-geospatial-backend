import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '../lib/errors.js';
import { cacheGet, cacheSet, hashKey } from '../lib/cache.js';
import { parseLatLon } from '../lib/geo.js';
import type { PlaceRow } from '../clients/postgres.js';

const qsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    q: { type: 'string', minLength: 1, maxLength: 200 },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
    center: { type: 'string' },
    radius: { type: 'integer', minimum: 1, maximum: 50000 },
  },
};

const reverseQsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['lat', 'lon'],
  properties: {
    lat: { type: 'number' },
    lon: { type: 'number' },
    radius: { type: 'integer', minimum: 1, maximum: 50000, default: 500 },
  },
};

function toPlaceResult(r: PlaceRow) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    subcategory: r.subcategory,
    address: {},
    center: { lat: r.lat, lon: r.lon },
    score: r.score ?? 0,
    type: 'place',
  };
}

export const geocode: FastifyPluginAsync = async (fastify) => {
  const { pg, config } = fastify.sara;

  fastify.get(
    '/v1/geocode',
    { schema: { querystring: qsSchema } },
    async (request) => {
      const qs = request.query as {
        q: string;
        limit?: number;
        center?: string;
        radius?: number;
      };
      const limit = qs.limit ?? 5;
      const center = qs.center ? parseLatLon(qs.center, 'center') : undefined;
      const radius = qs.radius ?? (center ? 5000 : undefined);

      const cacheKey = hashKey([
        'geo:fwd',
        JSON.stringify({ q: qs.q, limit, center, radius }),
      ]);
      const cached = await cacheGet(fastify.sara.redis, cacheKey);
      if (cached) return JSON.parse(cached) as unknown;

      const rows = await pg.geocode(qs.q, { center, radius, limit });
      const body = { results: rows.map(toPlaceResult) };
      await cacheSet(fastify.sara.redis, cacheKey, JSON.stringify(body), config.geocodeCacheTtlS);
      return body;
    },
  );

  fastify.get(
    '/v1/geocode/reverse',
    { schema: { querystring: reverseQsSchema } },
    async (request) => {
      const qs = request.query as { lat: number; lon: number; radius?: number };
      const { lat, lon } = qs;
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        throw new AppError('BAD_REQUEST', 'lat/lon outside valid WGS-84 ranges');
      }
      const radius = qs.radius ?? 500;
      const cacheKey = hashKey(['geo:rev', JSON.stringify({ lat, lon, radius })]);
      const cached = await cacheGet(fastify.sara.redis, cacheKey);
      if (cached) return JSON.parse(cached) as unknown;

      const place = await pg.reverseGeocode(lat, lon, radius);
      if (!place) {
        throw new AppError('NOT_FOUND', 'no named place found near the given coordinates', 404);
      }
      const body = {
        place: {
          name: place.name,
          category: place.category,
          subcategory: place.subcategory,
          center: { lat: place.lat, lon: place.lon },
          distance_m: place.distance_m,
        },
      };
      await cacheSet(fastify.sara.redis, cacheKey, JSON.stringify(body), config.geocodeCacheTtlS);
      return body;
    },
  );
};
