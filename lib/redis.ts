import Redis from "ioredis";

let _redis: Redis | null = null;

function makeRedis(): Redis {
  const url = process.env.REDIS_URL;
  if (url) {
    return new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
  }

  const tls = (process.env.REDIS_TLS || "").toLowerCase() === "true";
  const cluster = (process.env.REDIS_CLUSTER || "").toLowerCase() === "true";

  if (cluster) {
    // Minimal cluster setup (supply comma-separated hosts via REDIS_HOST)
    const hosts = (process.env.REDIS_HOST || "").split(",").map(h => h.trim());
    if (!hosts.length) throw new Error("REDIS_HOST required for cluster (comma-separated).");

    return new (Redis as any).Cluster(
      hosts.map((host: string) => ({
        host,
        port: Number(process.env.REDIS_PORT || 6379),
        tls: tls ? {} : undefined,
      })),
      {
        lazyConnect: true,
        redisOptions: {
          username: process.env.REDIS_USERNAME,
          password: process.env.REDIS_PASSWORD,
          maxRetriesPerRequest: 2,
        },
      }
    );
  }

  return new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    tls: (tls ? {} : undefined) as any,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });
}

export function getRedis(): Redis {
  if (!_redis) _redis = makeRedis();
  return _redis;
}
