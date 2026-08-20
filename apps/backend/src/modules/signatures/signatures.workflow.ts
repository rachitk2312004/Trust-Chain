import {
  CertificateStatuses,
  DocumentPermissions,
  RoleKeys,
  SignatureArtifactKinds,
  SignatureStatuses,
  SignatureWorkflowKinds,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { assertDocumentPermission } from "../documents/documents.access.js";
import {
  normalizeDetachedPayload,
  pickDetachedArtifacts,
  verifyDetachedSignature,
  type DetachedPayloadInput,
} from "./signatures.detached.js";
import {
  assertSignatureNotExpired,
  assertSignatureNotRevoked,
  evaluateExpiration,
  resolveExpiresAt,
  shouldPersistExpiredStatus,
} from "./signatures.expiration.js";
import {
  assertCertificateSignable,
  assertDocumentSignable,
  assertRevocationPolicy,
  assertWorkflowKindAllowed,
  defaultOrgSignaturePolicy,
  validateSignPolicy,
  type OrgSignaturePolicy,
  type SignatureWorkflowKind,
} from "./signatures.policy.js";
import * as repo from "./signatures.repository.js";
import { createSignature, revokeSignature, verifySignature } from "./signatures.service.js";

export type WorkflowSignOptions = {
  organizationId: string;
  algorithm?: string;
  privateKeyPem?: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
  policy?: OrgSignaturePolicy;
};

async function loadOrgPolicy(
  _organizationId: string,
  override?: OrgSignaturePolicy,
): Promise<OrgSignaturePolicy> {
  // Foundation: in-memory defaults. Org-persisted policies can plug in later.
  return override ?? defaultOrgSignaturePolicy();
}

async function persistExpiredIfNeeded(row: {
  id: string;
  status: string;
  expiresAt: Date | null;
}) {
  if (!shouldPersistExpiredStatus(row.status, row.expiresAt)) return row;
  return repo.updateSignature(row.id, { status: SignatureStatuses.expired });
}

/**
 * Shared signing steps: validate policy → resolve expiration → create signature.
 */
async function runSignWorkflow(
  userId: string,
  kind: SignatureWorkflowKind,
  input: WorkflowSignOptions & {
    documentId?: string | null;
    certificateId?: string | null;
    contentHash?: string | null;
    metadataExtra?: Record<string, unknown>;
  },
) {
  const policy = await loadOrgPolicy(input.organizationId, input.policy);
  const signedAt = new Date();
  const expiresAt = resolveExpiresAt({
    expiresAt: input.expiresAt,
    signedAt,
    policy,
  });

  const { algorithm } = validateSignPolicy({
    kind,
    algorithm: input.algorithm,
    expiresAt,
    signedAt,
    policy,
  });

  const result = await createSignature(userId, {
    organizationId: input.organizationId,
    documentId: input.documentId ?? null,
    certificateId: input.certificateId ?? null,
    algorithm,
    privateKeyPem: input.privateKeyPem,
    expiresAt: expiresAt?.toISOString() ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      ...(input.metadataExtra ?? {}),
      workflow: kind,
    },
    contentHash: input.contentHash ?? null,
  });

  return {
    workflow: kind,
    ...result,
    expiration: evaluateExpiration(
      result.signature.status,
      result.signature.expiresAt ? new Date(result.signature.expiresAt) : null,
    ),
  };
}

export async function signDocumentWorkflow(
  userId: string,
  input: WorkflowSignOptions & { documentId: string },
) {
  const policy = await loadOrgPolicy(input.organizationId, input.policy);
  assertWorkflowKindAllowed(SignatureWorkflowKinds.document, policy);

  const document = await prisma.document.findFirst({
    where: { id: input.documentId, organizationId: input.organizationId },
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

  assertDocumentSignable(document.status, policy);

  if (!document.currentVersion?.contentHash) {
    throw new AppError(
      400,
      "DOCUMENT_MISSING_HASH",
      "Document has no current version content hash to sign",
    );
  }

  return runSignWorkflow(userId, SignatureWorkflowKinds.document, {
    ...input,
    documentId: document.id,
    certificateId: null,
    contentHash: document.currentVersion.contentHash,
    metadataExtra: {
      documentStatus: document.status,
      documentTitle: document.title ?? null,
    },
  });
}

export async function signCertificateWorkflow(
  userId: string,
  input: WorkflowSignOptions & { certificateId: string },
) {
  const policy = await loadOrgPolicy(input.organizationId, input.policy);
  assertWorkflowKindAllowed(SignatureWorkflowKinds.certificate, policy);

  const certificate = await prisma.certificate.findFirst({
    where: { id: input.certificateId, organizationId: input.organizationId },
  });
  if (!certificate) {
    throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  }

  let status = certificate.status;
  if (
    status === CertificateStatuses.issued &&
    certificate.expiresAt &&
    certificate.expiresAt.getTime() <= Date.now()
  ) {
    status = CertificateStatuses.expired;
  }
  assertCertificateSignable(status, policy);

  return runSignWorkflow(userId, SignatureWorkflowKinds.certificate, {
    ...input,
    documentId: certificate.documentId,
    certificateId: certificate.id,
    contentHash: certificate.integrityHash,
    metadataExtra: {
      certificatePublicId: certificate.publicId,
      certificateStatus: status,
      recipientName: certificate.recipientName,
    },
  });
}

export async function signDetachedWorkflow(
  userId: string,
  input: WorkflowSignOptions & { payload: DetachedPayloadInput },
) {
  const normalized = normalizeDetachedPayload(input.payload);

  const created = await runSignWorkflow(userId, SignatureWorkflowKinds.detached, {
    ...input,
    documentId: null,
    certificateId: null,
    contentHash: normalized.contentHash,
    metadataExtra: {
      detachedContentType: normalized.contentType,
      detachedPayloadHash: normalized.contentHash,
    },
  });

  await repo.createSignatureArtifact({
    signatureId: created.signature.id,
    organizationId: input.organizationId,
    kind: SignatureArtifactKinds.detachedPayload,
    content: normalized.content,
    contentType: normalized.contentType,
    metadataJson: { contentHash: normalized.contentHash },
  });

  const artifacts = await repo.listSignatureArtifacts(created.signature.id);

  return {
    ...created,
    detached: {
      contentHash: normalized.contentHash,
      contentType: normalized.contentType,
      artifacts: pickDetachedArtifacts(artifacts),
    },
  };
}

export type VerifyWorkflowInput = {
  organizationId: string;
  /** Stored signature verification. */
  signatureId?: string;
  /** Stateless detached verification materials. */
  detached?: {
    signerId: string;
    algorithm: string;
    publicKeyPem: string;
    signatureValue: string;
    signedAt: string;
    expiresAt?: string | null;
    metadata?: Record<string, unknown>;
    payload: DetachedPayloadInput;
    publicId?: string;
    payloadHash?: string;
    integrityHash?: string;
    status?: string;
  };
};

/**
 * Verification workflow: stored signatureId path or detached materials path.
 */
export async function verifySignatureWorkflow(userId: string, input: VerifyWorkflowInput) {
  if (input.signatureId) {
    const row = await repo.findSignatureById(input.organizationId, input.signatureId);
    if (!row) throw new AppError(404, "SIGNATURE_NOT_FOUND", "Signature not found");

    const persisted = await persistExpiredIfNeeded(row);
    const expiration = evaluateExpiration(persisted.status, persisted.expiresAt);

    try {
      assertSignatureNotRevoked(persisted.status);
      assertSignatureNotExpired(persisted.status, persisted.expiresAt);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
    }

    const verified = await verifySignature(userId, input.organizationId, input.signatureId);
    const artifacts = await repo.listSignatureArtifacts(input.signatureId);
    const detached = pickDetachedArtifacts(artifacts);

    return {
      workflow: "verify",
      mode: "stored" as const,
      ...verified,
      expiration,
      detachedArtifacts: detached.payload ? detached : null,
    };
  }

  if (input.detached) {
    const d = input.detached;
    const result = verifyDetachedSignature({
      organizationId: input.organizationId,
      signerId: d.signerId,
      algorithm: d.algorithm,
      publicKeyPem: d.publicKeyPem,
      signatureValue: d.signatureValue,
      signedAt: d.signedAt,
      expiresAt: d.expiresAt,
      metadata: d.metadata,
      payload: d.payload,
      publicId: d.publicId,
      payloadHash: d.payloadHash,
      integrityHash: d.integrityHash,
      status: d.status,
    });

    return {
      workflow: "verify",
      mode: "detached" as const,
      verification: result,
      expiration: evaluateExpiration(
        result.status,
        d.expiresAt ? new Date(d.expiresAt) : null,
      ),
    };
  }

  throw new AppError(
    400,
    "INVALID_PAYLOAD",
    "Provide signatureId or detached verification materials",
  );
}

export async function revokeSignatureWorkflow(
  userId: string,
  organizationId: string,
  signatureId: string,
  reason?: string,
  policyOverride?: OrgSignaturePolicy,
) {
  const policy = await loadOrgPolicy(organizationId, policyOverride);
  const row = await repo.findSignatureById(organizationId, signatureId);
  if (!row) throw new AppError(404, "SIGNATURE_NOT_FOUND", "Signature not found");

  const isSigner = row.signerId === userId;
  const isAdmin = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  assertRevocationPolicy({ isSigner, isAdmin, policy });
  assertSignatureNotRevoked(row.status);

  return revokeSignature(userId, organizationId, signatureId, reason);
}

/** Exported for tests — documents the workflow step sequence. */
export const SIGNING_WORKFLOW_STEPS = [
  "retrieve_target",
  "create_canonical_payload",
  "validate_policy",
  "generate_signature",
  "store_artifacts",
  "emit_notifications",
  "publish_events",
] as const;
