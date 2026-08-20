import {
  SignatureApprovalWorkflowStatuses,
  SignatureEventTypes,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";

export type SignatureRetentionPolicy = {
  /** Old signature events older than this are deleted. */
  eventDays: number;
  /** Old approval events older than this are deleted. */
  approvalEventDays: number;
  /** Terminal workflows older than this are deleted. */
  workflowDays: number;
  /** Artifacts for revoked/expired signatures older than this. */
  artifactDays: number;
  /** Short-lived diagnostic events (verified/reprocessed/downloaded). */
  diagnosticEventDays: number;
};

export const DEFAULT_SIGNATURE_RETENTION_POLICY: SignatureRetentionPolicy = {
  eventDays: Number.parseInt(process.env.SIGNATURE_EVENT_RETENTION_DAYS ?? "365", 10) || 365,
  approvalEventDays:
    Number.parseInt(process.env.SIGNATURE_APPROVAL_EVENT_RETENTION_DAYS ?? "365", 10) || 365,
  workflowDays: Number.parseInt(process.env.SIGNATURE_WORKFLOW_RETENTION_DAYS ?? "180", 10) || 180,
  artifactDays: Number.parseInt(process.env.SIGNATURE_ARTIFACT_RETENTION_DAYS ?? "365", 10) || 365,
  diagnosticEventDays:
    Number.parseInt(process.env.SIGNATURE_DIAGNOSTIC_EVENT_DAYS ?? "30", 10) || 30,
};

export type SignatureRetentionResult = {
  deletedEvents: number;
  deletedApprovalEvents: number;
  deletedWorkflows: number;
  deletedArtifacts: number;
  deletedDiagnosticEvents: number;
  cutoffs: {
    events: string;
    approvalEvents: string;
    workflows: string;
    artifacts: string;
    diagnostics: string;
  };
  policy: SignatureRetentionPolicy;
};

export function retentionCutoff(days: number, now = new Date()): Date {
  const ms = Math.max(1, days) * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms);
}

const TERMINAL_WORKFLOWS = [
  SignatureApprovalWorkflowStatuses.approved,
  SignatureApprovalWorkflowStatuses.rejected,
  SignatureApprovalWorkflowStatuses.cancelled,
  SignatureApprovalWorkflowStatuses.expired,
] as const;

const DIAGNOSTIC_EVENT_TYPES = [
  SignatureEventTypes.verified,
  SignatureEventTypes.reprocessed,
  SignatureEventTypes.downloaded,
];

export async function previewSignatureRetention(
  organizationId: string,
  policy: SignatureRetentionPolicy = DEFAULT_SIGNATURE_RETENTION_POLICY,
  now = new Date(),
) {
  const eventCutoff = retentionCutoff(policy.eventDays, now);
  const approvalEventCutoff = retentionCutoff(policy.approvalEventDays, now);
  const workflowCutoff = retentionCutoff(policy.workflowDays, now);
  const artifactCutoff = retentionCutoff(policy.artifactDays, now);
  const diagnosticCutoff = retentionCutoff(policy.diagnosticEventDays, now);

  const [
    eventsEligible,
    approvalEventsEligible,
    workflowsEligible,
    artifactsEligible,
    diagnosticEligible,
  ] = await Promise.all([
    prisma.signatureEvent.count({
      where: { organizationId, createdAt: { lte: eventCutoff } },
    }),
    prisma.signatureApprovalEvent.count({
      where: { organizationId, createdAt: { lte: approvalEventCutoff } },
    }),
    prisma.signatureWorkflow.count({
      where: {
        organizationId,
        status: { in: [...TERMINAL_WORKFLOWS] },
        OR: [
          { completedAt: { lte: workflowCutoff } },
          { completedAt: null, createdAt: { lte: workflowCutoff } },
        ],
      },
    }),
    prisma.signatureArtifact.count({
      where: {
        organizationId,
        createdAt: { lte: artifactCutoff },
        signature: { status: { in: ["revoked", "expired"] } },
      },
    }),
    prisma.signatureEvent.count({
      where: {
        organizationId,
        eventType: { in: DIAGNOSTIC_EVENT_TYPES },
        createdAt: { lte: diagnosticCutoff },
      },
    }),
  ]);

  return {
    organizationId,
    eventsEligible,
    approvalEventsEligible,
    workflowsEligible,
    artifactsEligible,
    diagnosticEventsEligible: diagnosticEligible,
    policy,
    cutoffs: {
      events: eventCutoff.toISOString(),
      approvalEvents: approvalEventCutoff.toISOString(),
      workflows: workflowCutoff.toISOString(),
      artifacts: artifactCutoff.toISOString(),
      diagnostics: diagnosticCutoff.toISOString(),
    },
  };
}

/**
 * Cleans old signature events, approval events, terminal workflows, and stale artifacts.
 * Does not delete active signatures.
 */
export async function runSignatureRetentionCleanup(
  organizationId: string,
  policy: SignatureRetentionPolicy = DEFAULT_SIGNATURE_RETENTION_POLICY,
  now = new Date(),
): Promise<SignatureRetentionResult> {
  const eventCutoff = retentionCutoff(policy.eventDays, now);
  const approvalEventCutoff = retentionCutoff(policy.approvalEventDays, now);
  const workflowCutoff = retentionCutoff(policy.workflowDays, now);
  const artifactCutoff = retentionCutoff(policy.artifactDays, now);
  const diagnosticCutoff = retentionCutoff(policy.diagnosticEventDays, now);

  const deletedDiagnostics = await prisma.signatureEvent.deleteMany({
    where: {
      organizationId,
      eventType: { in: DIAGNOSTIC_EVENT_TYPES },
      createdAt: { lte: diagnosticCutoff },
    },
  });

  const deletedEvents = await prisma.signatureEvent.deleteMany({
    where: { organizationId, createdAt: { lte: eventCutoff } },
  });

  const deletedApprovalEvents = await prisma.signatureApprovalEvent.deleteMany({
    where: {
      organizationId,
      createdAt: { lte: approvalEventCutoff },
    },
  });

  const deletedArtifacts = await prisma.signatureArtifact.deleteMany({
    where: {
      organizationId,
      createdAt: { lte: artifactCutoff },
      signature: { status: { in: ["revoked", "expired"] } },
    },
  });

  const deletedWorkflows = await prisma.signatureWorkflow.deleteMany({
    where: {
      organizationId,
      status: { in: [...TERMINAL_WORKFLOWS] },
      OR: [
        { completedAt: { lte: workflowCutoff } },
        { completedAt: null, createdAt: { lte: workflowCutoff } },
      ],
    },
  });

  return {
    deletedEvents: deletedEvents.count,
    deletedApprovalEvents: deletedApprovalEvents.count,
    deletedWorkflows: deletedWorkflows.count,
    deletedArtifacts: deletedArtifacts.count,
    deletedDiagnosticEvents: deletedDiagnostics.count,
    cutoffs: {
      events: eventCutoff.toISOString(),
      approvalEvents: approvalEventCutoff.toISOString(),
      workflows: workflowCutoff.toISOString(),
      artifacts: artifactCutoff.toISOString(),
      diagnostics: diagnosticCutoff.toISOString(),
    },
    policy,
  };
}
