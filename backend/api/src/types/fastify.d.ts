import type { Config } from '../config.js';
import type { PgClient } from '../clients/postgres.js';
import type { ValhallaClient } from '../clients/valhalla.js';
import type { RedisLike } from '../app.js';

declare module 'fastify' {
  interface FastifyInstance {
    sara: {
      config: Config;
      pg: PgClient;
      valhalla: ValhallaClient;
      redis?: RedisLike;
    };
  }
}
