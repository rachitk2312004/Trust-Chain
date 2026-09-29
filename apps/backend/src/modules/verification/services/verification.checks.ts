import { RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../../lib/errors.js";
import { userHasRole } from "../../auth/rbac.repository.js";

export type SavedCheckKind = "intake" | "documents" | "certificates" | "hashes" | "identifiers";

export type CheckRowInput = {
  inputLabel: string;
  fileName?: string;
  outcome: string;
  verdict?: string;
  valid: boolean;
  recipientName?: string;
  publicId?: string;
  title?: string;
  uniqueId?: string;
  contentHash?: string;
  certificateId?: string;
  documentId?: string;
  requestId?: string;
  detail?: string;
};

export type VerificationCheckHistoryRow = {
  id: string;
  runId: string;
  kind: string;
  scope: string;
  inputLabel: string;
  fileName: string | null;
  outcome: string;
  verdict: string | null;
  valid: boolean;
  recipientName: string | null;
  publicId: string | null;
  title: string | null;
  uniqueId: string | null;
  contentHash: string | null;
  certificateId: string | null;
  documentId: string | null;
  requestId: string | null;
  detail: string | null;
  createdAt: Date;
};

export async function saveCheckRun(
  userId: string,
  organizationId: string,
  kind: SavedCheckKind,
  rows: CheckRowInput[],
) {
  if (!rows.length) return null;
  const validCount = rows.filter((row) => row.valid).length;
  return prisma.verificationCheckRun.create({
    data: {
      organizationId,
      createdById: userId,
      kind,
      scope: rows.length === 1 ? "single" : "bulk",
      total: rows.length,
      validCount,
      failedCount: rows.length - validCount,
      rows: {
        create: rows.map((row) => ({
          organizationId,
          inputLabel: row.inputLabel.slice(0, 240),
          fileName: row.fileName?.slice(0, 240) ?? null,
          outcome: row.outcome,
          verdict: row.verdict ?? null,
          valid: row.valid,
          recipientName: row.recipientName ?? null,
          publicId: row.publicId ?? null,
          title: row.title ?? null,
          uniqueId: row.uniqueId ?? row.publicId ?? null,
          contentHash: row.contentHash ?? null,
          certificateId: row.certificateId ?? null,
          documentId: row.documentId ?? null,
          requestId: row.requestId ?? null,
          detail: row.detail?.slice(0, 500) ?? null,
        })),
      },
    },
  });
}

export async function listCheckHistory(
  userId: string,
  organizationId: string,
  query: { kind?: string; limit?: number; offset?: number } = {},
) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "VERIFY_FORBIDDEN", "Organization membership required");

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const where = {
    organizationId,
    ...(query.kind ? { run: { kind: query.kind } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.verificationCheckRow.findMany({
      where,
      include: { run: { select: { kind: true, scope: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.verificationCheckRow.count({ where }),
  ]);

  return {
    rows: rows.map(
      (row): VerificationCheckHistoryRow => ({
        id: row.id,
        runId: row.runId,
        kind: row.run.kind,
        scope: row.run.scope,
        inputLabel: row.inputLabel,
        fileName: row.fileName,
        outcome: row.outcome,
        verdict: row.verdict,
        valid: row.valid,
        recipientName: row.recipientName,
        publicId: row.publicId,
        title: row.title,
        uniqueId: row.uniqueId,
        contentHash: row.contentHash,
        certificateId: row.certificateId,
        documentId: row.documentId,
        requestId: row.requestId,
        detail: row.detail,
        createdAt: row.createdAt,
      }),
    ),
    total,
    limit,
    offset,
  };
}
