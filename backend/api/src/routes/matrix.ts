import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '../lib/errors.js';
import { parseLatLon, parseLocations, parseMode } from '../lib/geo.js';
import { mapMatrix } from '../lib/mappers.js';

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['locations'],
  properties: {
    locations: { type: 'string' },
    mode: { type: 'string', default: 'auto' },
  },
};

export const matrix: FastifyPluginAsync = async (fastify) => {
  const { valhalla } = fastify.sara;

  fastify.get('/v1/matrix', { schema: { querystring: schema } }, async (request) => {
    const qs = request.query as { locations: string; mode?: string };
    const locations = parseLocations(qs.locations);
    if (locations.length > 100) {
      throw new AppError('BAD_REQUEST', 'too many locations (max 100)');
    }
    if (locations.length < 2) {
      throw new AppError('BAD_REQUEST', 'locations must contain at least 2 points');
    }
    const mode = parseMode(qs.mode ?? 'auto');

    const data = await valhalla.post('/sources_to_targets', {
      sources: locations.map((l) => ({ lat: l.lat, lon: l.lon })),
      targets: locations.map((l) => ({ lat: l.lat, lon: l.lon })),
      costing: mode,
      units: 'kilometers',
    });
    return mapMatrix(data);
  });
};
