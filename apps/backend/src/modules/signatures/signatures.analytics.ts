import {
  SignatureApprovalWorkflowStatuses,
  SignatureEventTypes,
  SignatureStatuses,
  SignatureWorkflowKinds,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { averageLatency, signatureProcessMetrics } from "./signatures.observability.js";

export type SignatureLifecycleStatistics = {
  created: number;
  active: number;
  pending: number;
  revoked: number;
  expired: number;
  total: number;
};

export type SignatureVerificationAnalytics = {
  totalEvents: number;
  valid: number;
  invalid: number;
  successRate: number | null;
  averageVerificationTimeMs: number | null;
};

export type SignatureAlgorithmRow = {
  algorithm: string;
  count: number;
  share: number | null;
};

export type SignatureWorkflowAnalytics = {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  completionRate: number | null;
  rejectionRate: number | null;
  averageApprovalLatencyMs: number | null;
  pending: number;
};

export type SignatureDetachedAnalytics = {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  artifactCount: number;
};

export type SignatureDownloadAnalytics = {
  artifactCount: number;
  byKind: Record<string, number>;
  processDownloads: number;
  processDownloadByKind: Record<string, number>;
};

export type SignatureAnalyticsSnapshot = {
  generatedAt: string;
  organizationId: string;
  lifecycle: SignatureLifecycleStatistics;
  verification: SignatureVerificationAnalytics;
  algorithms: SignatureAlgorithmRow[];
  workflows: SignatureWorkflowAnalytics;
  detached: SignatureDetachedAnalytics;
  downloads: SignatureDownloadAnalytics;
  revocation: { revoked: number; revokeEvents: number };
  expiration: { expired: number; expiringWithin30Days: number };
  process: ReturnType<typeof signatureProcessMetrics.snapshot>;
};

function rate(success: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((success / total) * 10000) / 100;
}

export function buildLifecycleStatistics(counts: Record<string, number>): SignatureLifecycleStatistics {
  const active = counts[SignatureStatuses.active] ?? 0;
  const pending = counts[SignatureStatuses.pending] ?? 0;
  const revoked = counts[SignatureStatuses.revoked] ?? 0;
  const expired = counts[SignatureStatuses.expired] ?? 0;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    created: total,
    active,
    pending,
    revoked,
    expired,
    total,
  };
}

export function buildVerificationAnalytics(
  events: Array<{ payloadJson: Prisma.JsonValue | null }>,
  processAverageMs: number | null,
): SignatureVerificationAnalytics {
  let valid = 0;
  let invalid = 0;
  const latencies: number[] = [];
  for (const event of events) {
    const payload =
      event.payloadJson && typeof event.payloadJson === "object" && !Array.isArray(event.payloadJson)
        ? (event.payloadJson as Record<string, unknown>)
        : {};
    if (payload.valid === true) valid += 1;
    else if (payload.valid === false) invalid += 1;
    if (typeof payload.durationMs === "number" && Number.isFinite(payload.durationMs)) {
      latencies.push(payload.durationMs);
    }
  }
  return {
    totalEvents: events.length,
    valid,
    invalid,
    successRate: rate(valid, events.length),
    averageVerificationTimeMs: averageLatency(latencies) ?? processAverageMs,
  };
}

export function buildAlgorithmDistribution(
  groups: Array<{ algorithm: string; _count: { _all: number } }>,
): SignatureAlgorithmRow[] {
  const total = groups.reduce((sum, g) => sum + g._count._all, 0);
  return groups
    .map((g) => ({
      algorithm: g.algorithm,
      count: g._count._all,
      share: rate(g._count._all, total),
    }))
    .sort((a, b) => b.count - a.count);
}

export function buildWorkflowAnalytics(input: {
  byStatus: Array<{ status: string; _count: { _all: number } }>;
  byType: Array<{ workflowType: string; _count: { _all: number } }>;
  completedLatenciesMs: number[];
}): SignatureWorkflowAnalytics {
  const byStatus: Record<string, number> = {};
  for (const row of input.byStatus) byStatus[row.status] = row._count._all;
  const byType: Record<string, number> = {};
  for (const row of input.byType) byType[row.workflowType] = row._count._all;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const approved = byStatus[SignatureApprovalWorkflowStatuses.approved] ?? 0;
  const rejected = byStatus[SignatureApprovalWorkflowStatuses.rejected] ?? 0;
  const terminal = approved + rejected;
  return {
    total,
    byStatus,
    byType,
    completionRate: rate(approved, terminal || total),
    rejectionRate: rate(rejected, terminal || total),
    averageApprovalLatencyMs: averageLatency(input.completedLatenciesMs),
    pending: byStatus[SignatureApprovalWorkflowStatuses.pending] ?? 0,
  };
}

export function buildDetachedAnalytics(input: {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  artifactCount: number;
}): SignatureDetachedAnalytics {
  return input;
}

export async function generateSignatureAnalytics(
  organizationId: string,
): Promise<SignatureAnalyticsSnapshot> {
  const process = signatureProcessMetrics.snapshot();
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    statusGroups,
    algorithmGroups,
    verifyEvents,
    revokeEvents,
    workflowStatusGroups,
    workflowTypeGroups,
    completedWorkflows,
    detachedTotal,
    detachedActive,
    detachedRevoked,
    detachedExpired,
    detachedArtifacts,
    artifactGroups,
    expiringSoon,
  ] = await Promise.all([
    prisma.signature.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.signature.groupBy({
      by: ["algorithm"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.signatureEvent.findMany({
      where: { organizationId, eventType: SignatureEventTypes.verified },
      select: { payloadJson: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.signatureEvent.count({
      where: { organizationId, eventType: SignatureEventTypes.revoked },
    }),
    prisma.signatureWorkflow.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.signatureWorkflow.groupBy({
      by: ["workflowType"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.signatureWorkflow.findMany({
      where: {
        organizationId,
        status: {
          in: [
            SignatureApprovalWorkflowStatuses.approved,
            SignatureApprovalWorkflowStatuses.rejected,
          ],
        },
        completedAt: { not: null },
      },
      select: { createdAt: true, completedAt: true },
      take: 2000,
      orderBy: { completedAt: "desc" },
    }),
    prisma.signature.count({
      where: {
        organizationId,
        metadataJson: { path: ["workflow"], equals: SignatureWorkflowKinds.detached },
      },
    }),
    prisma.signature.count({
      where: {
        organizationId,
        status: SignatureStatuses.active,
        metadataJson: { path: ["workflow"], equals: SignatureWorkflowKinds.detached },
      },
    }),
    prisma.signature.count({
      where: {
        organizationId,
        status: SignatureStatuses.revoked,
        metadataJson: { path: ["workflow"], equals: SignatureWorkflowKinds.detached },
      },
    }),
    prisma.signature.count({
      where: {
        organizationId,
        status: SignatureStatuses.expired,
        metadataJson: { path: ["workflow"], equals: SignatureWorkflowKinds.detached },
      },
    }),
    prisma.signatureArtifact.count({
      where: {
        organizationId,
        kind: "detached_payload",
      },
    }),
    prisma.signatureArtifact.groupBy({
      by: ["kind"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.signature.count({
      where: {
        organizationId,
        status: SignatureStatuses.active,
        expiresAt: { gt: now, lte: in30Days },
      },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of statusGroups) statusCounts[row.status] = row._count._all;
  const lifecycle = buildLifecycleStatistics(statusCounts);

  const completedLatenciesMs = completedWorkflows
    .filter((w) => w.completedAt)
    .map((w) => w.completedAt!.getTime() - w.createdAt.getTime())
    .filter((ms) => ms >= 0);

  const byKind: Record<string, number> = {};
  for (const row of artifactGroups) byKind[row.kind] = row._count._all;

  return {
    generatedAt: now.toISOString(),
    organizationId,
    lifecycle,
    verification: buildVerificationAnalytics(verifyEvents, process.averageVerificationTimeMs),
    algorithms: buildAlgorithmDistribution(algorithmGroups),
    workflows: buildWorkflowAnalytics({
      byStatus: workflowStatusGroups,
      byType: workflowTypeGroups,
      completedLatenciesMs,
    }),
    detached: buildDetachedAnalytics({
      total: detachedTotal,
      active: detachedActive,
      revoked: detachedRevoked,
      expired: detachedExpired,
      artifactCount: detachedArtifacts,
    }),
    downloads: {
      artifactCount: Object.values(byKind).reduce((a, b) => a + b, 0),
      byKind,
      processDownloads: process.downloads,
      processDownloadByKind: process.downloadByKind,
    },
    revocation: {
      revoked: lifecycle.revoked,
      revokeEvents,
    },
    expiration: {
      expired: lifecycle.expired,
      expiringWithin30Days: expiringSoon,
    },
    process,
  };
}

export async function getWorkflowAnalytics(organizationId: string) {
  const snapshot = await generateSignatureAnalytics(organizationId);
  return {
    workflows: snapshot.workflows,
    process: { averageApprovalTimeMs: snapshot.process.averageApprovalTimeMs },
  };
}

export async function getAlgorithmAnalytics(organizationId: string) {
  const snapshot = await generateSignatureAnalytics(organizationId);
  return { algorithms: snapshot.algorithms, lifecycle: snapshot.lifecycle };
}

export async function getVerificationAnalyticsSlice(organizationId: string) {
  const snapshot = await generateSignatureAnalytics(organizationId);
  return { verification: snapshot.verification, process: snapshot.process };
}

export async function getDetachedAnalytics(organizationId: string) {
  const snapshot = await generateSignatureAnalytics(organizationId);
  return { detached: snapshot.detached, downloads: snapshot.downloads };
}
