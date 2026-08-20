import { RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { putObjectBuffer } from "../../integrations/objectStorage.js";
import { bindStaffRoleToUser } from "../auth/roles.repository.js";
import { findUserByEmail } from "../auth/users.repository.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { createMembership } from "./memberships.repository.js";
import { inviteToOrganization } from "./orgStructure.service.js";
import {
  createBulkImportJob,
  findBulkImportJob,
  toPublicBulkImportJob,
  updateBulkImportJob,
} from "./bulkImport.repository.js";

type ImportRow = {
  email: string;
  roleKey: "org_admin" | "employee" | "public_user";
  title?: string;
};

function parseCsv(csv: string): ImportRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new AppError(400, "EMPTY_CSV", "CSV content is empty");
  }

  const header =
    lines[0]
      ?.toLowerCase()
      .split(",")
      .map((part) => part.trim()) ?? [];
  const emailIdx = header.indexOf("email");
  const roleIdx = header.indexOf("role_key");
  const titleIdx = header.indexOf("title");
  if (emailIdx < 0 || roleIdx < 0) {
    throw new AppError(400, "INVALID_CSV_HEADER", "CSV must include email and role_key columns");
  }

  const rows: ImportRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((part) => part.trim());
    const email = cols[emailIdx] ?? "";
    const roleKey = cols[roleIdx] ?? "";
    if (!email || !roleKey) {
      continue;
    }
    if (roleKey !== "org_admin" && roleKey !== "employee" && roleKey !== "public_user") {
      throw new AppError(400, "INVALID_ROLE", `Invalid role_key: ${roleKey}`);
    }
    rows.push({
      email,
      roleKey,
      title: titleIdx >= 0 ? cols[titleIdx] : undefined,
    });
  }
  return rows;
}

export async function runBulkImport(actorUserId: string, organizationId: string, csv: string) {
  const allowed = await userHasRole(
    actorUserId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }

  const rows = parseCsv(csv);
  const sourceKey = `orgs/${organizationId}/imports/${Date.now()}-source.csv`;
  await putObjectBuffer({
    objectKey: sourceKey,
    body: Buffer.from(csv, "utf8"),
    contentType: "text/csv",
  });

  const job = await createBulkImportJob({
    organizationId,
    createdBy: actorUserId,
    sourceObjectKey: sourceKey,
  });

  await updateBulkImportJob(job.id, { status: "processing", totalRows: rows.length });

  const errors: string[] = ["email,error"];
  let success = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const existing = await findUserByEmail(row.email);
      if (existing) {
        await createMembership({
          organizationId,
          userId: existing.id,
          title: row.title,
          status: "active",
        });
        await bindStaffRoleToUser({
          userId: existing.id,
          roleKey: row.roleKey,
          organizationId,
        });
      } else {
        await inviteToOrganization(actorUserId, organizationId, {
          email: row.email,
          roleKey: row.roleKey,
        });
      }
      success += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${row.email},"${message.replaceAll('"', "'")}"`);
    }
  }

  let errorReportObjectKey: string | null = null;
  if (failed > 0) {
    errorReportObjectKey = `orgs/${organizationId}/imports/${job.id}-errors.csv`;
    await putObjectBuffer({
      objectKey: errorReportObjectKey,
      body: Buffer.from(errors.join("\n"), "utf8"),
      contentType: "text/csv",
    });
  }

  const updated = await updateBulkImportJob(job.id, {
    status: failed > 0 && success === 0 ? "failed" : "completed",
    totalRows: rows.length,
    successRows: success,
    failedRows: failed,
    errorReportObjectKey,
    completed: true,
  });

  return toPublicBulkImportJob(updated);
}

export async function getBulkImportJob(userId: string, organizationId: string, jobId: string) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
  const job = await findBulkImportJob(organizationId, jobId);
  if (!job) {
    throw new AppError(404, "IMPORT_NOT_FOUND", "Import job not found");
  }
  return toPublicBulkImportJob(job);
}
