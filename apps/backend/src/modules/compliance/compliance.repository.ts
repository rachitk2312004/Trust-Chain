import {
  ComplianceRemediationStatuses,
  ComplianceViolationStatuses,
  type ComplianceFramework,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import type { ComplianceSignals, RuleEvaluationResult } from "./compliance.engine.js";
import { defaultSignals } from "./compliance.engine.js";

export function toPublicAssessment(row: {
  id: string;
  organizationId: string;
  framework: string;
  status: string;
  score: number;
  passedRules: number;
  failedRules: number;
  totalRules: number;
  summaryJson: Prisma.JsonValue | null;
  triggeredById: string | null;
  scheduled: boolean;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    framework: row.framework,
    status: row.status,
    score: row.score,
    passedRules: row.passedRules,
    failedRules: row.failedRules,
    totalRules: row.totalRules,
    summary: row.summaryJson,
    triggeredById: row.triggeredById,
    scheduled: row.scheduled,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function gatherComplianceSignals(
  organizationId: string,
  overrides?: Partial<ComplianceSignals>,
): Promise<ComplianceSignals> {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [
    memberships,
    mfaFactors,
    auditTotal,
    auditFailed,
    retentionPolicies,
    encryptionFlag,
    accessReviewEvents,
    dsarEvents,
    phiEvents,
    backupEvents,
    incidentEvents,
    vendorEvents,
    leastPrivilegeEvents,
  ] = await Promise.all([
    prisma.membership.count({ where: { organizationId, status: "active" } }),
    prisma.mfaFactor.count({
      where: {
        disabledAt: null,
        verifiedAt: { not: null },
        user: { memberships: { some: { organizationId, status: "active" } } },
      },
    }),
    prisma.platformAuditEvent.count({
      where: { organizationId, createdAt: { gte: since30 } },
    }),
    prisma.platformAuditEvent.count({
      where: { organizationId, createdAt: { gte: since30 }, success: false },
    }),
    prisma.policyAssignment.count({
      where: {
        organizationId,
        policy: {
          policyType: { contains: "retention", mode: "insensitive" },
          status: "active",
        },
      },
    }).catch(() => 0),
    prisma.systemConfiguration
      .findFirst({
        where: {
          OR: [
            { key: "document.encryption.enabled" },
            { key: { contains: "encryption", mode: "insensitive" } },
          ],
        },
      })
      .then((row) => (row ? 1 : 0))
      .catch(() => 0),
    prisma.platformAuditEvent.count({
      where: {
        organizationId,
        createdAt: { gte: since90 },
        action: { contains: "access.review", mode: "insensitive" },
      },
    }),
    prisma.complianceEvent.count({
      where: {
        organizationId,
        framework: "gdpr",
        action: { contains: "dsar", mode: "insensitive" },
      },
    }),
    prisma.complianceEvent.count({
      where: {
        organizationId,
        framework: "hipaa",
        action: { contains: "phi", mode: "insensitive" },
      },
    }),
    prisma.complianceEvent.count({
      where: {
        organizationId,
        action: { contains: "backup.verify", mode: "insensitive" },
        createdAt: { gte: since30 },
      },
    }),
    prisma.complianceEvent.count({
      where: {
        organizationId,
        action: { contains: "incident.plan", mode: "insensitive" },
      },
    }),
    prisma.complianceEvent.count({
      where: {
        organizationId,
        action: { contains: "vendor.risk", mode: "insensitive" },
      },
    }),
    prisma.complianceEvent.count({
      where: {
        organizationId,
        action: { contains: "least.privilege", mode: "insensitive" },
      },
    }),
  ]);

  const mfaEnabledRatio =
    memberships === 0 ? 0 : Math.min(1, mfaFactors / Math.max(1, memberships));
  const failedAuditRatio = auditTotal === 0 ? 0 : auditFailed / auditTotal;

  return defaultSignals({
    mfaEnabledRatio: Math.round(mfaEnabledRatio * 1000) / 1000,
    auditEventsLast30d: auditTotal,
    failedAuditRatio: Math.round(failedAuditRatio * 1000) / 1000,
    documentRetentionPolicyPresent: retentionPolicies > 0 ? 1 : 0,
    encryptionAtRestEnabled: encryptionFlag,
    accessReviewsLast90d: accessReviewEvents > 0 ? 1 : 0,
    dataSubjectRequestProcess: dsarEvents > 0 ? 1 : 0,
    phiAccessLogging: phiEvents > 0 ? 1 : 0,
    backupVerifiedLast30d: backupEvents > 0 ? 1 : 0,
    incidentResponsePlanPresent: incidentEvents > 0 ? 1 : 0,
    vendorRiskAssessed: vendorEvents > 0 ? 1 : 0,
    leastPrivilegeEnforced: leastPrivilegeEvents > 0 ? 1 : 0,
    ...overrides,
  });
}

export async function createAssessment(input: {
  organizationId: string;
  framework: ComplianceFramework;
  triggeredById: string;
  scheduled: boolean;
}) {
  return prisma.complianceAssessment.create({
    data: {
      organizationId: input.organizationId,
      framework: input.framework,
      status: "running",
      triggeredById: input.triggeredById,
      scheduled: input.scheduled,
      startedAt: new Date(),
    },
  });
}

export async function completeAssessment(
  assessmentId: string,
  input: {
    score: number;
    passedRules: number;
    failedRules: number;
    totalRules: number;
    summary: Record<string, unknown>;
    results: RuleEvaluationResult[];
  },
) {
  await prisma.complianceRuleResult.createMany({
    data: input.results.map((r) => ({
      assessmentId,
      ruleKey: r.ruleKey,
      framework: r.framework,
      title: r.title,
      severity: r.severity,
      passed: r.passed,
      score: r.score,
      evidenceJson: r.evidence as Prisma.InputJsonValue,
      message: r.message,
    })),
  });

  return prisma.complianceAssessment.update({
    where: { id: assessmentId },
    data: {
      status: "completed",
      score: input.score,
      passedRules: input.passedRules,
      failedRules: input.failedRules,
      totalRules: input.totalRules,
      summaryJson: input.summary as Prisma.InputJsonValue,
      finishedAt: new Date(),
    },
  });
}

export async function failAssessment(assessmentId: string, message: string) {
  return prisma.complianceAssessment.update({
    where: { id: assessmentId },
    data: {
      status: "failed",
      summaryJson: { error: message },
      finishedAt: new Date(),
    },
  });
}

export async function createViolationsAndRemediations(input: {
  organizationId: string;
  assessmentId: string;
  framework: ComplianceFramework;
  failures: RuleEvaluationResult[];
}) {
  const violations = [];
  for (const failure of input.failures) {
    const violation = await prisma.complianceViolation.create({
      data: {
        organizationId: input.organizationId,
        assessmentId: input.assessmentId,
        framework: input.framework,
        ruleKey: failure.ruleKey,
        title: failure.title,
        severity: failure.severity,
        status: ComplianceViolationStatuses.open,
        detailsJson: {
          message: failure.message,
          evidence: failure.evidence,
          remediationHint: failure.remediationHint,
        } as Prisma.InputJsonValue,
      },
    });
    await prisma.complianceRemediation.create({
      data: {
        organizationId: input.organizationId,
        violationId: violation.id,
        title: `Remediate: ${failure.title}`,
        status: ComplianceRemediationStatuses.pending,
        notes: failure.remediationHint,
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    violations.push(violation);
  }
  return violations;
}

export async function createReport(input: {
  organizationId: string;
  assessmentId: string;
  framework: ComplianceFramework;
  title: string;
  score: number;
  report: Record<string, unknown>;
}) {
  return prisma.complianceReport.create({
    data: {
      organizationId: input.organizationId,
      assessmentId: input.assessmentId,
      framework: input.framework,
      title: input.title,
      score: input.score,
      status: "ready",
      reportJson: input.report as Prisma.InputJsonValue,
    },
  });
}

export async function listAssessments(input: {
  organizationId: string;
  framework?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.ComplianceAssessmentWhereInput = {
    organizationId: input.organizationId,
    ...(input.framework ? { framework: input.framework } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.complianceAssessment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
    }),
    prisma.complianceAssessment.count({ where }),
  ]);
  return { assessments: rows.map(toPublicAssessment), total, limit: input.limit, offset: input.offset };
}

export async function getAssessment(id: string) {
  return prisma.complianceAssessment.findUnique({
    where: { id },
    include: {
      ruleResults: { orderBy: { createdAt: "asc" } },
      violations: {
        include: { remediations: true },
        orderBy: { detectedAt: "desc" },
      },
      reports: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
}

export async function listReports(input: {
  organizationId: string;
  framework?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.ComplianceReportWhereInput = {
    organizationId: input.organizationId,
    ...(input.framework ? { framework: input.framework } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.complianceReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
    }),
    prisma.complianceReport.count({ where }),
  ]);
  return {
    reports: rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      assessmentId: r.assessmentId,
      framework: r.framework,
      title: r.title,
      score: r.score,
      status: r.status,
      report: r.reportJson,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    limit: input.limit,
    offset: input.offset,
  };
}

export async function getDashboardData(organizationId: string) {
  const [assessments, openViolations, openRemediations] = await Promise.all([
    prisma.complianceAssessment.findMany({
      where: { organizationId, status: "completed" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.complianceViolation.count({
      where: {
        organizationId,
        status: {
          in: [ComplianceViolationStatuses.open, ComplianceViolationStatuses.inProgress],
        },
      },
    }),
    prisma.complianceRemediation.count({
      where: {
        organizationId,
        status: {
          in: [ComplianceRemediationStatuses.pending, ComplianceRemediationStatuses.inProgress],
        },
      },
    }),
  ]);

  const latestByFramework: Record<string, { score: number; assessmentId: string }> = {};
  for (const row of assessments) {
    if (!latestByFramework[row.framework]) {
      latestByFramework[row.framework] = { score: row.score, assessmentId: row.id };
    }
  }

  const violations = await prisma.complianceViolation.findMany({
    where: { organizationId },
    orderBy: { detectedAt: "desc" },
    take: 50,
    include: { remediations: true },
  });

  return {
    assessments: assessments.map(toPublicAssessment),
    openViolations,
    openRemediations,
    latestByFramework,
    violations: violations.map((v) => ({
      id: v.id,
      framework: v.framework,
      ruleKey: v.ruleKey,
      title: v.title,
      severity: v.severity,
      status: v.status,
      detectedAt: v.detectedAt.toISOString(),
      remediatedAt: v.remediatedAt?.toISOString() ?? null,
      remediations: v.remediations.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        dueAt: r.dueAt?.toISOString() ?? null,
        notes: r.notes,
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
    })),
  };
}

export async function updateRemediation(
  id: string,
  input: { status?: string; notes?: string; ownerUserId?: string | null },
) {
  const data: Prisma.ComplianceRemediationUpdateInput = {};
  if (input.status) {
    data.status = input.status;
    if (input.status === ComplianceRemediationStatuses.completed) {
      data.completedAt = new Date();
    }
  }
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.ownerUserId !== undefined) {
    data.owner = input.ownerUserId
      ? { connect: { id: input.ownerUserId } }
      : { disconnect: true };
  }
  const remediation = await prisma.complianceRemediation.update({
    where: { id },
    data,
  });

  if (input.status === ComplianceRemediationStatuses.completed) {
    await prisma.complianceViolation.update({
      where: { id: remediation.violationId },
      data: {
        status: ComplianceViolationStatuses.remediated,
        remediatedAt: new Date(),
      },
    });
  }

  return remediation;
}
