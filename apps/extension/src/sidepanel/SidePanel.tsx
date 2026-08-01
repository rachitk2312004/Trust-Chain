import { useEffect, useState } from "react";
import { isWarningOutcome, trustBadge } from "../security/signatures/reportValidation.js";
import { formatCacheAge } from "../utils/time.js";
import { sendMessage } from "../stores/extensionStore.js";
import type {
  ExtensionStateSnapshot,
  HealthMetrics,
  PublicReportView,
  VerifyResult,
} from "../types/extension.types.js";
import "../styles/globals.css";

export function SidePanel() {
  const [state, setState] = useState<ExtensionStateSnapshot | null>(null);
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [history, setHistory] = useState<
    Array<{ cacheId: string; lookupKey: string; cachedAt: string; expiresAt: string | null }>
  >([]);
  const [exportText, setExportText] = useState<string>("");

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const s = await sendMessage<{ state: ExtensionStateSnapshot }>({ type: "GET_STATE" });
    if (s.ok) setState(s.state);
    const h = await sendMessage<{ health: HealthMetrics }>({ type: "GET_HEALTH" });
    if (h.ok) setHealth(h.health);
    const hist = await sendMessage<{
      cache: Array<{
        cacheId: string;
        lookupKey: string;
        cachedAt: string;
        expiresAt: string | null;
      }>;
    }>({ type: "GET_HISTORY" });
    if (hist.ok) setHistory(hist.cache ?? []);
  }

  async function exportReport() {
    const res = await sendMessage<{ report: PublicReportView | null }>({ type: "EXPORT_REPORT" });
    if (res.ok && res.report) {
      const text = JSON.stringify(res.report, null, 2);
      setExportText(text);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trustchain-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  const last = state?.lastResult as VerifyResult | null | undefined;

  return (
    <main className="tc-shell min-h-screen max-w-lg">
      <h1 className="tc-brand m-0 text-2xl">TrustChain</h1>
      <p className="mt-1 text-sm text-slate-600">Signed report viewer & history</p>

      {state ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="tc-chip">{state.lifecycle}</span>
          <span className="tc-chip">{state.network}</span>
          <span className="tc-chip">{state.sessionId}</span>
        </div>
      ) : null}

      {last ? (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span
              className={
                isWarningOutcome(last.report.verificationResult)
                  ? "tc-chip tc-chip-danger"
                  : "tc-chip tc-chip-ok"
              }
            >
              {trustBadge(last.report.verificationResult)}
            </span>
            <span className="text-xs text-slate-500">
              {last.fromCache
                ? `Cached ${formatCacheAge(last.cachedAt)}`
                : `Live ${last.latencyMs}ms`}
            </span>
          </div>
          <dl className="space-y-1 text-xs text-slate-700">
            <div>
              <dt className="inline font-medium">Integrity: </dt>
              <dd className="inline break-all">{String(last.report.proofOfIntegrity ?? "—")}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Network: </dt>
              <dd className="inline">{String(last.report.networkName ?? "—")}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Tx: </dt>
              <dd className="inline break-all">{String(last.report.transactionHash ?? "—")}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Checksum: </dt>
              <dd className="inline break-all">{String(last.report.reportChecksum ?? "—")}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Expires: </dt>
              <dd className="inline">{String(last.report.expiresAt ?? "—")}</dd>
            </div>
          </dl>
          <button type="button" className="tc-btn mt-3" onClick={() => void exportReport()}>
            Export report JSON
          </button>
        </section>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No verification yet.</p>
      )}

      <section className="mt-6">
        <h2 className="m-0 text-sm font-semibold">Health</h2>
        {health ? (
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li>scanSuccessRate: {(health.scanSuccessRate * 100).toFixed(1)}%</li>
            <li>verificationLatency: {Math.round(health.verificationLatencyAvgMs)} ms</li>
            <li>cacheHitRatio: {(health.cacheHitRatio * 100).toFixed(1)}%</li>
            <li>networkFailures: {health.networkFailures}</li>
          </ul>
        ) : null}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-sm font-semibold">Cached reports</h2>
          <button
            type="button"
            className="tc-btn-ghost !py-1 text-xs"
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        </div>
        <ul className="mt-2 space-y-2">
          {history.map((item) => (
            <li key={item.cacheId} className="rounded border border-slate-200 bg-white p-2 text-xs">
              <div className="font-medium">{item.cacheId}</div>
              <div className="break-all text-slate-600">{item.lookupKey}</div>
              <div className="text-slate-500">{formatCacheAge(item.cachedAt)}</div>
            </li>
          ))}
          {history.length === 0 ? (
            <li className="text-xs text-slate-500">No cache entries</li>
          ) : null}
        </ul>
      </section>

      {exportText ? (
        <pre className="mt-4 max-h-40 overflow-auto rounded bg-slate-900 p-2 text-[10px] text-slate-100">
          {exportText.slice(0, 2000)}
        </pre>
      ) : null}
    </main>
  );
}
