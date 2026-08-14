import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '../lib/errors.js';
import { cacheGet, cacheSet, hashKey } from '../lib/cache.js';
import { parseLatLon } from '../lib/geo.js';
import type { PlaceRow } from '../clients/postgres.js';

const searchSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['q'],
  properties: {
    q: { type: 'string', minLength: 1, maxLength: 100 },
    center: { type: 'string' },
    radius: { type: 'integer', minimum: 1, maximum: 50000, default: 2000 },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
  },
};

const nearbySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['lat', 'lon'],
  properties: {
    lat: { type: 'number' },
    lon: { type: 'number' },
    radius: { type: 'integer', minimum: 1, maximum: 50000, default: 1500 },
    category: { type: 'string' },
    subcategory: { type: 'string' },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
};

function toPoiResult(r: PlaceRow) {
  return {
    name: r.name,
    category: r.category,
    subcategory: r.subcategory,
    center: { lat: r.lat, lon: r.lon },
    distance_m: r.distance_m,
  };
}

export const poi: FastifyPluginAsync = async (fastify) => {
  const { pg, config } = fastify.sara;

  fastify.get(
    '/v1/poi/search',
    { schema: { querystring: searchSchema } },
    async (request) => {
      const qs = request.query as {
        q: string;
        center?: string;
        radius?: number;
        limit?: number;
      };
      const limit = qs.limit ?? 20;
      const center = qs.center ? parseLatLon(qs.center, 'center') : undefined;
      const radius = qs.radius ?? 2000;

      const cacheKey = hashKey([
        'poi:search',
        JSON.stringify({ q: qs.q, center, radius, limit }),
      ]);
      const cached = await cacheGet(fastify.sara.redis, cacheKey);
      if (cached) return JSON.parse(cached) as unknown;

      const rows = await pg.geocode(qs.q, { center, radius, limit });
      const body = { results: rows.map(toPoiResult) };
      await cacheSet(fastify.sara.redis, cacheKey, JSON.stringify(body), config.geocodeCacheTtlS);
      return body;
    },
  );

  fastify.get(
    '/v1/poi/nearby',
    { schema: { querystring: nearbySchema } },
    async (request) => {
      const qs = request.query as {
        lat: number;
        lon: number;
        radius?: number;
        category?: string;
        subcategory?: string;
        limit?: number;
      };
      const { lat, lon } = qs;
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        throw new AppError('BAD_REQUEST', 'lat/lon outside valid WGS-84 ranges');
      }
      const rows = await pg.nearby({
        lat,
        lon,
        radius: qs.radius ?? 1500,
        category: qs.category,
        subcategory: qs.subcategory,
        limit: qs.limit ?? 20,
      });
      return { results: rows.map(toPoiResult) };
    },
  );
};
