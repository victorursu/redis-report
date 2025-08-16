import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

type InfoMap = Record<string, string | number>;

function parseInfo(infoText: string): Record<string, InfoMap> {
  const sections: Record<string, InfoMap> = {};
  let current = "default";
  sections[current] = {};

  for (const line of infoText.split("\n")) {
    if (!line || line.startsWith("#")) {
      const sec = line.replace("#", "").trim();
      if (sec) {
        current = sec;
        sections[current] = {};
      }
      continue;
    }
    const [k, v] = line.split(":");
    if (!k || v === undefined) continue;
    const num = Number(v);
    sections[current][k] = Number.isFinite(num) ? num : v.trim();
  }
  return sections;
}

async function getTopKeys(redis: any) {
  // SCAN sampling + optional MEMORY USAGE
  const sampleCount = Number(process.env.TOP_KEYS_SAMPLE_COUNT || 2000);
  const topLimit = Number(process.env.TOP_KEYS_LIMIT || 25);

  let cursor = "0";
  const sampled: string[] = [];
  try {
    do {
      const [next, keys] = await redis.scan(cursor, "COUNT", 500);
      cursor = next;
      sampled.push(...keys);
    } while (cursor !== "0" && sampled.length < sampleCount);
  } catch {
    // SCAN not available? ignore
  }
  const sliced = sampled.slice(0, sampleCount);

  const rows: { key: string; ttl: number | "PERSIST"; size?: number }[] = [];
  for (const key of sliced) {
    let ttl = -2;
    try { ttl = await redis.ttl(key); } catch {}
    let size: number | undefined = undefined;
    try { size = await redis.call("MEMORY", "USAGE", key); } catch { /* some providers disallow */ }

    rows.push({
      key,
      ttl: ttl === -1 ? "PERSIST" : ttl,
      size,
    });
  }

  rows.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
  return rows.slice(0, topLimit);
}

async function getSlowlog(redis: any) {
  try {
    const len = await redis.call("SLOWLOG", "LEN");
    const raw = await redis.call("SLOWLOG", "GET", 25); // last 25
    // Normalize: [id, timestamp, duration(us), args..., client?]
    return { length: Number(len), entries: raw as any[] };
  } catch {
    return { length: 0, entries: [] };
  }
}

async function getLatency(redis: any) {
  // LATENCY DOCTOR is human text; use LATENCY LATEST if possible
  try {
    const latest = await redis.call("LATENCY", "LATEST"); // [[event, ts, latest, max]]
    return { latest };
  } catch {
    return { latest: [] };
  }
}

export async function GET() {
  const redis = getRedis();
  try {
    await redis.connect().catch(() => {});
    const infoText: string = await redis.info();
    const info = parseInfo(infoText);

    const dbsizePromise = redis.dbsize().catch(() => 0);
    const topKeysPromise = getTopKeys(redis);
    const slowlogPromise = getSlowlog(redis);
    const latencyPromise = getLatency(redis);

    const [dbsize, topKeys, slowlog, latency] = await Promise.all([
      dbsizePromise,
      topKeysPromise,
      slowlogPromise,
      latencyPromise,
    ]);

    const server = info["Server"] || {};
    const clients = info["Clients"] || {};
    const memory = info["Memory"] || {};
    const stats = info["Stats"] || {};
    const cpu = info["CPU"] || {};
    const keyspace = info["Keyspace"] || {};

    return NextResponse.json({
      ok: true,
      server,
      clients,
      memory,
      stats,
      cpu,
      keyspace,
      dbsize,
      topKeys,
      slowlog,
      latency,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
