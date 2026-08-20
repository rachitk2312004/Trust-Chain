import { RoleKeys, type AuditExportFormat } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { generateAuditExport } from "./audit.export.js";
import * as repo from "./audit.repository.js";
import {
  buildTimeline,
  replayCorrelationEvents,
  type AuditEventInput,
  type AuditFilter,
} from "./audit.timeline.js";

async function assertAuditReader(userId: string, organizationId?: string) {
  if (!organizationId) {
    const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
    if (!ok) {
      throw new AppError(400, "VALIDATION_ERROR", "organizationId is required");
    }
    return;
  }
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function writeAuditEvent(input: AuditEventInput) {
  return repo.createPlatformAuditEvent(input);
}

export async function listAuditEvents(
  actorId: string,
  query: AuditFilter & { limit: number; offset: number },
) {
  await assertAuditReader(actorId, query.organizationId);
  return repo.listPlatformAuditEvents(query);
}

export async function getAuditEvent(actorId: string, id: string, organizationId?: string) {
  const event = await repo.getPlatformAuditEvent(id);
  if (!event) throw new AppError(404, "NOT_FOUND", "Audit event not found");
  const orgId = organizationId ?? event.organizationId ?? undefined;
  await assertAuditReader(actorId, orgId);
  if (organizationId && event.organizationId && event.organizationId !== organizationId) {
    throw new AppError(404, "NOT_FOUND", "Audit event not found");
  }
  const replay =
    event.correlationId
      ? replayCorrelationEvents(
          await repo.listTimelineCandidates({
            correlationId: event.correlationId,
            organizationId: event.organizationId ?? undefined,
            limit: 200,
          }),
        ).find((r) => r.event.id === event.id)
      : null;
  return {
    event,
    replay: replay ? { sequence: replay.sequence, linked: replay.linked } : null,
  };
}

export async function getAuditTimeline(
  actorId: string,
  query: {
    organizationId?: string;
    correlationId?: string;
    requestId?: string;
    resourceType?: string;
    resourceId?: string;
    from?: string;
    to?: string;
    limit: number;
  },
) {
  await assertAuditReader(actorId, query.organizationId);
  if (
    !query.correlationId &&
    !query.requestId &&
    !(query.resourceType && query.resourceId) &&
    !query.organizationId
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Provide correlationId, requestId, resource, or organizationId",
    );
  }

  const events = await repo.listTimelineCandidates({
    organizationId: query.organizationId,
    correlationId: query.correlationId,
    requestId: query.requestId,
    resourceType: query.resourceType,
    resourceId: query.resourceId,
    from: query.from,
    to: query.to,
    limit: query.limit,
  });

  const timeline = buildTimeline(events, {
    correlationId: query.correlationId,
    requestId: query.requestId,
    resourceType: query.resourceType,
    resourceId: query.resourceId,
  });

  return {
    ...timeline,
    replay: replayCorrelationEvents(timeline.events),
  };
}

export async function exportAuditEvents(
  actorId: string,
  body: AuditFilter & { format: AuditExportFormat },
) {
  await assertAuditReader(actorId, body.organizationId);
  const job = await repo.createAuditExportJob({
    organizationId: body.organizationId ?? null,
    format: body.format,
    filters: { ...body },
    triggeredById: actorId,
  });

  try {
    const listed = await repo.listPlatformAuditEvents({
      ...body,
      limit: 5000,
      offset: 0,
    });
    const exported = generateAuditExport(listed.events, body.format);
    const finished = await repo.finishAuditExportJob(job.id, {
      status: "completed",
      rowCount: exported.rowCount,
      contentText: exported.content,
    });
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
    await repo.finishAuditExportJob(job.id, {
      status: "failed",
      rowCount: 0,
      errorMessage: error instanceof Error ? error.message : "Export failed",
    });
    throw error;
  }
}

export async function getAuditInfrastructureStatus(
  actorId: string,
  organizationId?: string,
) {
  await assertAuditReader(actorId, organizationId);
  return {
    organizationId: organizationId ?? null,
    ...(await repo.getAuditStatus(organizationId)),
  };
}
