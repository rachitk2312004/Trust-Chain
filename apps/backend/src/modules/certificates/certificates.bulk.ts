import {
  CertificateBulkFormats,
  CertificateBulkJobStatuses,
  CertificateStatuses,
  RoleKeys,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import {
  parseBulkImport,
  parseFlexibleDate,
  validateBulkRows,
  type BulkImportFormat,
  type BulkImportRow,
  type BulkValidatedRow,
  type TemplateLookup,
} from "./certificates.import.js";
import {
  clearBulkCancel,
  isBulkCancelRequested,
  isTerminalBulkStatus,
  requestBulkCancel,
  resolveTerminalStatus,
  toBulkJobProgress,
  type BulkJobProgress,
} from "./certificates.progress.js";
import { issueCertificate } from "./certificates.service.js";
import { listTemplates } from "./certificates.templates.js";

type BulkErrorEntry = {
  rowNumber: number;
  code: string;
  message: string;
  certificateIdentifier?: string | null;
};

async function assertOrgStaff(userId: string, organizationId: string) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
}

function importErrorToAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code ?? "IMPORT_ERROR")
      : "IMPORT_ERROR";
  const message = error instanceof Error ? error.message : "Import failed";
  const status =
    code === "EMPTY_IMPORT" ||
    code === "INVALID_CSV_HEADER" ||
    code === "INVALID_JSON" ||
    code === "TOO_MANY_ROWS" ||
    code === "UNSUPPORTED_FORMAT"
      ? 400
      : 400;
  return new AppError(status, code, message);
}

async function buildTemplateMap(organizationId: string): Promise<Map<string, TemplateLookup>> {
  const templates = await listTemplates(organizationId);
  const map = new Map<string, TemplateLookup>();
  for (const tpl of templates) {
    const lookup = { id: tpl.id, code: tpl.code, status: tpl.status };
    map.set(tpl.id.toLowerCase(), lookup);
    map.set(tpl.code.toLowerCase(), lookup);
  }
  return map;
}

async function existingCertificateIdentifiers(organizationId: string): Promise<Set<string>> {
  const rows = await prisma.certificate.findMany({
    where: { organizationId },
    select: { publicId: true },
    take: 50_000,
  });
  return new Set(rows.map((row) => row.publicId.toLowerCase()));
}

export async function previewCertificateBulk(
  userId: string,
  input: {
    organizationId: string;
    format: BulkImportFormat;
    content: string;
    defaultTemplateId?: string | null;
  },
) {
  await assertOrgStaff(userId, input.organizationId);

  let rows: BulkImportRow[];
  try {
    rows = parseBulkImport(input.format, input.content);
  } catch (error) {
    throw importErrorToAppError(error);
  }

  if (rows.length === 0) {
    throw new AppError(400, "EMPTY_IMPORT", "No import rows found");
  }

  const templatesByKey = await buildTemplateMap(input.organizationId);
  const existingIdentifiers = await existingCertificateIdentifiers(input.organizationId);
  const preview = validateBulkRows(rows, {
    templatesByKey,
    defaultTemplateId: input.defaultTemplateId,
    existingIdentifiers,
  });
  preview.format = input.format;
  return { preview };
}

function asIssuableRows(rows: BulkValidatedRow[]): BulkValidatedRow[] {
  return rows.filter((row) => row.errors.length === 0);
}

export async function startCertificateBulk(
  userId: string,
  input: {
    organizationId: string;
    format: BulkImportFormat;
    content: string;
    defaultTitle?: string | null;
    defaultTemplateId?: string | null;
    rollbackOnCancel?: boolean;
    /** When true, reject the job if any row fails validation. Default true. */
    requireAllValid?: boolean;
  },
) {
  await assertOrgStaff(userId, input.organizationId);

  let rows: BulkImportRow[];
  try {
    rows = parseBulkImport(input.format, input.content);
  } catch (error) {
    throw importErrorToAppError(error);
  }
  if (rows.length === 0) {
    throw new AppError(400, "EMPTY_IMPORT", "No import rows found");
  }

  const templatesByKey = await buildTemplateMap(input.organizationId);
  const existingIdentifiers = await existingCertificateIdentifiers(input.organizationId);
  const preview = validateBulkRows(rows, {
    templatesByKey,
    defaultTemplateId: input.defaultTemplateId,
    existingIdentifiers,
  });
  preview.format = input.format;

  const requireAllValid = input.requireAllValid !== false;
  if (requireAllValid && preview.summary.invalidRows > 0) {
    throw new AppError(400, "BULK_VALIDATION_FAILED", "Import contains invalid rows", {
      preview,
    });
  }

  const issuable = asIssuableRows(preview.rows);
  if (issuable.length === 0) {
    throw new AppError(400, "BULK_NO_VALID_ROWS", "No valid rows to issue", { preview });
  }

  const preErrors: BulkErrorEntry[] = preview.rows
    .filter((row) => row.errors.length > 0)
    .flatMap((row) =>
      row.errors.map((err) => ({
        rowNumber: row.rowNumber,
        code: err.code,
        message: err.message,
        certificateIdentifier: row.certificateIdentifier,
      })),
    );

  const job = await prisma.certificateBulkJob.create({
    data: {
      organizationId: input.organizationId,
      createdById: userId,
      status: CertificateBulkJobStatuses.pending,
      format:
        input.format === CertificateBulkFormats.json
          ? CertificateBulkFormats.json
          : CertificateBulkFormats.csv,
      rowsJson: issuable as unknown as Prisma.InputJsonValue,
      errorsJson: preErrors as unknown as Prisma.InputJsonValue,
      issuedCertificateIds: [],
      totalRows: issuable.length,
      processedRows: 0,
      successRows: 0,
      failedRows: preview.summary.invalidRows,
      skippedRows: preview.summary.invalidRows,
      rollbackOnCancel: input.rollbackOnCancel !== false,
      defaultTitle: input.defaultTitle ?? null,
      defaultTemplateId: input.defaultTemplateId ?? null,
    },
  });

  // Fire-and-forget background processing so clients can poll progress.
  void processCertificateBulkJob(job.id).catch((error) => {
    console.error("[certificates.bulk] job failed", job.id, error);
  });

  return {
    job: toBulkJobProgress(job),
    preview,
  };
}

async function processCertificateBulkJob(jobId: string): Promise<void> {
  const job = await prisma.certificateBulkJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (isTerminalBulkStatus(job.status)) return;

  clearBulkCancel(jobId);

  await prisma.certificateBulkJob.update({
    where: { id: jobId },
    data: {
      status: CertificateBulkJobStatuses.processing,
      startedAt: job.startedAt ?? new Date(),
    },
  });

  const rows = (Array.isArray(job.rowsJson) ? job.rowsJson : []) as BulkValidatedRow[];
  const errors: BulkErrorEntry[] = Array.isArray(job.errorsJson)
    ? ([...job.errorsJson] as BulkErrorEntry[])
    : [];
  const issuedIds: string[] = Array.isArray(job.issuedCertificateIds)
    ? [...(job.issuedCertificateIds as string[])]
    : [];

  let processedRows = job.processedRows;
  let successRows = job.successRows;
  let failedRows = job.failedRows;
  let cancelRequested = job.cancelRequested;

  for (const row of rows) {
    const fresh = await prisma.certificateBulkJob.findUnique({
      where: { id: jobId },
      select: { cancelRequested: true, status: true },
    });
    cancelRequested = Boolean(fresh?.cancelRequested);
    if (isBulkCancelRequested(jobId, cancelRequested)) {
      cancelRequested = true;
      break;
    }

    try {
      const issueDate = parseFlexibleDate(row.issueDate);
      const expirationDate = parseFlexibleDate(row.expirationDate);
      const title =
        row.title?.trim() ||
        job.defaultTitle?.trim() ||
        `Certificate for ${row.recipientName.trim()}`;

      const metadata: Record<string, unknown> = {
        ...row.metadata,
        bulkJobId: jobId,
        bulkRowNumber: row.rowNumber,
        ...(row.certificateIdentifier
          ? { certificateIdentifier: row.certificateIdentifier }
          : {}),
      };

      const result = await issueCertificate(job.createdById, {
        organizationId: job.organizationId,
        title,
        recipientName: row.recipientName.trim(),
        recipientEmail: row.recipientEmail,
        templateId: row.resolvedTemplateId ?? job.defaultTemplateId,
        expiresAt: expirationDate?.toISOString() ?? null,
        issuedAt: issueDate?.toISOString() ?? null,
        publicId: row.certificateIdentifier,
        metadata,
        createQr: false,
      });

      issuedIds.push(result.certificate.id);
      successRows += 1;
    } catch (error) {
      failedRows += 1;
      const message = error instanceof AppError ? error.message : error instanceof Error ? error.message : "Issuance failed";
      const code = error instanceof AppError ? error.code : "ISSUANCE_FAILED";
      errors.push({
        rowNumber: row.rowNumber,
        code,
        message,
        certificateIdentifier: row.certificateIdentifier,
      });
    }

    processedRows += 1;

    // Persist progress frequently for polling clients.
    if (processedRows % 5 === 0 || processedRows === rows.length) {
      await prisma.certificateBulkJob.update({
        where: { id: jobId },
        data: {
          processedRows,
          successRows,
          failedRows,
          errorsJson: errors as unknown as Prisma.InputJsonValue,
          issuedCertificateIds: issuedIds as unknown as Prisma.InputJsonValue,
          cancelRequested,
        },
      });
    }
  }

  const latest = await prisma.certificateBulkJob.findUnique({ where: { id: jobId } });
  cancelRequested = Boolean(latest?.cancelRequested || isBulkCancelRequested(jobId));

  let rolledBackCount = latest?.rolledBackCount ?? 0;
  if (cancelRequested && (latest?.rollbackOnCancel ?? true) && issuedIds.length > 0) {
    rolledBackCount = await rollbackIssuedCertificates(
      job.createdById,
      job.organizationId,
      issuedIds,
      jobId,
    );
  }

  const status = resolveTerminalStatus({
    cancelRequested,
    successRows,
    failedRows,
    processedRows,
    totalRows: rows.length,
  });

  await prisma.certificateBulkJob.update({
    where: { id: jobId },
    data: {
      status,
      processedRows,
      successRows,
      failedRows,
      rolledBackCount,
      cancelRequested,
      errorsJson: errors as unknown as Prisma.InputJsonValue,
      issuedCertificateIds: issuedIds as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  clearBulkCancel(jobId);
}

async function rollbackIssuedCertificates(
  userId: string,
  organizationId: string,
  certificateIds: string[],
  jobId: string,
): Promise<number> {
  let rolledBack = 0;
  for (const certificateId of certificateIds) {
    try {
      const row = await prisma.certificate.findFirst({
        where: { id: certificateId, organizationId },
      });
      if (!row || row.status === CertificateStatuses.revoked) continue;

      await prisma.$transaction(async (tx) => {
        await tx.certificate.update({
          where: { id: certificateId },
          data: {
            status: CertificateStatuses.revoked,
            revokedAt: new Date(),
            revokedById: userId,
            revokeReason: `Bulk job ${jobId} cancelled — rollback`,
          },
        });
        await tx.certificateEvent.create({
          data: {
            certificateId,
            organizationId,
            eventType: "revoked",
            actorId: userId,
            payloadJson: {
              reason: `Bulk job ${jobId} cancelled — rollback`,
              bulkRollback: true,
            },
          },
        });
      });
      rolledBack += 1;
    } catch (error) {
      console.error("[certificates.bulk] rollback failed", certificateId, error);
    }
  }
  return rolledBack;
}

export async function getCertificateBulkJob(
  userId: string,
  organizationId: string,
  jobId: string,
): Promise<{ job: BulkJobProgress }> {
  await assertOrgStaff(userId, organizationId);
  const job = await prisma.certificateBulkJob.findFirst({
    where: { id: jobId, organizationId },
  });
  if (!job) throw new AppError(404, "BULK_JOB_NOT_FOUND", "Bulk job not found");
  return { job: toBulkJobProgress(job) };
}

export async function cancelCertificateBulkJob(
  userId: string,
  organizationId: string,
  jobId: string,
): Promise<{ job: BulkJobProgress }> {
  await assertOrgStaff(userId, organizationId);
  const job = await prisma.certificateBulkJob.findFirst({
    where: { id: jobId, organizationId },
  });
  if (!job) throw new AppError(404, "BULK_JOB_NOT_FOUND", "Bulk job not found");

  if (isTerminalBulkStatus(job.status)) {
    return { job: toBulkJobProgress(job) };
  }

  requestBulkCancel(jobId);
  const updated = await prisma.certificateBulkJob.update({
    where: { id: jobId },
    data: { cancelRequested: true },
  });

  // If still pending (worker not started), mark cancelled immediately.
  if (updated.status === CertificateBulkJobStatuses.pending) {
    const cancelled = await prisma.certificateBulkJob.update({
      where: { id: jobId },
      data: {
        status: CertificateBulkJobStatuses.cancelled,
        completedAt: new Date(),
      },
    });
    clearBulkCancel(jobId);
    return { job: toBulkJobProgress(cancelled) };
  }

  return { job: toBulkJobProgress(updated) };
}

/** Test helper — process a job synchronously. */
export async function runCertificateBulkJobNow(jobId: string): Promise<void> {
  await processCertificateBulkJob(jobId);
}
