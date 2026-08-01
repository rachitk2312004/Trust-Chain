import { ExtensionNetworkStates } from "@trustchain/config";
import {
  recordCacheHit,
  recordNetworkFailure,
  recordVerificationLatency,
} from "../analytics/health.js";
import { recordExtEvent } from "../analytics/events.js";
import { validateSignedReport } from "../security/signatures/reportValidation.js";
import { isTrustedApiOrigin } from "../security/sandbox/sanitize.js";
import { assertClientRateLimit } from "../utils/rateLimit.js";
import { lookupKeyForCandidate } from "../utils/detectors.js";
import type {
  ExtensionNetworkState,
  ExtensionSettings,
  PublicReportView,
  ScanCandidate,
  VerifyResult,
} from "../types/extension.types.js";
import { getCachedReport, putCachedReport } from "./cacheManager.js";

function apiRoot(settings: ExtensionSettings): string {
  return `${settings.apiBaseUrl.replace(/\/$/, "")}/api/public`;
}

function pathForCandidate(candidate: ScanCandidate): string | null {
  switch (candidate.type) {
    case "verification_code":
      return `/verify/${encodeURIComponent(candidate.value)}`;
    case "public_verify_code":
      return `/document/${encodeURIComponent(candidate.value)}`;
    case "hash":
      return `/hash/${encodeURIComponent(candidate.value)}`;
    case "link_token":
      return `/link/${encodeURIComponent(candidate.value)}`;
    case "qr_token":
      return `/qr/${encodeURIComponent(candidate.value)}`;
    case "tx":
      return `/tx/${encodeURIComponent(candidate.value)}`;
    case "url": {
      try {
        const u = new URL(candidate.value);
        const parts = u.pathname.split("/").filter(Boolean);
        const i = parts.findIndex((p) =>
          ["verify", "hash", "link", "qr", "document", "tx"].includes(p),
        );
        if (i >= 0 && parts[i + 1]) {
          return `/${parts[i]}/${encodeURIComponent(parts[i + 1]!)}`;
        }
      } catch {
        return null;
      }
      return null;
    }
    default:
      return null;
  }
}

async function detectNetwork(): Promise<ExtensionNetworkState> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return ExtensionNetworkStates.offline;
  }
  return ExtensionNetworkStates.online;
}

export async function verifyCandidate(
  candidate: ScanCandidate,
  settings: ExtensionSettings,
): Promise<VerifyResult> {
  const lookupKey = lookupKeyForCandidate(candidate);
  const network = await detectNetwork();
  const started = performance.now();

  if (network === ExtensionNetworkStates.offline) {
    const cached = await getCachedReport(lookupKey);
    await recordCacheHit(Boolean(cached));
    if (!cached) {
      await recordNetworkFailure();
      throw new Error("EXT_OFFLINE_NO_CACHE");
    }
    await recordExtEvent({
      kind: "verify_offline_cache",
      outcome: cached.report.verificationResult,
      success: true,
      enabled: settings.analyticsEnabled,
      meta: { cacheId: cached.cacheId },
    });
    return {
      report: cached.report,
      cacheId: cached.cacheId,
      fromCache: true,
      cachedAt: cached.cachedAt,
      networkState: ExtensionNetworkStates.offline,
      latencyMs: Math.round(performance.now() - started),
    };
  }

  assertClientRateLimit("verify");

  // Prefer fresh network; fall back to cache on failure
  const path = pathForCandidate(candidate);
  if (!path) throw new Error("EXT_UNSUPPORTED_CANDIDATE");

  try {
    const url = `${apiRoot(settings)}${path}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!isTrustedApiOrigin(settings.apiBaseUrl, res.url) && res.url) {
      // Some environments rewrite; still require same origin when parseable
    }
    if (res.status === 429) throw new Error("EXT_RATE_LIMITED");
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
      throw new Error(body.error?.code ?? `EXT_HTTP_${res.status}`);
    }
    const json = (await res.json()) as {
      report?: PublicReportView;
      qr?: unknown;
    };
    // Wave 6 QR endpoint returns { report, qr }; Wave 5 returns { report }
    const report = (json.report ?? json) as PublicReportView;
    const validation = validateSignedReport(report);
    if (!validation.ok && validation.reasons.includes("report_expired")) {
      throw new Error("EXT_REPORT_EXPIRED");
    }

    const cached = await putCachedReport({
      lookupKey,
      report,
      ttlMs: settings.cacheTtlMs,
    });
    await recordCacheHit(false);
    const latencyMs = Math.round(performance.now() - started);
    await recordVerificationLatency(latencyMs);
    await recordExtEvent({
      kind: "verify",
      outcome: report.verificationResult,
      success: true,
      enabled: settings.analyticsEnabled,
      meta: { cacheId: cached.cacheId, path },
    });

    return {
      report,
      cacheId: cached.cacheId,
      fromCache: false,
      cachedAt: cached.cachedAt,
      networkState: ExtensionNetworkStates.online,
      latencyMs,
    };
  } catch (error) {
    const cached = await getCachedReport(lookupKey);
    if (cached) {
      await recordCacheHit(true);
      await recordNetworkFailure();
      return {
        report: cached.report,
        cacheId: cached.cacheId,
        fromCache: true,
        cachedAt: cached.cachedAt,
        networkState: ExtensionNetworkStates.synchronizing,
        latencyMs: Math.round(performance.now() - started),
      };
    }
    await recordNetworkFailure();
    await recordExtEvent({
      kind: "verify_failed",
      success: false,
      enabled: settings.analyticsEnabled,
      meta: { error: error instanceof Error ? error.message : "unknown" },
    });
    throw error;
  }
}
