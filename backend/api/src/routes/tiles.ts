import { Readable } from 'node:stream';
import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '../lib/errors.js';

const ALLOWED_SOURCES = new Set([
  'tile_points',
  'tile_roads',
  'tile_areas',
]);

const zxySchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['z', 'x', 'y'],
    properties: {
      z: { type: 'integer', minimum: 0, maximum: 22 },
      x: { type: 'integer', minimum: 0 },
      y: { type: 'integer', minimum: 0 },
    },
  },
};

export const tiles: FastifyPluginAsync = async (fastify) => {
  const { config } = fastify.sara;

  const proxy = async (
    request: {
      params: { source?: string; z: number; x: number; y: number };
    },
    reply: {
      header(name: string, value: string): unknown;
      send(body: unknown): unknown;
    },
    defaultSource: string,
  ) => {
    const source = request.params.source ?? defaultSource;
    if (!ALLOWED_SOURCES.has(source)) {
      throw new AppError('BAD_REQUEST', `unknown tile source "${source}"`);
    }
    const { z, x, y } = request.params;
    const upstream = `${config.martinUrl}/${source}/${z}/${x}/${y}`;

    let res: Response;
    try {
      res = await fetch(upstream, { signal: AbortSignal.timeout(15000) });
    } catch {
      throw new AppError('MARTIN_UNREACHABLE', 'tile server unavailable', 503);
    }
    if (res.status === 404) {
      throw new AppError('TILE_NOT_FOUND', 'tile not found', 404);
    }
    if (!res.ok) {
      throw new AppError('TILE_ERROR', `tile server returned ${res.status}`, 502);
    }
    reply.header(
      'content-type',
      res.headers.get('content-type') ?? 'application/x-protobuf',
    );
    reply.header('cache-control', 'public, max-age=86400');
    return reply.send(Readable.fromWeb(res.body as never));
  };

  fastify.get('/v1/tiles/:z/:x/:y.mvt', { schema: zxySchema }, (request, reply) =>
    proxy(request as never, reply, 'tile_points'),
  );

  fastify.get(
    '/v1/tiles/:source/:z/:x/:y.mvt',
    { schema: { ...zxySchema, params: { ...zxySchema.params, required: ['source', 'z', 'x', 'y'], properties: { ...zxySchema.params.properties, source: { type: 'string' } } } } },
    (request, reply) => proxy(request as never, reply, 'tile_points'),
  );
};
