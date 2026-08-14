import type { FastifyPluginAsync } from 'fastify';

export const health: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/health',
    {
      schema: {
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    async (_request, reply) => {
      const { sara } = fastify;
      const deps: Record<string, { status: string; latency_ms: number }> = {};

      const check = async (name: string, fn: () => Promise<unknown>) => {
        const start = Date.now();
        try {
          await fn();
          deps[name] = { status: 'up', latency_ms: Date.now() - start };
        } catch {
          deps[name] = { status: 'down', latency_ms: Date.now() - start };
        }
      };

      await Promise.all([
        check('postgis', () => sara.pg.ping()),
        check('valhalla', () => sara.valhalla.ping()),
        check('martin', async () => {
          const res = await fetch(`${sara.config.martinUrl}/health`, {
            signal: AbortSignal.timeout(3000),
          });
          if (!res.ok) throw new Error(`martin ${res.status}`);
        }),
        check('redis', async () => {
          if (!sara.redis?.isOpen) throw new Error('redis not connected');
          await sara.redis.ping();
        }),
      ]);

      const ok = Object.values(deps).every((d) => d.status === 'up');
      const status = ok ? 200 : 503;
      void reply.code(status as 200).send({
        status: ok ? 'ok' : 'degraded',
        version: '0.1.0',
        dependencies: deps,
      });
    },
  );
};
