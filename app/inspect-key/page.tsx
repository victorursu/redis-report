'use client';

import { useEffect, useMemo, useState } from 'react';
// If you're on the Pages Router, remove the next/navigation import and use window.location.search instead:
import { useSearchParams } from 'next/navigation';

type InspectResponse = {
  key: string;
  type: string;
  value: any; // for a hash, you'll see { serialized, valid, tags, data, ... }
  error?: string;
};

type CidSearchResponse = {
  ok: boolean;
  cid: string;
  bin: string;
  count: number;
  keys: Array<{
    key: string;
    bin: string;
    cid: string;
    ttl: number | "PERSIST";
    type: string;
    size?: number;
  }>;
  error?: string;
};

export default function InspectKeyPage() {
  const searchParams = typeof window === 'undefined' ? null : useSearchParams?.();
  const [key, setKey] = useState('');
  const [result, setResult] = useState<InspectResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [searchMode, setSearchMode] = useState<'key' | 'cid'>('key');
  const [bin, setBin] = useState('');
  const [cidResults, setCidResults] = useState<CidSearchResponse | null>(null);

  // Pre-fill from ?key=...
  useEffect(() => {
    const k =
      (searchParams && searchParams.get('key')) ||
      (typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('key')
        : null);
    if (k) setKey(k);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setResult(null);
    setCidResults(null);
    
    try {
      if (searchMode === 'cid') {
        // Search by CID
        const params = new URLSearchParams({ cid: key });
        if (bin.trim()) params.append('bin', bin.trim());
        const res = await fetch(`/api/search-cid?${params.toString()}`);
        const data = (await res.json()) as CidSearchResponse;
        setCidResults(data);
      } else {
        // Inspect full key
        const res = await fetch(`/api/inspect-key?key=${encodeURIComponent(key)}`);
        const data = (await res.json()) as InspectResponse;
        setResult(data);
      }
    } catch (e) {
      if (searchMode === 'cid') {
        setCidResults({ ok: false, cid: key, bin: bin || 'all', count: 0, keys: [], error: String(e) });
      } else {
        setResult({ key, type: 'error', value: null, error: String(e) });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInspectFromCid = async (fullKey: string) => {
    setSearchMode('key');
    setKey(fullKey);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/inspect-key?key=${encodeURIComponent(fullKey)}`);
      const data = (await res.json()) as InspectResponse;
      setResult(data);
    } catch (e) {
      setResult({ key: fullKey, type: 'error', value: null, error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  // Extract raw tags string from common shapes:
  const rawTags: string | null = useMemo(() => {
    if (!result || !result.value) return null;

    // Common shape for your render cache hash
    if (result.type === 'hash' && typeof result.value === 'object') {
      // Drupal often stores tags under `tags` for render cache entries
      if (typeof result.value.tags === 'string') return result.value.tags;
    }

    // Fallbacks: some stores put tags in `#cache.tags` or nested JSON
    // If your API later returns `tags: string[]`, you could join them here.
    return null;
  }, [result]);

  // Turn space-separated tags into an ordered array
  const tags: string[] = useMemo(() => {
    if (!rawTags) return [];
    return rawTags
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean);
  }, [rawTags]);

  const filteredTags = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(t => t.toLowerCase().includes(q));
  }, [tags, filter]);

  const copyAll = async () => {
    const text = tags.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      alert('Cache tags copied to clipboard');
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Cache tags copied to clipboard');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Inspect Redis Key</h1>

      {/* Search Mode Toggle */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm font-medium text-gray-900 dark:text-white">Search by:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="searchMode"
            checked={searchMode === 'key'}
            onChange={() => setSearchMode('key')}
            className="text-blue-600"
          />
          <span className="text-gray-700 dark:text-gray-300">Full Key</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="searchMode"
            checked={searchMode === 'cid'}
            onChange={() => setSearchMode('cid')}
            className="text-blue-600"
          />
          <span className="text-gray-700 dark:text-gray-300">Drupal CID</span>
        </label>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder={searchMode === 'cid' ? "Enter Drupal cache ID (CID)…" : "Enter Redis key…"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded px-3 py-2 flex-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            required
          />
          {searchMode === 'cid' && (
            <input
              type="text"
              placeholder="Cache bin (optional, e.g. render, dynamic_page_cache)"
              value={bin}
              onChange={(e) => setBin(e.target.value)}
              className="border border-gray-300 dark:border-gray-700 rounded px-3 py-2 w-full md:w-64 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          )}
          <button
            type="submit"
            className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 whitespace-nowrap"
          >
            {searchMode === 'cid' ? 'Search CID' : 'Inspect'}
          </button>
        </div>
        {searchMode === 'cid' && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Drupal cache keys follow the pattern: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">prefix:bin:cid[context]=value]</code>
          </p>
        )}
      </form>

      {loading && <p className="text-gray-700 dark:text-gray-300">Loading…</p>}

      {/* CID Search Results */}
      {cidResults && (
        <div className="space-y-6">
          {cidResults.error && (
            <div className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-red-700 dark:text-red-400">
              {cidResults.error}
            </div>
          )}

          <div className="rounded border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
            <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              <div><span className="font-medium">CID:</span> {cidResults.cid}</div>
              <div><span className="font-medium">Bin:</span> {cidResults.bin}</div>
              <div><span className="font-medium">Found:</span> {cidResults.count} key{cidResults.count !== 1 ? 's' : ''}</div>
            </div>
          </div>

          {cidResults.count > 0 ? (
            <div className="rounded border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
              <h2 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Matching Keys</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Key</th>
                      <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Bin</th>
                      <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Type</th>
                      <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Size (bytes)</th>
                      <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">TTL</th>
                      <th className="py-2 pr-3 text-gray-700 dark:text-gray-300">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cidResults.keys.map((k) => (
                      <tr key={k.key} className="border-b border-gray-200 dark:border-gray-700 last:border-none hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-2 pr-3">
                          <code className="text-xs break-all text-gray-900 dark:text-white">{k.key}</code>
                        </td>
                        <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{k.bin}</td>
                        <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{k.type}</td>
                        <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{k.size?.toLocaleString() || "—"}</td>
                        <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{k.ttl}</td>
                        <td className="py-2 pr-3">
                          <button
                            onClick={() => handleInspectFromCid(k.key)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-xs"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded border border-yellow-200 dark:border-yellow-800 p-4 bg-yellow-50 dark:bg-yellow-900/20">
              <p className="text-yellow-800 dark:text-yellow-400">No keys found matching this CID.</p>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {result.error && (
            <div className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-red-700 dark:text-red-400">
              {result.error}
            </div>
          )}

          <div className="rounded border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <div><span className="font-medium">Key:</span> {result.key}</div>
              <div><span className="font-medium">Type:</span> {result.type}</div>
            </div>
          </div>

          {/* Cache Tags Section */}
          <div className="rounded border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Cache tags</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter tags…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="border border-gray-300 dark:border-gray-700 rounded px-3 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={copyAll}
                  disabled={!tags.length}
                  className="border border-gray-300 dark:border-gray-700 rounded px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300"
                >
                  Copy all ({tags.length})
                </button>
              </div>
            </div>

            {!tags.length ? (
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                No cache tags found on this entry.
              </p>
            ) : (
              <>
                <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  Showing {filteredTags.length} of {tags.length}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {filteredTags.map((t, i) => (
                    <span
                      key={`${t}-${i}`}
                      className="inline-block rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700"
                      title={t}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {/* Raw list, one per line */}
                <details className="mt-4">
                  <summary className="cursor-pointer select-none text-gray-900 dark:text-white">Show one-per-line</summary>
                  <pre className="mt-2 bg-gray-50 dark:bg-gray-900 rounded p-3 text-sm overflow-auto text-gray-900 dark:text-white">
{filteredTags.join('\n')}
                  </pre>
                </details>
              </>
            )}
          </div>

          {/* Raw JSON (optional keeps everything visible for debugging) */}
          <details className="rounded border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
            <summary className="cursor-pointer select-none text-lg font-medium text-gray-900 dark:text-white">Raw response</summary>
            <pre className="mt-3 bg-gray-50 dark:bg-gray-900 rounded p-3 text-sm overflow-auto text-gray-900 dark:text-white">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
