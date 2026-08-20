import {
  GovernanceAssessmentStatuses,
  GovernanceFrameworkList,
  GovernancePolicyStatuses,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import {
  GovernanceControlCatalog,
  GovernanceFrameworkCatalog,
  buildExecutiveSummary,
  defaultControlSignals,
  evaluateControlCatalog,
  listControlsForFramework,
  runAssessmentWorkflow,
} from "./governance.controls.js";
import {
  aggregateRiskPortfolio,
  assertOwnershipValid,
  calculateResidualRiskScore,
  riskBand,
  validateOwnership,
} from "./governance.risk.js";

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

async function memberOwnerIds(organizationId: string): Promise<Set<string>> {
  const members = await prisma.membership.findMany({
    where: { organizationId, status: "active" },
    select: { userId: true },
  });
  return new Set(members.map((m) => m.userId));
}

async function assertOwnerAllowed(organizationId: string, ownerUserId?: string | null) {
  if (!ownerUserId) return;
  const allowed = await memberOwnerIds(organizationId);
  assertOwnershipValid(validateOwnership({ ownerUserId, allowedOwnerIds: allowed }));
}

function toPublicPolicy(row: {
  id: string;
  organizationId: string;
  framework: string;
  key: string;
  title: string;
  description: string | null;
  status: string;
  ownerUserId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    framework: row.framework,
    key: row.key,
    title: row.title,
    description: row.description,
    status: row.status,
    ownerUserId: row.ownerUserId,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicRisk(row: {
  id: string;
  organizationId: string;
  key: string;
  title: string;
  description: string | null;
  category: string;
  framework: string | null;
  likelihood: number;
  impact: number;
  residualLikelihood: number;
  residualImpact: number;
  inherentScore: number;
  residualScore: number;
  status: string;
  ownerUserId: string | null;
  controlKeysJson: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    key: row.key,
    title: row.title,
    description: row.description,
    category: row.category,
    framework: row.framework,
    likelihood: row.likelihood,
    impact: row.impact,
    residualLikelihood: row.residualLikelihood,
    residualImpact: row.residualImpact,
    inherentScore: row.inherentScore,
    residualScore: row.residualScore,
    band: riskBand(row.residualScore),
    status: row.status,
    ownerUserId: row.ownerUserId,
    controlKeys: asStringArray(row.controlKeysJson),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function deriveSignals(input: {
  activePolicies: number;
  openRisks: number;
  assessmentsPassed: number;
}): ReturnType<typeof defaultControlSignals> {
  const signals = defaultControlSignals();
  signals.accessReviewsComplete = input.activePolicies > 0 ? 1 : 0;
  signals.changeApprovalsEnforced = input.activePolicies > 0 ? 1 : 0;
  signals.riskRegisterPresent = input.openRisks >= 0 && input.activePolicies >= 0 ? 1 : 0;
  if (input.openRisks > 0 || input.activePolicies > 0) signals.riskRegisterPresent = 1;
  signals.assetInventoryCoverage = input.activePolicies > 0 ? 0.8 : 0.3;
  signals.lawfulBasisDocumented = input.activePolicies > 0 ? 1 : 0;
  signals.dsarProcessPresent = input.activePolicies > 0 ? 1 : 0;
  signals.phiAccessLogging = input.assessmentsPassed > 0 ? 1 : 0;
  signals.nistIdentifyMaturity = input.activePolicies > 0 ? 0.7 : 0.2;
  signals.nistProtectMaturity = input.assessmentsPassed > 0 ? 0.7 : 0.2;
  signals.cardDataEncrypted = input.assessmentsPassed > 0 ? 1 : 0;
  signals.networkSegmented = input.activePolicies > 1 ? 1 : 0;
  return signals;
}

export async function getGovernanceDashboard(organizationId: string) {
  const [policies, risks, assessments, latestReport] = await Promise.all([
    prisma.governancePolicy.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.governanceRisk.findMany({
      where: { organizationId },
      orderBy: [{ residualScore: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.governanceControlAssessment.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.governanceExecutiveReport.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activePolicies = policies.filter((p) => p.status === GovernancePolicyStatuses.active);
  const frameworksCovered = new Set(
    [...activePolicies.map((p) => p.framework), ...risks.map((r) => r.framework).filter(Boolean)],
  );
  const portfolio = aggregateRiskPortfolio(risks);
  const signals = deriveSignals({
    activePolicies: activePolicies.length,
    openRisks: portfolio.openCount,
    assessmentsPassed: assessments.filter((a) => a.status === GovernanceAssessmentStatuses.passed)
      .length,
  });
  const controlEval = evaluateControlCatalog({ signals });

  return {
    organizationId,
    frameworks: GovernanceFrameworkCatalog.map((f) => ({
      ...f,
      enabled: frameworksCovered.has(f.id) || activePolicies.some((p) => p.framework === f.id),
      controlCount: listControlsForFramework(f.id).length,
    })),
    policies: policies.map(toPublicPolicy),
    risks: risks.map(toPublicRisk),
    assessments: assessments.map((a) => ({
      id: a.id,
      framework: a.framework,
      controlKey: a.controlKey,
      controlTitle: a.controlTitle,
      status: a.status,
      score: a.score,
      assessedAt: a.assessedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    controlLibrary: {
      total: GovernanceControlCatalog.length,
      coverageScore: controlEval.coverageScore,
      passed: controlEval.passed,
      failed: controlEval.failed,
      evaluations: controlEval.evaluations,
    },
    riskPortfolio: portfolio,
    executive: {
      latestScore: latestReport?.score ?? null,
      summary: buildExecutiveSummary({
        frameworksCovered: frameworksCovered.size,
        frameworksTotal: GovernanceFrameworkList.length,
        activePolicies: activePolicies.length,
        riskPortfolioScore: portfolio.portfolioScore,
        controlCoverageScore: controlEval.coverageScore,
        openCriticalRisks: portfolio.criticalCount,
        assessmentsPassed: assessments.filter(
          (a) => a.status === GovernanceAssessmentStatuses.passed,
        ).length,
        assessmentsTotal: assessments.length,
      }),
    },
  };
}

export async function createPolicy(input: {
  organizationId: string;
  framework: string;
  key: string;
  title: string;
  description?: string;
  status?: string;
  ownerUserId?: string | null;
  createdById?: string | null;
}) {
  await assertOwnerAllowed(input.organizationId, input.ownerUserId);
  try {
    const row = await prisma.governancePolicy.create({
      data: {
        organizationId: input.organizationId,
        framework: input.framework,
        key: input.key,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? GovernancePolicyStatuses.draft,
        ownerUserId: input.ownerUserId ?? null,
        createdById: input.createdById ?? null,
      },
    });
    return { policy: toPublicPolicy(row) };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw new AppError(409, "CONFLICT", "Policy key already exists for organization");
    }
    throw err;
  }
}

export async function patchPolicy(
  id: string,
  input: {
    title?: string;
    description?: string | null;
    status?: string;
    ownerUserId?: string | null;
    framework?: string;
  },
) {
  const existing = await prisma.governancePolicy.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Policy not found");
  if (input.ownerUserId !== undefined) {
    await assertOwnerAllowed(existing.organizationId, input.ownerUserId);
  }

  const row = await prisma.governancePolicy.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
      ...(input.framework !== undefined ? { framework: input.framework } : {}),
      version: { increment: 1 },
    },
  });
  return { policy: toPublicPolicy(row) };
}

export async function listRisks(query: {
  organizationId: string;
  status?: string;
  framework?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.GovernanceRiskWhereInput = {
    organizationId: query.organizationId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.framework ? { framework: query.framework } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.governanceRisk.findMany({
      where,
      orderBy: [{ residualScore: "desc" }, { updatedAt: "desc" }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.governanceRisk.count({ where }),
  ]);
  return {
    risks: rows.map(toPublicRisk),
    total,
    limit: query.limit,
    offset: query.offset,
    portfolio: aggregateRiskPortfolio(rows),
  };
}

export async function createRisk(input: {
  organizationId: string;
  key: string;
  title: string;
  description?: string;
  category: string;
  framework?: string | null;
  likelihood: number;
  impact: number;
  residualLikelihood?: number;
  residualImpact?: number;
  mitigationEffectiveness?: number;
  status?: string;
  ownerUserId?: string | null;
  controlKeys?: string[];
  createdById?: string | null;
}) {
  await assertOwnerAllowed(input.organizationId, input.ownerUserId);
  const scored = calculateResidualRiskScore({
    likelihood: input.likelihood,
    impact: input.impact,
    residualLikelihood: input.residualLikelihood,
    residualImpact: input.residualImpact,
    mitigationEffectiveness: input.mitigationEffectiveness,
  });

  try {
    const row = await prisma.governanceRisk.create({
      data: {
        organizationId: input.organizationId,
        key: input.key,
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        framework: input.framework ?? null,
        likelihood: input.likelihood,
        impact: input.impact,
        residualLikelihood: scored.residualLikelihood,
        residualImpact: scored.residualImpact,
        inherentScore: scored.inherentScore,
        residualScore: scored.residualScore,
        status: input.status ?? "open",
        ownerUserId: input.ownerUserId ?? null,
        controlKeysJson: input.controlKeys ?? [],
        createdById: input.createdById ?? null,
      },
    });

    // Run assessment workflow for linked controls
    const assessments = [];
    for (const key of input.controlKeys ?? []) {
      const control = GovernanceControlCatalog.find((c) => c.key === key);
      if (!control) continue;
      const signals = deriveSignals({
        activePolicies: 1,
        openRisks: 1,
        assessmentsPassed: 0,
      });
      const workflow = runAssessmentWorkflow({ control, signals });
      const assessment = await prisma.governanceControlAssessment.create({
        data: {
          organizationId: input.organizationId,
          framework: control.framework,
          controlKey: control.key,
          controlTitle: control.title,
          status: workflow.status,
          score: workflow.score,
          findingsJson: {
            ...workflow.findings,
            steps: workflow.steps,
            riskKey: input.key,
          } as unknown as Prisma.InputJsonValue,
          assessorUserId: input.createdById ?? null,
          assessedAt: new Date(),
        },
      });
      assessments.push({
        id: assessment.id,
        controlKey: assessment.controlKey,
        status: assessment.status,
        score: assessment.score,
      });
    }

    return { risk: toPublicRisk(row), assessments };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw new AppError(409, "CONFLICT", "Risk key already exists for organization");
    }
    throw err;
  }
}

export async function patchRisk(
  id: string,
  input: {
    title?: string;
    description?: string | null;
    category?: string;
    framework?: string | null;
    likelihood?: number;
    impact?: number;
    residualLikelihood?: number;
    residualImpact?: number;
    mitigationEffectiveness?: number;
    status?: string;
    ownerUserId?: string | null;
    controlKeys?: string[];
  },
) {
  const existing = await prisma.governanceRisk.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Risk not found");
  if (input.ownerUserId !== undefined) {
    await assertOwnerAllowed(existing.organizationId, input.ownerUserId);
  }

  const scoreTouched =
    input.likelihood !== undefined ||
    input.impact !== undefined ||
    input.residualLikelihood !== undefined ||
    input.residualImpact !== undefined ||
    input.mitigationEffectiveness !== undefined;

  const likelihood = input.likelihood ?? existing.likelihood;
  const impact = input.impact ?? existing.impact;
  const scored = scoreTouched
    ? calculateResidualRiskScore({
        likelihood,
        impact,
        residualLikelihood:
          input.residualLikelihood ??
          (input.mitigationEffectiveness != null ? undefined : existing.residualLikelihood),
        residualImpact:
          input.residualImpact ??
          (input.mitigationEffectiveness != null ? undefined : existing.residualImpact),
        mitigationEffectiveness: input.mitigationEffectiveness,
      })
    : {
        inherentScore: existing.inherentScore,
        residualLikelihood: existing.residualLikelihood,
        residualImpact: existing.residualImpact,
        residualScore: existing.residualScore,
      };

  const row = await prisma.governanceRisk.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.framework !== undefined ? { framework: input.framework } : {}),
      ...(scoreTouched
        ? {
            likelihood,
            impact,
            residualLikelihood: scored.residualLikelihood,
            residualImpact: scored.residualImpact,
            inherentScore: scored.inherentScore,
            residualScore: scored.residualScore,
          }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
      ...(input.controlKeys !== undefined ? { controlKeysJson: input.controlKeys } : {}),
    },
  });
  return { risk: toPublicRisk(row) };
}

export async function listGovernanceReports(query: {
  organizationId: string;
  limit: number;
  offset: number;
}) {
  const dashboard = await getGovernanceDashboard(query.organizationId);
  const summary = dashboard.executive.summary;

  const created = await prisma.governanceExecutiveReport.create({
    data: {
      organizationId: query.organizationId,
      score: summary.score,
      summaryJson: {
        grade: summary.grade,
        highlights: summary.highlights,
        frameworks: dashboard.frameworks,
        riskPortfolio: dashboard.riskPortfolio,
        controlLibrary: {
          coverageScore: dashboard.controlLibrary.coverageScore,
          passed: dashboard.controlLibrary.passed,
          failed: dashboard.controlLibrary.failed,
        },
        activePolicies: dashboard.policies.filter(
          (p) => p.status === GovernancePolicyStatuses.active,
        ).length,
        generatedAt: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue,
    },
  });

  const [rows, total] = await Promise.all([
    prisma.governanceExecutiveReport.findMany({
      where: { organizationId: query.organizationId },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.governanceExecutiveReport.count({
      where: { organizationId: query.organizationId },
    }),
  ]);

  return {
    reports: rows.map((r) => ({
      id: r.id,
      score: r.score,
      summary: r.summaryJson,
      createdAt: r.createdAt.toISOString(),
    })),
    latest: {
      id: created.id,
      score: created.score,
      summary: created.summaryJson,
      createdAt: created.createdAt.toISOString(),
    },
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getPolicyOrganizationId(id: string): Promise<string | null> {
  const row = await prisma.governancePolicy.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  return row?.organizationId ?? null;
}

export async function getRiskOrganizationId(id: string): Promise<string | null> {
  const row = await prisma.governanceRisk.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  return row?.organizationId ?? null;
}
