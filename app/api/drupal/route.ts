// app/api/drupal/route.ts
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

type Row = {
  key: string; bin: string; bytes?: number; ttl?: number | "PERSIST";
  route?: string; url?: string; urlPath?: string; theme?: string;
  langContent?: string; langInterface?: string; isAnon?: boolean; isAuth?: boolean;
};

const PREFIX = process.env.DRUPAL_REDIS_PREFIX || "pantheon-redis-json";
const SCAN_LIMIT = Number(process.env.DRUPAL_SCAN_LIMIT || 3000);
const TOP_LIMIT = Number(process.env.DRUPAL_TOP_LIMIT || 25);

const cap = (v?: string) => (v === undefined ? undefined : v);

function parseKey(key: string): Row {
  const parts = key.split(":");
  const bin = parts[1] || "unknown";
  const get = (label: string) => {
    const m = key.match(new RegExp(`\\[${label}\\]=(.*?)(?::\\[|$)`));
    return m ? m[1] : undefined;
  };
  const row: Row = { key, bin };
  row.route = cap(get("route"));
  row.theme = cap(get("theme"));
  row.url = cap(get("url"));
  row.urlPath = cap(get("url\\.path"));
  row.langContent = cap(get("languages:language_content"));
  row.langInterface = cap(get("languages:language_interface"));
  const anon = get("user\\.roles:anonymous");
  const auth = get("user\\.roles:authenticated");
  row.isAnon = anon === "true";
  row.isAuth = auth === "true";
  return row;
}

async function scan(redis: any) {
  const match = `${PREFIX}:*`;
  let cursor = "0";
  const keys: string[] = [];
  try {
    do {
      const [next, batch] = await redis.scan(cursor, "MATCH", match, "COUNT", 1000);
      cursor = next;
      for (const k of batch) {
        keys.push(k);
        if (keys.length >= SCAN_LIMIT) { cursor = "0"; break; }
      }
    } while (cursor !== "0");
  } catch {}
  return keys;
}

export async function GET() {
  const redis = getRedis();
  try {
    await redis.ping();

    const keys = await scan(redis);
    const rows: Row[] = [];

    for (const key of keys) {
      const r = parseKey(key);
      try {
        const ttl = await redis.ttl(key);
        r.ttl = ttl === -1 ? "PERSIST" : ttl;
      } catch {}
      try {
        const bytes = await redis.call("MEMORY", "USAGE", key);
        if (typeof bytes === "number") r.bytes = bytes;
      } catch {}
      rows.push(r);
    }

    // Aggregations
    const bins: Record<string, { count: number; totalBytes: number; avgTTL: number | null; maxBytes: number; maxKey?: string }> = {};
    const routes: Record<string, { bytes: number; count: number; url?: string; theme?: string }> = {};
    const themes: Record<string, { bytes: number; count: number }> = {};
    const langs: Record<string, { bytes: number; count: number }> = {};
    let anonCount = 0, authCount = 0;

    for (const r of rows) {
      // bins
      if (!bins[r.bin]) bins[r.bin] = { count: 0, totalBytes: 0, avgTTL: null, maxBytes: 0, maxKey: undefined };
      const b = bins[r.bin];
      b.count += 1;
      const bytes = r.bytes || 0;
      b.totalBytes += bytes;
      if (bytes > b.maxBytes) { b.maxBytes = bytes; b.maxKey = r.key; }
      if (typeof r.ttl === "number" && r.ttl >= 0) {
        if (b.avgTTL === null) b.avgTTL = r.ttl; else b.avgTTL = Math.round((b.avgTTL + r.ttl) / 2);
      }

      // routes (dynamic_page_cache)
      if (r.bin === "dynamic_page_cache" && r.route) {
        if (!routes[r.route]) routes[r.route] = { bytes: 0, count: 0, url: r.url || r.urlPath, theme: r.theme };
        routes[r.route].count += 1;
        routes[r.route].bytes += bytes;
      }

      if (r.theme) {
        if (!themes[r.theme]) themes[r.theme] = { bytes: 0, count: 0 };
        themes[r.theme].count += 1;
        themes[r.theme].bytes += bytes;
      }

      const lc = r.langContent || "n/a";
      if (!langs[lc]) langs[lc] = { bytes: 0, count: 0 };
      langs[lc].count += 1;
      langs[lc].bytes += bytes;

      if (r.bin === "dynamic_page_cache") {
        if (r.isAnon) anonCount += 1;
        if (r.isAuth) authCount += 1;
      }
    }

    const topRoutes = Object.entries(routes)
    .map(([route, v]) => ({ route, ...v }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, TOP_LIMIT);

    const binSummary = Object.entries(bins)
    .map(([bin, v]) => ({ bin, ...v }))
    .sort((a, b) => b.totalBytes - a.totalBytes);

    const themeArr = Object.entries(themes)
    .map(([theme, v]) => ({ theme, ...v }))
    .sort((a, b) => b.bytes - a.bytes);

    const langArr = Object.entries(langs)
    .map(([langContent, v]) => ({ langContent, ...v }))
    .sort((a, b) => b.bytes - a.bytes);

    return NextResponse.json({
      ok: true,
      scanned: keys.length,
      prefix: PREFIX,
      bins: binSummary,
      topRoutes,
      themes: themeArr,
      languages: langArr,
      authVsAnon: { authCount, anonCount },
      note: "Sizes use MEMORY USAGE where permitted; TTL excludes PERSIST/-2.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
