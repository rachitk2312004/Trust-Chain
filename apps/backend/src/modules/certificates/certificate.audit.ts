import { AuditEventSources } from "@trustchain/config";
import { writeAuditEvent } from "../audit/audit.service.js";
import { indexCertificate } from "../search/search.indexer.js";
import { upsertSearchDocuments } from "../search/search.repository.js";

type CertificateAuditRow = {
  id: string;
  organizationId: string;
  publicId: string;
  title: string;
  description?: string | null;
  recipientName: string;
  recipientEmail?: string | null;
  status: string;
  createdAt: Date;
};

export async function auditCertificateIssued(input: {
  actorUserId: string;
  certificate: CertificateAuditRow;
}): Promise<void> {
  await writeAuditEvent({
    source: AuditEventSources.certificate,
    action: "certificate.issued",
    actorUserId: input.actorUserId,
    organizationId: input.certificate.organizationId,
    resourceType: "certificate",
    resourceId: input.certificate.id,
    meta: {
      publicId: input.certificate.publicId,
      recipientName: input.certificate.recipientName,
      title: input.certificate.title,
    },
  }).catch(() => undefined);
}

export async function auditCertificateRevoked(input: {
  actorUserId: string;
  certificate: CertificateAuditRow;
  reason?: string | null;
}): Promise<void> {
  await writeAuditEvent({
    source: AuditEventSources.certificate,
    action: "certificate.revoked",
    actorUserId: input.actorUserId,
    organizationId: input.certificate.organizationId,
    resourceType: "certificate",
    resourceId: input.certificate.id,
    meta: {
      publicId: input.certificate.publicId,
      recipientName: input.certificate.recipientName,
      title: input.certificate.title,
      reason: input.reason ?? null,
    },
  }).catch(() => undefined);
}

export async function auditCertificatePublicVerify(input: {
  certificate: CertificateAuditRow;
  valid: boolean;
  reasons: string[];
}): Promise<void> {
  await writeAuditEvent({
    source: AuditEventSources.verification,
    action: "certificate.verify.public",
    organizationId: input.certificate.organizationId,
    resourceType: "certificate",
    resourceId: input.certificate.id,
    success: input.valid,
    meta: {
      publicId: input.certificate.publicId,
      title: input.certificate.title,
      valid: input.valid,
      reasons: input.reasons,
    },
  }).catch(() => undefined);
}

export async function indexCertificateSearch(certificate: CertificateAuditRow): Promise<void> {
  await upsertSearchDocuments([
    indexCertificate({
      id: certificate.id,
      organizationId: certificate.organizationId,
      publicId: certificate.publicId,
      title: certificate.title,
      description: certificate.description,
      recipientName: certificate.recipientName,
      recipientEmail: certificate.recipientEmail,
      status: certificate.status,
      createdAt: certificate.createdAt,
    }),
  ]).catch(() => undefined);
}
