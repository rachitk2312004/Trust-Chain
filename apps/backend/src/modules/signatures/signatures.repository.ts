import { prisma, type Prisma } from "@trustchain/database";

export function toPublicSignature(row: {
  id: string;
  publicId: string;
  organizationId: string;
  signerId: string;
  documentId: string | null;
  certificateId: string | null;
  algorithm: string;
  status: string;
  publicKeyPem: string;
  signatureValue: string;
  payloadHash: string;
  integrityHash: string;
  signedAt: Date;
  expiresAt: Date | null;
  metadataJson: Prisma.JsonValue | null;
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
    signerId: row.signerId,
    documentId: row.documentId,
    certificateId: row.certificateId,
    algorithm: row.algorithm,
    status: row.status,
    publicKeyPem: row.publicKeyPem,
    signatureValue: row.signatureValue,
    payloadHash: row.payloadHash,
    integrityHash: row.integrityHash,
    signedAt: row.signedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    metadata: row.metadataJson,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokedById: row.revokedById,
    revokeReason: row.revokeReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicEvent(row: {
  id: string;
  signatureId: string;
  organizationId: string;
  eventType: string;
  actorId: string | null;
  payloadJson: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    signatureId: row.signatureId,
    organizationId: row.organizationId,
    eventType: row.eventType,
    actorId: row.actorId,
    payload: row.payloadJson,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPublicArtifact(row: {
  id: string;
  signatureId: string;
  organizationId: string;
  kind: string;
  content: string;
  contentType: string;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    signatureId: row.signatureId,
    organizationId: row.organizationId,
    kind: row.kind,
    content: row.content,
    contentType: row.contentType,
    metadata: row.metadataJson,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createSignature(
  data: Prisma.SignatureCreateInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.signature.create({ data });
}

export async function createSignatureEvent(
  data: {
    signatureId: string;
    organizationId: string;
    eventType: string;
    actorId?: string | null;
    payloadJson?: Prisma.InputJsonValue | null;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.signatureEvent.create({
    data: {
      signatureId: data.signatureId,
      organizationId: data.organizationId,
      eventType: data.eventType,
      actorId: data.actorId ?? null,
      payloadJson: data.payloadJson ?? undefined,
    },
  });
}

export async function createSignatureArtifact(
  data: {
    signatureId: string;
    organizationId: string;
    kind: string;
    content: string;
    contentType?: string;
    metadataJson?: Prisma.InputJsonValue | null;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.signatureArtifact.create({
    data: {
      signatureId: data.signatureId,
      organizationId: data.organizationId,
      kind: data.kind,
      content: data.content,
      contentType: data.contentType ?? "text/plain",
      metadataJson: data.metadataJson ?? undefined,
    },
  });
}

export async function findSignatureById(organizationId: string, signatureId: string) {
  return prisma.signature.findFirst({
    where: { id: signatureId, organizationId },
  });
}

export async function listSignatures(
  organizationId: string,
  query: { status?: string; documentId?: string; limit: number; offset: number },
) {
  const where = {
    organizationId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.documentId ? { documentId: query.documentId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.signature.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.signature.count({ where }),
  ]);
  return { items, total, limit: query.limit, offset: query.offset };
}

export async function updateSignature(
  signatureId: string,
  data: Prisma.SignatureUpdateInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.signature.update({ where: { id: signatureId }, data });
}

export async function listSignatureEvents(signatureId: string, limit: number, offset: number) {
  const where = { signatureId };
  const [items, total] = await Promise.all([
    prisma.signatureEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.signatureEvent.count({ where }),
  ]);
  return { items, total, limit, offset };
}

export async function listSignatureArtifacts(signatureId: string) {
  return prisma.signatureArtifact.findMany({
    where: { signatureId },
    orderBy: { createdAt: "asc" },
  });
}
