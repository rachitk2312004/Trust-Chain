import { AuditEventSources, RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import * as repo from "./marketplace.repository.js";

async function assertMarketplaceAdmin(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function listMarketplace(
  actorId: string,
  query: {
    organizationId?: string;
    category?: string;
    status?: string;
    publisherOrgId?: string;
    q?: string;
    limit: number;
    offset: number;
  },
) {
  const orgId = query.organizationId ?? query.publisherOrgId;
  if (orgId) await assertMarketplaceAdmin(actorId, orgId);
  else {
    // browsing published catalog still requires auth; allow any authenticated admin of any org via super/admin check skipped — require org context
    throw new AppError(400, "VALIDATION_ERROR", "organizationId is required");
  }
  return repo.listMarketplace(query);
}

export async function publishConnector(
  actorId: string,
  body: {
    publisherOrgId: string;
    name: string;
    slug?: string;
    summary: string;
    description?: string;
    category: string;
    connectorKey?: string | null;
    authMode: string;
    version: string;
    changelog?: string;
    minPlatformVersion: string;
    maxPlatformVersion?: string | null;
    publish?: boolean;
  },
) {
  await assertMarketplaceAdmin(actorId, body.publisherOrgId);
  const result = await repo.publishConnector({ ...body, publishedById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "marketplace.connector.publish",
    actorUserId: actorId,
    organizationId: body.publisherOrgId,
    resourceType: "marketplace_listing",
    resourceId: result.listing.id,
    meta: { slug: result.listing.slug, version: result.version.version },
  }).catch(() => undefined);
  return result;
}

export async function patchConnector(
  actorId: string,
  id: string,
  body: {
    name?: string;
    summary?: string;
    description?: string | null;
    status?: string;
    version?: string;
    changelog?: string;
    minPlatformVersion?: string;
    maxPlatformVersion?: string | null;
    publishVersion?: boolean;
  },
) {
  const publisherOrgId = await repo.getListingPublisherOrgId(id);
  if (!publisherOrgId) throw new AppError(404, "NOT_FOUND", "Listing not found");
  await assertMarketplaceAdmin(actorId, publisherOrgId);
  const result = await repo.patchConnector(id, body);
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "marketplace.connector.patch",
    actorUserId: actorId,
    organizationId: publisherOrgId,
    resourceType: "marketplace_listing",
    resourceId: id,
    meta: { status: body.status, version: body.version },
  }).catch(() => undefined);
  return result;
}

export async function installConnector(
  actorId: string,
  body: {
    organizationId: string;
    listingId: string;
    version?: string;
    review?: { rating: number; title: string; body?: string };
  },
) {
  await assertMarketplaceAdmin(actorId, body.organizationId);
  const result = await repo.installConnector({ ...body, installedById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "marketplace.install",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "marketplace_installation",
    resourceId: result.installation.id,
    meta: {
      listingId: body.listingId,
      version: result.installation.installedVersion,
    },
  }).catch(() => undefined);
  return result;
}

export async function listReviews(
  actorId: string,
  query: {
    organizationId?: string;
    listingId?: string;
    limit: number;
    offset: number;
  },
) {
  if (query.organizationId) {
    await assertMarketplaceAdmin(actorId, query.organizationId);
  }
  return repo.listReviews(query);
}

export async function getAnalytics(
  actorId: string,
  query: { organizationId?: string; publisherOrgId?: string },
) {
  const orgId = query.organizationId ?? query.publisherOrgId;
  if (!orgId) {
    throw new AppError(400, "VALIDATION_ERROR", "organizationId or publisherOrgId required");
  }
  await assertMarketplaceAdmin(actorId, orgId);
  return repo.getMarketplaceAnalytics(query);
}

export {
  evaluateCompatibility,
  resolveInstallVersion,
  buildInstallationPlan,
  compareSemver,
  parseSemver,
} from "./marketplace.installation.js";
export {
  aggregateReviews,
  buildMarketplaceAnalytics,
  slugifyName,
} from "./marketplace.analytics.js";
