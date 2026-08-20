import { CertificateEventTypes, CertificateStatuses } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import {
  generateCertificateAnalytics,
  getDownloadAnalytics,
  getIssuanceAnalytics,
  getTemplateAnalytics,
  getVerificationAnalytics,
} from "./certificates.analytics.js";
import { loadCertificateAssets } from "./certificates.assets.js";
import { exportCertificate, type CertificateExportFormat } from "./certificates.export.js";
import { defaultCertificateLayout, resolveCertificateLayout } from "./certificates.layout.js";
import { certificateProcessMetrics } from "./certificates.observability.js";
import * as repo from "./certificates.repository.js";
import {
  DEFAULT_CERTIFICATE_RETENTION_POLICY,
  previewCertificateRetention,
  runCertificateRetentionCleanup,
  type CertificateRetentionPolicy,
} from "./certificates.retention.js";
import { findTemplateById } from "./certificates.templates.js";
import { verifyCertificate } from "./certificates.verifier.js";

function asMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function listBulkJobsForAdmin(
  organizationId: string,
  input?: { limit?: number; offset?: number; status?: string },
) {
  const take = Math.min(Math.max(input?.limit ?? 30, 1), 100);
  const skip = Math.max(input?.offset ?? 0, 0);
  const where = {
    organizationId,
    ...(input?.status ? { status: input.status } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.certificateBulkJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.certificateBulkJob.count({ where }),
  ]);
  return {
    total,
    limit: take,
    offset: skip,
    jobs: rows.map((row) => ({
      id: row.id,
      status: row.status,
      format: row.format,
      totalRows: row.totalRows,
      processedRows: row.processedRows,
      successRows: row.successRows,
      failedRows: row.failedRows,
      skippedRows: row.skippedRows,
      rolledBackCount: row.rolledBackCount,
      cancelRequested: row.cancelRequested,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function getRenderingDiagnostics(organizationId: string) {
  const process = certificateProcessMetrics.snapshot();
  const recent = await prisma.certificateEvent.findMany({
    where: {
      organizationId,
      eventType: {
        in: [CertificateEventTypes.rendered, CertificateEventTypes.downloaded],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      certificateId: true,
      eventType: true,
      payloadJson: true,
      createdAt: true,
    },
  });
  return {
    organizationId,
    process,
    recent: recent.map((row) => ({
      id: row.id,
      certificateId: row.certificateId,
      eventType: row.eventType,
      payload: row.payloadJson,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

/**
 * Reprocess certificates: re-verify and optionally re-render.
 * Records `reprocessed` events with diagnostics.
 */
export async function reprocessCertificates(
  userId: string,
  organizationId: string,
  input: {
    certificateIds?: string[];
    limit?: number;
    renderFormat?: CertificateExportFormat;
    skipRender?: boolean;
  },
) {
  const take = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const format = input.renderFormat ?? "png";

  const certificates =
    input.certificateIds && input.certificateIds.length > 0
      ? await prisma.certificate.findMany({
          where: { organizationId, id: { in: input.certificateIds } },
          include: { document: { select: { status: true, deletedAt: true } } },
          take,
        })
      : await prisma.certificate.findMany({
          where: {
            organizationId,
            status: { in: [CertificateStatuses.issued, CertificateStatuses.expired] },
          },
          include: { document: { select: { status: true, deletedAt: true } } },
          orderBy: { updatedAt: "asc" },
          take,
        });

  if (!certificates.length) {
    throw new AppError(404, "CERTIFICATE_NOT_FOUND", "No certificates found to reprocess");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  if (!organization) throw new AppError(404, "ORG_NOT_FOUND", "Organization not found");

  const branding = await prisma.organizationBranding.findUnique({ where: { organizationId } });
  const results: Array<{
    certificateId: string;
    publicId: string;
    verified: boolean;
    rendered: boolean;
    durationMs: number;
    error?: string;
  }> = [];

  for (const row of certificates) {
    const started = Date.now();
    let verified = false;
    let rendered = false;
    let error: string | undefined;

    try {
      let status = row.status;
      if (
        status === CertificateStatuses.issued &&
        row.expiresAt &&
        row.expiresAt.getTime() <= Date.now()
      ) {
        status = CertificateStatuses.expired;
      }

      const verifyStarted = Date.now();
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
      certificateProcessMetrics.recordVerification(Date.now() - verifyStarted);
      verified = result.valid;

      if (!input.skipRender) {
        const renderStarted = Date.now();
        let layoutJson: unknown = defaultCertificateLayout();
        if (row.templateId) {
          const template = await findTemplateById(organizationId, row.templateId);
          if (template) layoutJson = template.layoutJson;
        }
        const layout = resolveCertificateLayout(layoutJson);
        if (branding?.primaryColor) layout.accentColor = branding.primaryColor;
        if (branding?.secondaryColor) layout.borderColor = branding.secondaryColor;

        const assets = await loadCertificateAssets({
          organizationId,
          verificationUrl: row.verificationUrl,
          qrPublicCode: row.qrPublicCode,
          logoObjectKey: layout.logoObjectKey,
          signatureImageKey: layout.signatureImageKey,
          backgroundImageKey: layout.backgroundImageKey,
          showQr: layout.showQr,
          showLogo: layout.showLogo,
          showSignature: layout.showSignature,
        });

        await exportCertificate(
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
          format,
          row.publicId,
        );

        const renderMs = Date.now() - renderStarted;
        certificateProcessMetrics.recordRender(renderMs, true);
        rendered = true;
        await repo.createCertificateEvent({
          certificateId: row.id,
          organizationId,
          eventType: CertificateEventTypes.rendered,
          actorId: userId,
          payloadJson: { format, durationMs: renderMs, source: "reprocess" },
        });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Reprocess failed";
      certificateProcessMetrics.recordRender(0, false);
    }

    const durationMs = Date.now() - started;
    await repo.createCertificateEvent({
      certificateId: row.id,
      organizationId,
      eventType: CertificateEventTypes.reprocessed,
      actorId: userId,
      payloadJson: { verified, rendered, durationMs, format, error: error ?? null },
    });

    results.push({
      certificateId: row.id,
      publicId: row.publicId,
      verified,
      rendered,
      durationMs,
      error,
    });
  }

  return {
    organizationId,
    requested: certificates.length,
    processed: results.length,
    succeeded: results.filter((r) => !r.error).length,
    failed: results.filter((r) => Boolean(r.error)).length,
    results,
  };
}

export async function runCertificateAdminCleanup(
  organizationId: string,
  policy?: Partial<CertificateRetentionPolicy>,
) {
  const merged: CertificateRetentionPolicy = {
    ...DEFAULT_CERTIFICATE_RETENTION_POLICY,
    ...policy,
  };
  const preview = await previewCertificateRetention(organizationId, merged);
  const result = await runCertificateRetentionCleanup(organizationId, merged);
  return { preview, result };
}

export async function getCertificateOpsOverview(organizationId: string) {
  const [analytics, retention, bulk, diagnostics] = await Promise.all([
    generateCertificateAnalytics(organizationId),
    previewCertificateRetention(organizationId),
    listBulkJobsForAdmin(organizationId, { limit: 10 }),
    getRenderingDiagnostics(organizationId),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    organizationId,
    analytics,
    retention,
    bulk,
    diagnostics,
  };
}

export {
  generateCertificateAnalytics,
  getTemplateAnalytics,
  getIssuanceAnalytics,
  getDownloadAnalytics,
  getVerificationAnalytics,
  previewCertificateRetention,
  runCertificateRetentionCleanup,
};
