import { createPrivateKey, createPublicKey } from "node:crypto";
import {
  DeveloperEventTypes,
  DocumentPermissions,
  NotificationEventTypes,
  RoleKeys,
  SignatureArtifactKinds,
  SignatureStatuses,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { publishDeveloperEventSafe } from "../developer/developer.delivery.js";
import { assertDocumentPermission } from "../documents/documents.access.js";
import { emitDomainNotification } from "../notifications/notification.emit.js";
import {
  recordSignatureCreatedEvent,
  recordSignatureRevokedEvent,
  recordSignatureVerifiedEvent,
} from "./signatures.events.js";
import * as repo from "./signatures.repository.js";
import {
  assertSupportedAlgorithm,
  buildCanonicalPayload,
  canonicalizeSignaturePayload,
  generateKeyPairForAlgorithm,
  generateSignaturePublicId,
  hashCanonicalPayload,
  hashSignatureIntegrity,
  signCanonicalPayload,
} from "./signatures.validator.js";
import { resolveEffectiveStatus, verifySignatureRecord } from "./signatures.verifier.js";

async function assertOrgStaff(userId: string, organizationId: string) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
}

async function assertOrgAdmin(userId: string, organizationId: string) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Organization admin role required");
}

function asMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function createSignature(
  userId: string,
  input: {
    organizationId: string;
    documentId?: string | null;
    certificateId?: string | null;
    algorithm?: string;
    privateKeyPem?: string;
    expiresAt?: string | null;
    metadata?: Record<string, unknown>;
    contentHash?: string | null;
  },
) {
  await assertOrgStaff(userId, input.organizationId);

  const algorithm = assertSupportedAlgorithm(input.algorithm ?? "RSA-SHA256");
  let contentHash: string | null = input.contentHash ?? null;
  let documentId: string | null = input.documentId ?? null;
  let certificateId: string | null = input.certificateId ?? null;

  if (documentId) {
    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId: input.organizationId },
      include: { currentVersion: true },
    });
    if (!document || document.deletedAt) {
      throw new AppError(404, "DOC_NOT_FOUND", "Document not found");
    }
    await assertDocumentPermission(
      userId,
      {
        id: document.id,
        organizationId: document.organizationId,
        createdById: document.createdById,
        status: document.status,
        deletedAt: document.deletedAt,
        expiresAt: document.expiresAt,
        archivedAt: document.archivedAt,
      },
      DocumentPermissions.view,
    );
    if (!contentHash) contentHash = document.currentVersion?.contentHash ?? null;
  }

  if (certificateId) {
    const certificate = await prisma.certificate.findFirst({
      where: { id: certificateId, organizationId: input.organizationId },
      select: { id: true, status: true },
    });
    if (!certificate) {
      throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
    }
  }

  const signedAt = new Date();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid expiration date");
  }

  const metadata = input.metadata ?? {};
  let privateKeyPem = input.privateKeyPem;
  let generatedPrivateKey: string | null = null;
  let publicKeyPem: string;

  if (privateKeyPem) {
    try {
      const keyObj = createPrivateKey(privateKeyPem);
      publicKeyPem = createPublicKey(keyObj)
        .export({ type: "spki", format: "pem" })
        .toString();
    } catch (error) {
      throw new AppError(
        400,
        "INVALID_PRIVATE_KEY",
        `Invalid private key PEM: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    const pair = generateKeyPairForAlgorithm(algorithm);
    privateKeyPem = pair.privateKeyPem;
    publicKeyPem = pair.publicKeyPem;
    generatedPrivateKey = pair.privateKeyPem;
  }

  const payload = buildCanonicalPayload({
    organizationId: input.organizationId,
    signerId: userId,
    documentId,
    certificateId,
    timestamp: signedAt,
    algorithm,
    metadata,
    contentHash,
  });
  const canonical = canonicalizeSignaturePayload(payload);
  const payloadHash = hashCanonicalPayload(canonical);
  const signatureValue = signCanonicalPayload(algorithm, canonical, privateKeyPem);
  const publicId = generateSignaturePublicId();
  const integrityHash = hashSignatureIntegrity({
    publicId,
    organizationId: input.organizationId,
    signerId: userId,
    documentId,
    certificateId,
    algorithm,
    publicKeyPem,
    signatureValue,
    payloadHash,
    signedAt: signedAt.toISOString(),
    expiresAt: expiresAt?.toISOString() ?? null,
    metadata,
  });

  const row = await prisma.$transaction(async (tx) => {
    const created = await repo.createSignature(
      {
        publicId,
        organization: { connect: { id: input.organizationId } },
        signer: { connect: { id: userId } },
        ...(documentId ? { document: { connect: { id: documentId } } } : {}),
        ...(certificateId ? { certificate: { connect: { id: certificateId } } } : {}),
        algorithm,
        status: SignatureStatuses.active,
        publicKeyPem,
        signatureValue,
        payloadHash,
        integrityHash,
        signedAt,
        expiresAt,
        metadataJson: metadata as Prisma.InputJsonValue,
      },
      tx,
    );

    await recordSignatureCreatedEvent(
      {
        signatureId: created.id,
        organizationId: input.organizationId,
        actorId: userId,
        payload: {
          publicId,
          algorithm,
          documentId,
          certificateId,
        },
      },
      tx,
    );

    await repo.createSignatureArtifact(
      {
        signatureId: created.id,
        organizationId: input.organizationId,
        kind: SignatureArtifactKinds.canonicalPayload,
        content: canonical,
        contentType: "application/json",
      },
      tx,
    );
    await repo.createSignatureArtifact(
      {
        signatureId: created.id,
        organizationId: input.organizationId,
        kind: SignatureArtifactKinds.detachedSignature,
        content: signatureValue,
        contentType: "application/octet-stream",
      },
      tx,
    );
    await repo.createSignatureArtifact(
      {
        signatureId: created.id,
        organizationId: input.organizationId,
        kind: SignatureArtifactKinds.publicKey,
        content: publicKeyPem,
        contentType: "application/x-pem-file",
      },
      tx,
    );

    return created;
  });

  publishDeveloperEventSafe({
    organizationId: input.organizationId,
    eventType: DeveloperEventTypes.signatureCreated,
    data: {
      signatureId: row.id,
      publicId: row.publicId,
      algorithm: row.algorithm,
      documentId: row.documentId,
      certificateId: row.certificateId,
    },
  });

  await emitDomainNotification({
    organizationId: input.organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.signatureCreated,
    entityId: row.id,
    entityType: "signature",
    title: "Signature created",
    message: `Digital signature ${row.publicId} was created.`,
    metadata: {
      publicId: row.publicId,
      algorithm: row.algorithm,
      documentId: row.documentId,
      certificateId: row.certificateId,
    },
    recipientUserIds: [userId],
  });

  return {
    signature: repo.toPublicSignature(row),
    /** Present only when the server generated the keypair — store securely; not persisted. */
    generatedPrivateKeyPem: generatedPrivateKey,
  };
}

export async function listSignatures(
  userId: string,
  organizationId: string,
  query: { status?: string; documentId?: string; limit: number; offset: number },
) {
  await assertOrgStaff(userId, organizationId);
  const result = await repo.listSignatures(organizationId, query);
  return {
    signatures: result.items.map((row) =>
      repo.toPublicSignature({
        ...row,
        status: resolveEffectiveStatus(row.status, row.expiresAt),
      }),
    ),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}

export async function getSignature(userId: string, organizationId: string, signatureId: string) {
  await assertOrgStaff(userId, organizationId);
  const row = await repo.findSignatureById(organizationId, signatureId);
  if (!row) throw new AppError(404, "SIGNATURE_NOT_FOUND", "Signature not found");
  const artifacts = await repo.listSignatureArtifacts(signatureId);
  return {
    signature: repo.toPublicSignature({
      ...row,
      status: resolveEffectiveStatus(row.status, row.expiresAt),
    }),
    artifacts: artifacts.map(repo.toPublicArtifact),
  };
}

export async function verifySignature(
  userId: string,
  organizationId: string,
  signatureId: string,
) {
  await assertOrgStaff(userId, organizationId);
  const row = await repo.findSignatureById(organizationId, signatureId);
  if (!row) throw new AppError(404, "SIGNATURE_NOT_FOUND", "Signature not found");
  const started = Date.now();

  const contentHash =
    typeof row.metadataJson === "object" &&
    row.metadataJson &&
    !Array.isArray(row.metadataJson) &&
    typeof (row.metadataJson as Record<string, unknown>).contentHash === "string"
      ? ((row.metadataJson as Record<string, unknown>).contentHash as string)
      : null;

  // Prefer content hash from canonical artifact reconstruction — stored in payload via validator.
  const artifacts = await repo.listSignatureArtifacts(signatureId);
  const payloadArtifact = artifacts.find((a) => a.kind === SignatureArtifactKinds.canonicalPayload);
  let parsedContentHash: string | null = contentHash;
  if (payloadArtifact) {
    try {
      const parsed = JSON.parse(payloadArtifact.content) as { contentHash?: string | null };
      if (typeof parsed.contentHash === "string") parsedContentHash = parsed.contentHash;
      else if (parsed.contentHash === null) parsedContentHash = null;
    } catch {
      // ignore parse errors; verifier will fail integrity if needed
    }
  }

  const cryptoResult = verifySignatureRecord({
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
    contentHash: parsedContentHash,
  });

  /** Optional document content-hash check (Wave 4 verification integrity model). */
  let documentContentMatch: boolean | null = null;
  const reasons = [...cryptoResult.reasons];
  if (row.documentId && parsedContentHash) {
    const document = await prisma.document.findFirst({
      where: { id: row.documentId, organizationId: row.organizationId },
      include: { currentVersion: { select: { contentHash: true } } },
    });
    const current = document?.currentVersion?.contentHash?.toLowerCase() ?? null;
    documentContentMatch = current === parsedContentHash.toLowerCase();
    if (!documentContentMatch) reasons.push("DOCUMENT_CONTENT_HASH_MISMATCH");
  }

  const result = {
    ...cryptoResult,
    valid: cryptoResult.valid && documentContentMatch !== false,
    reasons,
    checks: { ...cryptoResult.checks, documentContentMatch },
  };

  const durationMs = Date.now() - started;
  const { signatureProcessMetrics } = await import("./signatures.observability.js");
  signatureProcessMetrics.recordVerification(durationMs, result.valid);

  await recordSignatureVerifiedEvent({
    signatureId: row.id,
    organizationId: row.organizationId,
    actorId: userId,
    payload: {
      valid: result.valid,
      reasons: result.reasons,
      checks: result.checks,
      durationMs,
    },
  });

  await emitDomainNotification({
    organizationId: row.organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.signatureVerified,
    entityId: row.id,
    entityType: "signature",
    title: "Signature verified",
    message: `Digital signature ${row.publicId} verification ${result.valid ? "passed" : "failed"}.`,
    metadata: { publicId: row.publicId, valid: result.valid, reasons: result.reasons },
    recipientUserIds: [userId, row.signerId],
  });

  return {
    signature: repo.toPublicSignature({
      ...row,
      status: result.status,
    }),
    verification: result,
  };
}

export async function revokeSignature(
  userId: string,
  organizationId: string,
  signatureId: string,
  reason?: string,
) {
  const row = await repo.findSignatureById(organizationId, signatureId);
  if (!row) throw new AppError(404, "SIGNATURE_NOT_FOUND", "Signature not found");

  const isSigner = row.signerId === userId;
  if (!isSigner) {
    await assertOrgAdmin(userId, organizationId);
  } else {
    await assertOrgStaff(userId, organizationId);
  }

  if (row.status === SignatureStatuses.revoked) {
    return { signature: repo.toPublicSignature(row) };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await repo.updateSignature(
      signatureId,
      {
        status: SignatureStatuses.revoked,
        revokedAt: new Date(),
        revokedBy: { connect: { id: userId } },
        revokeReason: reason ?? null,
      },
      tx,
    );
    await recordSignatureRevokedEvent(
      {
        signatureId,
        organizationId,
        actorId: userId,
        payload: { reason: reason ?? null },
      },
      tx,
    );
    return next;
  });

  await emitDomainNotification({
    organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.signatureRevoked,
    entityId: updated.id,
    entityType: "signature",
    title: "Signature revoked",
    message: `Digital signature ${updated.publicId} was revoked.`,
    metadata: { publicId: updated.publicId, reason: reason ?? null },
    recipientUserIds: [userId, updated.signerId],
  });

  publishDeveloperEventSafe({
    organizationId,
    eventType: DeveloperEventTypes.signatureRevoked,
    data: {
      signatureId: updated.id,
      publicId: updated.publicId,
      reason: reason ?? null,
    },
  });

  return { signature: repo.toPublicSignature(updated) };
}

export async function getSignatureHistory(
  userId: string,
  organizationId: string,
  signatureId: string,
  query: { limit: number; offset: number },
) {
  await assertOrgStaff(userId, organizationId);
  const row = await repo.findSignatureById(organizationId, signatureId);
  if (!row) throw new AppError(404, "SIGNATURE_NOT_FOUND", "Signature not found");
  const events = await repo.listSignatureEvents(signatureId, query.limit, query.offset);
  return {
    signatureId,
    events: events.items.map(repo.toPublicEvent),
    total: events.total,
    limit: events.limit,
    offset: events.offset,
  };
}

export async function getSignatureAnalyticsOverview(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  const { generateSignatureAnalytics } = await import("./signatures.analytics.js");
  return { analytics: await generateSignatureAnalytics(organizationId) };
}

export async function getSignatureWorkflowAnalytics(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  const { getWorkflowAnalytics } = await import("./signatures.analytics.js");
  return getWorkflowAnalytics(organizationId);
}

export async function getSignatureAlgorithmAnalytics(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  const { getAlgorithmAnalytics } = await import("./signatures.analytics.js");
  return getAlgorithmAnalytics(organizationId);
}

export async function getSignatureVerificationAnalytics(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  const { getVerificationAnalyticsSlice } = await import("./signatures.analytics.js");
  return getVerificationAnalyticsSlice(organizationId);
}

export async function getSignatureDetachedAnalytics(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  const { getDetachedAnalytics } = await import("./signatures.analytics.js");
  return getDetachedAnalytics(organizationId);
}

export async function adminReprocessSignatures(
  userId: string,
  organizationId: string,
  input?: { signatureIds?: string[]; limit?: number },
) {
  await assertOrgAdmin(userId, organizationId);
  const { reprocessSignatures } = await import("./signatures.admin.js");
  return reprocessSignatures(userId, organizationId, input);
}

export async function adminCleanupSignatures(
  userId: string,
  organizationId: string,
  policy?: {
    eventDays?: number;
    approvalEventDays?: number;
    workflowDays?: number;
    artifactDays?: number;
    diagnosticEventDays?: number;
  },
) {
  await assertOrgAdmin(userId, organizationId);
  const { runSignatureAdminCleanup } = await import("./signatures.admin.js");
  return runSignatureAdminCleanup(organizationId, policy);
}
