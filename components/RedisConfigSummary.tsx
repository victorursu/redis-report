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

  if (err) return <div className="mt-2 text-red-600">Failed to load Redis config: {err}</div>;
  if (!data) return <div className="mt-2 text-sm">Loading Redis config…</div>;
  if (!data.ok) return <div className="mt-2 text-red-600">Redis config error: {data.error}</div>;

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
      {data.note && <div className="mt-2 text-xs text-neutral-500">{data.note}</div>}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white rounded-xl shadow p-3">
      <div className="text-[12px] text-neutral-500">{label}</div>
      <div className="text-base font-semibold truncate">{String(value)}</div>
    </div>
  );
}
