// components/DrupalStats.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type DrupalReport = {
  ok: boolean;
  scanned: number;
  prefix: string;
  bins: { bin: string; count: number; totalBytes: number; avgTTL: number | null; maxBytes: number; maxKey?: string }[];
  topRoutes: { route: string; bytes: number; count: number; url?: string; theme?: string }[];
  themes: { theme: string; bytes: number; count: number }[];
  languages: { langContent: string; bytes: number; count: number }[];
  authVsAnon: { authCount: number; anonCount: number };
  note?: string;
  error?: string;
};

export default function DrupalStats() {
  const [data, setData] = useState<DrupalReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/drupal", { cache: "no-store" });
      const json = (await res.json()) as DrupalReport;
      if (!res.ok || !json.ok) {
        setErr(json.error || `HTTP ${res.status}`);
      }
      setData(json);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const bins = useMemo(() => data?.bins ?? [], [data]);

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-medium">Drupal Cache Report</h2>
        <button onClick={load} className="px-3 py-1 rounded-lg border hover:bg-neutral-50">Refresh</button>
      </div>

      {loading && <p>Scanning Redis for Drupal keys…</p>}
      {err && <p className="text-red-600">Drupal report error: {err}</p>}

      {data?.ok && (
        <div className="space-y-6">
          <div className="text-sm text-neutral-600">
            Prefix <code>{data.prefix}</code> — scanned {data.scanned.toLocaleString()} keys.
          </div>

          {/* Cache bins */}
          <div>
            <h3 className="font-semibold mb-2">Cache Bins</h3>
            <table className="w-full text-sm">
              <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Bin</th>
                <th className="py-2 pr-3">Items</th>
                <th className="py-2 pr-3">Total Bytes</th>
                <th className="py-2 pr-3">Avg TTL (s)</th>
                <th className="py-2 pr-3">Largest Key</th>
                <th className="py-2 pr-3">Largest (bytes)</th>
              </tr>
              </thead>
              <tbody>
              {bins.map((b) => (
                <tr key={b.bin} className="border-b last:border-none hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium">{b.bin}</td>
                  <td className="py-2 pr-3">{b.count.toLocaleString()}</td>
                  <td className="py-2 pr-3">{b.totalBytes.toLocaleString()}</td>
                  <td className="py-2 pr-3">{b.avgTTL ?? "—"}</td>
                  <td className="py-2 pr-3 truncate max-w-[520px]">
                    {b.maxKey ? (
                      <a 
                        href={`/inspect-key?key=${encodeURIComponent(b.maxKey)}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        title={`Inspect key: ${b.maxKey}`}
                      >
                        {b.maxKey}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 pr-3">{b.maxBytes?.toLocaleString() || "—"}</td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>

          {/* Top routes */}
          <div>
            <h3 className="font-semibold mb-2">Top Routes by Memory</h3>
            {data.topRoutes.length === 0 ? (
              <p className="text-sm text-neutral-600">No dynamic_page_cache routes detected.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">Route</th>
                  <th className="py-2 pr-3">URL (last seen)</th>
                  <th className="py-2 pr-3">Theme</th>
                  <th className="py-2 pr-3">Items</th>
                  <th className="py-2 pr-3">Bytes</th>
                </tr>
                </thead>
                <tbody>
                {data.topRoutes.map((r) => (
                  <tr key={r.route} className="border-b last:border-none hover:bg-gray-50">
                    <td className="py-2 pr-3">{r.route}</td>
                    <td className="py-2 pr-3 truncate max-w-[520px]">
                      {r.url ? (
                        <a 
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          title={`Open URL: ${r.url}`}
                        >
                          {r.url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3">{r.theme || "—"}</td>
                    <td className="py-2 pr-3">{r.count.toLocaleString()}</td>
                    <td className="py-2 pr-3">{r.bytes.toLocaleString()}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Themes & Languages */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Themes</h3>
              <table className="w-full text-sm">
                <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">Theme</th>
                  <th className="py-2 pr-3">Items</th>
                  <th className="py-2 pr-3">Bytes</th>
                </tr>
                </thead>
                <tbody>
                {data.themes.map((t) => (
                  <tr key={t.theme} className="border-b last:border-none">
                    <td className="py-2 pr-3">{t.theme}</td>
                    <td className="py-2 pr-3">{t.count.toLocaleString()}</td>
                    <td className="py-2 pr-3">{t.bytes.toLocaleString()}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Languages (content)</h3>
              <table className="w-full text-sm">
                <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">Lang</th>
                  <th className="py-2 pr-3">Items</th>
                  <th className="py-2 pr-3">Bytes</th>
                </tr>
                </thead>
                <tbody>
                {data.languages.map((l) => (
                  <tr key={l.langContent} className="border-b last:border-none">
                    <td className="py-2 pr-3">{l.langContent}</td>
                    <td className="py-2 pr-3">{l.count.toLocaleString()}</td>
                    <td className="py-2 pr-3">{l.bytes.toLocaleString()}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Auth vs Anon */}
          <div className="text-sm text-neutral-700">
            <b>dynamic_page_cache entries</b> — Auth: {data.authVsAnon.authCount.toLocaleString()} · Anon: {data.authVsAnon.anonCount.toLocaleString()}
          </div>

          {data.note && <div className="text-xs text-neutral-500">{data.note}</div>}
        </div>
      )}
    </section>
  );
}
