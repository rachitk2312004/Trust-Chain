import { useEffect, useState } from "react";
import { sendMessage } from "../stores/extensionStore.js";
import type {
  ExtensionSettings,
  ExtensionStateSnapshot,
  HealthMetrics,
} from "../types/extension.types.js";
import "../styles/globals.css";

export function Options() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await sendMessage<{ state: ExtensionStateSnapshot }>({ type: "GET_STATE" });
      if (res.ok) setSettings(res.state.settings);
      const h = await sendMessage<{ health: HealthMetrics }>({ type: "GET_HEALTH" });
      if (h.ok) setHealth(h.health);
    })();
  }, []);

  async function save() {
    if (!settings) return;
    const res = await sendMessage<{ state: ExtensionStateSnapshot }>({
      type: "SET_SETTINGS",
      settings,
    });
    if (res.ok) {
      setSettings(res.state.settings);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    }
  }

  async function clearCache() {
    await sendMessage({ type: "CLEAR_CACHE" });
  }

  if (!settings) return <main className="tc-shell">Loading…</main>;

  return (
    <main className="tc-shell mx-auto max-w-xl">
      <h1 className="tc-brand m-0 text-2xl">TrustChain Settings</h1>
      <p className="mt-1 text-sm text-slate-600">Permission-minimized · public verify only</p>

      <label className="mt-4 block text-xs font-medium">API base URL</label>
      <input
        className="tc-input mt-1"
        value={settings.apiBaseUrl}
        onChange={(e) => setSettings({ ...settings, apiBaseUrl: e.target.value })}
      />

      <div className="mt-4 space-y-2 text-sm">
        {(
          [
            ["extensionEnabled", "Extension enabled"],
            ["autoScanEnabled", "Automatic page scanning"],
            ["clipboardScanEnabled", "Clipboard scanning (optional permission)"],
            ["notificationsEnabled", "Notifications"],
            ["analyticsEnabled", "Local analytics"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(settings[key])}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>

      <label className="mt-4 block text-xs font-medium">Cache TTL (ms)</label>
      <input
        className="tc-input mt-1"
        type="number"
        value={settings.cacheTtlMs}
        onChange={(e) =>
          setSettings({ ...settings, cacheTtlMs: Number.parseInt(e.target.value, 10) || 0 })
        }
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="tc-btn" onClick={() => void save()}>
          Save
        </button>
        <button type="button" className="tc-btn-ghost" onClick={() => void clearCache()}>
          Clear cache
        </button>
      </div>
      {saved ? <p className="mt-2 text-xs text-emerald-700">Saved</p> : null}

      {health ? (
        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h2 className="m-0 text-sm font-semibold">Health monitoring</h2>
          <ul className="mt-2 space-y-1 text-xs">
            <li>scanSuccessRate: {(health.scanSuccessRate * 100).toFixed(1)}%</li>
            <li>verificationLatency (avg): {Math.round(health.verificationLatencyAvgMs)} ms</li>
            <li>cacheHitRatio: {(health.cacheHitRatio * 100).toFixed(1)}%</li>
            <li>networkFailures: {health.networkFailures}</li>
          </ul>
        </section>
      ) : null}
    </main>
  );
}
