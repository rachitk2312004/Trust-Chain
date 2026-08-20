import { CertificateEventTypes, CertificateStatuses } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import * as repo from "./certificates.repository.js";
import { verifyCertificate } from "./certificates.verifier.js";
import { auditCertificatePublicVerify } from "./certificate.audit.js";

function asMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function verifyCertificateByPublicId(publicId: string) {
  const row = await repo.findCertificateByPublicId(publicId.trim());
  if (!row) {
    throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  }

  let status = row.status;
  if (
    status === CertificateStatuses.issued &&
    row.expiresAt &&
    row.expiresAt.getTime() <= Date.now()
  ) {
    status = CertificateStatuses.expired;
  }

  const organization = await prisma.organization.findUnique({
    where: { id: row.organizationId },
    select: { name: true },
  });

  const result = verifyCertificate({
    publicId: row.publicId,
    organizationId: row.organizationId,
    title: row.title,
    recipientName: row.recipientName,
    recipientEmail: row.recipientEmail,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    templateId: row.templateId,
    documentId: row.documentId,
    metadata: asMetadata(row.metadataJson),
    integrityHash: row.integrityHash,
    status,
    qrPublicCode: row.qrPublicCode,
    documentStatus: row.document?.status ?? null,
    documentDeletedAt: row.document?.deletedAt ?? null,
  });

  await repo.createCertificateEvent({
    certificateId: row.id,
    organizationId: row.organizationId,
    eventType: CertificateEventTypes.verified,
    actorId: null,
    payloadJson: {
      public: true,
      valid: result.valid,
      reasons: result.reasons,
      checks: result.checks,
    },
  });

  await auditCertificatePublicVerify({
    certificate: row,
    valid: result.valid,
    reasons: result.reasons,
  });

  return {
    certificate: {
      publicId: row.publicId,
      title: row.title,
      recipientName: row.recipientName,
      status,
      issuedAt: row.issuedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      revokeReason: row.revokeReason,
      organizationName: organization?.name ?? null,
    },
    verification: result,
  };
}
