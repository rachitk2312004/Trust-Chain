import {
  PublicVerificationLinkStatuses,
  PublicVerifyLookupTypes,
  RoleKeys,
  VerificationVisibility,
} from "@trustchain/config";
import { prisma, Prisma } from "@trustchain/database";
import { AppError } from "../../../lib/errors.js";
import { userHasRole } from "../../auth/rbac.repository.js";
import { assertDocumentPermission } from "../../documents/documents.access.js";
import { DocumentPermissions } from "@trustchain/config";
import { startDocumentVerification } from "../../verification/services/verification.service.js";
import type { VerificationReport } from "../../verification/types/verification.types.js";
import { recordPublicEvent } from "../analytics/events.js";
import {
  assertNotAbusive,
  assertPublicRateLimit,
  evaluateLinkStatus,
  isPubliclyVerifiableVisibility,
  registerAbuseStrike,
} from "../utils/abuse.js";
import {
  buildPublicUrls,
  generatePublicCode,
  hashOpaque,
  hashToken,
  mintRawToken,
} from "../utils/crypto.js";
import { toPublicReport, type PublicVerificationReport } from "./publicReport.js";

async function ensurePublicVerifyCode(documentId: string): Promise<string> {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  if (doc.publicVerifyCode) return doc.publicVerifyCode;
  const code = generatePublicCode("PUB-VERIFY");
  await prisma.document.update({
    where: { id: documentId },
    data: { publicVerifyCode: code },
  });
  return code;
}

async function runEngineForDocument(input: {
  organizationId: string;
  documentId: string;
  documentVersionId?: string;
  requireAnchor?: boolean;
}): Promise<{ report: VerificationReport; publicVerifyCode: string }> {
  // Public engine runs as a system-like path using org admin bootstrap:
  // Use document creator as actor for audit trail without requiring anonymous auth.
  const document = await prisma.document.findFirst({
    where: { id: input.documentId, organizationId: input.organizationId },
  });
  if (!document || document.deletedAt) {
    throw new AppError(404, "PUBLIC_VERIFY_NOT_FOUND", "Verification not found");
  }

  const result = await startDocumentVerification(
    document.createdById,
    input.organizationId,
    input.documentId,
    {
      mode: "sync",
      documentVersionId: input.documentVersionId,
      requireAnchor: input.requireAnchor !== false,
      rehashFromR2: false,
      idempotencyKey: `public:${input.documentId}:${input.documentVersionId ?? "current"}:${Date.now()}`,
    },
  );

  if (!result.report) {
    throw new AppError(404, "PUBLIC_VERIFY_NOT_FOUND", "Verification not found");
  }

  const publicVerifyCode = await ensurePublicVerifyCode(input.documentId);
  return { report: result.report, publicVerifyCode };
}

export async function publicVerifyByCode(
  code: string,
  meta: { ip: string; userAgent?: string },
): Promise<PublicVerificationReport> {
  const ipHash = await assertNotAbusive(meta.ip);
  await assertPublicRateLimit(ipHash);

  try {
    const request = await prisma.verificationRequest.findFirst({
      where: {
        OR: [{ verificationCode: code }, { id: code }],
      },
      include: { result: true, document: true },
    });

    if (!request?.result || !isPubliclyVerifiableVisibility(request.document.visibility)) {
      await registerAbuseStrike(ipHash, "not_found_probe");
      throw new AppError(404, "PUBLIC_VERIFY_NOT_FOUND", "Verification not found");
    }

    const publicVerifyCode = await ensurePublicVerifyCode(request.documentId);
    const report = toPublicReport({
      report: request.result.report as VerificationReport,
      publicVerifyCode,
    });

    await recordPublicEvent({
      organizationId: request.organizationId,
      documentId: request.documentId,
      verificationCode: request.verificationCode,
      publicVerifyCode,
      lookupType: PublicVerifyLookupTypes.verificationId,
      lookupValueHash: hashOpaque(code),
      outcome: request.result.outcome,
      success: true,
      ipHash,
      userAgentHash: meta.userAgent ? hashOpaque(meta.userAgent) : null,
    });

    return report;
  } catch (error) {
    if (error instanceof AppError && error.code === "PUBLIC_VERIFY_NOT_FOUND") throw error;
    throw error;
  }
}

export async function publicVerifyByHash(
  hash: string,
  meta: { ip: string; userAgent?: string },
): Promise<PublicVerificationReport> {
  const ipHash = await assertNotAbusive(meta.ip);
  await assertPublicRateLimit(ipHash);
  const contentHash = hash.toLowerCase().replace(/^0x/, "");

  const version = await prisma.documentVersion.findFirst({
    where: { contentHash },
    include: { document: true },
    orderBy: { createdAt: "desc" },
  });

  if (!version || !isPubliclyVerifiableVisibility(version.document.visibility)) {
    await registerAbuseStrike(ipHash, "hash_probe");
    throw new AppError(404, "PUBLIC_VERIFY_NOT_FOUND", "Verification not found");
  }

  const { report, publicVerifyCode } = await runEngineForDocument({
    organizationId: version.document.organizationId,
    documentId: version.documentId,
    documentVersionId: version.id,
  });

  const publicReport = toPublicReport({ report, publicVerifyCode });
  await recordPublicEvent({
    organizationId: version.document.organizationId,
    documentId: version.documentId,
    publicVerifyCode,
    lookupType: PublicVerifyLookupTypes.hash,
    lookupValueHash: hashOpaque(contentHash),
    outcome: report.verificationResult,
    success: true,
    ipHash,
    userAgentHash: meta.userAgent ? hashOpaque(meta.userAgent) : null,
  });
  return publicReport;
}

export async function publicVerifyByTx(
  transactionHash: string,
  meta: { ip: string; userAgent?: string },
): Promise<PublicVerificationReport> {
  const ipHash = await assertNotAbusive(meta.ip);
  await assertPublicRateLimit(ipHash);

  const tx = await prisma.blockchainTransaction.findFirst({
    where: { txHash: transactionHash },
  });
  if (!tx?.documentId || !tx.organizationId) {
    await registerAbuseStrike(ipHash, "tx_probe");
    throw new AppError(404, "PUBLIC_VERIFY_NOT_FOUND", "Verification not found");
  }

  const document = await prisma.document.findUnique({ where: { id: tx.documentId } });
  if (!document || !isPubliclyVerifiableVisibility(document.visibility)) {
    throw new AppError(404, "PUBLIC_VERIFY_NOT_FOUND", "Verification not found");
  }

  const { report, publicVerifyCode } = await runEngineForDocument({
    organizationId: tx.organizationId,
    documentId: tx.documentId,
    documentVersionId: tx.documentVersionId ?? undefined,
  });

  const publicReport = toPublicReport({ report, publicVerifyCode });
  await recordPublicEvent({
    organizationId: tx.organizationId,
    documentId: tx.documentId,
    publicVerifyCode,
    lookupType: PublicVerifyLookupTypes.tx,
    lookupValueHash: hashOpaque(transactionHash),
    outcome: report.verificationResult,
    success: true,
    ipHash,
    userAgentHash: meta.userAgent ? hashOpaque(meta.userAgent) : null,
  });
  return publicReport;
}

export async function publicVerifyByDocumentPublicCode(
  publicVerifyCode: string,
  meta: { ip: string; userAgent?: string },
): Promise<PublicVerificationReport> {
  const ipHash = await assertNotAbusive(meta.ip);
  await assertPublicRateLimit(ipHash);

  const document = await prisma.document.findFirst({
    where: { publicVerifyCode },
  });
  if (!document || !isPubliclyVerifiableVisibility(document.visibility)) {
    await registerAbuseStrike(ipHash, "document_probe");
    throw new AppError(404, "PUBLIC_VERIFY_NOT_FOUND", "Verification not found");
  }

  const { report } = await runEngineForDocument({
    organizationId: document.organizationId,
    documentId: document.id,
  });
  const publicReport = toPublicReport({ report, publicVerifyCode });
  await recordPublicEvent({
    organizationId: document.organizationId,
    documentId: document.id,
    publicVerifyCode,
    lookupType: PublicVerifyLookupTypes.document,
    lookupValueHash: hashOpaque(publicVerifyCode),
    outcome: report.verificationResult,
    success: true,
    ipHash,
    userAgentHash: meta.userAgent ? hashOpaque(meta.userAgent) : null,
  });
  return publicReport;
}

export async function publicVerifyByLinkToken(
  rawToken: string,
  meta: { ip: string; userAgent?: string },
): Promise<PublicVerificationReport> {
  const ipHash = await assertNotAbusive(meta.ip);
  await assertPublicRateLimit(ipHash);
  const tokenHash = hashToken(rawToken);

  const token = await prisma.publicVerificationToken.findUnique({
    where: { tokenHash },
    include: { links: true, document: true },
  });
  if (!token) {
    await registerAbuseStrike(ipHash, "link_probe");
    throw new AppError(404, "PUBLIC_VERIFY_NOT_FOUND", "Verification not found");
  }

  const status = evaluateLinkStatus(token);
  if (status !== PublicVerificationLinkStatuses.active) {
    throw new AppError(410, "PUBLIC_VERIFY_LINK_INACTIVE", `Link is ${status}`);
  }
  if (token.maxUses != null && token.useCount >= token.maxUses) {
    throw new AppError(410, "PUBLIC_VERIFY_LINK_INACTIVE", "Link use limit reached");
  }

  const link = token.links[0];
  if (link?.snapshotJson) {
    await prisma.publicVerificationToken.update({
      where: { id: token.id },
      data: { useCount: { increment: 1 } },
    });
    const snapshot = link.snapshotJson as PublicVerificationReport;
    await recordPublicEvent({
      organizationId: token.organizationId,
      documentId: token.documentId,
      linkId: link.id,
      tokenId: token.id,
      publicVerifyCode: snapshot.publicVerifyCode,
      lookupType: PublicVerifyLookupTypes.link,
      lookupValueHash: tokenHash,
      outcome: snapshot.verificationResult,
      success: true,
      ipHash,
      userAgentHash: meta.userAgent ? hashOpaque(meta.userAgent) : null,
    });
    return snapshot;
  }

  if (!token.documentId) {
    throw new AppError(404, "PUBLIC_VERIFY_NOT_FOUND", "Verification not found");
  }

  const { report, publicVerifyCode } = await runEngineForDocument({
    organizationId: token.organizationId,
    documentId: token.documentId,
    documentVersionId: token.documentVersionId ?? undefined,
    requireAnchor: token.requireAnchor,
  });

  await prisma.publicVerificationToken.update({
    where: { id: token.id },
    data: { useCount: { increment: 1 } },
  });

  const publicReport = toPublicReport({ report, publicVerifyCode });
  await recordPublicEvent({
    organizationId: token.organizationId,
    documentId: token.documentId,
    linkId: link?.id,
    tokenId: token.id,
    publicVerifyCode,
    lookupType: PublicVerifyLookupTypes.link,
    lookupValueHash: tokenHash,
    outcome: report.verificationResult,
    success: true,
    ipHash,
    userAgentHash: meta.userAgent ? hashOpaque(meta.userAgent) : null,
  });
  return publicReport;
}

export async function publicVerifyBody(
  body: {
    verificationCode?: string;
    contentHash?: string;
    transactionHash?: string;
    publicVerifyCode?: string;
    token?: string;
  },
  meta: { ip: string; userAgent?: string },
): Promise<PublicVerificationReport> {
  if (body.token) return publicVerifyByLinkToken(body.token, meta);
  if (body.verificationCode) return publicVerifyByCode(body.verificationCode, meta);
  if (body.contentHash) return publicVerifyByHash(body.contentHash, meta);
  if (body.transactionHash) return publicVerifyByTx(body.transactionHash, meta);
  if (body.publicVerifyCode) return publicVerifyByDocumentPublicCode(body.publicVerifyCode, meta);
  throw new AppError(400, "VALIDATION_ERROR", "No supported lookup field provided");
}

// --- Authenticated link management ---

export async function setDocumentVisibility(
  userId: string,
  organizationId: string,
  documentId: string,
  visibility: string,
) {
  await assertOrgManage(userId, organizationId, documentId);
  const data: Prisma.DocumentUpdateInput = { visibility };
  if (
    visibility === VerificationVisibility.public ||
    visibility === VerificationVisibility.restricted
  ) {
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    if (!doc.publicVerifyCode) {
      data.publicVerifyCode = generatePublicCode("PUB-VERIFY");
    }
  }
  const updated = await prisma.document.update({ where: { id: documentId }, data });
  return {
    visibility: updated.visibility,
    publicVerifyCode: updated.publicVerifyCode,
    urls: buildPublicUrls({
      publicVerifyCode: updated.publicVerifyCode ?? undefined,
    }),
  };
}

export async function createPublicLink(
  userId: string,
  organizationId: string,
  documentId: string,
  input: {
    label?: string;
    expiresAt?: string | null;
    maxUses?: number;
    freezeReport?: boolean;
    visibility?: string;
  },
) {
  await assertOrgManage(userId, organizationId, documentId);
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
  });
  if (!document) throw new AppError(404, "DOC_NOT_FOUND", "Document not found");

  const publicVerifyCode = await ensurePublicVerifyCode(documentId);
  if (document.visibility === VerificationVisibility.private) {
    await prisma.document.update({
      where: { id: documentId },
      data: { visibility: VerificationVisibility.restricted },
    });
  }

  const rawToken = mintRawToken();
  const token = await prisma.publicVerificationToken.create({
    data: {
      publicCode: generatePublicCode("PUB-LINK"),
      organizationId,
      documentId,
      documentVersionId: document.currentVersionId,
      tokenHash: hashToken(rawToken),
      purpose: "link",
      status: PublicVerificationLinkStatuses.active,
      visibility: input.visibility ?? VerificationVisibility.restricted,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      maxUses: input.maxUses,
      createdByUserId: userId,
    },
  });

  let snapshotJson: Prisma.InputJsonValue | undefined;
  if (input.freezeReport) {
    const { report } = await runEngineForDocument({
      organizationId,
      documentId,
      documentVersionId: document.currentVersionId ?? undefined,
    });
    snapshotJson = toPublicReport({ report, publicVerifyCode }) as unknown as Prisma.InputJsonValue;
  }

  const link = await prisma.publicVerificationLink.create({
    data: {
      publicCode: token.publicCode,
      organizationId,
      documentId,
      tokenId: token.id,
      status: PublicVerificationLinkStatuses.active,
      visibility: token.visibility,
      label: input.label,
      expiresAt: token.expiresAt,
      snapshotJson,
      createdByUserId: userId,
    },
  });

  const urls = buildPublicUrls({
    rawToken,
    publicVerifyCode,
  });

  return {
    link: {
      publicCode: link.publicCode,
      status: link.status,
      visibility: link.visibility,
      label: link.label,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
    },
    token: rawToken, // shown once
    urls,
  };
}

export async function listPublicLinks(userId: string, organizationId: string, documentId: string) {
  await assertOrgManage(userId, organizationId, documentId);
  const links = await prisma.publicVerificationLink.findMany({
    where: { organizationId, documentId },
    orderBy: { createdAt: "desc" },
  });
  return links.map((l) => ({
    publicCode: l.publicCode,
    status: evaluateLinkStatus(l),
    visibility: l.visibility,
    label: l.label,
    expiresAt: l.expiresAt,
    createdAt: l.createdAt,
  }));
}

export async function revokePublicLink(
  userId: string,
  organizationId: string,
  documentId: string,
  publicCode: string,
) {
  await assertOrgManage(userId, organizationId, documentId);
  const link = await prisma.publicVerificationLink.findFirst({
    where: { organizationId, documentId, publicCode },
  });
  if (!link) throw new AppError(404, "NOT_FOUND", "Link not found");
  const now = new Date();
  await prisma.publicVerificationLink.update({
    where: { id: link.id },
    data: { status: PublicVerificationLinkStatuses.revoked, revokedAt: now },
  });
  await prisma.publicVerificationToken.update({
    where: { id: link.tokenId },
    data: { status: PublicVerificationLinkStatuses.revoked, revokedAt: now },
  });
  return { publicCode, status: PublicVerificationLinkStatuses.revoked };
}

export async function disablePublicLink(
  userId: string,
  organizationId: string,
  documentId: string,
  publicCode: string,
) {
  await assertOrgManage(userId, organizationId, documentId);
  const link = await prisma.publicVerificationLink.findFirst({
    where: { organizationId, documentId, publicCode },
  });
  if (!link) throw new AppError(404, "NOT_FOUND", "Link not found");
  const now = new Date();
  await prisma.publicVerificationLink.update({
    where: { id: link.id },
    data: { status: PublicVerificationLinkStatuses.disabled, disabledAt: now },
  });
  await prisma.publicVerificationToken.update({
    where: { id: link.tokenId },
    data: { status: PublicVerificationLinkStatuses.disabled, disabledAt: now },
  });
  return { publicCode, status: PublicVerificationLinkStatuses.disabled };
}

export async function listPublicEvents(userId: string, organizationId: string, documentId: string) {
  await assertOrgManage(userId, organizationId, documentId);
  return prisma.publicVerificationEvent.findMany({
    where: { organizationId, documentId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getPublicAnalytics(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  await assertOrgManage(userId, organizationId, documentId);
  return prisma.publicVerificationAnalytics.findMany({
    where: { organizationId, documentId },
    orderBy: { day: "desc" },
    take: 30,
  });
}

async function assertOrgManage(userId: string, organizationId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
  });
  if (!document) throw new AppError(404, "DOC_NOT_FOUND", "Document not found");
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
    DocumentPermissions.manage,
  );
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
}

/** Clear frozen snapshots when document trust state changes. */
export async function invalidatePublicSnapshots(
  organizationId: string,
  documentId: string,
): Promise<void> {
  await prisma.publicVerificationLink.updateMany({
    where: { organizationId, documentId },
    data: { snapshotJson: Prisma.DbNull },
  });
}
