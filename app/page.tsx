// app/page.tsx — Enhanced Redis dashboard focused on "why it goes down" for Drupal
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import DrupalStats from "../components/DrupalStats"; // Drupal app-level cache stats (already in your app)
import RedisConfigSummary from "../components/RedisConfigSummary"; // Surfaced config (already in your app)

// Recharts client-only to prevent SSR/window issues
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), {
  ssr: false,
});
const Line = dynamic(() => import("recharts").then((m) => m.Line), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), {
  ssr: false,
});
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);

// -----------------------------
// Types augmented for new panels
// -----------------------------

type TopKey = { key: string; ttl: number | "PERSIST"; size?: number };

type CommandStat = {
  calls?: number;
  usec?: number;
  usec_per_call?: number;
};

type Metrics = {
  ok: boolean;
  error?: string;
  fetchedAt: string;
  // Existing fields
  server: Record<string, any>;
  clients: Record<string, any>;
  memory: Record<string, any>;
  stats: Record<string, any>;
  cpu: Record<string, any>;
  keyspace: Record<string, any>;
  dbsize: number;
  topKeys: TopKey[];
  slowlog: { length: number; entries: any[] };
  latency: { latest: any[] };
  // New optional fields (add these in your /api/metrics route)
  replication?: Record<string, any>;
  persistence?: Record<string, any>;
  commandstats?: Record<string, CommandStat>;
  config?: Record<string, string>; // e.g. { "maxmemory": "...", "maxmemory-policy": "allkeys-lru" }
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [configError, setConfigError] = useState(false);
  
  useEffect(() => setMounted(true), []);

  // Check if there's a config error from RedisConfigSummary
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        setConfigError(!data.ok && (data.error?.toLowerCase().includes('configuration is missing') || data.connection?.host === 'unknown'));
      } catch {
        setConfigError(false);
      }
    };
    checkConfig();
  }, []);

  const { data, error, isLoading } = useSWR<Metrics>("/api/metrics", fetcher, {
    refreshInterval: 5000,
  });

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    []
  );

  // Tiny in-memory series (single point per fetch) — keeps the chart alive without server history
  const memSeries = useMemo(() => {
    if (!data?.memory) return [] as { t: string; used: number }[];
    const used = Number(data.memory.used_memory || data.memory.used_memory_rss || 0);
    const t = data?.fetchedAt ? fmt.format(new Date(data.fetchedAt)) : "";
    return [{ t, used }];
  }, [data, fmt]);

  const policy = data?.config?.["maxmemory-policy"] || "unknown";
  const maxmemory = Number(data?.config?.["maxmemory"] || 0);
  const used = Number(data?.memory?.used_memory || 0);
  const headroom = maxmemory > 0 ? Math.max(maxmemory - used, 0) : undefined;
  const frag = Number(data?.memory?.mem_fragmentation_ratio || 0);

  // Simple alert rules (current-sample, not timeseries)
  const alerts: { level: "red" | "amber"; msg: string }[] = [];
  if (Number(data?.stats?.evicted_keys || 0) > 0 && headroom !== undefined && headroom < maxmemory * 0.05) {
    alerts.push({ level: "red", msg: "Evictions occurring and memory within 5% of maxmemory." });
  }
  if (Number(data?.clients?.blocked_clients || 0) > 0) {
    alerts.push({ level: "red", msg: "One or more clients are blocked (possible BLPOP/FSYNC stalls)." });
  }
  if (Number(data?.stats?.rejected_connections || 0) > 0) {
    alerts.push({ level: "amber", msg: "Connections are being rejected (maxclients or resource pressure)." });
  }
  if (frag && frag > 1.8) {
    alerts.push({ level: "amber", msg: `High memory fragmentation ratio (${frag.toFixed(2)}).` });
  }
  if (data?.replication?.role === "slave" || data?.replication?.role === "replica") {
    const lastIO = Number(data?.replication?.master_last_io_seconds_ago || 0);
    if (lastIO > 10) alerts.push({ level: "amber", msg: `Replica lagging: master_last_io_seconds_ago=${lastIO}s.` });
  }

  if (!mounted) return null;

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">RedisReport — Redis & Drupal Cache Analyzer</h1>

      {/* Config summary (your existing component) */}
      <RedisConfigSummary />

      {isLoading && <p className="text-gray-700 dark:text-gray-300">Loading metrics…</p>}
      
      {/* Only show error if it's not a configuration error (config errors are shown in RedisConfigSummary) */}
      {error && !configError && !String((error as any)?.message || error).toLowerCase().includes('configuration is missing') && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">Connection Error</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
                Failed to load Redis metrics: {String((error as any)?.message || error)}
              </p>
              <button
                onClick={() => {
                  const event = new CustomEvent('openConfig');
                  window.dispatchEvent(event);
                }}
                className="text-sm px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
              >
                Configure Redis Connection
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Only show data error if it's not a configuration error */}
      {data && !data.ok && !configError && !data.error?.toLowerCase().includes('configuration is missing') && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">Redis Connection Error</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-2">
                {data.error || 'Unable to connect to Redis server.'}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mb-3">
                Please check your Redis connection settings. Make sure your Redis server is running and accessible.
              </p>
              <button
                onClick={() => {
                  const event = new CustomEvent('openConfig');
                  window.dispatchEvent(event);
                }}
                className="text-sm px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
              >
                Configure Redis Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {data?.ok && (
        <div className="space-y-8">
          {/* Live Alerts */}
          {alerts.length > 0 && (
            <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
              <h2 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Alerts</h2>
              <ul className="text-sm space-y-1">
                {alerts.map((a, i) => (
                  <li key={i} className={a.level === "red" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}>
                    • {a.msg}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <Card title="Version" value={data.server.redis_version} />
            <Card title="Uptime (days)" value={Number(data.server.uptime_in_seconds || 0) / 86400} format="0.0" />
            <Card title="Role" value={data.replication?.role ?? "n/a"} />
            <Card title="Clients" value={data.clients.connected_clients} />
            <Card title="Ops/sec" value={data.stats.instantaneous_ops_per_sec} />
            <Card title="Keys (DBSIZE)" value={data.dbsize} />
          </div>

          {/* Memory health */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Memory</h2>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <Stat label="used_memory_human" value={String(data.memory.used_memory_human || "n/a")} />
              <Stat label="maxmemory" value={maxmemory > 0 ? humanBytes(maxmemory) : "unlimited"} />
              <Stat label="headroom" value={headroom !== undefined ? humanBytes(headroom) : "n/a"} />
              <Stat label="policy" value={policy} />
            </div>
            <div className="h-56 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={memSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="t" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="used" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-neutral-700">
              <Badge label="fragmentation" value={frag ? frag.toFixed(2) : "n/a"} intent={frag > 1.8 ? "warn" : "ok"} />
              <Badge label="evicted_keys (total)" value={String(data.stats.evicted_keys || 0)} intent={Number(data.stats.evicted_keys || 0) > 0 ? "warn" : "ok"} />
              <Badge label="active_defrag" value={String(data.memory.active_defrag_running ?? "n/a")} intent="neutral" />
            </div>
          </section>

          {/* Keyspace table */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Keyspace</h2>
            <table className="w-full text-sm">
              <thead>
              <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">DB</th>
                <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Keys</th>
                <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Expires</th>
                <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Avg TTL</th>
              </tr>
              </thead>
              <tbody>
              {Object.entries(data.keyspace).map(([db, rec]: any) => (
                <tr key={db} className="border-b border-gray-200 dark:border-gray-700 last:border-none">
                  <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">{db}</td>
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{rec.keys ?? "-"}</td>
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{rec.expires ?? "-"}</td>
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{rec.avg_ttl ?? "-"}</td>
                </tr>
              ))}
              </tbody>
            </table>
          </section>

          {/* Command mix (high ROI for prod issues) */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Command Mix (INFO commandstats)</h2>
            {!data.commandstats ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">commandstats not provided by /api/metrics.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Command</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Calls</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">usec/call</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Total usec</th>
                </tr>
                </thead>
                <tbody>
                {Object.entries(data.commandstats)
                .sort((a: any, b: any) => (b[1]?.calls || 0) - (a[1]?.calls || 0))
                .slice(0, 20)
                .map(([cmd, s]) => (
                  <tr key={cmd} className="border-b border-gray-200 dark:border-gray-700 last:border-none">
                    <td className="py-2 pr-3 text-gray-900 dark:text-white">{cmd}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{s?.calls ?? "-"}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{s?.usec_per_call?.toFixed ? s.usec_per_call.toFixed(2) : s?.usec_per_call ?? "-"}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{s?.usec ?? "-"}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Persistence & replication health */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Persistence & Replication</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Persistence</h3>
                {!data.persistence ? (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">persistence not provided by /api/metrics.</p>
                ) : (
                  <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                    <li>RDB last save: {String(data.persistence.rdb_last_save_time ?? "n/a")}</li>
                    <li>RDB changes since last save: {String(data.persistence.rdb_changes_since_last_save ?? "n/a")}</li>
                    <li>RDB last bgsave status: {String(data.persistence.rdb_last_bgsave_status ?? "n/a")}</li>
                    <li>AOF enabled: {String(data.persistence.aof_enabled ?? "n/a")}</li>
                    <li>AOF last rewrite status: {String(data.persistence.aof_last_bgrewrite_status ?? "n/a")}</li>
                    <li>latest_fork_usec: {String(data.persistence.latest_fork_usec ?? "n/a")}</li>
                  </ul>
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Replication</h3>
                {!data.replication ? (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">replication not provided by /api/metrics.</p>
                ) : (
                  <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                    <li>role: {String(data.replication.role)}</li>
                    {data.replication.role !== "master" && data.replication.role !== "primary" && (
                      <>
                        <li>master_link_status: {String(data.replication.master_link_status ?? "n/a")}</li>
                        <li>master_last_io_seconds_ago: {String(data.replication.master_last_io_seconds_ago ?? "n/a")}</li>
                        <li>master_sync_in_progress: {String(data.replication.master_sync_in_progress ?? "n/a")}</li>
                      </>
                    )}
                    {Number(data.replication.connected_slaves || data.replication.connected_replicas || 0) > 0 && (
                      <li>connected replicas: {String(data.replication.connected_slaves || data.replication.connected_replicas)}</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* Top Keys (by MEMORY USAGE) */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Top Keys (by MEMORY USAGE)</h2>
            {data.topKeys.length === 0 ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                No data or MEMORY command not permitted by your provider.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Key</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Size (bytes)</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">TTL</th>
                </tr>
                </thead>
                <tbody>
                {data.topKeys.map((k) => (
                  <tr key={k.key} className="border-b border-gray-200 dark:border-gray-700 last:border-none hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-2 pr-3 truncate max-w-[520px]">
                      <a 
                        href={`/inspect-key?key=${encodeURIComponent(k.key)}`}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
                        title={`Inspect key: ${k.key}`}
                      >
                        {k.key}
                      </a>
                    </td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{k.size ?? "n/a"}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{k.ttl}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Slowlog & Latency */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Slowlog & Latency</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Slowlog (last 25)</h3>
                {data.slowlog.entries.length === 0 ? (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">No entries or command not permitted.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                    <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-2 text-gray-700 dark:text-gray-300">ID</th>
                      <th className="py-2 pr-2 text-gray-700 dark:text-gray-300">Unix TS</th>
                      <th className="py-2 pr-2 text-gray-700 dark:text-gray-300">Duration (µs)</th>
                      <th className="py-2 pr-2 text-gray-700 dark:text-gray-300">Cmd</th>
                    </tr>
                    </thead>
                    <tbody>
                    {data.slowlog.entries.map((e: any, i: number) => {
                      const [id, ts, usec, args] = e;
                      return (
                        <tr key={i} className="border-b border-gray-200 dark:border-gray-700 last:border-none">
                          <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">{id}</td>
                          <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">{ts}</td>
                          <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">{usec}</td>
                          <td className="py-2 pr-2 truncate max-w-[340px] text-gray-700 dark:text-gray-300">
                            {Array.isArray(args) ? args.join(" ") : ""}
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-2">Latency Latest</h3>
                {!data.latency.latest ||
                (Array.isArray(data.latency.latest) && data.latency.latest.length === 0) ? (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">No latency events or command not permitted.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                    <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-2 text-gray-700 dark:text-gray-300">Event</th>
                      <th className="py-2 pr-2 text-gray-700 dark:text-gray-300">Last TS</th>
                      <th className="py-2 pr-2 text-gray-700 dark:text-gray-300">Latest (ms)</th>
                      <th className="py-2 pr-2 text-gray-700 dark:text-gray-300">Max (ms)</th>
                    </tr>
                    </thead>
                    <tbody>
                    {(data.latency.latest as any[]).map((row: any[], i: number) => {
                      const [event, ts, latest, max] = row;
                      return (
                        <tr key={i} className="border-b border-gray-200 dark:border-gray-700 last:border-none">
                          <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">{event}</td>
                          <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">{ts}</td>
                          <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">{latest}</td>
                          <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">{max}</td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* Drupal cache health (your component) */}
          <DrupalStats />
        </div>
      )}
    </main>
  );
}

function Card({ title, value, format }: { title: string; value: any; format?: "0.0" }) {
  let display = value;
  if (typeof value === "number" && format === "0.0") {
    display = (Math.round(value * 10) / 10).toFixed(1);
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow dark:shadow-gray-900/50 p-4">
      <div className="text-sm text-neutral-500 dark:text-neutral-400">{title}</div>
      <div className="text-xl font-semibold text-gray-900 dark:text-white">{String(display ?? "—")}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="text-sm font-medium text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

function Badge({ label, value, intent = "ok" as const }: { label: string; value: string | number; intent?: "ok" | "warn" | "neutral" }) {
  const cls = intent === "warn" 
    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400" 
    : intent === "neutral" 
    ? "bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300" 
    : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400";
  return (
    <span className={`inline-flex items-center gap-2 ${cls} rounded-full px-3 py-1 w-fit`}>
      <span className="text-xs uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </span>
  );
}

function humanBytes(n: number) {
  if (!Number.isFinite(n)) return "n/a";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}
