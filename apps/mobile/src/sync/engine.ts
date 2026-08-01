import { MobileSyncPriorities } from "@trustchain/config";
import { enqueueSyncJob, processSyncQueue } from "./queue";
import type { AuthTokens } from "../types/mobile.types";

export async function scheduleOrgSync(organizationId?: string): Promise<void> {
  await enqueueSyncJob({
    kind: "download_organizations",
    priority: MobileSyncPriorities.high,
    payload: { organizationId },
  });
}

export async function scheduleDocumentSync(organizationId: string): Promise<void> {
  await enqueueSyncJob({
    kind: "download_documents",
    priority: MobileSyncPriorities.normal,
    payload: { organizationId },
  });
}

export async function scheduleBackgroundAnalyticsFlush(): Promise<void> {
  await enqueueSyncJob({
    kind: "flush_analytics",
    priority: MobileSyncPriorities.background,
  });
}

export async function runForegroundSync(input: {
  accessToken: string | null;
  apiBaseUrl: string;
  onOrgs?: (orgs: unknown[]) => void;
  onDocs?: (docs: unknown[]) => void;
  onLatency?: (ms: number) => void;
}): Promise<{ processed: number; failed: number }> {
  return processSyncQueue(async (job) => {
    if (!input.accessToken && job.kind.startsWith("download_")) {
      throw new Error("MOBILE_SYNC_UNAUTHORIZED");
    }
    if (job.kind === "download_organizations") {
      const res = await fetch(`${input.apiBaseUrl}/api/v1/organizations`, {
        headers: { Authorization: `Bearer ${input.accessToken}` },
      });
      if (!res.ok) throw new Error(`MOBILE_SYNC_HTTP_${res.status}`);
      const json = (await res.json()) as { organizations?: unknown[] };
      input.onOrgs?.(json.organizations ?? []);
      return;
    }
    if (job.kind === "download_documents") {
      const orgId = String(job.payload.organizationId ?? "");
      if (!orgId) return;
      const res = await fetch(`${input.apiBaseUrl}/api/v1/organizations/${orgId}/documents`, {
        headers: { Authorization: `Bearer ${input.accessToken}` },
      });
      if (!res.ok) throw new Error(`MOBILE_SYNC_HTTP_${res.status}`);
      const json = (await res.json()) as { documents?: unknown[] };
      input.onDocs?.(json.documents ?? []);
      return;
    }
    if (job.kind === "flush_analytics") {
      // Local-only analytics in Wave 8 — no remote flush endpoint.
      return;
    }
  }, input.onLatency);
}

export type { AuthTokens };
