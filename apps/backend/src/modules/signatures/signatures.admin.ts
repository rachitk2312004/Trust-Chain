import { SignatureEventTypes, SignatureStatuses } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import {
  generateSignatureAnalytics,
  getAlgorithmAnalytics,
  getDetachedAnalytics,
  getVerificationAnalyticsSlice,
  getWorkflowAnalytics,
} from "./signatures.analytics.js";
import { signatureProcessMetrics } from "./signatures.observability.js";
import * as repo from "./signatures.repository.js";
import {
  DEFAULT_SIGNATURE_RETENTION_POLICY,
  previewSignatureRetention,
  runSignatureRetentionCleanup,
  type SignatureRetentionPolicy,
} from "./signatures.retention.js";
import { resolveEffectiveStatus, verifySignatureRecord } from "./signatures.verifier.js";
import { SignatureArtifactKinds } from "@trustchain/config";

function asMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function inspectSignature(organizationId: string, signatureId: string) {
  const row = await repo.findSignatureById(organizationId, signatureId);
  if (!row) throw new AppError(404, "SIGNATURE_NOT_FOUND", "Signature not found");
  const artifacts = await repo.listSignatureArtifacts(signatureId);
  const events = await repo.listSignatureEvents(signatureId, 50, 0);
  return {
    signature: repo.toPublicSignature({
      ...row,
      status: resolveEffectiveStatus(row.status, row.expiresAt),
    }),
    artifacts: artifacts.map(repo.toPublicArtifact),
    events: events.items.map(repo.toPublicEvent),
    diagnostics: {
      artifactKinds: artifacts.map((a) => a.kind),
      eventCount: events.total,
      process: signatureProcessMetrics.snapshot(),
    },
  };
}

export async function inspectWorkflow(organizationId: string, workflowId: string) {
  const { findWorkflowById, toPublicWorkflow, toPublicApproval, toPublicApprovalEvent } =
    await import("./signatures.approval.repository.js");
  const row = await findWorkflowById(organizationId, workflowId);
  if (!row) throw new AppError(404, "WORKFLOW_NOT_FOUND", "Approval workflow not found");
  return {
    workflow: toPublicWorkflow(row),
    approvals: row.approvals.map(toPublicApproval),
    events: row.events.map(toPublicApprovalEvent),
    diagnostics: {
      approvalCount: row.approvals.length,
      eventCount: row.events.length,
      process: signatureProcessMetrics.snapshot(),
    },
  };
}

export async function getSignatureOpsOverview(organizationId: string) {
  const [analytics, retention] = await Promise.all([
    generateSignatureAnalytics(organizationId),
    previewSignatureRetention(organizationId),
  ]);
  return {
    analytics,
    retention,
    process: signatureProcessMetrics.snapshot(),
  };
}

export async function reprocessSignatures(
  userId: string,
  organizationId: string,
  input?: { signatureIds?: string[]; limit?: number },
) {
  const take = Math.min(Math.max(input?.limit ?? 20, 1), 100);
  const rows = input?.signatureIds?.length
    ? await prisma.signature.findMany({
        where: { organizationId, id: { in: input.signatureIds } },
        take,
      })
    : await prisma.signature.findMany({
        where: {
          organizationId,
          status: { in: [SignatureStatuses.active, SignatureStatuses.pending] },
        },
        orderBy: { createdAt: "desc" },
        take,
      });

  const results: Array<{
    signatureId: string;
    publicId: string;
    verified: boolean;
    status: string;
    durationMs: number;
    error?: string;
  }> = [];

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    const started = Date.now();
    try {
      const artifacts = await repo.listSignatureArtifacts(row.id);
      const payloadArtifact = artifacts.find(
        (a) => a.kind === SignatureArtifactKinds.canonicalPayload,
      );
      let contentHash: string | null = null;
      if (payloadArtifact) {
        try {
          const parsed = JSON.parse(payloadArtifact.content) as { contentHash?: string | null };
          contentHash =
            typeof parsed.contentHash === "string" ? parsed.contentHash : parsed.contentHash ?? null;
        } catch {
          contentHash = null;
        }
      }

      const verification = verifySignatureRecord({
        publicId: row.publicId,
        organizationId: row.organizationId,
        signerId: row.signerId,
        documentId: row.documentId,
        certificateId: row.certificateId,
        algorithm: row.algorithm,
        publicKeyPem: row.publicKeyPem,
        signatureValue: row.signatureValue,
        payloadHash: row.payloadHash,
        integrityHash: row.integrityHash,
        signedAt: row.signedAt,
        expiresAt: row.expiresAt,
        metadata: asMetadata(row.metadataJson),
        status: row.status,
        contentHash,
      });

      const durationMs = Date.now() - started;
      signatureProcessMetrics.recordVerification(durationMs, verification.valid);

      if (
        verification.status === SignatureStatuses.expired &&
        row.status !== SignatureStatuses.expired
      ) {
        await repo.updateSignature(row.id, { status: SignatureStatuses.expired });
      }

      await repo.createSignatureEvent({
        signatureId: row.id,
        organizationId,
        eventType: SignatureEventTypes.reprocessed,
        actorId: userId,
        payloadJson: {
          valid: verification.valid,
          reasons: verification.reasons,
          durationMs,
          checks: verification.checks,
        },
      });

      if (verification.valid) succeeded += 1;
      else failed += 1;

      results.push({
        signatureId: row.id,
        publicId: row.publicId,
        verified: verification.valid,
        status: verification.status,
        durationMs,
      });
    } catch (error) {
      failed += 1;
      const durationMs = Date.now() - started;
      signatureProcessMetrics.recordVerification(durationMs, false);
      results.push({
        signatureId: row.id,
        publicId: row.publicId,
        verified: false,
        status: row.status,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    requested: input?.signatureIds?.length ?? take,
    processed: rows.length,
    succeeded,
    failed,
    results,
  };
}

export async function runSignatureAdminCleanup(
  organizationId: string,
  policy?: Partial<SignatureRetentionPolicy>,
) {
  const merged: SignatureRetentionPolicy = {
    ...DEFAULT_SIGNATURE_RETENTION_POLICY,
    ...policy,
  };
  const preview = await previewSignatureRetention(organizationId, merged);
  const result = await runSignatureRetentionCleanup(organizationId, merged);
  return { preview, result };
}

export {
  generateSignatureAnalytics,
  getWorkflowAnalytics,
  getAlgorithmAnalytics,
  getVerificationAnalyticsSlice,
  getDetachedAnalytics,
};
