'use client';

import { useEffect, useState } from 'react';
import { useTheme } from './ThemeProvider';
import Link from 'next/link';

type ConnectionInfo = {
  ok: boolean;
  connection?: {
    host: string;
    port: number;
    tls: boolean;
    cluster: boolean;
  };
  error?: string;
};

export default function StickyHeader() {
  const { theme, toggleTheme } = useTheme();
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    // Fetch connection info
    const fetchConnection = async () => {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        setConnectionInfo(data);
      } catch (e) {
        setConnectionInfo({ ok: false, error: 'Failed to fetch connection info' });
      }
    };
    fetchConnection();
    // Refresh every 30 seconds
    const interval = setInterval(fetchConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatConnectionString = () => {
    if (!connectionInfo?.ok || !connectionInfo.connection) {
      return 'Not connected';
    }
    const { host, port, tls, cluster } = connectionInfo.connection;
    const protocol = tls ? 'rediss://' : 'redis://';
    const clusterText = cluster ? ' (cluster)' : '';
    return `${protocol}${host}:${port}${clusterText}`;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Connection String */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Link href="/" className="text-lg font-semibold text-gray-900 dark:text-white hover:opacity-80">
            Redis Dashboard
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Connection:</span>
            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-100 font-mono text-xs truncate max-w-md border border-gray-200 dark:border-gray-600">
              {formatConnectionString()}
            </code>
            {connectionInfo?.ok && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-green-600 dark:text-green-400 text-xs">Connected</span>
              </span>
            )}
            {connectionInfo && !connectionInfo.ok && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="text-red-600 dark:text-red-400 text-xs">Disconnected</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Config Button and Theme Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(true)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
            title="Configuration"
          >
            ⚙️ Config
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Config Modal */}
      {showConfig && (
        <ConfigModal onClose={() => setShowConfig(false)} />
      )}
    </header>
  );
}

// Config Modal Component
function ConfigModal({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Fetch current config
    fetch('/api/config/get')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setConfig(data.config || {});
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load configuration');
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/config/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          // Reload page to apply new config
          window.location.reload();
        }, 1000);
      } else {
        setError(data.error || 'Failed to save configuration');
      }
    } catch (e) {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const redisKeys = Object.keys(config).filter((k) => k.startsWith('REDIS_'));
  const drupalKeys = Object.keys(config).filter((k) => k.startsWith('DRUPAL_'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col m-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Configuration</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading configuration...</div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-400 text-sm">
                  Configuration saved! Reloading...
                </div>
              )}

              {/* Redis Configuration */}
              <div>
                <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Redis Configuration</h3>
                <div className="space-y-3">
                  {redisKeys.length > 0 ? (
                    redisKeys.map((key) => (
                      <ConfigField
                        key={key}
                        label={key}
                        value={config[key] || ''}
                        onChange={(v) => updateConfig(key, v)}
                        type={key.includes('PASSWORD') ? 'password' : 'text'}
                      />
                    ))
                  ) : (
                    <>
                      <ConfigField
                        label="REDIS_URL"
                        value={config.REDIS_URL || ''}
                        onChange={(v) => updateConfig('REDIS_URL', v)}
                        placeholder="redis://localhost:6379"
                      />
                      <ConfigField
                        label="REDIS_HOST"
                        value={config.REDIS_HOST || ''}
                        onChange={(v) => updateConfig('REDIS_HOST', v)}
                        placeholder="localhost"
                      />
                      <ConfigField
                        label="REDIS_PORT"
                        value={config.REDIS_PORT || ''}
                        onChange={(v) => updateConfig('REDIS_PORT', v)}
                        placeholder="6379"
                      />
                      <ConfigField
                        label="REDIS_PASSWORD"
                        value={config.REDIS_PASSWORD || ''}
                        onChange={(v) => updateConfig('REDIS_PASSWORD', v)}
                        type="password"
                        placeholder={config.REDIS_PASSWORD === '***' ? 'Password is set (enter new value to change)' : 'Enter password'}
                      />
                      <ConfigField
                        label="REDIS_USERNAME"
                        value={config.REDIS_USERNAME || ''}
                        onChange={(v) => updateConfig('REDIS_USERNAME', v)}
                      />
                      <ConfigField
                        label="REDIS_TLS"
                        value={config.REDIS_TLS || ''}
                        onChange={(v) => updateConfig('REDIS_TLS', v)}
                        placeholder="false"
                      />
                      <ConfigField
                        label="REDIS_CLUSTER"
                        value={config.REDIS_CLUSTER || ''}
                        onChange={(v) => updateConfig('REDIS_CLUSTER', v)}
                        placeholder="false"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Drupal Configuration */}
              <div>
                <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Drupal Configuration</h3>
                <div className="space-y-3">
                  {drupalKeys.length > 0 ? (
                    drupalKeys.map((key) => (
                      <ConfigField
                        key={key}
                        label={key}
                        value={config[key] || ''}
                        onChange={(v) => updateConfig(key, v)}
                      />
                    ))
                  ) : (
                    <>
                      <ConfigField
                        label="DRUPAL_REDIS_PREFIX"
                        value={config.DRUPAL_REDIS_PREFIX || ''}
                        onChange={(v) => updateConfig('DRUPAL_REDIS_PREFIX', v)}
                        placeholder="pantheon-redis-json"
                      />
                      <ConfigField
                        label="DRUPAL_SCAN_LIMIT"
                        value={config.DRUPAL_SCAN_LIMIT || ''}
                        onChange={(v) => updateConfig('DRUPAL_SCAN_LIMIT', v)}
                        placeholder="3000"
                      />
                      <ConfigField
                        label="DRUPAL_TOP_LIMIT"
                        value={config.DRUPAL_TOP_LIMIT || ''}
                        onChange={(v) => updateConfig('DRUPAL_TOP_LIMIT', v)}
                        placeholder="25"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Top Keys Configuration */}
              <div>
                <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Top Keys Configuration</h3>
                <div className="space-y-3">
                  <ConfigField
                    label="TOP_KEYS_SAMPLE_COUNT"
                    value={config.TOP_KEYS_SAMPLE_COUNT || ''}
                    onChange={(v) => updateConfig('TOP_KEYS_SAMPLE_COUNT', v)}
                    placeholder="2000"
                  />
                  <ConfigField
                    label="TOP_KEYS_LIMIT"
                    value={config.TOP_KEYS_LIMIT || ''}
                    onChange={(v) => updateConfig('TOP_KEYS_LIMIT', v)}
                    placeholder="25"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save & Reload'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

