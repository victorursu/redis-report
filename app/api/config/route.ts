// app/api/config/route.ts
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

function getConnEnv() {
  const url = process.env.REDIS_URL;
  const tls = (process.env.REDIS_TLS || "").toLowerCase() === "true";
  const cluster = (process.env.REDIS_CLUSTER || "").toLowerCase() === "true";

  if (url) {
    try {
      const u = new URL(url);
      return {
        host: u.hostname,
        port: Number(u.port || 6379),
        tls: u.protocol === "rediss:" || tls,
        cluster,
      };
    } catch {
      // fall through
    }
  }
  return {
    host: process.env.REDIS_HOST || "unknown",
    port: Number(process.env.REDIS_PORT || 6379),
    tls,
    cluster,
  };
}

function parseInfo(infoText: string) {
  const out: Record<string, Record<string, string | number>> = {};
  let sec = "default";
  out[sec] = {};
  for (const line of infoText.split("\n")) {
    if (!line) continue;
    if (line.startsWith("#")) {
      sec = line.replace("#", "").trim();
      out[sec] = {};
      continue;
    }
    const [k, v] = line.split(":");
    if (!k || v === undefined) continue;
    const num = Number(v);
    out[sec][k] = Number.isFinite(num) ? num : v.trim();
  }
  return out;
}

export async function GET() {
  const redis = getRedis();
  try {
    await redis.ping(); // quick connectivity check

    const infoText: string = await redis.info();
    const info = parseInfo(infoText);

    const server = info["Server"] || {};
    const memory = info["Memory"] || {};
    const clients = info["Clients"] || {};
    const stats = info["Stats"] || {};
    const repl = info["Replication"] || {};
    const cluster = info["Cluster"] || {};
    const persistence = info["Persistence"] || {};
    const keyspace = info["Keyspace"] || {};

    const dbsize = await redis.dbsize().catch(() => 0);

    const connection = getConnEnv();

    // Light inference: you generally can't *reliably* detect shared hosting from INFO.
    // We’ll surface helpful fields and add a note.
    return NextResponse.json({
      ok: true,
      connection, // { host, port, tls, cluster (from env) }
      server: {
        redis_version: server.redis_version,
        redis_mode: server.redis_mode, // standalone / sentinel / cluster
        os: server.os,
        arch_bits: server.arch_bits,
        tcp_port: server.tcp_port,
        hz: server.hz,
        config_file: server.config_file || null,
        process_id: server.process_id,
        run_id: server.run_id,
        executable: server.executable,
        uptime_in_seconds: server.uptime_in_seconds,
      },
      memory: {
        used_memory: memory.used_memory,
        used_memory_human: memory.used_memory_human,
        used_memory_peak: memory.used_memory_peak,
        used_memory_peak_human: memory.used_memory_peak_human,
        used_memory_rss: memory.used_memory_rss,
        total_system_memory: memory.total_system_memory,
        total_system_memory_human: memory.total_system_memory_human,
        maxmemory: memory.maxmemory,
        maxmemory_human: memory.maxmemory_human,
        maxmemory_policy: memory.maxmemory_policy,
        allocator_frag_ratio: memory.allocator_frag_ratio,
        mem_allocator: memory.mem_allocator,
        evicted_keys: stats.evicted_keys, // from Stats section
      },
      clients: {
        connected_clients: clients.connected_clients,
        maxclients: (clients as any).maxclients ?? null, // may be null on some providers
      },
      replication: {
        role: repl.role, // master/primary or replica
        connected_slaves: repl.connected_slaves,
        master_host: repl.master_host,
        master_port: repl.master_port,
        master_link_status: repl.master_link_status,
      },
      cluster: {
        cluster_enabled: cluster.cluster_enabled,
      },
      persistence: {
        rdb_last_save_time: persistence.rdb_last_save_time,
        aof_enabled: persistence.aof_enabled,
        aof_rewrite_in_progress: persistence.aof_rewrite_in_progress,
        rdb_bgsave_in_progress: persistence.rdb_bgsave_in_progress,
      },
      stats: {
        instantaneous_ops_per_sec: stats.instantaneous_ops_per_sec,
        total_commands_processed: stats.total_commands_processed,
        total_connections_received: stats.total_connections_received,
        keyspace_hits: stats.keyspace_hits,
        keyspace_misses: stats.keyspace_misses,
        pubsub_channels: (stats as any).pubsub_channels ?? null,
      },
      keyspace: {
        databases: Object.keys(keyspace).length,
      },
      dbsize,
      note:
        "Shared vs dedicated cannot be reliably detected via INFO; check your provider plan. Values shown are from INFO and env (sanitized).",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
