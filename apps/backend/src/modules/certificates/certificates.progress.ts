import { CertificateBulkJobStatuses } from "@trustchain/config";
import type { Prisma } from "@trustchain/database";

export type BulkJobProgress = {
  jobId: string;
  organizationId: string;
  status: string;
  format: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  skippedRows: number;
  rolledBackCount: number;
  cancelRequested: boolean;
  rollbackOnCancel: boolean;
  percentComplete: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  errors: Array<{
    rowNumber: number;
    code: string;
    message: string;
    certificateIdentifier?: string | null;
  }>;
  issuedCertificateIds: string[];
};

/** In-memory cancel flags for fast cooperative cancellation between DB polls. */
const cancelFlags = new Map<string, boolean>();

export function requestBulkCancel(jobId: string): void {
  cancelFlags.set(jobId, true);
}

export function clearBulkCancel(jobId: string): void {
  cancelFlags.delete(jobId);
}

export function isBulkCancelRequested(jobId: string, dbFlag?: boolean): boolean {
  return Boolean(cancelFlags.get(jobId) || dbFlag);
}

export function computeBulkPercent(processedRows: number, totalRows: number): number {
  if (totalRows <= 0) return 0;
  return Math.min(100, Math.round((processedRows / totalRows) * 100));
}

export function toBulkJobProgress(row: {
  id: string;
  organizationId: string;
  status: string;
  format: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  skippedRows: number;
  rolledBackCount: number;
  cancelRequested: boolean;
  rollbackOnCancel: boolean;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  errorsJson: Prisma.JsonValue;
  issuedCertificateIds: Prisma.JsonValue;
}): BulkJobProgress {
  const errors = Array.isArray(row.errorsJson)
    ? (row.errorsJson as BulkJobProgress["errors"])
    : [];
  const issuedCertificateIds = Array.isArray(row.issuedCertificateIds)
    ? (row.issuedCertificateIds as string[])
    : [];

  return {
    jobId: row.id,
    organizationId: row.organizationId,
    status: row.status,
    format: row.format,
    totalRows: row.totalRows,
    processedRows: row.processedRows,
    successRows: row.successRows,
    failedRows: row.failedRows,
    skippedRows: row.skippedRows,
    rolledBackCount: row.rolledBackCount,
    cancelRequested: row.cancelRequested,
    rollbackOnCancel: row.rollbackOnCancel,
    percentComplete: computeBulkPercent(row.processedRows, row.totalRows),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    errors,
    issuedCertificateIds,
  };
}

export function resolveTerminalStatus(input: {
  cancelRequested: boolean;
  successRows: number;
  failedRows: number;
  processedRows: number;
  totalRows: number;
}): string {
  if (input.cancelRequested) return CertificateBulkJobStatuses.cancelled;
  if (input.successRows === 0 && input.failedRows > 0) return CertificateBulkJobStatuses.failed;
  if (input.processedRows < input.totalRows && input.cancelRequested) {
    return CertificateBulkJobStatuses.cancelled;
  }
  return CertificateBulkJobStatuses.completed;
}

export function isTerminalBulkStatus(status: string): boolean {
  return (
    status === CertificateBulkJobStatuses.completed ||
    status === CertificateBulkJobStatuses.failed ||
    status === CertificateBulkJobStatuses.cancelled
  );
}
