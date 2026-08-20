import {
  CertificateEventTypes,
  CertificateStatuses,
  CertificateTemplateStatuses,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { averageLatency, certificateProcessMetrics } from "./certificates.observability.js";

export type IssuanceStatistics = {
  issued: number;
  draft: number;
  revoked: number;
  expired: number;
  active: number;
  total: number;
};

export type VerificationStatistics = {
  totalEvents: number;
  valid: number;
  invalid: number;
  successRate: number | null;
  averageVerificationTimeMs: number | null;
};

export type DownloadStatistics = {
  totalEvents: number;
  byFormat: Record<string, number>;
  averageRenderTimeMs: number | null;
};

export type TemplateUtilizationRow = {
  templateId: string | null;
  templateCode: string | null;
  templateName: string | null;
  status: string | null;
  certificateCount: number;
};

export type BulkJobStatistics = {
  totalJobs: number;
  byStatus: Record<string, number>;
  totalRows: number;
  successRows: number;
  failedRows: number;
  rolledBackCount: number;
  successRate: number | null;
};

export type ExpirationStatistics = {
  expired: number;
  expiringWithin30Days: number;
  neverExpires: number;
};

export type RenderingStatistics = {
  renderEvents: number;
  averageRenderTimeMs: number | null;
  processAverageRenderTimeMs: number | null;
  processRenderFailures: number;
};

export type CertificateAnalyticsSnapshot = {
  generatedAt: string;
  organizationId: string;
  issuance: IssuanceStatistics;
  revocation: { revoked: number; revokeEvents: number };
  verification: VerificationStatistics;
  expiration: ExpirationStatistics;
  downloads: DownloadStatistics;
  rendering: RenderingStatistics;
  templates: TemplateUtilizationRow[];
  bulk: BulkJobStatistics;
  process: ReturnType<typeof certificateProcessMetrics.snapshot>;
};

function rate(success: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((success / total) * 10000) / 100;
}

export function buildIssuanceStatistics(counts: Record<string, number>): IssuanceStatistics {
  const issued = counts[CertificateStatuses.issued] ?? 0;
  const draft = counts[CertificateStatuses.draft] ?? 0;
  const revoked = counts[CertificateStatuses.revoked] ?? 0;
  const expired = counts[CertificateStatuses.expired] ?? 0;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    issued,
    draft,
    revoked,
    expired,
    active: issued,
    total,
  };
}

export function buildVerificationStatistics(
  events: Array<{ payloadJson: Prisma.JsonValue | null }>,
  processAverageMs: number | null,
): VerificationStatistics {
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
  const totalEvents = events.length;
  return {
    totalEvents,
    valid,
    invalid,
    successRate: rate(valid, valid + invalid),
    averageVerificationTimeMs: averageLatency(latencies) ?? processAverageMs,
  };
}

export function buildDownloadStatistics(
  events: Array<{ payloadJson: Prisma.JsonValue | null }>,
  processAverageMs: number | null,
): DownloadStatistics {
  const byFormat: Record<string, number> = {};
  const latencies: number[] = [];
  for (const event of events) {
    const payload =
      event.payloadJson && typeof event.payloadJson === "object" && !Array.isArray(event.payloadJson)
        ? (event.payloadJson as Record<string, unknown>)
        : {};
    const format = typeof payload.format === "string" ? payload.format.toLowerCase() : "unknown";
    byFormat[format] = (byFormat[format] ?? 0) + 1;
    if (typeof payload.durationMs === "number" && Number.isFinite(payload.durationMs)) {
      latencies.push(payload.durationMs);
    }
  }
  return {
    totalEvents: events.length,
    byFormat,
    averageRenderTimeMs: averageLatency(latencies) ?? processAverageMs,
  };
}

export function buildBulkJobStatistics(
  jobs: Array<{
    status: string;
    totalRows: number;
    successRows: number;
    failedRows: number;
    rolledBackCount: number;
  }>,
): BulkJobStatistics {
  const byStatus: Record<string, number> = {};
  let totalRows = 0;
  let successRows = 0;
  let failedRows = 0;
  let rolledBackCount = 0;
  for (const job of jobs) {
    byStatus[job.status] = (byStatus[job.status] ?? 0) + 1;
    totalRows += job.totalRows;
    successRows += job.successRows;
    failedRows += job.failedRows;
    rolledBackCount += job.rolledBackCount;
  }
  return {
    totalJobs: jobs.length,
    byStatus,
    totalRows,
    successRows,
    failedRows,
    rolledBackCount,
    successRate: rate(successRows, successRows + failedRows),
  };
}

export function buildTemplateUtilization(
  groups: Array<{ templateId: string | null; _count: { _all: number } }>,
  templates: Array<{ id: string; code: string; name: string; status: string }>,
): TemplateUtilizationRow[] {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const rows: TemplateUtilizationRow[] = groups.map((g) => {
    const tpl = g.templateId ? byId.get(g.templateId) : null;
    return {
      templateId: g.templateId,
      templateCode: tpl?.code ?? null,
      templateName: tpl?.name ?? null,
      status: tpl?.status ?? null,
      certificateCount: g._count._all,
    };
  });
  rows.sort((a, b) => b.certificateCount - a.certificateCount);
  return rows;
}

/**
 * Org-scoped durable analytics + process counters.
 */
export async function generateCertificateAnalytics(
  organizationId: string,
): Promise<CertificateAnalyticsSnapshot> {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    statusGroups,
    revokeEvents,
    verifyEvents,
    downloadEvents,
    renderEvents,
    templateGroups,
    templates,
    bulkJobs,
    expiringWithin30Days,
    neverExpires,
  ] = await Promise.all([
    prisma.certificate.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.certificateEvent.count({
      where: { organizationId, eventType: CertificateEventTypes.revoked },
    }),
    prisma.certificateEvent.findMany({
      where: { organizationId, eventType: CertificateEventTypes.verified },
      select: { payloadJson: true },
      take: 5000,
      orderBy: { createdAt: "desc" },
    }),
    prisma.certificateEvent.findMany({
      where: { organizationId, eventType: CertificateEventTypes.downloaded },
      select: { payloadJson: true },
      take: 5000,
      orderBy: { createdAt: "desc" },
    }),
    prisma.certificateEvent.findMany({
      where: { organizationId, eventType: CertificateEventTypes.rendered },
      select: { payloadJson: true },
      take: 2000,
      orderBy: { createdAt: "desc" },
    }),
    prisma.certificate.groupBy({
      by: ["templateId"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.certificateTemplate.findMany({
      where: { organizationId },
      select: { id: true, code: true, name: true, status: true },
    }),
    prisma.certificateBulkJob.findMany({
      where: { organizationId },
      select: {
        status: true,
        totalRows: true,
        successRows: true,
        failedRows: true,
        rolledBackCount: true,
      },
    }),
    prisma.certificate.count({
      where: {
        organizationId,
        status: CertificateStatuses.issued,
        expiresAt: { gt: now, lte: in30Days },
      },
    }),
    prisma.certificate.count({
      where: {
        organizationId,
        status: { in: [CertificateStatuses.issued, CertificateStatuses.draft] },
        expiresAt: null,
      },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of statusGroups) {
    statusCounts[row.status] = row._count._all;
  }

  const process = certificateProcessMetrics.snapshot();
  const issuance = buildIssuanceStatistics(statusCounts);
  const verification = buildVerificationStatistics(verifyEvents, process.averageVerificationTimeMs);
  const downloads = buildDownloadStatistics(downloadEvents, process.averageRenderTimeMs);
  const bulk = buildBulkJobStatistics(bulkJobs);
  const templateRows = buildTemplateUtilization(templateGroups, templates);

  const renderLatencies: number[] = [];
  for (const event of renderEvents) {
    const payload =
      event.payloadJson && typeof event.payloadJson === "object" && !Array.isArray(event.payloadJson)
        ? (event.payloadJson as Record<string, unknown>)
        : {};
    if (typeof payload.durationMs === "number") renderLatencies.push(payload.durationMs);
  }

  return {
    generatedAt: now.toISOString(),
    organizationId,
    issuance,
    revocation: {
      revoked: issuance.revoked,
      revokeEvents,
    },
    verification,
    expiration: {
      expired: issuance.expired,
      expiringWithin30Days,
      neverExpires,
    },
    downloads,
    rendering: {
      renderEvents: renderEvents.length,
      averageRenderTimeMs: averageLatency(renderLatencies) ?? process.averageRenderTimeMs,
      processAverageRenderTimeMs: process.averageRenderTimeMs,
      processRenderFailures: process.renderFailures,
    },
    templates: templateRows,
    bulk,
    process,
  };
}

export async function getTemplateAnalytics(organizationId: string) {
  const snapshot = await generateCertificateAnalytics(organizationId);
  const activeTemplates = snapshot.templates.filter(
    (t) => t.status === CertificateTemplateStatuses.active || t.templateId == null,
  );
  return {
    generatedAt: snapshot.generatedAt,
    organizationId,
    templates: snapshot.templates,
    activeTemplateCount: activeTemplates.filter((t) => t.status === CertificateTemplateStatuses.active)
      .length,
    unusedActiveTemplates: (
      await prisma.certificateTemplate.findMany({
        where: { organizationId, status: CertificateTemplateStatuses.active },
        select: { id: true, code: true, name: true },
      })
    ).filter((t) => !snapshot.templates.some((u) => u.templateId === t.id && u.certificateCount > 0)),
  };
}

export async function getIssuanceAnalytics(organizationId: string) {
  const snapshot = await generateCertificateAnalytics(organizationId);
  return {
    generatedAt: snapshot.generatedAt,
    organizationId,
    issuance: snapshot.issuance,
    revocation: snapshot.revocation,
    expiration: snapshot.expiration,
    bulk: snapshot.bulk,
  };
}

export async function getDownloadAnalytics(organizationId: string) {
  const snapshot = await generateCertificateAnalytics(organizationId);
  return {
    generatedAt: snapshot.generatedAt,
    organizationId,
    downloads: snapshot.downloads,
    rendering: snapshot.rendering,
    process: snapshot.process,
  };
}

export async function getVerificationAnalytics(organizationId: string) {
  const snapshot = await generateCertificateAnalytics(organizationId);
  return {
    generatedAt: snapshot.generatedAt,
    organizationId,
    verification: snapshot.verification,
    process: {
      verifications: snapshot.process.verifications,
      averageVerificationTimeMs: snapshot.process.averageVerificationTimeMs,
    },
  };
}
