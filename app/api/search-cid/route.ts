// app/api/search-cid/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

const PREFIX = process.env.DRUPAL_REDIS_PREFIX || "pantheon-redis-json";

/**
 * Search for Drupal cache keys by CID (Cache ID)
 * 
 * Query parameters:
 * - cid: The cache ID to search for (required)
 * - bin: Optional cache bin filter (e.g., "render", "dynamic_page_cache")
 * - limit: Maximum number of keys to return (default: 100)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cid = searchParams.get("cid");
  const bin = searchParams.get("bin");
  const limit = Number(searchParams.get("limit") || 100);

  if (!cid) {
    return NextResponse.json(
      { ok: false, error: "Missing 'cid' parameter" },
      { status: 400 }
    );
  }

  const redis = getRedis();
  try {
    await redis.connect().catch(() => {});
    await redis.ping();

    // Construct the search pattern
    // If bin is provided: {PREFIX}:{bin}:{cid}*
    // Otherwise: {PREFIX}:*:{cid}*
    let pattern: string;
    if (bin) {
      pattern = `${PREFIX}:${bin}:${cid}*`;
    } else {
      pattern = `${PREFIX}:*:${cid}*`;
    }

    // Use SCAN to find matching keys
    let cursor = "0";
    const keys: string[] = [];
    const maxIterations = 10; // Prevent infinite loops
    let iterations = 0;

    do {
      const [next, batch] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        1000
      );
      cursor = next;
      
      // Filter to ensure CID matches exactly (not just as substring)
      // Drupal key format: {PREFIX}:{bin}:{cid}[context]=value]:...
      for (const key of batch) {
        if (!key.startsWith(PREFIX + ":")) continue;
        
        const parts = key.split(":");
        if (parts.length >= 3) {
          const keyBin = parts[1];
          const keyCidPart = parts[2];
          // Extract CID before context parameters (before '[')
          const keyCid = keyCidPart.split("[")[0];
          
          // Match CID exactly, and bin if specified
          if (keyCid === cid) {
            if (!bin || keyBin === bin) {
              keys.push(key);
              if (keys.length >= limit) {
                cursor = "0";
                break;
              }
            }
          }
        }
      }
      
      iterations++;
      if (iterations >= maxIterations || keys.length >= limit) {
        cursor = "0";
        break;
      }
    } while (cursor !== "0");

    // Get additional info for each key
    const results = await Promise.all(
      keys.map(async (key) => {
        const parts = key.split(":");
        const detectedBin = parts[1] || "unknown";
        
        let ttl: number | "PERSIST" = "PERSIST";
        let size: number | undefined;
        let type: string = "unknown";
        
        try {
          ttl = await redis.ttl(key);
          if (ttl === -1) ttl = "PERSIST";
        } catch {}
        
        try {
          type = await redis.type(key);
        } catch {}
        
        try {
          size = await redis.call("MEMORY", "USAGE", key) as number;
        } catch {}

        return {
          key,
          bin: detectedBin,
          cid,
          ttl,
          type,
          size,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      cid,
      bin: bin || "all",
      count: results.length,
      keys: results,
      pattern,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

