export interface Config {
  nodeEnv: string;
  logLevel: string;
  port: number;
  databaseUrl: string;
  valhallaUrl: string;
  martinUrl: string;
  redisUrl: string;
  rateLimitMax: number;
  geocodeCacheTtlS: number;
  routeCacheTtlS: number;
  isochroneCacheTtlS: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    logLevel: env.LOG_LEVEL ?? 'info',
    port: Number(env.PORT ?? 8080),
    databaseUrl:
      env.DATABASE_URL ?? 'postgresql://sara:sara@localhost:5433/sara',
    valhallaUrl: env.VALHALLA_URL ?? 'http://localhost:8002',
    martinUrl: env.MARTIN_URL ?? 'http://localhost:3000',
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6379',
    rateLimitMax: Number(env.API_RATE_LIMIT_MAX ?? 120),
    geocodeCacheTtlS: Number(env.GEOCODE_CACHE_TTL_S ?? 86400),
    routeCacheTtlS: Number(env.ROUTE_CACHE_TTL_S ?? 120),
    isochroneCacheTtlS: Number(env.ISOCHRONE_CACHE_TTL_S ?? 900),
  };
}
