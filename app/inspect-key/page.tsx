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

export default function InspectKeyPage() {
  const searchParams = typeof window === 'undefined' ? null : useSearchParams?.();
  const [key, setKey] = useState('');
  const [result, setResult] = useState<InspectResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

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
    try {
      const res = await fetch(`/api/inspect-key?key=${encodeURIComponent(key)}`);
      const data = (await res.json()) as InspectResponse;
      setResult(data);
    } catch (e) {
      setResult({ key, type: 'error', value: null, error: String(e) });
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
      <h1 className="text-2xl font-semibold">Inspect Redis Key</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row">
        <input
          type="text"
          placeholder="Enter Redis key…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
          required
        />
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          Inspect
        </button>
      </form>

      {loading && <p>Loading…</p>}

      {result && (
        <div className="space-y-6">
          {result.error && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-red-700">
              {result.error}
            </div>
          )}

          <div className="rounded border p-4 bg-gray-50">
            <div className="text-sm text-gray-700">
              <div><span className="font-medium">Key:</span> {result.key}</div>
              <div><span className="font-medium">Type:</span> {result.type}</div>
            </div>
          </div>

          {/* Cache Tags Section */}
          <div className="rounded border p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-medium">Cache tags</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter tags…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="border rounded px-3 py-1"
                />
                <button
                  type="button"
                  onClick={copyAll}
                  disabled={!tags.length}
                  className="border rounded px-3 py-1 hover:bg-gray-100 disabled:opacity-50"
                >
                  Copy all ({tags.length})
                </button>
              </div>
            </div>

            {!tags.length ? (
              <p className="mt-3 text-gray-600">
                No cache tags found on this entry.
              </p>
            ) : (
              <>
                <div className="mt-3 text-sm text-gray-600">
                  Showing {filteredTags.length} of {tags.length}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {filteredTags.map((t, i) => (
                    <span
                      key={`${t}-${i}`}
                      className="inline-block rounded-full border px-3 py-1 text-sm"
                      title={t}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {/* Raw list, one per line */}
                <details className="mt-4">
                  <summary className="cursor-pointer select-none">Show one-per-line</summary>
                  <pre className="mt-2 bg-gray-50 rounded p-3 text-sm overflow-auto">
{filteredTags.join('\n')}
                  </pre>
                </details>
              </>
            )}
          </div>

          {/* Raw JSON (optional keeps everything visible for debugging) */}
          <details className="rounded border p-4">
            <summary className="cursor-pointer select-none text-lg font-medium">Raw response</summary>
            <pre className="mt-3 bg-gray-50 rounded p-3 text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
