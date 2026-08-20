import { RoleKeys, type ComplianceFramework } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import {
  calculateComplianceScore,
  executeRules,
  listFrameworks,
  mapRuleToFrameworks,
  type ComplianceSignals,
} from "./compliance.engine.js";
import { buildComplianceReport, buildDashboardSummary } from "./compliance.reporting.js";
import * as repo from "./compliance.repository.js";

async function assertComplianceAdmin(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function getComplianceDashboard(actorId: string, organizationId: string) {
  await assertComplianceAdmin(actorId, organizationId);
  const data = await repo.getDashboardData(organizationId);
  return {
    organizationId,
    frameworks: listFrameworks(),
    ...buildDashboardSummary({
      assessments: data.assessments.map((a) => ({
        id: a.id,
        framework: a.framework,
        score: a.score,
        status: a.status,
        finishedAt: a.finishedAt,
      })),
      openViolations: data.openViolations,
      openRemediations: data.openRemediations,
      latestByFramework: data.latestByFramework,
    }),
    violations: data.violations,
  };
}

export async function listComplianceAssessments(
  actorId: string,
  query: { organizationId: string; framework?: string; limit: number; offset: number },
) {
  await assertComplianceAdmin(actorId, query.organizationId);
  return repo.listAssessments(query);
}

export async function getComplianceAssessment(actorId: string, id: string) {
  const row = await repo.getAssessment(id);
  if (!row) throw new AppError(404, "NOT_FOUND", "Compliance assessment not found");
  await assertComplianceAdmin(actorId, row.organizationId);
  return {
    assessment: repo.toPublicAssessment(row),
    ruleResults: row.ruleResults.map((r) => ({
      id: r.id,
      ruleKey: r.ruleKey,
      framework: r.framework,
      title: r.title,
      severity: r.severity,
      passed: r.passed,
      score: r.score,
      evidence: r.evidenceJson,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
    violations: row.violations.map((v) => ({
      id: v.id,
      ruleKey: v.ruleKey,
      title: v.title,
      severity: v.severity,
      status: v.status,
      detectedAt: v.detectedAt.toISOString(),
      remediations: v.remediations.map((rem) => ({
        id: rem.id,
        title: rem.title,
        status: rem.status,
        dueAt: rem.dueAt?.toISOString() ?? null,
        notes: rem.notes,
      })),
    })),
    reports: row.reports.map((r) => ({
      id: r.id,
      title: r.title,
      score: r.score,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function runComplianceAssessment(
  actorId: string,
  body: {
    organizationId: string;
    framework: ComplianceFramework;
    scheduled?: boolean;
    signals?: Record<string, number>;
  },
) {
  await assertComplianceAdmin(actorId, body.organizationId);
  const assessment = await repo.createAssessment({
    organizationId: body.organizationId,
    framework: body.framework,
    triggeredById: actorId,
    scheduled: body.scheduled ?? false,
  });

  try {
    const overrides = body.signals as Partial<ComplianceSignals> | undefined;
    const signals = await repo.gatherComplianceSignals(body.organizationId, overrides);
    const results = executeRules(body.framework, signals);
    const score = calculateComplianceScore(results);
    const completed = await repo.completeAssessment(assessment.id, {
      score: score.score,
      passedRules: score.passedRules,
      failedRules: score.failedRules,
      totalRules: score.totalRules,
      summary: { grade: score.grade, signals },
      results,
    });

    const failures = results.filter((r) => !r.passed);
    await repo.createViolationsAndRemediations({
      organizationId: body.organizationId,
      assessmentId: assessment.id,
      framework: body.framework,
      failures,
    });

    const reportPayload = buildComplianceReport({
      organizationId: body.organizationId,
      framework: body.framework,
      assessmentId: assessment.id,
      score,
      results,
    });
    const report = await repo.createReport({
      organizationId: body.organizationId,
      assessmentId: assessment.id,
      framework: body.framework,
      title: `${reportPayload.frameworkName} compliance report`,
      score: score.score,
      report: reportPayload,
    });

    return {
      assessment: repo.toPublicAssessment(completed),
      score,
      results,
      report: {
        id: report.id,
        title: report.title,
        score: report.score,
        createdAt: report.createdAt.toISOString(),
      },
      frameworksMapped: failures.flatMap((f) => mapRuleToFrameworks(f.ruleKey)),
    };
  } catch (error) {
    await repo.failAssessment(
      assessment.id,
      error instanceof Error ? error.message : "Compliance run failed",
    );
    throw error;
  }
}

export async function listComplianceReports(
  actorId: string,
  query: { organizationId: string; framework?: string; limit: number; offset: number },
) {
  await assertComplianceAdmin(actorId, query.organizationId);
  return repo.listReports(query);
}

export async function getComplianceFrameworks(actorId: string, organizationId?: string) {
  if (organizationId) {
    await assertComplianceAdmin(actorId, organizationId);
  } else {
    const ok = await userHasRole(actorId, [RoleKeys.superAdmin, RoleKeys.orgAdmin]);
    if (!ok) throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
  return { frameworks: listFrameworks() };
}

export async function patchRemediation(
  actorId: string,
  remediationId: string,
  body: { status?: string; notes?: string; ownerUserId?: string | null },
) {
  const { prisma } = await import("@trustchain/database");
  const existing = await prisma.complianceRemediation.findUnique({
    where: { id: remediationId },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Remediation not found");
  await assertComplianceAdmin(actorId, existing.organizationId);
  const updated = await repo.updateRemediation(remediationId, body);
  return {
    remediation: {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      notes: updated.notes,
      ownerUserId: updated.ownerUserId,
      dueAt: updated.dueAt?.toISOString() ?? null,
      completedAt: updated.completedAt?.toISOString() ?? null,
    },
  };
}
