import {
  IntegrationDefaults,
  IntegrationSyncJobStatuses,
} from "@trustchain/config";
import { createHash, randomBytes } from "node:crypto";
import { hashSecret, maskSecret } from "./integration.oauth.js";

export type SyncPolicy = {
  intervalMinutes: number;
  mode: "full" | "incremental";
  scopes: string[];
};

export function normalizeSyncPolicy(input: {
  intervalMinutes?: number;
  mode?: string;
  scopes?: string[];
}): SyncPolicy {
  const interval = Math.max(
    5,
    input.intervalMinutes ?? IntegrationDefaults.defaultSyncIntervalMinutes,
  );
  const mode = input.mode === "full" ? "full" : "incremental";
  return {
    intervalMinutes: interval,
    mode,
    scopes: input.scopes ?? [],
  };
}

export function shouldRunSync(input: {
  lastSyncedAt: Date | string | null;
  intervalMinutes: number;
  force?: boolean;
  now?: Date;
}): boolean {
  if (input.force) return true;
  if (!input.lastSyncedAt) return true;
  const now = input.now ?? new Date();
  const last =
    typeof input.lastSyncedAt === "string"
      ? new Date(input.lastSyncedAt)
      : input.lastSyncedAt;
  return now.getTime() - last.getTime() >= input.intervalMinutes * 60_000;
}

export type SyncExecutionResult = {
  status: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  eventsEmitted: string[];
  completedAt: Date;
};

export function executeIntegrationSync(input: {
  connectorKey: string;
  mode: string;
  scopes: string[];
  subscribedEventTypes: string[];
  now?: Date;
}): SyncExecutionResult {
  const now = input.now ?? new Date();
  const base = input.mode === "full" ? 25 : 8;
  const scopeBoost = Math.min(10, input.scopes.length * 2);
  const recordsProcessed = base + scopeBoost;
  const recordsCreated = Math.floor(recordsProcessed * 0.3);
  const recordsUpdated = recordsProcessed - recordsCreated;

  const eventsEmitted = input.subscribedEventTypes.slice(0, 3).map((t) => t);

  return {
    status: IntegrationSyncJobStatuses.completed,
    recordsProcessed,
    recordsCreated,
    recordsUpdated,
    eventsEmitted,
    completedAt: now,
  };
}

export type CredentialRotationResult = {
  version: number;
  secret: string;
  secretHash: string;
  secretLast4: string;
  secretCipher: string;
  rotatedAt: Date;
};

export function rotateCredential(input: {
  kind: string;
  connectorKey: string;
  previousVersion: number;
  now?: Date;
}): CredentialRotationResult {
  const secret =
    input.kind === "api_key"
      ? `tc_${input.connectorKey}_${randomBytes(24).toString("hex")}`
      : createHash("sha256")
          .update(`rot:${input.connectorKey}:${input.previousVersion}:${Date.now()}`)
          .digest("hex");
  const masked = maskSecret(secret);
  return {
    version: input.previousVersion + 1,
    secret,
    secretHash: hashSecret(secret),
    secretLast4: masked.last4,
    secretCipher: masked.cipher,
    rotatedAt: input.now ?? new Date(),
  };
}

export function matchSubscriptions(
  subscriptions: Array<{ eventType: string; enabled: boolean }>,
  emitted: string[],
): string[] {
  const enabled = new Set(
    subscriptions.filter((s) => s.enabled).map((s) => s.eventType),
  );
  return emitted.filter((e) => enabled.has(e));
}

export function buildSyncDashboard(input: {
  integrations: Array<{ status: string; connectorKey: string }>;
  recentJobs: Array<{ status: string }>;
}): {
  total: number;
  connected: number;
  errored: number;
  byCategoryReady: number;
  recentSuccessRate: number;
} {
  const total = input.integrations.length;
  const connected = input.integrations.filter((i) => i.status === "connected").length;
  const errored = input.integrations.filter((i) => i.status === "error").length;
  const recent = input.recentJobs;
  const recentSuccessRate =
    recent.length === 0
      ? 1
      : recent.filter((j) => j.status === "completed").length / recent.length;

  return {
    total,
    connected,
    errored,
    byCategoryReady: connected,
    recentSuccessRate: Number(recentSuccessRate.toFixed(3)),
  };
}
