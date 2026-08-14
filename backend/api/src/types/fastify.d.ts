import type { Config } from '../config.js';
import type { PgClient } from '../clients/postgres.js';
import type { ValhallaClient } from '../clients/valhalla.js';

declare module 'fastify' {
  interface FastifyInstance {
    sara: {
      config: Config;
      pg: PgClient;
      valhalla: ValhallaClient;
      redis?: {
        isOpen: boolean;
        get(key: string): Promise<string | null>;
        set(key: string, value: string, opts: { EX: number }): Promise<unknown>;
        ping(): Promise<string>;
        quit(): Promise<string>;
      };
    };
  }
}
