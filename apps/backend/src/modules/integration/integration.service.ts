import { AuditEventSources, RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import * as repo from "./integration.repository.js";

async function assertIntegrationAdmin(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function listIntegrations(
  actorId: string,
  query: {
    organizationId: string;
    status?: string;
    connectorKey?: string;
    category?: string;
  },
) {
  await assertIntegrationAdmin(actorId, query.organizationId);
  return repo.listIntegrations(query);
}

export async function createIntegration(
  actorId: string,
  body: {
    organizationId: string;
    connectorKey: string;
    name: string;
    authMode?: string;
    syncIntervalMinutes?: number;
    syncMode?: string;
    scopes?: string[];
    config?: Record<string, unknown>;
    apiKey?: string;
    eventTypes?: string[];
  },
) {
  await assertIntegrationAdmin(actorId, body.organizationId);
  const result = await repo.createIntegration({ ...body, createdById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "integration.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "ecosystem_integration",
    resourceId: result.integration.id,
    meta: { connectorKey: body.connectorKey, authMode: result.integration.authMode },
  }).catch(() => undefined);
  return result;
}

export async function patchIntegration(
  actorId: string,
  id: string,
  body: {
    name?: string;
    status?: string;
    syncIntervalMinutes?: number;
    syncMode?: string;
    scopes?: string[];
    config?: Record<string, unknown>;
    eventTypes?: string[];
    rotateCredential?: boolean;
  },
) {
  const organizationId = await repo.getIntegrationOrganizationId(id);
  if (!organizationId) throw new AppError(404, "NOT_FOUND", "Integration not found");
  await assertIntegrationAdmin(actorId, organizationId);
  const result = await repo.patchIntegration(id, body);
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "integration.patch",
    actorUserId: actorId,
    organizationId,
    resourceType: "ecosystem_integration",
    resourceId: id,
    meta: {
      status: body.status,
      rotateCredential: body.rotateCredential ?? false,
    },
  }).catch(() => undefined);
  return result;
}

export async function handleOAuth(
  actorId: string,
  body: {
    organizationId: string;
    integrationId: string;
    action: "start" | "complete";
    redirectUri?: string;
    clientId?: string;
    scopes?: string[];
    state?: string;
    code?: string;
  },
) {
  await assertIntegrationAdmin(actorId, body.organizationId);
  const result = await repo.handleOAuth({ ...body, userId: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: `integration.oauth.${body.action}`,
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "ecosystem_integration",
    resourceId: body.integrationId,
    meta: { action: body.action },
  }).catch(() => undefined);
  return result;
}

export async function syncIntegrations(
  actorId: string,
  body: {
    organizationId: string;
    integrationId?: string;
    force?: boolean;
    mode?: string;
  },
) {
  await assertIntegrationAdmin(actorId, body.organizationId);
  const result = await repo.syncIntegrations({ ...body, triggeredById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "integration.sync",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "integration_sync_job",
    resourceId: result.jobs[0]?.id,
    meta: { jobs: result.jobs.length, skipped: result.skipped },
  }).catch(() => undefined);
  return result;
}

export async function listEvents(
  actorId: string,
  query: {
    organizationId: string;
    integrationId?: string;
    eventType?: string;
    limit: number;
    offset: number;
  },
) {
  await assertIntegrationAdmin(actorId, query.organizationId);
  return repo.listEvents(query);
}

export {
  getConnector,
  listConnectors,
  startOAuthFlow,
  validateOAuthCallback,
  exchangeAuthorizationCode,
  generateApiKeyMaterial,
} from "./integration.oauth.js";
export {
  executeIntegrationSync,
  rotateCredential,
  matchSubscriptions,
  shouldRunSync,
  normalizeSyncPolicy,
  buildSyncDashboard,
} from "./integration.sync.js";
