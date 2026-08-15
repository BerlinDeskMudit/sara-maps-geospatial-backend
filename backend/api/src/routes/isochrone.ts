import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '../lib/errors.js';
import { cacheGet, cacheSet, hashKey } from '../lib/cache.js';
import { parseLatLon, parseMode } from '../lib/geo.js';
import { mapIsochrone } from '../lib/mappers.js';

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['center', 'contours'],
  properties: {
    center: { type: 'string' },
    contours: { type: 'string' },
    mode: { type: 'string', default: 'auto' },
  },
};

export const isochrone: FastifyPluginAsync = async (fastify) => {
  const { valhalla, config } = fastify.sara;

  fastify.get('/v1/isochrone', { schema: { querystring: schema } }, async (request) => {
    const qs = request.query as { center: string; contours: string; mode?: string };
    const center = parseLatLon(qs.center, 'center');
    const mode = parseMode(qs.mode ?? 'auto');
    const contours = qs.contours
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 4);
    if (contours.length === 0) {
      throw new AppError('BAD_REQUEST', 'contours must be comma-separated minutes, e.g. "10,20,30"');
    }

    const cacheKey = hashKey(['isochrone', JSON.stringify({ center, contours, mode })]);
    const cached = await cacheGet(fastify.sara.redis, cacheKey);
    if (cached) return JSON.parse(cached) as unknown;

    const data = await valhalla.post('/isochrone', {
      locations: [{ lat: center.lat, lon: center.lon }],
      costing: mode,
      contours: contours.map((time) => ({ time })),
      polygons: true,
    });
    const body = mapIsochrone(data);
    await cacheSet(fastify.sara.redis, cacheKey, JSON.stringify(body), config.isochroneCacheTtlS);
    return body;
  });
};
