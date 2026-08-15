import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createClient } from 'redis';

import { type Config, loadConfig } from './config.js';
import { PgClient } from './clients/postgres.js';
import { ValhallaClient } from './clients/valhalla.js';
import { toErrorBody } from './lib/errors.js';
import { health } from './routes/health.js';
import { geocode } from './routes/geocode.js';
import { route } from './routes/route.js';
import { matrix } from './routes/matrix.js';
import { isochrone } from './routes/isochrone.js';
import { trace } from './routes/trace.js';
import { poi } from './routes/poi.js';
import { tiles } from './routes/tiles.js';

export interface RedisLike {
  isOpen: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts: { EX: number }): Promise<unknown>;
  ping(): Promise<string>;
  quit(): Promise<string>;
}

export interface BuildAppOptions {
  config?: Config;
  pg?: PgClient;
  valhalla?: ValhallaClient;
  redis?: RedisLike;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = opts.config ?? loadConfig();
  const pg = opts.pg ?? new PgClient(config.databaseUrl);
  const valhalla = opts.valhalla ?? new ValhallaClient(config.valhallaUrl);

  const app = Fastify({ logger: { level: config.logLevel } });

  await app.register(sensible);
  await app.register(cors, { origin: true });

  const redis: RedisLike = opts.redis ?? (() => {
    const client = createClient({ url: config.redisUrl });
    client.on('error', (err) => app.log.warn({ err }, 'redis error'));
    void client.connect().catch((err) => app.log.warn({ err }, 'redis connect failed'));
    return client;
  })();

  app.decorate('sara', { config, pg, valhalla, redis });
  app.addHook('onClose', async () => {
    await pg.close();
    if (redis.isOpen) await redis.quit().catch(() => undefined);
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Sara Maps API',
        description: 'Map data, routing, matrix, isochrone and map-matching gateway.',
        version: '0.1.0',
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: '1 minute',
    allowList: (request) => request.url.startsWith('/v1/tiles'),
  });

  app.setNotFoundHandler((request, reply) => {
    void reply.code(404).send({
      error: { code: 'NOT_FOUND', message: `route ${request.method} ${request.url} not found`, details: {} },
    });
  });

  app.setErrorHandler((err, request, reply) => {
    const status = err instanceof Error && 'statusCode' in err
      ? ((err as { statusCode?: number }).statusCode ?? 500)
      : 500;
    const body = toErrorBody(err);
    if (status >= 500) request.log.error(err);
    void reply.code(status).send(body);
  });

  await app.register(health);
  await app.register(geocode);
  await app.register(route);
  await app.register(matrix);
  await app.register(isochrone);
  await app.register(trace);
  await app.register(poi);
  await app.register(tiles);

  return app;
}
