// components/RedisConfigSummary.tsx
"use client";

import { useEffect, useState } from "react";

type Json = Record<string, any>;
type Api = {
  ok: boolean;
  error?: string;
  connection?: { host: string; port: number; tls: boolean; cluster: boolean };
  server?: Json;
  memory?: Json;
  clients?: Json;
  replication?: Json;
  cluster?: Json;
  persistence?: Json;
  stats?: Json;
  keyspace?: { databases: number };
  dbsize?: number;
  note?: string;
};

export default function RedisConfigSummary() {
  const [data, setData] = useState<Api | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/config", { cache: "no-store" })
    .then(r => r.json())
    .then(j => alive && setData(j))
    .catch(e => alive && setErr(e?.message || String(e)));
    return () => { alive = false; };
  }, []);

  if (err) {
    return (
      <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">Redis Configuration Required</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
              Failed to load Redis configuration. Please configure your Redis connection to get started.
            </p>
            <button
              onClick={() => {
                // Trigger config modal - we'll need to expose this from StickyHeader
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
    );
  }
  
  if (!data) return <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">Loading Redis config…</div>;
  
  if (!data.ok) {
    const isConfigError = data.error?.toLowerCase().includes('connect') || 
                         data.error?.toLowerCase().includes('host') ||
                         data.error?.toLowerCase().includes('connection') ||
                         data.connection?.host === 'unknown';
    
    if (isConfigError) {
      return (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">Redis Connection Error</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-2">
                {data.error || 'Unable to connect to Redis. Please check your connection settings.'}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mb-3">
                Make sure your Redis server is running and the connection details are correct.
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
      );
    }
    
    return <div className="mt-2 text-red-600 dark:text-red-400">Redis config error: {data.error}</div>;
  }

  const s = data.server || {};
  const m = data.memory || {};
  const c = data.connection || { host: "?", port: 0, tls: false, cluster: false };
  const r = data.replication || {};
  const cl = data.clients || {};
  const ks = data.keyspace || { databases: 0 };

  const facts: { label: string; value: any }[] = [
    { label: "Host", value: c.host },
    { label: "Port", value: c.port },
    { label: "TLS", value: c.tls ? "Yes" : "No" },
    { label: "Cluster (env)", value: c.cluster ? "Yes" : "No" },
    { label: "Mode", value: s.redis_mode ?? "—" },
    { label: "Role", value: r.role ?? "—" },
    { label: "Version", value: s.redis_version ?? "—" },
    { label: "Clients", value: cl.connected_clients ?? "—" },
    { label: "DB Count", value: ks.databases },
    { label: "Keys (DBSIZE)", value: data.dbsize?.toLocaleString() ?? "—" },
    { label: "Max Memory", value: m.maxmemory_human ?? m.maxmemory ?? "—" },
    { label: "Used Memory", value: m.used_memory_human ?? m.used_memory ?? "—" },
    { label: "Peak Memory", value: m.used_memory_peak_human ?? m.used_memory_peak ?? "—" },
    { label: "Policy", value: m.maxmemory_policy ?? "—" },
    { label: "Evicted Keys", value: m.evicted_keys ?? "—" },
    { label: "Ops/sec", value: data.stats?.instantaneous_ops_per_sec ?? "—" },
    { label: "AOF Enabled", value: data.persistence?.aof_enabled ? "Yes" : "No" },
    { label: "OS", value: s.os ?? "—" },
  ];

  return (
    <section className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {facts.map((f) => (
          <Fact key={f.label} label={f.label} value={f.value} />
        ))}
      </div>
      {data.note && <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{data.note}</div>}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow dark:shadow-gray-900/50 p-3">
      <div className="text-[12px] text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="text-base font-semibold truncate text-gray-900 dark:text-white">{String(value)}</div>
    </div>
  );
}
