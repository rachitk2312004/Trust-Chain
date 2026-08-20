import { AuditEventSources, EvidenceCustodyActions, RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import { generateEvidenceExport } from "./evidence.export.js";
import * as repo from "./evidence.repository.js";
import { assertValidLinkTarget, verifyCustodyChain } from "./evidence.validation.js";

async function assertEvidenceAdmin(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function listEvidence(
  actorId: string,
  query: {
    organizationId: string;
    q?: string;
    status?: string;
    framework?: string;
    tag?: string;
    limit: number;
    offset: number;
  },
) {
  await assertEvidenceAdmin(actorId, query.organizationId);
  return repo.listEvidence(query);
}

export async function createEvidence(
  actorId: string,
  body: {
    organizationId: string;
    title: string;
    description?: string | null;
    contentText?: string | null;
    objectKey?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    checksumSha256?: string | null;
    tags?: string[];
    frameworks?: string[];
    metadata?: Record<string, unknown> | null;
    actorIp?: string | null;
  },
) {
  await assertEvidenceAdmin(actorId, body.organizationId);
  const evidence = await repo.createEvidence({
    ...body,
    createdById: actorId,
  });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "evidence.collect",
    actorUserId: actorId,
    actorIp: body.actorIp,
    organizationId: body.organizationId,
    resourceType: "compliance_evidence",
    resourceId: evidence.id,
    meta: { publicCode: evidence.publicCode, frameworks: evidence.frameworks },
  }).catch(() => undefined);
  return { evidence };
}

export async function getEvidence(actorId: string, id: string) {
  const row = await repo.getEvidence(id);
  if (!row) throw new AppError(404, "NOT_FOUND", "Evidence not found");
  await assertEvidenceAdmin(actorId, row.organizationId);

  const custody = row.custody.map((c) => ({
    id: c.id,
    action: c.action,
    actorUserId: c.actorUserId,
    actorIp: c.actorIp,
    previousHash: c.previousHash,
    integrityHash: c.integrityHash,
    details: c.detailsJson,
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    evidence: repo.toPublicEvidence(row),
    versions: row.versions.map((v) => ({
      id: v.id,
      version: v.version,
      checksumSha256: v.checksumSha256,
      mimeType: v.mimeType,
      fileName: v.fileName,
      sizeBytes: v.sizeBytes,
      changeNote: v.changeNote,
      createdById: v.createdById,
      createdAt: v.createdAt.toISOString(),
    })),
    links: row.links.map((l) => ({
      id: l.id,
      targetType: l.targetType,
      targetId: l.targetId,
      label: l.label,
      createdAt: l.createdAt.toISOString(),
    })),
    custody,
    chainValid: verifyCustodyChain(custody),
  };
}

export async function patchEvidence(
  actorId: string,
  id: string,
  body: {
    title?: string;
    description?: string | null;
    status?: string;
    tags?: string[];
    frameworks?: string[];
    metadata?: Record<string, unknown> | null;
    contentText?: string | null;
    objectKey?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    checksumSha256?: string | null;
    changeNote?: string | null;
    revalidate?: boolean;
    actorIp?: string | null;
  },
) {
  const existing = await repo.getEvidence(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Evidence not found");
  await assertEvidenceAdmin(actorId, existing.organizationId);

  const evidence = await repo.patchEvidence(id, {
    ...body,
    actorUserId: actorId,
  });
  if (!evidence) throw new AppError(404, "NOT_FOUND", "Evidence not found");

  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "evidence.update",
    actorUserId: actorId,
    actorIp: body.actorIp,
    organizationId: evidence.organizationId,
    resourceType: "compliance_evidence",
    resourceId: evidence.id,
    meta: { version: evidence.currentVersion, status: evidence.status },
  }).catch(() => undefined);

  return { evidence };
}

export async function linkEvidence(
  actorId: string,
  id: string,
  body: {
    targetType: string;
    targetId: string;
    label?: string | null;
    actorIp?: string | null;
  },
) {
  const existing = await repo.getEvidence(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Evidence not found");
  await assertEvidenceAdmin(actorId, existing.organizationId);
  assertValidLinkTarget(body.targetType, body.targetId);

  const link = await repo.linkEvidence({
    evidenceId: id,
    targetType: body.targetType,
    targetId: body.targetId,
    label: body.label,
    actorUserId: actorId,
    actorIp: body.actorIp,
  });

  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "evidence.link",
    actorUserId: actorId,
    actorIp: body.actorIp,
    organizationId: existing.organizationId,
    resourceType: "compliance_evidence",
    resourceId: id,
    meta: { targetType: body.targetType, targetId: body.targetId },
  }).catch(() => undefined);

  return { link };
}

export async function exportEvidence(
  actorId: string,
  body: {
    organizationId: string;
    format: "json" | "csv";
    status?: string;
    framework?: string;
    tag?: string;
    q?: string;
  },
) {
  await assertEvidenceAdmin(actorId, body.organizationId);
  const job = await repo.createEvidenceExportJob({
    organizationId: body.organizationId,
    format: body.format,
    filters: { ...body },
    triggeredById: actorId,
  });

  try {
    const listed = await repo.listEvidence({
      organizationId: body.organizationId,
      status: body.status,
      framework: body.framework,
      tag: body.tag,
      q: body.q,
      limit: 2000,
      offset: 0,
    });
    const detailed = await repo.listEvidenceForExport(body.organizationId);
    const byId = new Map(detailed.map((d) => [d.id, d]));
    const rows = listed.evidence.map((e) => {
      const full = byId.get(e.id);
      return {
        ...e,
        frameworks: e.frameworks,
        tags: e.tags,
        links: full?.links.map((l) => ({
          targetType: l.targetType,
          targetId: l.targetId,
          label: l.label,
        })),
        custody: full?.custody.map((c) => ({
          action: c.action,
          integrityHash: c.integrityHash,
          createdAt: c.createdAt.toISOString(),
        })),
      };
    });
    const exported = generateEvidenceExport(rows, body.format);
    const finished = await repo.finishEvidenceExportJob(job.id, {
      status: "completed",
      rowCount: exported.rowCount,
      contentText: exported.content,
    });

    await writeAuditEvent({
      source: AuditEventSources.platform,
      action: "evidence.export",
      actorUserId: actorId,
      organizationId: body.organizationId,
      resourceType: "compliance_evidence_export",
      resourceId: finished.id,
      meta: {
        rowCount: exported.rowCount,
        format: body.format,
        custodyAction: EvidenceCustodyActions.exported,
      },
    }).catch(() => undefined);

    return {
      export: {
        id: finished.id,
        status: finished.status,
        format: finished.format,
        rowCount: finished.rowCount,
        contentType: exported.contentType,
        content: finished.contentText,
        finishedAt: finished.finishedAt?.toISOString() ?? null,
      },
    };
  } catch (error) {
    await repo.finishEvidenceExportJob(job.id, {
      status: "failed",
      rowCount: 0,
      errorMessage: error instanceof Error ? error.message : "Export failed",
    });
    throw error;
  }
}
