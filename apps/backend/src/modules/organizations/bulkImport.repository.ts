import { prisma } from "@trustchain/database";

export type BulkImportJobRow = {
  id: string;
  organization_id: string;
  created_by: string | null;
  source_object_key: string;
  error_report_object_key: string | null;
  status: string;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

function toBulkImportJobRow(row: {
  id: string;
  organizationId: string;
  createdBy: string | null;
  sourceObjectKey: string;
  errorReportObjectKey: string | null;
  status: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): BulkImportJobRow {
  return {
    id: row.id,
    organization_id: row.organizationId,
    created_by: row.createdBy,
    source_object_key: row.sourceObjectKey,
    error_report_object_key: row.errorReportObjectKey,
    status: row.status,
    total_rows: row.totalRows,
    success_rows: row.successRows,
    failed_rows: row.failedRows,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    completed_at: row.completedAt,
  };
}

export async function createBulkImportJob(input: {
  organizationId: string;
  createdBy: string;
  sourceObjectKey: string;
}): Promise<BulkImportJobRow> {
  const row = await prisma.bulkImportJob.create({
    data: {
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      sourceObjectKey: input.sourceObjectKey,
      status: "pending",
    },
  });
  return toBulkImportJobRow(row);
}

export async function updateBulkImportJob(
  id: string,
  input: {
    status: string;
    totalRows?: number;
    successRows?: number;
    failedRows?: number;
    errorReportObjectKey?: string | null;
    completed?: boolean;
  },
): Promise<BulkImportJobRow> {
  const row = await prisma.bulkImportJob.update({
    where: { id },
    data: {
      status: input.status,
      ...(input.totalRows !== undefined ? { totalRows: input.totalRows } : {}),
      ...(input.successRows !== undefined ? { successRows: input.successRows } : {}),
      ...(input.failedRows !== undefined ? { failedRows: input.failedRows } : {}),
      ...(input.errorReportObjectKey !== undefined
        ? { errorReportObjectKey: input.errorReportObjectKey }
        : {}),
      ...(input.completed ? { completedAt: new Date() } : {}),
    },
  });
  return toBulkImportJobRow(row);
}

export async function findBulkImportJob(
  organizationId: string,
  jobId: string,
): Promise<BulkImportJobRow | null> {
  const row = await prisma.bulkImportJob.findFirst({
    where: { id: jobId, organizationId },
  });
  return row ? toBulkImportJobRow(row) : null;
}

export function toPublicBulkImportJob(row: BulkImportJobRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    sourceObjectKey: row.source_object_key,
    errorReportObjectKey: row.error_report_object_key,
    status: row.status,
    totalRows: row.total_rows,
    successRows: row.success_rows,
    failedRows: row.failed_rows,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}
