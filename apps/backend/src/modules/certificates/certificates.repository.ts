import { prisma, type Prisma } from "@trustchain/database";

export function toPublicCertificate(row: {
  id: string;
  publicId: string;
  organizationId: string;
  templateId: string | null;
  documentId: string | null;
  title: string;
  description: string | null;
  recipientName: string;
  recipientEmail: string | null;
  recipientUserId: string | null;
  status: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  metadataJson: Prisma.JsonValue | null;
  integrityHash: string;
  verificationUrl: string;
  qrPublicCode: string | null;
  issuedById: string;
  revokedAt: Date | null;
  revokedById: string | null;
  revokeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    publicId: row.publicId,
    organizationId: row.organizationId,
    templateId: row.templateId,
    documentId: row.documentId,
    title: row.title,
    description: row.description,
    recipient: {
      name: row.recipientName,
      email: row.recipientEmail,
      userId: row.recipientUserId,
    },
    status: row.status,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    metadata: row.metadataJson,
    integrityHash: row.integrityHash,
    verificationUrl: row.verificationUrl,
    qrPublicCode: row.qrPublicCode,
    issuedById: row.issuedById,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokedById: row.revokedById,
    revokeReason: row.revokeReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicEvent(row: {
  id: string;
  certificateId: string;
  organizationId: string;
  eventType: string;
  actorId: string | null;
  payloadJson: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    certificateId: row.certificateId,
    organizationId: row.organizationId,
    eventType: row.eventType,
    actorId: row.actorId,
    payload: row.payloadJson,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createCertificate(
  data: Prisma.CertificateCreateInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.certificate.create({ data });
}

export async function findCertificateById(organizationId: string, certificateId: string) {
  return prisma.certificate.findFirst({
    where: { id: certificateId, organizationId },
    include: { document: { select: { id: true, status: true, deletedAt: true, title: true } } },
  });
}

export async function findCertificateByPublicId(publicId: string) {
  return prisma.certificate.findFirst({
    where: { publicId },
    include: { document: { select: { id: true, status: true, deletedAt: true, title: true } } },
  });
}

export async function listCertificatesForRecipient(
  recipientUserId: string,
  input: { status?: string; limit: number; offset: number },
) {
  const where: Prisma.CertificateWhereInput = {
    recipientUserId,
    ...(input.status ? { status: input.status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.certificate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
    }),
    prisma.certificate.count({ where }),
  ]);
  return { items, total, limit: input.limit, offset: input.offset };
}

export async function findCertificateForRecipient(recipientUserId: string, certificateId: string) {
  return prisma.certificate.findFirst({
    where: { id: certificateId, recipientUserId },
    include: { document: { select: { id: true, status: true, deletedAt: true, title: true } } },
  });
}

export async function listCertificates(
  organizationId: string,
  input: { status?: string; limit: number; offset: number },
) {
  const where: Prisma.CertificateWhereInput = {
    organizationId,
    ...(input.status ? { status: input.status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.certificate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
    }),
    prisma.certificate.count({ where }),
  ]);
  return { items, total, limit: input.limit, offset: input.offset };
}

export async function updateCertificate(
  certificateId: string,
  data: Prisma.CertificateUpdateInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.certificate.update({ where: { id: certificateId }, data });
}

export async function createCertificateEvent(
  input: {
    certificateId: string;
    organizationId: string;
    eventType: string;
    actorId?: string | null;
    payloadJson?: Prisma.InputJsonValue;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.certificateEvent.create({
    data: {
      certificateId: input.certificateId,
      organizationId: input.organizationId,
      eventType: input.eventType,
      actorId: input.actorId ?? null,
      payloadJson: input.payloadJson ?? undefined,
    },
  });
}

export async function listCertificateEvents(certificateId: string, limit = 50, offset = 0) {
  const [items, total] = await Promise.all([
    prisma.certificateEvent.findMany({
      where: { certificateId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.certificateEvent.count({ where: { certificateId } }),
  ]);
  return { items, total, limit, offset };
}
