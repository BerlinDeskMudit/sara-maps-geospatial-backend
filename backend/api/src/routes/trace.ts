import type { FastifyPluginAsync } from 'fastify';
import { parseMode } from '../lib/geo.js';
import { encodePolyline } from '../lib/geo.js';
import { mapTrace } from '../lib/mappers.js';

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['trace'],
  properties: {
    trace: {
      type: 'array',
      minItems: 2,
      maxItems: 1000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['lat', 'lon'],
        properties: {
          lat: { type: 'number' },
          lon: { type: 'number' },
          time: { type: 'number' },
        },
      },
    },
    mode: { type: 'string', default: 'auto' },
    radius: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
  },
};

export const trace: FastifyPluginAsync = async (fastify) => {
  const { valhalla } = fastify.sara;

  fastify.post('/v1/trace/route', { schema: { body: schema } }, async (request) => {
    const body = request.body as {
      trace: { lat: number; lon: number; time?: number }[];
      mode?: string;
      radius?: number;
    };
    const mode = parseMode(body.mode ?? 'auto');
    const radius = body.radius ?? 100;
    const shape = encodePolyline(body.trace, 6);

    const data = await valhalla.post('/trace_attributes', {
      encoded_polyline: shape,
      shape_match: 'map_snap',
      costing: mode,
      costing_options: { [mode]: {} },
      trace_options: { max_search_radius: radius, gps_accuracy: 5.0 },
    });
    return mapTrace(data);
  });
};
