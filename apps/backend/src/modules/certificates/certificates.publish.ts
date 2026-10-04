import { createHash } from "node:crypto";
import {
  BillingOwnerTypes,
  BlockchainAnchorStatuses,
  CertificateEventTypes,
  DocumentStatuses,
  OrganizationChainRegistrationStatuses,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { assertOrgFeature, getEntitlementSnapshot } from "../billing/billing.entitlements.js";
import { BillingFeatureKeys } from "../billing/billing.plans.js";
import { getObjectBuffer, putObjectBuffer } from "../../integrations/objectStorage.js";
import {
  anchorDocumentOnChain,
  ensureOrganizationRegisteredOnChain,
  getDocumentChainStatus,
  getOrganizationChainStatus,
  revokeDocumentOnChain,
} from "../blockchain/blockchain.service.js";
import { explorerTxUrl, isChainEnabled, resolveConfiguredNetwork } from "../blockchain/chainConfig.js";
import { createDocumentQr } from "../qr/services/qr.service.js";
import { loadCertificateAssets } from "./certificates.assets.js";
import { exportCertificate } from "./certificates.export.js";
import { resolveCertificateLayoutFromSources } from "./certificates.layout.js";
import * as repo from "./certificates.repository.js";
import { findTemplateById } from "./certificates.templates.js";

export type CertificatePublishResult = {
  certificate: ReturnType<typeof repo.toPublicCertificate>;
  qrPublicCode: string | null;
  documentId: string | null;
  chain: CertificateChainSummary;
};

export type CertificateChainSummary = {
  enabled: boolean;
  registered: boolean;
  status: string | null;
  contentHash: string | null;
  txHash: string | null;
  explorerUrl: string | null;
  skipped: boolean;
  reason: string | null;
};

function asMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function emptyChain(partial: Partial<CertificateChainSummary> = {}): CertificateChainSummary {
  return {
    enabled: isChainEnabled(),
    registered: false,
    status: null,
    contentHash: null,
    txHash: null,
    explorerUrl: null,
    skipped: true,
    reason: null,
    ...partial,
  };
}

function errorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  if (error instanceof Error) return error.message;
  return "CHAIN_PUBLISH_FAILED";
}

export async function ensureCertificateBackingDocument(input: {
  userId: string;
  organizationId: string;
  title: string;
  description?: string | null;
  documentId?: string | null;
  expiresAt?: Date | null;
}): Promise<string> {
  if (input.documentId) return input.documentId;

  const doc = await prisma.document.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.userId,
      title: input.title,
      description: input.description ?? `Issued certificate: ${input.title}`,
      status: DocumentStatuses.pendingUpload,
      expiresAt: input.expiresAt,
    },
  });
  return doc.id;
}

async function renderCertificatePdf(row: {
  id: string;
  publicId: string;
  organizationId: string;
  templateId: string | null;
  title: string;
  recipientName: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  verificationUrl: string;
  qrPublicCode: string | null;
  metadataJson: unknown;
}) {
  const organization = await prisma.organization.findUnique({
    where: { id: row.organizationId },
    select: { name: true },
  });
  if (!organization) throw new AppError(404, "ORG_NOT_FOUND", "Organization not found");

  let templateLayoutJson: unknown;
  if (row.templateId) {
    const template = await findTemplateById(row.organizationId, row.templateId);
    if (template) templateLayoutJson = template.layoutJson;
  }
  const layout = resolveCertificateLayoutFromSources({
    templateLayoutJson,
    metadata: asMetadata(row.metadataJson),
  });
  const branding = await prisma.organizationBranding.findUnique({
    where: { organizationId: row.organizationId },
  });
  if (branding?.primaryColor) layout.accentColor = branding.primaryColor;
  if (branding?.secondaryColor) layout.borderColor = branding.secondaryColor;

  const assets = await loadCertificateAssets({
    organizationId: row.organizationId,
    verificationUrl: row.verificationUrl,
    qrPublicCode: row.qrPublicCode,
    logoObjectKey: layout.logoObjectKey,
    signatureImageKey: layout.signatureImageKey,
    backgroundImageKey: layout.backgroundImageKey,
    backgroundColor: layout.backgroundColor,
    showQr: layout.showQr,
    showLogo: layout.showLogo,
    showSignature: layout.showSignature,
  });

  return exportCertificate(
    {
      publicId: row.publicId,
      title: row.title,
      recipientName: row.recipientName,
      organizationName: branding?.displayName || organization.name,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      verificationUrl: row.verificationUrl,
      qrPublicCode: row.qrPublicCode,
      metadata: asMetadata(row.metadataJson),
      layout,
      assets,
      branding: {
        primaryColor: branding?.primaryColor,
        secondaryColor: branding?.secondaryColor,
        displayName: branding?.displayName,
      },
    },
    "pdf",
    row.publicId,
  );
}

async function attachCertificatePdfArtifact(
  userId: string,
  row: {
    id: string;
    publicId: string;
    organizationId: string;
    documentId: string | null;
    templateId: string | null;
    title: string;
    recipientName: string;
    issuedAt: Date | null;
    expiresAt: Date | null;
    verificationUrl: string;
    qrPublicCode: string | null;
    metadataJson: unknown;
  },
): Promise<string | null> {
  if (!row.documentId) return null;

  const document = await prisma.document.findFirst({
    where: { id: row.documentId, organizationId: row.organizationId },
    include: { currentVersion: true },
  });
  if (!document || document.deletedAt) return row.documentId;

  // Reuse existing version only when the PDF object is actually present in storage.
  if (document.currentVersionId && document.currentVersion) {
    try {
      const existing = await getObjectBuffer(document.currentVersion.objectKey);
      if (existing.exists && existing.body && existing.body.length > 0) {
        if (document.status !== DocumentStatuses.active) {
          await prisma.document.update({
            where: { id: document.id },
            data: { status: DocumentStatuses.active },
          });
        }
        return document.id;
      }
    } catch {
      // Missing/corrupt object — regenerate below.
    }
  }

  const exported = await renderCertificatePdf(row);
  const contentHash = createHash("sha256").update(exported.body).digest("hex");
  const nextVersion = (document.currentVersion?.versionNumber ?? 0) + 1;
  const objectKey = `orgs/${row.organizationId}/documents/${document.id}/certificate-${row.publicId}-v${nextVersion}.pdf`;

  await putObjectBuffer({
    objectKey,
    body: exported.body,
    contentType: "application/pdf",
  });

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: nextVersion,
        objectKey,
        contentHash,
        mimeType: "application/pdf",
        sizeBytes: BigInt(exported.body.length),
        originalFileName: exported.fileName,
        uploadedById: userId,
      },
    });
    await tx.document.update({
      where: { id: document.id },
      data: {
        currentVersionId: created.id,
        status: DocumentStatuses.active,
      },
    });
    return created;
  });

  const metadata = asMetadata(row.metadataJson);
  metadata.documentContentHash = contentHash;
  await repo.updateCertificate(row.id, {
    metadataJson: metadata as Prisma.InputJsonValue,
  });

  await repo.createCertificateEvent({
    certificateId: row.id,
    organizationId: row.organizationId,
    eventType: CertificateEventTypes.published,
    actorId: userId,
    payloadJson: {
      documentId: document.id,
      documentVersionId: version.id,
      contentHash,
      objectKey,
      regenerated: nextVersion > 1,
    },
  });

  return document.id;
}

async function ensureCertificateQr(
  userId: string,
  row: {
    id: string;
    publicId: string;
    organizationId: string;
    documentId: string | null;
    qrPublicCode: string | null;
    expiresAt: Date | null;
  },
): Promise<string | null> {
  if (row.qrPublicCode) return row.qrPublicCode;
  if (!row.documentId) return null;

  try {
    const qr = await createDocumentQr(userId, row.organizationId, row.documentId, {
      label: `Certificate ${row.publicId}`,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    });
    const qrPublicCode = qr.qr.publicCode;
    await repo.updateCertificate(row.id, { qrPublicCode });
    return qrPublicCode;
  } catch (error) {
    console.error("[certificates] QR publish failed", error);
    return null;
  }
}

async function orgHasChainPublish(organizationId: string): Promise<boolean> {
  const snapshot = await getEntitlementSnapshot({
    ownerType: BillingOwnerTypes.organization,
    ownerId: organizationId,
  });
  return Boolean(snapshot.features[BillingFeatureKeys.chainPublish]);
}

async function readChainSummary(
  userId: string,
  organizationId: string,
  documentId: string | null,
): Promise<CertificateChainSummary> {
  if (!isChainEnabled()) {
    return emptyChain({ enabled: false, reason: "CHAIN_DISABLED" });
  }

  const planIncludesChain = await orgHasChainPublish(organizationId);
  if (!planIncludesChain) {
    return emptyChain({
      enabled: true,
      skipped: true,
      reason: "PLAN_NOT_INCLUDED",
    });
  }

  if (!documentId) {
    return emptyChain({ reason: "NO_DOCUMENT" });
  }

  try {
    const orgStatus = await getOrganizationChainStatus(userId, organizationId);
    const registered =
      orgStatus.registration?.status === OrganizationChainRegistrationStatuses.registered;
    const docStatus = await getDocumentChainStatus(userId, organizationId, documentId);
    const latest = docStatus.anchors[0] ?? null;
    const networkKey = resolveConfiguredNetwork();
    const txHash =
      latest && "txHash" in latest
        ? ((latest as { txHash?: string | null }).txHash ?? null)
        : null;
    const storedTx = await prisma.blockchainAnchor.findFirst({
      where: { documentId },
      orderBy: { createdAt: "desc" },
      include: { anchorTx: { select: { txHash: true } } },
    });
    const resolvedTxHash = storedTx?.anchorTx?.txHash ?? txHash;
    return {
      enabled: true,
      registered,
      status: latest?.status ?? storedTx?.status ?? null,
      contentHash: latest?.contentHash ?? storedTx?.contentHash ?? docStatus.currentContentHash,
      txHash: resolvedTxHash,
      explorerUrl: resolvedTxHash ? explorerTxUrl(networkKey, resolvedTxHash) : null,
      skipped: false,
      reason: registered ? null : "CHAIN_ORG_NOT_REGISTERED",
    };
  } catch (error) {
    return emptyChain({ reason: errorCode(error) });
  }
}

async function tryPublishToChain(
  userId: string,
  organizationId: string,
  documentId: string,
  certificateId: string,
): Promise<CertificateChainSummary> {
  if (!isChainEnabled()) {
    return emptyChain({ enabled: false, reason: "CHAIN_DISABLED" });
  }

  try {
    await ensureOrganizationRegisteredOnChain(userId, organizationId);
    const orgStatus = await getOrganizationChainStatus(userId, organizationId);
    if (orgStatus.registration?.status !== OrganizationChainRegistrationStatuses.registered) {
      return emptyChain({
        enabled: true,
        reason: "CHAIN_ORG_NOT_REGISTERED",
      });
    }

    const result = await anchorDocumentOnChain(userId, organizationId, documentId);
    const txHash =
      result && typeof result === "object" && "transaction" in result
        ? ((result as { transaction?: { txHash?: string | null } }).transaction?.txHash ?? null)
        : null;
    const explorerUrl =
      result && typeof result === "object" && "explorerUrl" in result
        ? ((result as { explorerUrl?: string | null }).explorerUrl ?? null)
        : null;

    await repo.createCertificateEvent({
      certificateId,
      organizationId,
      eventType: CertificateEventTypes.anchored,
      actorId: userId,
      payloadJson: {
        documentId,
        txHash,
        explorerUrl,
      },
    });

    return {
      enabled: true,
      registered: true,
      status: BlockchainAnchorStatuses.anchored,
      contentHash: null,
      txHash,
      explorerUrl,
      skipped: false,
      reason: null,
    };
  } catch (error) {
    console.error("[certificates] chain publish failed", error);
    return emptyChain({
      enabled: true,
      skipped: true,
      reason: errorCode(error),
    });
  }
}

/**
 * After a certificate row exists: store PDF bytes, register a QR, optionally anchor on-chain.
 * QR/chain failures are recorded and do not roll back issuance.
 * When `requirePdf` is true, PDF storage failures are thrown (used by verify self-heal).
 */
export async function finalizeIssuedCertificate(
  userId: string,
  certificateId: string,
  organizationId: string,
  options: { createQr: boolean; publishToChain: boolean; requirePdf?: boolean },
): Promise<CertificatePublishResult> {
  let row = await repo.findCertificateById(organizationId, certificateId);
  if (!row) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");

  // Ensure a backing document exists so we always have a place to store the PDF.
  if (!row.documentId) {
    const documentId = await ensureCertificateBackingDocument({
      userId,
      organizationId,
      title: row.title,
      description: null,
      expiresAt: row.expiresAt,
    });
    await repo.updateCertificate(certificateId, {
      document: { connect: { id: documentId } },
    });
    row = (await repo.findCertificateById(organizationId, certificateId)) ?? row;
  }

  try {
    const documentId = await attachCertificatePdfArtifact(userId, row);
    if (documentId && documentId !== row.documentId) {
      await repo.updateCertificate(certificateId, {
        document: { connect: { id: documentId } },
      });
    }
  } catch (error) {
    console.error("[certificates] PDF artifact publish failed", error);
    if (options.requirePdf) {
      throw error instanceof AppError
        ? error
        : new AppError(
            500,
            "CERTIFICATE_PDF_MISSING",
            `Could not store certificate PDF: ${error instanceof Error ? error.message : String(error)}`,
          );
    }
  }

  row = (await repo.findCertificateById(organizationId, certificateId)) ?? row;

  if (options.createQr) {
    await ensureCertificateQr(userId, {
      id: row.id,
      publicId: row.publicId,
      organizationId,
      documentId: row.documentId,
      qrPublicCode: row.qrPublicCode,
      expiresAt: row.expiresAt,
    });
  }

  row = (await repo.findCertificateById(organizationId, certificateId)) ?? row;

  let chain = await readChainSummary(userId, organizationId, row.documentId);
  if (options.publishToChain && row.documentId) {
    if (chain.reason === "PLAN_NOT_INCLUDED") {
      // Soft-skip: do not attempt anchor or surface an upgrade action.
      chain = { ...chain, skipped: true, reason: "PLAN_NOT_INCLUDED" };
    } else {
      chain = await tryPublishToChain(userId, organizationId, row.documentId, row.id);
      if (!chain.contentHash || !chain.status) {
        const refreshed = await readChainSummary(userId, organizationId, row.documentId);
        chain = { ...refreshed, ...chain, skipped: chain.skipped, reason: chain.reason };
      }
    }
  }

  const latest = (await repo.findCertificateById(organizationId, certificateId)) ?? row;
  return {
    certificate: repo.toPublicCertificate(latest),
    qrPublicCode: latest.qrPublicCode,
    documentId: latest.documentId,
    chain,
  };
}

export async function publishCertificate(
  userId: string,
  organizationId: string,
  certificateId: string,
  input?: { publishToChain?: boolean },
): Promise<CertificatePublishResult> {
  const existing = await repo.findCertificateById(organizationId, certificateId);
  if (!existing) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");

  let publishToChain = input?.publishToChain !== false;
  if (publishToChain) {
    try {
      await assertOrgFeature(userId, organizationId, BillingFeatureKeys.chainPublish);
    } catch (error) {
      if (error instanceof AppError && error.code === "PLAN_REQUIRED") {
        // Soft-skip instead of throwing — UI shows “not included in plan”.
        publishToChain = false;
        const published = await finalizeIssuedCertificate(userId, certificateId, organizationId, {
          createQr: true,
          publishToChain: false,
        });
        return {
          ...published,
          chain: {
            ...published.chain,
            enabled: true,
            skipped: true,
            reason: "PLAN_NOT_INCLUDED",
          },
        };
      }
      throw error;
    }
  }

  return finalizeIssuedCertificate(userId, certificateId, organizationId, {
    createQr: true,
    publishToChain,
  });
}

export async function getCertificatePublishStatus(
  userId: string,
  organizationId: string,
  certificateId: string,
) {
  const row = await repo.findCertificateById(organizationId, certificateId);
  if (!row) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  const chain = await readChainSummary(userId, organizationId, row.documentId);
  return {
    certificate: repo.toPublicCertificate(row),
    qrPublicCode: row.qrPublicCode,
    documentId: row.documentId,
    chain,
  };
}

export async function revokeCertificateOnChainSafe(
  userId: string,
  organizationId: string,
  documentId: string | null,
) {
  if (!documentId || !isChainEnabled()) return;
  try {
    await revokeDocumentOnChain(userId, organizationId, documentId);
  } catch (error) {
    console.error("[certificates] on-chain revoke skipped", error);
  }
}

export async function publicCertificateChain(documentId: string | null) {
  if (!documentId) {
    return { status: null, contentHash: null, txHash: null, anchored: false, live: false };
  }
  const anchor = await prisma.blockchainAnchor.findFirst({
    where: { documentId, status: BlockchainAnchorStatuses.anchored },
    orderBy: { createdAt: "desc" },
    include: { anchorTx: { select: { txHash: true } } },
  });
  return {
    status: anchor?.status ?? null,
    contentHash: anchor?.contentHash ?? null,
    txHash: anchor?.anchorTx?.txHash ?? null,
    anchored: Boolean(anchor),
    live: false,
  };
}
