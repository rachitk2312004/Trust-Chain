import { createHash } from "node:crypto";
import {
  BillingPlanKeys,
  OpsEntityStates,
  PlatformScoreDefaults,
  RoleKeys,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../../lib/errors.js";
import { userHasRole } from "../../auth/rbac.repository.js";
import { assertEvidenceImmutable, assertSafeOpsOperation } from "../utils/guards.js";
import { generateOpsPublicCode } from "../utils/ids.js";
import { computePlatformScores } from "../utils/scoring.js";

async function assertOpsAdmin(userId: string, organizationId?: string): Promise<void> {
  const allowed = organizationId
    ? await userHasRole(userId, [RoleKeys.superAdmin, RoleKeys.orgAdmin], organizationId)
    : await userHasRole(userId, [RoleKeys.superAdmin]);
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Ops admin role required");
  }
}

async function writeOpsAudit(input: {
  organizationId?: string;
  actorUserId: string;
  action: string;
  targetCode?: string;
  meta?: unknown;
}): Promise<void> {
  await prisma.opsAuditEvent.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.action,
      targetCode: input.targetCode,
      metaJson: (input.meta as Prisma.InputJsonValue) ?? undefined,
      success: true,
    },
  });
}

export async function createReport(
  userId: string,
  input: { organizationId?: string; kind: string; params?: Record<string, unknown> },
) {
  assertSafeOpsOperation("create_report");
  await assertOpsAdmin(userId, input.organizationId);
  const publicCode = generateOpsPublicCode("report");
  const summary = {
    kind: input.kind,
    generatedAt: new Date().toISOString(),
    totals: { documents: 0, verifications: 0, alerts: 0 },
    params: input.params ?? {},
  } as Prisma.InputJsonValue;
  const row = await prisma.opsReport.create({
    data: {
      publicCode,
      organizationId: input.organizationId,
      createdByUserId: userId,
      kind: input.kind,
      status: OpsEntityStates.active,
      paramsJson: (input.params as Prisma.InputJsonValue) ?? undefined,
      resultJson: summary,
      generatedAt: new Date(),
    },
  });
  await writeOpsAudit({
    organizationId: input.organizationId,
    actorUserId: userId,
    action: "ops.report.create",
    targetCode: publicCode,
  });
  await publishEvent(input.organizationId, "ops.report.created", { publicCode });
  return { report: serializeReport(row) };
}

export async function getReport(userId: string, id: string) {
  const row = await prisma.opsReport.findFirst({
    where: { OR: [{ publicCode: id }, { id }] },
  });
  if (!row) throw new AppError(404, "OPS_REPORT_NOT_FOUND", "Report not found");
  await assertOpsAdmin(userId, row.organizationId ?? undefined);
  return { report: serializeReport(row) };
}

export async function createAlert(
  userId: string,
  input: {
    organizationId?: string;
    title: string;
    severity?: string;
    source?: string;
    payload?: Record<string, unknown>;
  },
) {
  assertSafeOpsOperation("create_alert");
  await assertOpsAdmin(userId, input.organizationId);
  const publicCode = generateOpsPublicCode("alert");
  const row = await prisma.opsAlert.create({
    data: {
      publicCode,
      organizationId: input.organizationId,
      createdByUserId: userId,
      title: input.title,
      severity: input.severity ?? "info",
      source: input.source ?? "manual",
      status: OpsEntityStates.pending,
      payloadJson: (input.payload as Prisma.InputJsonValue) ?? undefined,
    },
  });
  await writeOpsAudit({
    organizationId: input.organizationId,
    actorUserId: userId,
    action: "ops.alert.create",
    targetCode: publicCode,
  });
  await publishEvent(input.organizationId, "ops.alert.created", { publicCode });
  return { alert: serializeAlert(row) };
}

export async function listAlerts(userId: string, organizationId?: string) {
  await assertOpsAdmin(userId, organizationId);
  const rows = await prisma.opsAlert.findMany({
    where: organizationId ? { organizationId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return { alerts: rows.map(serializeAlert) };
}

export async function createInvestigation(
  userId: string,
  input: {
    organizationId: string;
    title: string;
    subjectDocumentId?: string;
    lineagePublicCode?: string;
  },
) {
  assertSafeOpsOperation("create_investigation");
  await assertOpsAdmin(userId, input.organizationId);
  const publicCode = generateOpsPublicCode("case");
  const timeline = [{ at: new Date().toISOString(), event: "case_opened", by: userId }];
  const row = await prisma.investigation.create({
    data: {
      publicCode,
      organizationId: input.organizationId,
      createdByUserId: userId,
      title: input.title,
      status: OpsEntityStates.pending,
      subjectDocumentId: input.subjectDocumentId,
      lineagePublicCode: input.lineagePublicCode,
      timelineJson: timeline,
    },
  });
  await writeOpsAudit({
    organizationId: input.organizationId,
    actorUserId: userId,
    action: "ops.investigation.create",
    targetCode: publicCode,
  });
  return { investigation: serializeInvestigation(row) };
}

export async function getInvestigation(userId: string, id: string) {
  const row = await prisma.investigation.findFirst({
    where: { OR: [{ publicCode: id }, { id }] },
    include: { evidence: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) throw new AppError(404, "OPS_CASE_NOT_FOUND", "Investigation not found");
  await assertOpsAdmin(userId, row.organizationId);
  return {
    investigation: serializeInvestigation(row),
    evidence: row.evidence.map((e) => ({
      id: e.id,
      sourceType: e.sourceType,
      contentHash: e.contentHash,
      immutable: e.immutable,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export async function appendEvidence(
  userId: string,
  caseId: string,
  input: {
    sourceType: string;
    contentHash: string;
    meta?: Record<string, unknown>;
    objectKey?: string;
  },
) {
  assertSafeOpsOperation("append_evidence");
  const investigation = await prisma.investigation.findFirst({
    where: { OR: [{ publicCode: caseId }, { id: caseId }] },
  });
  if (!investigation) throw new AppError(404, "OPS_CASE_NOT_FOUND", "Investigation not found");
  await assertOpsAdmin(userId, investigation.organizationId);
  const evidence = await prisma.evidence.create({
    data: {
      investigationId: investigation.id,
      organizationId: investigation.organizationId,
      sourceType: input.sourceType,
      contentHash: input.contentHash,
      immutable: true,
      metaJson: (input.meta as Prisma.InputJsonValue) ?? undefined,
      objectKey: input.objectKey,
    },
  });
  const timeline = Array.isArray(investigation.timelineJson)
    ? [...(investigation.timelineJson as unknown[])]
    : [];
  timeline.push({
    at: new Date().toISOString(),
    event: "evidence_appended",
    contentHash: input.contentHash,
  });
  await prisma.investigation.update({
    where: { id: investigation.id },
    data: {
      status: OpsEntityStates.active,
      timelineJson: timeline as Prisma.InputJsonValue,
    },
  });
  await writeOpsAudit({
    organizationId: investigation.organizationId,
    actorUserId: userId,
    action: "ops.evidence.append",
    targetCode: investigation.publicCode,
  });
  return {
    evidence: {
      id: evidence.id,
      contentHash: evidence.contentHash,
      immutable: true,
    },
  };
}

/** Evidence is append-only — updates are rejected. */
export function updateEvidence(_id: string): never {
  return assertEvidenceImmutable();
}

export async function createSubscription(
  userId: string,
  input: { organizationId: string; planKey: string; quota?: Record<string, unknown> },
) {
  assertSafeOpsOperation("create_subscription");
  await assertOpsAdmin(userId, input.organizationId);
  if (!(Object.values(BillingPlanKeys) as string[]).includes(input.planKey)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid plan key");
  }
  const row = await prisma.subscription.create({
    data: {
      organizationId: input.organizationId,
      planKey: input.planKey,
      status: OpsEntityStates.pending,
      autonomous: false,
      quotaJson: (input.quota as Prisma.InputJsonValue) ?? { documents: 1000, verifications: 5000 },
      periodStart: new Date(),
    },
  });
  await writeOpsAudit({
    organizationId: input.organizationId,
    actorUserId: userId,
    action: "ops.subscription.create",
    targetCode: row.id,
    meta: { autonomous: false, note: "Requires human activation; no autonomous billing" },
  });
  return {
    subscription: {
      id: row.id,
      planKey: row.planKey,
      status: row.status,
      autonomous: false,
    },
  };
}

export async function listInvoices(userId: string, organizationId?: string) {
  await assertOpsAdmin(userId, organizationId);
  const rows = await prisma.invoice.findMany({
    where: organizationId ? { organizationId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return {
    invoices: rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      status: r.status,
      currency: r.currency,
      amountCents: r.amountCents,
      settledAt: r.settledAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function createFeature(
  userId: string,
  input: {
    organizationId?: string | null;
    key: string;
    status?: string;
    rolloutPercent?: number;
    killSwitch?: boolean;
    targeting?: Record<string, unknown>;
    experiments?: Record<string, unknown>;
  },
) {
  assertSafeOpsOperation("create_feature");
  await assertOpsAdmin(userId, input.organizationId ?? undefined);
  const publicCode = generateOpsPublicCode("feature");
  const status =
    input.killSwitch === true
      ? OpsEntityStates.suspended
      : (input.status ?? OpsEntityStates.inactive);
  const row = await prisma.featureFlag.create({
    data: {
      publicCode,
      organizationId: input.organizationId ?? undefined,
      key: input.key,
      status,
      rolloutPercent: input.rolloutPercent ?? 0,
      killSwitch: input.killSwitch ?? false,
      targetingJson: (input.targeting as Prisma.InputJsonValue) ?? undefined,
      experimentsJson: (input.experiments as Prisma.InputJsonValue) ?? undefined,
    },
  });
  await writeOpsAudit({
    organizationId: input.organizationId ?? undefined,
    actorUserId: userId,
    action: "ops.feature.create",
    targetCode: publicCode,
  });
  return { feature: serializeFeature(row) };
}

export async function listFeatures(userId: string, organizationId?: string) {
  await assertOpsAdmin(userId, organizationId);
  const rows = await prisma.featureFlag.findMany({
    where: organizationId ? { OR: [{ organizationId }, { organizationId: null }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return { features: rows.map(serializeFeature) };
}

export async function createComplianceEvent(
  userId: string,
  input: {
    organizationId?: string;
    framework: string;
    action: string;
    success?: boolean;
    meta?: Record<string, unknown>;
  },
) {
  assertSafeOpsOperation("create_compliance_event");
  await assertOpsAdmin(userId, input.organizationId);
  const row = await prisma.complianceEvent.create({
    data: {
      organizationId: input.organizationId,
      framework: input.framework,
      action: input.action,
      actorUserId: userId,
      success: input.success ?? true,
      metaJson: (input.meta as Prisma.InputJsonValue) ?? undefined,
    },
  });
  await writeOpsAudit({
    organizationId: input.organizationId,
    actorUserId: userId,
    action: "ops.compliance.create",
    targetCode: row.id,
  });
  return {
    event: {
      id: row.id,
      framework: row.framework,
      action: row.action,
      success: row.success,
      createdAt: row.createdAt.toISOString(),
    },
  };
}

export async function listComplianceEvents(userId: string, organizationId?: string) {
  await assertOpsAdmin(userId, organizationId);
  const rows = await prisma.complianceEvent.findMany({
    where: organizationId ? { organizationId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return {
    events: rows.map((r) => ({
      id: r.id,
      framework: r.framework,
      action: r.action,
      success: r.success,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function createPolicy(
  userId: string,
  input: { organizationId?: string; name: string; definition: Record<string, unknown> },
) {
  assertSafeOpsOperation("create_policy");
  await assertOpsAdmin(userId, input.organizationId);
  const publicCode = generateOpsPublicCode("policy");
  const row = await prisma.opsPolicy.create({
    data: {
      publicCode,
      organizationId: input.organizationId,
      createdByUserId: userId,
      name: input.name,
      status: OpsEntityStates.pending,
      definitionJson: input.definition as Prisma.InputJsonValue,
      autoEnforce: false,
    },
  });
  await writeOpsAudit({
    organizationId: input.organizationId,
    actorUserId: userId,
    action: "ops.policy.create",
    targetCode: publicCode,
  });
  return {
    policy: {
      publicCode: row.publicCode,
      name: row.name,
      status: row.status,
      autoEnforce: false,
    },
  };
}

export async function approvePolicy(userId: string, policyId: string, notes?: string) {
  assertSafeOpsOperation("approve_policy");
  const policy = await prisma.opsPolicy.findFirst({
    where: { OR: [{ publicCode: policyId }, { id: policyId }] },
  });
  if (!policy) throw new AppError(404, "OPS_POLICY_NOT_FOUND", "Policy not found");
  await assertOpsAdmin(userId, policy.organizationId ?? undefined);
  await prisma.policyApproval.create({
    data: {
      policyId: policy.id,
      actorId: userId,
      decision: "approved",
      notes,
    },
  });
  const updated = await prisma.opsPolicy.update({
    where: { id: policy.id },
    data: { status: OpsEntityStates.active, autoEnforce: false },
  });
  await writeOpsAudit({
    organizationId: policy.organizationId ?? undefined,
    actorUserId: userId,
    action: "ops.policy.approve",
    targetCode: policy.publicCode,
  });
  return {
    policy: {
      publicCode: updated.publicCode,
      status: updated.status,
      autoEnforce: false,
      note: "Activation is metadata-only; automatic enforcement is disabled",
    },
  };
}

export async function getAnalyticsSummary(userId: string, organizationId?: string) {
  await assertOpsAdmin(userId, organizationId);
  const orgFilter = organizationId ? { organizationId } : {};
  const [documents, verifications, aiJobs, alerts, fraudJobs] = await Promise.all([
    organizationId
      ? prisma.document.count({ where: { organizationId, deletedAt: null } })
      : prisma.document.count({ where: { deletedAt: null } }),
    prisma.verificationRequest.count({ where: orgFilter }),
    prisma.aiJob.count({ where: orgFilter }),
    prisma.opsAlert.count({ where: orgFilter }),
    prisma.fraudAnalysisJob.count({ where: orgFilter }),
  ]);
  return {
    analytics: {
      documents,
      verifications,
      aiJobs,
      fraudJobs,
      alerts,
      mobile: 0,
      extension: 0,
      note: "Mobile/extension server metrics reserved; clients may push later",
    },
  };
}

export async function getHealth(userId: string, organizationId?: string) {
  await assertOpsAdmin(userId, organizationId);
  const checks = {
    api: "ok",
    database: "ok",
    r2: "unknown",
    aiService: "optional",
    blockchain: "read_only_monitoring",
  };
  const snapshot = await prisma.healthSnapshot.create({
    data: {
      organizationId,
      status: OpsEntityStates.active,
      checksJson: checks,
    },
  });
  const scores = computePlatformScores({
    trustScore: PlatformScoreDefaults.trustScore,
    healthScore: 0.92,
    riskScore: 0.18,
    complianceScore: PlatformScoreDefaults.complianceScore,
  });
  await prisma.platformScore.create({
    data: {
      organizationId,
      ...scores,
      componentsJson: checks,
    },
  });
  return {
    health: {
      id: snapshot.id,
      status: snapshot.status,
      checks,
      createdAt: snapshot.createdAt.toISOString(),
    },
    scores,
  };
}

export async function createDeployment(
  userId: string,
  input: {
    organizationId?: string;
    environment: string;
    meta?: Record<string, unknown>;
  },
) {
  assertSafeOpsOperation("create_deployment");
  await assertOpsAdmin(userId, input.organizationId);
  const releaseCode = generateOpsPublicCode("release");
  const publicCode = generateOpsPublicCode("deployment");
  const row = await prisma.deploymentRecord.create({
    data: {
      releaseCode,
      publicCode,
      organizationId: input.organizationId,
      createdByUserId: userId,
      environment: input.environment,
      status: OpsEntityStates.pending,
      approved: false,
      rollbackPlanJson: { steps: ["redeploy_previous_release"], automatic: false },
      metaJson: (input.meta as Prisma.InputJsonValue) ?? undefined,
    },
  });
  await writeOpsAudit({
    organizationId: input.organizationId,
    actorUserId: userId,
    action: "ops.deployment.create",
    targetCode: publicCode,
  });
  return {
    deployment: {
      releaseCode: row.releaseCode,
      publicCode: row.publicCode,
      environment: row.environment,
      status: row.status,
      approved: false,
    },
  };
}

export async function createRecoveryBackup(userId: string, organizationId?: string) {
  assertSafeOpsOperation("create_recovery_backup");
  await assertOpsAdmin(userId, organizationId);
  const checksum = createHash("sha256").update(`backup:${Date.now()}`).digest("hex");
  const row = await prisma.recoveryBackup.create({
    data: {
      organizationId,
      kind: "snapshot",
      status: OpsEntityStates.pending,
      locationRef: `backup://pending/${checksum.slice(0, 12)}`,
      checksum,
      validated: false,
      metaJson: { automaticRestore: false },
    },
  });
  return {
    backup: {
      id: row.id,
      status: row.status,
      checksum: row.checksum,
      validated: false,
      automaticRestore: false,
    },
  };
}

export async function recordCapacity(
  userId: string,
  organizationId: string | undefined,
  input: { storageBytes?: number; computeUnits?: number; networkBytes?: number },
) {
  await assertOpsAdmin(userId, organizationId);
  const storage = input.storageBytes ?? 0;
  const compute = input.computeUnits ?? 0;
  const network = input.networkBytes ?? 0;
  const forecast = {
    storageBytes: storage * 1.1,
    computeUnits: compute * 1.05,
    networkBytes: network * 1.15,
    horizonDays: 30,
  };
  const row = await prisma.capacitySnapshot.create({
    data: {
      organizationId,
      storageBytes: storage,
      computeUnits: compute,
      networkBytes: network,
      forecastJson: forecast,
    },
  });
  return {
    capacity: {
      id: row.id,
      storageBytes: row.storageBytes,
      computeUnits: row.computeUnits,
      networkBytes: row.networkBytes,
      forecast,
    },
  };
}

async function publishEvent(
  organizationId: string | undefined,
  topic: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const retainedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.platformEvent.create({
    data: {
      organizationId,
      topic,
      payloadJson: payload as Prisma.InputJsonValue,
      retainedUntil,
    },
  });
}

function serializeReport(row: {
  publicCode: string;
  kind: string;
  status: string;
  resultJson: unknown;
  generatedAt: Date | null;
  createdAt: Date;
}) {
  return {
    publicCode: row.publicCode,
    kind: row.kind,
    status: row.status,
    result: row.resultJson,
    generatedAt: row.generatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeAlert(row: {
  publicCode: string;
  title: string;
  severity: string;
  source: string;
  status: string;
  createdAt: Date;
}) {
  return {
    publicCode: row.publicCode,
    title: row.title,
    severity: row.severity,
    source: row.source,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeInvestigation(row: {
  publicCode: string;
  title: string;
  status: string;
  organizationId: string;
  subjectDocumentId: string | null;
  lineagePublicCode: string | null;
  timelineJson: unknown;
  createdAt: Date;
}) {
  return {
    publicCode: row.publicCode,
    title: row.title,
    status: row.status,
    organizationId: row.organizationId,
    subjectDocumentId: row.subjectDocumentId,
    lineagePublicCode: row.lineagePublicCode,
    timeline: row.timelineJson,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeFeature(row: {
  publicCode: string;
  key: string;
  status: string;
  rolloutPercent: number;
  killSwitch: boolean;
  organizationId: string | null;
}) {
  return {
    publicCode: row.publicCode,
    key: row.key,
    status: row.status,
    rolloutPercent: row.rolloutPercent,
    killSwitch: row.killSwitch,
    organizationId: row.organizationId,
  };
}
