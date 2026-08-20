import { AuditEventSources, RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import * as repo from "./walletsync.repository.js";

async function assertOrgMember(userId: string, organizationId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId, organizationId, status: "active" },
  });
  if (!membership) {
    const admin = await userHasRole(userId, [RoleKeys.superAdmin], organizationId);
    if (!admin) {
      throw new AppError(403, "FORBIDDEN", "Organization membership required");
    }
  }
}

async function isOrgAdmin(userId: string, organizationId: string) {
  return userHasRole(userId, [RoleKeys.superAdmin, RoleKeys.orgAdmin], organizationId);
}

export async function listWallets(
  actorId: string,
  query: { organizationId: string; status?: string; userId?: string },
) {
  await assertOrgMember(actorId, query.organizationId);
  const adminView = await isOrgAdmin(actorId, query.organizationId);
  return repo.listWallets({
    ...query,
    scopeUserId: actorId,
    adminView,
  });
}

export async function linkWallet(
  actorId: string,
  body: {
    organizationId: string;
    provider: string;
    address: string;
    label?: string;
    chainHint?: string;
    setPrimary?: boolean;
  },
) {
  await assertOrgMember(actorId, body.organizationId);
  const result = await repo.linkWallet({ ...body, userId: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "wallet.link",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "wallet_link",
    resourceId: result.wallet.id,
    meta: { provider: body.provider, address: result.wallet.addressNormalized },
  }).catch(() => undefined);
  return result;
}

export async function verifyWallet(
  actorId: string,
  body: {
    organizationId: string;
    walletLinkId: string;
    challengeId?: string;
    proof?: string;
  },
) {
  await assertOrgMember(actorId, body.organizationId);
  const adminOverride = await isOrgAdmin(actorId, body.organizationId);
  const result = await repo.verifyWallet({
    ...body,
    userId: actorId,
    adminOverride,
  });
  if (result.verified) {
    await writeAuditEvent({
      source: AuditEventSources.platform,
      action: "wallet.verify",
      actorUserId: actorId,
      organizationId: body.organizationId,
      resourceType: "wallet_link",
      resourceId: result.wallet.id,
      meta: { status: result.wallet.status },
    }).catch(() => undefined);
  }
  return result;
}

export async function patchWallet(
  actorId: string,
  id: string,
  body: { label?: string | null; isPrimary?: boolean; status?: string },
) {
  const info = await repo.getWalletOrganizationId(id);
  if (!info) throw new AppError(404, "NOT_FOUND", "Wallet not found");
  await assertOrgMember(actorId, info.organizationId);
  const adminOverride = await isOrgAdmin(actorId, info.organizationId);
  const result = await repo.patchWallet(id, {
    ...body,
    actorUserId: actorId,
    adminOverride,
  });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "wallet.patch",
    actorUserId: actorId,
    organizationId: info.organizationId,
    resourceType: "wallet_link",
    resourceId: id,
    meta: { status: body.status, isPrimary: body.isPrimary },
  }).catch(() => undefined);
  return result;
}

export async function listHistory(
  actorId: string,
  query: {
    organizationId: string;
    walletLinkId?: string;
    userId?: string;
    limit: number;
    offset: number;
  },
) {
  await assertOrgMember(actorId, query.organizationId);
  const adminView = await isOrgAdmin(actorId, query.organizationId);
  return repo.listOwnershipHistory({
    ...query,
    scopeUserId: actorId,
    adminView,
  });
}

export async function syncWallets(
  actorId: string,
  body: { organizationId: string; walletLinkId?: string; force?: boolean },
) {
  await assertOrgMember(actorId, body.organizationId);
  const admin = await isOrgAdmin(actorId, body.organizationId);
  if (!admin) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required for sync");
  }
  const result = await repo.syncWallets({
    ...body,
    triggeredById: actorId,
  });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "wallet.sync",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "wallet_sync_job",
    resourceId: result.job.id,
    meta: {
      synced: result.job.result.synced,
      skipped: result.job.result.skipped,
      conflicts: result.job.result.conflicts,
    },
  }).catch(() => undefined);
  return result;
}

export {
  generateOwnershipChallenge,
  verifyOwnershipProof,
  normalizeWalletAddress,
  detectLinkConflict,
  resolveLinkConflict,
} from "./walletsync.verification.js";
export {
  buildSyncPlan,
  executeSyncPlan,
  shouldScheduleSync,
  buildOwnershipReport,
} from "./walletsync.jobs.js";
