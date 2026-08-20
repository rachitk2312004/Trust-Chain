import {
  DocumentPermissions,
  NotificationEventTypes,
  QrFormatVersions,
  QrStatuses,
  RoleKeys,
  VerificationVisibility,
} from "@trustchain/config";
import { prisma, Prisma } from "@trustchain/database";
import { AppError } from "../../../lib/errors.js";
import { putObjectBuffer } from "../../../integrations/objectStorage.js";
import { userHasRole } from "../../auth/rbac.repository.js";
import { assertDocumentPermission } from "../../documents/documents.access.js";
import { emitDomainNotification } from "../../notifications/notification.emit.js";
import {
  createPublicLink,
  publicVerifyByLinkToken,
} from "../../public-verification/services/publicVerification.service.js";
import { hashOpaque, hashToken } from "../../public-verification/utils/crypto.js";
import { assertNotAbusive, assertPublicRateLimit } from "../../public-verification/utils/abuse.js";
import { recordQrEvent } from "../analytics/events.js";
import {
  generateBase64Png,
  generatePngBuffer,
  generatePrintPdf,
  generateSvgString,
} from "../generators/qrGenerator.js";
import { resolveTemplate } from "../templates/template.service.js";
import type { QrPayload, QrRenderOptions } from "../types/qr.types.js";
import {
  buildPayloadV1,
  buildPayloadV2,
  buildPayloadV3,
  evaluateQrStatus,
  generateQrPublicCode,
  wireStringForPayload,
} from "../utils/payload.js";

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
  return document;
}

async function assertOrgStaff(userId: string, organizationId: string) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
}

function renderOptsFromTemplate(
  template: {
    sizePx: number;
    errorCorrection: string;
    foregroundColor: string;
    backgroundColor: string;
    marginModules: number;
  } | null,
): Partial<QrRenderOptions> {
  if (!template) return {};
  return {
    sizePx: template.sizePx,
    errorCorrection: template.errorCorrection as QrRenderOptions["errorCorrection"],
    foregroundColor: template.foregroundColor,
    backgroundColor: template.backgroundColor,
    marginModules: template.marginModules,
  };
}

function publicQr(row: {
  publicCode: string;
  formatVersion: string;
  status: string;
  visibility: string;
  payloadChecksum: string;
  payloadHash: string;
  signatureVersion: string;
  algorithm: string;
  payloadJson: Prisma.JsonValue;
  issuedAt: Date;
  expiresAt: Date | null;
  revokedAt?: Date | null;
  disabledAt?: Date | null;
  pngObjectKey: string | null;
  svgObjectKey: string | null;
  createdAt: Date;
  documentId: string;
}) {
  return {
    publicCode: row.publicCode,
    documentId: row.documentId,
    formatVersion: row.formatVersion,
    status: evaluateQrStatus({
      status: row.status,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt ?? null,
      disabledAt: row.disabledAt ?? null,
    }),
    visibility: row.visibility,
    integrity: {
      payloadChecksum: row.payloadChecksum,
      payloadHash: row.payloadHash,
      signatureVersion: row.signatureVersion,
      algorithm: row.algorithm,
    },
    payload: row.payloadJson,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    assets: {
      pngObjectKey: row.pngObjectKey,
      svgObjectKey: row.svgObjectKey,
    },
    createdAt: row.createdAt,
  };
}

async function buildPayloadForDocument(input: {
  formatVersion: string;
  rawToken: string;
  qrPublicCode: string;
  publicVerifyCode: string | null;
  documentId: string;
  expiresAt: Date | null;
}) {
  if (input.formatVersion === QrFormatVersions.V1) {
    return buildPayloadV1({ rawToken: input.rawToken, qrPublicCode: input.qrPublicCode });
  }
  if (input.formatVersion === QrFormatVersions.V2) {
    return buildPayloadV2({
      rawToken: input.rawToken,
      qrPublicCode: input.qrPublicCode,
      publicVerifyCode: input.publicVerifyCode,
      expiresAt: input.expiresAt,
    });
  }

  const version = await prisma.documentVersion.findFirst({
    where: { documentId: input.documentId },
    orderBy: { versionNumber: "desc" },
  });
  const anchor = version
    ? await prisma.blockchainAnchor.findFirst({
        where: { documentVersionId: version.id, status: "anchored" },
        include: { network: true, anchorTx: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return buildPayloadV3({
    rawToken: input.rawToken,
    qrPublicCode: input.qrPublicCode,
    publicVerifyCode: input.publicVerifyCode,
    contentHash: version?.contentHash ?? anchor?.contentHash ?? null,
    networkName: anchor?.network?.key ?? null,
    transactionHash: anchor?.anchorTx?.txHash ?? null,
    blockNumber:
      anchor?.blockNumber != null
        ? String(anchor.blockNumber)
        : anchor?.anchorTx?.blockNumber != null
          ? String(anchor.anchorTx.blockNumber)
          : null,
    expiresAt: input.expiresAt,
  });
}

async function maybeUploadAssets(input: {
  organizationId: string;
  qrPublicCode: string;
  png: Buffer;
  svg: string;
}): Promise<{ pngObjectKey: string | null; svgObjectKey: string | null }> {
  const pngKey = `orgs/${input.organizationId}/qr/${input.qrPublicCode}.png`;
  const svgKey = `orgs/${input.organizationId}/qr/${input.qrPublicCode}.svg`;
  try {
    await putObjectBuffer({ objectKey: pngKey, body: input.png, contentType: "image/png" });
    await putObjectBuffer({
      objectKey: svgKey,
      body: Buffer.from(input.svg, "utf8"),
      contentType: "image/svg+xml",
    });
    return { pngObjectKey: pngKey, svgObjectKey: svgKey };
  } catch {
    return { pngObjectKey: null, svgObjectKey: null };
  }
}

export async function createDocumentQr(
  userId: string,
  organizationId: string,
  documentId: string,
  input: {
    formatVersion?: string;
    templatePublicCode?: string;
    expiresAt?: string | null;
    maxUses?: number;
    visibility?: string;
    label?: string;
  },
) {
  await assertOrgManage(userId, organizationId, documentId);
  const formatVersion = input.formatVersion ?? QrFormatVersions.V1;
  const template = await resolveTemplate(organizationId, input.templatePublicCode);

  const linkResult = await createPublicLink(userId, organizationId, documentId, {
    label: input.label ?? `QR ${formatVersion}`,
    expiresAt: input.expiresAt,
    maxUses: input.maxUses,
    visibility: input.visibility ?? VerificationVisibility.restricted,
  });

  const tokenRow = await prisma.publicVerificationToken.findFirst({
    where: { organizationId, documentId, publicCode: linkResult.link.publicCode },
  });
  if (!tokenRow) throw new AppError(500, "QR_LINK_CREATE_FAILED", "Failed to create QR link");

  const linkRow = await prisma.publicVerificationLink.findFirst({
    where: { tokenId: tokenRow.id },
  });

  const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  const qrPublicCode = generateQrPublicCode("QR");
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  const built = await buildPayloadForDocument({
    formatVersion,
    rawToken: linkResult.token,
    qrPublicCode,
    publicVerifyCode: document.publicVerifyCode,
    documentId,
    expiresAt,
  });

  const renderOpts = renderOptsFromTemplate(template);
  const png = await generatePngBuffer(built.wire, renderOpts);
  const svg = await generateSvgString(built.wire, renderOpts);
  const assets = await maybeUploadAssets({ organizationId, qrPublicCode, png, svg });

  const row = await prisma.documentQrCode.create({
    data: {
      publicCode: qrPublicCode,
      organizationId,
      documentId,
      publicVerificationTokenId: tokenRow.id,
      publicVerificationLinkId: linkRow?.id,
      templateId: template?.id,
      formatVersion,
      status: QrStatuses.active,
      visibility: input.visibility ?? VerificationVisibility.restricted,
      payloadChecksum: built.integrity.payloadChecksum,
      payloadHash: built.integrity.payloadHash,
      signatureVersion: built.integrity.signatureVersion,
      algorithm: built.integrity.algorithm,
      payloadJson: built.payload as unknown as Prisma.InputJsonValue,
      expiresAt,
      pngObjectKey: assets.pngObjectKey,
      svgObjectKey: assets.svgObjectKey,
      createdByUserId: userId,
    },
  });

  await emitDomainNotification({
    organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.qrCreated,
    entityId: row.id,
    entityType: "document_qr",
    title: "QR code generated",
    message: `QR ${row.publicCode} was generated for a document.`,
    metadata: {
      documentId,
      publicCode: row.publicCode,
      formatVersion: row.formatVersion,
    },
    recipientUserIds: [userId, document.createdById],
  });

  return {
    qr: publicQr(row),
    scanUrl: (built.payload as QrPayload).url,
    download: {
      pngBase64: png.toString("base64"),
      svg,
    },
  };
}

export async function listDocumentQrs(userId: string, organizationId: string, documentId: string) {
  await assertOrgManage(userId, organizationId, documentId);
  const rows = await prisma.documentQrCode.findMany({
    where: { organizationId, documentId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(publicQr);
}

export async function listOrgQrs(userId: string, organizationId: string) {
  await assertOrgStaff(userId, organizationId);
  const rows = await prisma.documentQrCode.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(publicQr);
}

export async function getDocumentQr(userId: string, organizationId: string, publicCode: string) {
  await assertOrgStaff(userId, organizationId);
  const row = await prisma.documentQrCode.findFirst({
    where: { organizationId, publicCode },
  });
  if (!row) throw new AppError(404, "QR_NOT_FOUND", "QR code not found");
  return publicQr(row);
}

async function setQrStatus(
  userId: string,
  organizationId: string,
  publicCode: string,
  next: "revoked" | "disabled",
) {
  await assertOrgStaff(userId, organizationId);
  const row = await prisma.documentQrCode.findFirst({
    where: { organizationId, publicCode },
  });
  if (!row) throw new AppError(404, "QR_NOT_FOUND", "QR code not found");
  const now = new Date();
  const updated = await prisma.documentQrCode.update({
    where: { id: row.id },
    data:
      next === "revoked"
        ? { status: QrStatuses.revoked, revokedAt: now }
        : { status: QrStatuses.disabled, disabledAt: now },
  });
  return publicQr(updated);
}

export async function revokeQr(userId: string, organizationId: string, publicCode: string) {
  const qr = await setQrStatus(userId, organizationId, publicCode, "revoked");
  await emitDomainNotification({
    organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.qrRevoked,
    entityId: qr.publicCode,
    entityType: "document_qr",
    title: "QR code revoked",
    message: `QR ${qr.publicCode} was revoked.`,
    metadata: {
      documentId: qr.documentId,
      publicCode: qr.publicCode,
      status: qr.status,
    },
    recipientUserIds: [userId],
  });
  return qr;
}

export async function disableQr(userId: string, organizationId: string, publicCode: string) {
  return setQrStatus(userId, organizationId, publicCode, "disabled");
}

export async function rotateQr(
  userId: string,
  organizationId: string,
  publicCode: string,
  input: { formatVersion?: string; templatePublicCode?: string } = {},
) {
  await assertOrgStaff(userId, organizationId);
  const existing = await prisma.documentQrCode.findFirst({
    where: { organizationId, publicCode },
  });
  if (!existing) throw new AppError(404, "QR_NOT_FOUND", "QR code not found");

  const created = await createDocumentQr(userId, organizationId, existing.documentId, {
    formatVersion: input.formatVersion ?? existing.formatVersion,
    templatePublicCode: input.templatePublicCode,
    visibility: existing.visibility,
    label: `Rotated from ${publicCode}`,
  });

  const now = new Date();
  const newRow = await prisma.documentQrCode.findFirstOrThrow({
    where: { publicCode: created.qr.publicCode },
  });
  await prisma.documentQrCode.update({
    where: { id: existing.id },
    data: {
      status: QrStatuses.rotated,
      rotatedAt: now,
      rotatedToId: newRow.id,
    },
  });
  await prisma.documentQrCode.update({
    where: { id: newRow.id },
    data: { rotatedFromId: existing.id },
  });

  return {
    previous: { publicCode, status: QrStatuses.rotated },
    qr: created.qr,
    download: created.download,
    scanUrl: created.scanUrl,
  };
}

export async function downloadQrAsset(
  userId: string,
  organizationId: string,
  publicCode: string,
  format: "png" | "svg" | "base64",
) {
  await assertOrgStaff(userId, organizationId);
  const row = await prisma.documentQrCode.findFirst({
    where: { organizationId, publicCode },
    include: { template: true },
  });
  if (!row) throw new AppError(404, "QR_NOT_FOUND", "QR code not found");
  const payload = row.payloadJson as QrPayload;
  const wire = wireStringForPayload(payload);
  const renderOpts = renderOptsFromTemplate(row.template);
  await recordQrEvent({
    organizationId,
    documentId: row.documentId,
    qrCodeId: row.id,
    qrPublicCode: row.publicCode,
    lookupType: "download",
    success: true,
    kind: "download",
  });
  if (format === "svg") {
    return { contentType: "image/svg+xml", body: await generateSvgString(wire, renderOpts) };
  }
  if (format === "base64") {
    return {
      contentType: "application/json",
      body: JSON.stringify({ pngBase64: await generateBase64Png(wire, renderOpts) }),
    };
  }
  return { contentType: "image/png", body: await generatePngBuffer(wire, renderOpts) };
}

export async function exportPrintPdf(
  userId: string,
  organizationId: string,
  input: { publicCodes: string[]; templatePublicCode?: string },
) {
  await assertOrgStaff(userId, organizationId);
  const template =
    (await resolveTemplate(organizationId, input.templatePublicCode)) ??
    (await prisma.qrTemplate.findFirst({ where: { organizationId } }));

  const rows = await prisma.documentQrCode.findMany({
    where: { organizationId, publicCode: { in: input.publicCodes } },
    include: { template: true },
  });
  if (rows.length === 0) throw new AppError(404, "QR_NOT_FOUND", "No QR codes found");

  const pngBuffers: Buffer[] = [];
  const labels: string[] = [];
  for (const row of rows) {
    const tpl = row.template ?? template;
    const wire = wireStringForPayload(row.payloadJson as QrPayload);
    pngBuffers.push(await generatePngBuffer(wire, renderOptsFromTemplate(tpl)));
    labels.push(row.publicCode);
  }

  const pdf = await generatePrintPdf({
    pngBuffers,
    labels,
    print: {
      printPageSize: template?.printPageSize,
      printDpi: template?.printDpi,
      printMarginMm: template?.printMarginMm,
      printBleedMm: template?.printBleedMm,
      qrPerPage: template?.qrPerPage,
    },
  });
  return pdf;
}

export async function batchCreateQrs(
  userId: string,
  organizationId: string,
  input: {
    documentIds: string[];
    formatVersion?: string;
    templatePublicCode?: string;
    expiresAt?: string | null;
    visibility?: string;
  },
) {
  await assertOrgStaff(userId, organizationId);
  const job = await prisma.qrBatchJob.create({
    data: {
      organizationId,
      createdByUserId: userId,
      operation: "create",
      status: "processing",
      total: input.documentIds.length,
      formatVersion: input.formatVersion ?? QrFormatVersions.V1,
    },
  });

  const results: Array<{ documentId: string; publicCode?: string; error?: string }> = [];
  let successCount = 0;
  let failedCount = 0;

  for (const documentId of input.documentIds) {
    try {
      const created = await createDocumentQr(userId, organizationId, documentId, {
        formatVersion: input.formatVersion,
        templatePublicCode: input.templatePublicCode,
        expiresAt: input.expiresAt,
        visibility: input.visibility,
      });
      results.push({ documentId, publicCode: created.qr.publicCode });
      successCount += 1;
    } catch (error) {
      failedCount += 1;
      results.push({
        documentId,
        error: error instanceof AppError ? error.code : "QR_BATCH_ITEM_FAILED",
      });
    }
  }

  const updated = await prisma.qrBatchJob.update({
    where: { id: job.id },
    data: {
      status: "completed",
      successCount,
      failedCount,
      resultJson: results as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  return {
    job: {
      id: updated.id,
      operation: updated.operation,
      status: updated.status,
      total: updated.total,
      successCount: updated.successCount,
      failedCount: updated.failedCount,
      formatVersion: updated.formatVersion,
      completedAt: updated.completedAt,
    },
    results,
  };
}

export async function batchRotateQrs(
  userId: string,
  organizationId: string,
  input: {
    publicCodes: string[];
    formatVersion?: string;
    templatePublicCode?: string;
  },
) {
  await assertOrgStaff(userId, organizationId);
  const job = await prisma.qrBatchJob.create({
    data: {
      organizationId,
      createdByUserId: userId,
      operation: "rotate",
      status: "processing",
      total: input.publicCodes.length,
      formatVersion: input.formatVersion ?? QrFormatVersions.V1,
    },
  });

  const results: Array<{
    previousPublicCode: string;
    publicCode?: string;
    error?: string;
  }> = [];
  let successCount = 0;
  let failedCount = 0;

  for (const publicCode of input.publicCodes) {
    try {
      const rotated = await rotateQr(userId, organizationId, publicCode, {
        formatVersion: input.formatVersion,
        templatePublicCode: input.templatePublicCode,
      });
      results.push({ previousPublicCode: publicCode, publicCode: rotated.qr.publicCode });
      successCount += 1;
    } catch (error) {
      failedCount += 1;
      results.push({
        previousPublicCode: publicCode,
        error: error instanceof AppError ? error.code : "QR_BATCH_ITEM_FAILED",
      });
    }
  }

  const updated = await prisma.qrBatchJob.update({
    where: { id: job.id },
    data: {
      status: "completed",
      successCount,
      failedCount,
      resultJson: results as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  return {
    job: {
      id: updated.id,
      operation: updated.operation,
      status: updated.status,
      total: updated.total,
      successCount: updated.successCount,
      failedCount: updated.failedCount,
      formatVersion: updated.formatVersion,
      completedAt: updated.completedAt,
    },
    results,
  };
}

export async function listQrEvents(userId: string, organizationId: string, documentId?: string) {
  await assertOrgStaff(userId, organizationId);
  return prisma.qrVerificationEvent.findMany({
    where: { organizationId, ...(documentId ? { documentId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getQrAnalytics(userId: string, organizationId: string, documentId?: string) {
  await assertOrgStaff(userId, organizationId);
  return prisma.qrAnalytics.findMany({
    where: { organizationId, ...(documentId ? { documentId } : {}) },
    orderBy: { day: "desc" },
    take: 30,
  });
}

/** Public scan: QR token → status gate → Wave 5 link verification. */
export async function publicResolveQr(rawToken: string, meta: { ip: string; userAgent?: string }) {
  const ipHash = await assertNotAbusive(meta.ip);
  await assertPublicRateLimit(ipHash);
  const tokenHash = hashToken(rawToken);

  const token = await prisma.publicVerificationToken.findUnique({
    where: { tokenHash },
  });
  if (!token) {
    await recordQrEvent({
      lookupType: "qr_scan",
      success: false,
      errorCode: "QR_NOT_FOUND",
      ipHash,
      userAgentHash: meta.userAgent ? hashOpaque(meta.userAgent) : null,
    });
    throw new AppError(404, "QR_NOT_FOUND", "QR code not found");
  }

  const qr = await prisma.documentQrCode.findFirst({
    where: { publicVerificationTokenId: token.id },
    orderBy: { createdAt: "desc" },
  });

  if (qr) {
    const status = evaluateQrStatus(qr);
    if (status !== QrStatuses.active) {
      await recordQrEvent({
        organizationId: qr.organizationId,
        documentId: qr.documentId,
        qrCodeId: qr.id,
        qrPublicCode: qr.publicCode,
        lookupType: "qr_scan",
        outcome: status,
        success: false,
        errorCode: `QR_${status.toUpperCase()}`,
        ipHash,
        userAgentHash: meta.userAgent ? hashOpaque(meta.userAgent) : null,
      });
      throw new AppError(410, `QR_${status.toUpperCase()}`, `QR code is ${status}`);
    }
  }

  const report = await publicVerifyByLinkToken(rawToken, meta);

  if (qr) {
    await recordQrEvent({
      organizationId: qr.organizationId,
      documentId: qr.documentId,
      qrCodeId: qr.id,
      qrPublicCode: qr.publicCode,
      lookupType: "qr_scan",
      outcome: report.verificationResult,
      success: true,
      ipHash,
      userAgentHash: meta.userAgent ? hashOpaque(meta.userAgent) : null,
      kind: "scan",
    });
  }

  return {
    report,
    qr: qr
      ? {
          publicCode: qr.publicCode,
          formatVersion: qr.formatVersion,
          integrity: {
            payloadChecksum: qr.payloadChecksum,
            payloadHash: qr.payloadHash,
            signatureVersion: qr.signatureVersion,
            algorithm: qr.algorithm,
          },
        }
      : null,
  };
}

/** Clear cached QR assets when document trust state changes (payload remains until rotate). */
export async function invalidateQrAssets(
  organizationId: string,
  documentId: string,
): Promise<void> {
  await prisma.documentQrCode.updateMany({
    where: { organizationId, documentId, status: QrStatuses.active },
    data: { pngObjectKey: null, svgObjectKey: null },
  });
}
