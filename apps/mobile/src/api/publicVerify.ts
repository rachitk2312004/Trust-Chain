import { MobileAppStates } from "@trustchain/config";
import { getCachedReport, putCachedReport } from "../cache/reportCache";
import { validateSignedReport } from "../security/signatures/reportValidation";
import { assertClientRateLimit } from "../utils/rateLimit";
import { detectCandidates, lookupKeyForCandidate } from "../utils/detectors";
import type { PublicReportView, ScanCandidate } from "../types/mobile.types";
import {
  recordCacheHit,
  recordNetworkFailure,
  recordVerificationLatency,
} from "../analytics/health";

function apiRoot(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/public`;
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
        if (i >= 0 && parts[i + 1]) return `/${parts[i]}/${encodeURIComponent(parts[i + 1]!)}`;
      } catch {
        return null;
      }
      return null;
    }
    default:
      return null;
  }
}

export async function verifyCandidate(input: {
  candidate: ScanCandidate;
  apiBaseUrl: string;
  online: boolean;
  cacheTtlMs?: number;
}): Promise<{
  report: PublicReportView;
  fromCache: boolean;
  cachedAt: string | null;
  cacheId: string | null;
  networkState: string;
  latencyMs: number;
}> {
  const lookupKey = lookupKeyForCandidate(input.candidate);
  const started = Date.now();

  if (!input.online) {
    const cached = await getCachedReport(lookupKey);
    await recordCacheHit(Boolean(cached));
    if (!cached) {
      await recordNetworkFailure();
      throw new Error("MOBILE_OFFLINE_NO_CACHE");
    }
    return {
      report: cached.report,
      fromCache: true,
      cachedAt: cached.cachedAt,
      cacheId: cached.cacheId,
      networkState: MobileAppStates.offline,
      latencyMs: Date.now() - started,
    };
  }

  assertClientRateLimit("verify");
  const path = pathForCandidate(input.candidate);
  if (!path) throw new Error("MOBILE_UNSUPPORTED_CANDIDATE");

  try {
    const res = await fetch(`${apiRoot(input.apiBaseUrl)}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 429) throw new Error("MOBILE_RATE_LIMITED");
    if (!res.ok) throw new Error(`MOBILE_HTTP_${res.status}`);
    const json = (await res.json()) as { report?: PublicReportView };
    const report = (json.report ?? json) as PublicReportView;
    const validation = validateSignedReport(report);
    if (!validation.ok && validation.reasons.includes("report_expired")) {
      throw new Error("MOBILE_REPORT_EXPIRED");
    }
    const cached = await putCachedReport({
      lookupKey,
      report,
      ttlMs: input.cacheTtlMs ?? 24 * 60 * 60 * 1000,
    });
    await recordCacheHit(false);
    const latencyMs = Date.now() - started;
    await recordVerificationLatency(latencyMs);
    return {
      report,
      fromCache: false,
      cachedAt: cached.cachedAt,
      cacheId: cached.cacheId,
      networkState: MobileAppStates.online,
      latencyMs,
    };
  } catch (error) {
    const cached = await getCachedReport(lookupKey);
    if (cached) {
      await recordCacheHit(true);
      await recordNetworkFailure();
      return {
        report: cached.report,
        fromCache: true,
        cachedAt: cached.cachedAt,
        cacheId: cached.cacheId,
        networkState: MobileAppStates.synchronizing,
        latencyMs: Date.now() - started,
      };
    }
    await recordNetworkFailure();
    throw error;
  }
}

export async function verifyManualInput(input: {
  text: string;
  apiBaseUrl: string;
  online: boolean;
}) {
  const candidates = detectCandidates(input.text, "manual");
  if (!candidates[0]) throw new Error("MOBILE_NO_CANDIDATE");
  return verifyCandidate({
    candidate: candidates[0],
    apiBaseUrl: input.apiBaseUrl,
    online: input.online,
  });
}
