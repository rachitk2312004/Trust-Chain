import { useEffect, useState } from "react";
import { isWarningOutcome, trustBadge } from "../security/signatures/reportValidation.js";
import { formatCacheAge } from "../utils/time.js";
import { sendMessage, useExtensionStore } from "../stores/extensionStore.js";
import type { ExtensionStateSnapshot, VerifyResult } from "../types/extension.types.js";
import "../styles/globals.css";

function OutcomeChip({ result }: { result?: string }) {
  const badge = trustBadge(result);
  const cls = isWarningOutcome(result)
    ? result === "revoked" || result === "tampered"
      ? "tc-chip tc-chip-danger"
      : "tc-chip tc-chip-warn"
    : result === "valid"
      ? "tc-chip tc-chip-ok"
      : "tc-chip";
  return <span className={cls}>{badge}</span>;
}

function ReportSummary({ result }: { result: VerifyResult }) {
  const r = result.report;
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white/90 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <OutcomeChip result={r.verificationResult} />
        <span className="text-xs text-slate-500">
          {result.fromCache
            ? `Cached · ${formatCacheAge(result.cachedAt)}`
            : `Live · ${result.latencyMs}ms`}
        </span>
      </div>
      <p className="text-xs text-slate-600">Network: {result.networkState}</p>
      {r.publicVerifyCode ? (
        <p className="break-all text-xs">Doc: {String(r.publicVerifyCode)}</p>
      ) : null}
      {r.transactionHash ? (
        <p className="break-all text-xs text-slate-600">Tx: {String(r.transactionHash)}</p>
      ) : null}
      {(r.verificationResult === "revoked" || r.verificationResult === "tampered") && (
        <p className="text-xs font-medium text-red-700">
          Warning: document trust state requires attention.
        </p>
      )}
    </div>
  );
}

export function Popup() {
  const { state, setState, loading, setLoading, error, setError, lastResult, setLastResult } =
    useExtensionStore();
  const [input, setInput] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await sendMessage<{ state: ExtensionStateSnapshot }>({ type: "GET_STATE" });
      if (res.ok) {
        setState(res.state);
        setLastResult(res.state.lastResult);
      }
    })();
  }, [setState, setLastResult]);

  async function refresh() {
    const res = await sendMessage<{ state: ExtensionStateSnapshot }>({ type: "GET_STATE" });
    if (res.ok) {
      setState(res.state);
      setLastResult(res.state.lastResult);
    }
  }

  async function verifyManual() {
    setLoading(true);
    setError(null);
    const res = await sendMessage<{ result: VerifyResult; state: ExtensionStateSnapshot }>({
      type: "VERIFY_MANUAL",
      input,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Verification failed");
      if (res.state) setState(res.state);
      return;
    }
    setState(res.state);
    setLastResult(res.result);
  }

  async function scanPage() {
    setLoading(true);
    setError(null);
    const res = await sendMessage<{ result?: VerifyResult; state: ExtensionStateSnapshot }>({
      type: "SCAN_PAGE",
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Scan failed");
      if (res.state) setState(res.state);
      return;
    }
    setState(res.state);
    if (res.result) setLastResult(res.result);
  }

  async function toggleEnabled() {
    if (!state) return;
    const res = await sendMessage<{ state: ExtensionStateSnapshot }>({
      type: "SET_SETTINGS",
      settings: { extensionEnabled: !state.settings.extensionEnabled },
    });
    if (res.ok) setState(res.state);
  }

  return (
    <main className="tc-shell w-[340px]">
      <header className="mb-3">
        <h1 className="tc-brand m-0 text-xl text-[var(--tc-ink)]">TrustChain</h1>
        <p className="m-0 mt-1 text-xs text-[var(--tc-muted)]">
          Verify via public API · never local
        </p>
      </header>

      {state ? (
        <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
          <span className="tc-chip">{state.lifecycle}</span>
          <span className="tc-chip">{state.network}</span>
          <span className="tc-chip">{state.sessionId}</span>
        </div>
      ) : null}

      <label className="mb-1 block text-xs font-medium text-slate-600">
        URL, code, hash, or token
      </label>
      <textarea
        className="tc-input mb-2 min-h-[72px] resize-y"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="VERIFY-… / PUB-VERIFY-… / hash / link token"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="tc-btn"
          disabled={loading}
          onClick={() => void verifyManual()}
        >
          Verify
        </button>
        <button
          type="button"
          className="tc-btn-ghost"
          disabled={loading}
          onClick={() => void scanPage()}
        >
          Scan page
        </button>
        <button type="button" className="tc-btn-ghost" onClick={() => void toggleEnabled()}>
          {state?.settings.extensionEnabled === false ? "Enable" : "Pause"}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {lastResult ? <ReportSummary result={lastResult} /> : null}

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <button type="button" className="underline" onClick={() => void refresh()}>
          Refresh
        </button>
        <button
          type="button"
          className="underline"
          onClick={() => {
            void chrome.runtime.openOptionsPage();
          }}
        >
          Settings
        </button>
        <a
          className="underline"
          href={chrome.runtime.getURL("src/sidepanel/index.html")}
          target="_blank"
          rel="noreferrer"
        >
          Side panel
        </a>
      </div>
    </main>
  );
}
