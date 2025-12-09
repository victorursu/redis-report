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
    <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Drupal Cache Report</h2>
        <button onClick={load} className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-neutral-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Refresh</button>
      </div>

      {loading && <p className="text-gray-700 dark:text-gray-300">Scanning Redis for Drupal keys…</p>}
      {err && <p className="text-red-600 dark:text-red-400">Drupal report error: {err}</p>}

      {data?.ok && (
        <div className="space-y-6">
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Prefix <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{data.prefix}</code> — scanned {data.scanned.toLocaleString()} keys.
          </div>

          {/* Cache bins */}
          <div>
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Cache Bins</h3>
            <table className="w-full text-sm">
              <thead>
              <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Bin</th>
                <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Items</th>
                <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Total Bytes</th>
                <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Avg TTL (s)</th>
                <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Largest Key</th>
                <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Largest (bytes)</th>
              </tr>
              </thead>
              <tbody>
              {bins.map((b) => (
                <tr key={b.bin} className="border-b border-gray-200 dark:border-gray-700 last:border-none hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">{b.bin}</td>
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{b.count.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{b.totalBytes.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{b.avgTTL ?? "—"}</td>
                  <td className="py-2 pr-3 truncate max-w-[520px]">
                    {b.maxKey ? (
                      <a 
                        href={`/inspect-key?key=${encodeURIComponent(b.maxKey)}`}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
                        title={`Inspect key: ${b.maxKey}`}
                      >
                        {b.maxKey}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{b.maxBytes?.toLocaleString() || "—"}</td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>

          {/* Top routes */}
          <div>
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Top Routes by Memory</h3>
            {data.topRoutes.length === 0 ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">No dynamic_page_cache routes detected.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Route</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">URL (last seen)</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Theme</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Items</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Bytes</th>
                </tr>
                </thead>
                <tbody>
                {data.topRoutes.map((r) => (
                  <tr key={r.route} className="border-b border-gray-200 dark:border-gray-700 last:border-none hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-2 pr-3 text-gray-900 dark:text-white">{r.route}</td>
                    <td className="py-2 pr-3 truncate max-w-[520px]">
                      {r.url ? (
                        <a 
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
                          title={`Open URL: ${r.url}`}
                        >
                          {r.url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{r.theme || "—"}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{r.count.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{r.bytes.toLocaleString()}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Themes & Languages */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Themes</h3>
              <table className="w-full text-sm">
                <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Theme</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Items</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Bytes</th>
                </tr>
                </thead>
                <tbody>
                {data.themes.map((t) => (
                  <tr key={t.theme} className="border-b border-gray-200 dark:border-gray-700 last:border-none">
                    <td className="py-2 pr-3 text-gray-900 dark:text-white">{t.theme}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{t.count.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{t.bytes.toLocaleString()}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Languages (content)</h3>
              <table className="w-full text-sm">
                <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Lang</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Items</th>
                  <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Bytes</th>
                </tr>
                </thead>
                <tbody>
                {data.languages.map((l) => (
                  <tr key={l.langContent} className="border-b border-gray-200 dark:border-gray-700 last:border-none">
                    <td className="py-2 pr-3 text-gray-900 dark:text-white">{l.langContent}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{l.count.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{l.bytes.toLocaleString()}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Auth vs Anon */}
          <div className="text-sm text-neutral-700 dark:text-neutral-300">
            <b>dynamic_page_cache entries</b> — Auth: {data.authVsAnon.authCount.toLocaleString()} · Anon: {data.authVsAnon.anonCount.toLocaleString()}
          </div>

          {data.note && <div className="text-xs text-neutral-500 dark:text-neutral-400">{data.note}</div>}
        </div>
      )}
    </section>
  );
}
