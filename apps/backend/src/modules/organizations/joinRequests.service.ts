import { NotificationEventTypes, RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { clearAuthCacheForUser } from "../../middleware/requireAuth.js";
import { setOrgMemberRole } from "../auth/roles.repository.js";
import { userHasRole } from "../auth/rbac.repository.js";
import {
  searchDiscoverableOrganizations,
  toPublicOrganization,
} from "./organizations.repository.js";
import { assertOrgAdminPeerCannotModifyOrgAdmin } from "./orgMemberGuards.js";

async function assertOrgAdmin(userId: string, organizationId: string): Promise<void> {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

function toPublicJoinRequest(row: {
  id: string;
  organizationId: string;
  userId: string;
  message: string | null;
  requestedRole: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  organization?: { name: string; slug: string };
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organization?.name ?? null,
    organizationSlug: row.organization?.slug ?? null,
    userId: row.userId,
    email: row.user?.email ?? null,
    firstName: row.user?.firstName ?? null,
    lastName: row.user?.lastName ?? null,
    message: row.message,
    requestedRole: row.requestedRole,
    status: row.status,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function discoverOrganizations(userId: string, query: string) {
  const rows = await searchDiscoverableOrganizations(userId, query);
  return rows.map((row) => ({
    ...toPublicOrganization(row),
    membershipStatus: row.membershipStatus,
    joinRequestStatus: row.joinRequestStatus,
    isMember: row.membershipStatus === "active",
    hasPendingRequest: row.joinRequestStatus === "pending",
  }));
}

export async function createJoinRequest(
  userId: string,
  organizationId: string,
  input: { message?: string; requestedRole?: "employee" | "public_user" },
) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org || org.status !== "active") {
    throw new AppError(404, "ORG_NOT_FOUND", "Organization not found");
  }

  const existingMembership = await prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (existingMembership?.status === "active") {
    throw new AppError(409, "ALREADY_MEMBER", "You are already a member of this organization");
  }

  const pending = await prisma.membershipRequest.findFirst({
    where: { organizationId, userId, status: "pending" },
  });
  if (pending) {
    throw new AppError(409, "REQUEST_PENDING", "You already have a pending join request");
  }

  const request = await prisma.membershipRequest.create({
    data: {
      organizationId,
      userId,
      message: input.message?.trim() || null,
      requestedRole: input.requestedRole ?? "employee",
      status: "pending",
    },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      organization: { select: { name: true, slug: true } },
    },
  });

  const admins = await prisma.roleBinding.findMany({
    where: {
      organizationId,
      role: { key: RoleKeys.orgAdmin },
    },
    select: { userId: true },
  });

  const { emitDomainNotification } = await import("../notifications/notification.emit.js");
  await emitDomainNotification({
    organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.memberAdded,
    entityId: request.id,
    entityType: "membership_request",
    title: "Join request received",
    message: `${request.user.email} requested to join ${org.name}.`,
    metadata: { requestId: request.id, email: request.user.email },
    recipientUserIds: admins.map((a) => a.userId),
  }).catch(() => undefined);

  return toPublicJoinRequest(request);
}

export async function listMyJoinRequests(userId: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      organizationId: string;
      userId: string;
      message: string | null;
      requestedRole: string;
      status: string;
      reviewedBy: string | null;
      reviewedAt: Date | null;
      reviewNote: string | null;
      createdAt: Date;
      updatedAt: Date;
      email: string;
      firstName: string | null;
      lastName: string | null;
      organizationName: string;
      organizationSlug: string;
    }>
  >`
    SELECT
      mr.id,
      mr.organization_id AS "organizationId",
      mr.user_id AS "userId",
      mr.message,
      mr.requested_role AS "requestedRole",
      mr.status,
      mr.reviewed_by AS "reviewedBy",
      mr.reviewed_at AS "reviewedAt",
      mr.review_note AS "reviewNote",
      mr.created_at AS "createdAt",
      mr.updated_at AS "updatedAt",
      u.email,
      u.first_name AS "firstName",
      u.last_name AS "lastName",
      o.name AS "organizationName",
      o.slug AS "organizationSlug"
    FROM membership_requests mr
    INNER JOIN users u ON u.id = mr.user_id
    INNER JOIN organizations o ON o.id = mr.organization_id
    WHERE mr.user_id = ${userId}::uuid
    ORDER BY mr.created_at DESC
    LIMIT 50
  `;

  return rows.map((row) =>
    toPublicJoinRequest({
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      message: row.message,
      requestedRole: row.requestedRole,
      status: row.status,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      reviewNote: row.reviewNote,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
      },
      organization: { name: row.organizationName, slug: row.organizationSlug },
    }),
  );
}

export async function listOrgJoinRequests(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  const rows = await prisma.membershipRequest.findMany({
    where: { organizationId, status: "pending" },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      organization: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toPublicJoinRequest);
}

export async function approveJoinRequest(
  actorUserId: string,
  organizationId: string,
  requestId: string,
  input: { roleKey?: "org_admin" | "employee" | "public_user"; reviewNote?: string },
) {
  await assertOrgAdmin(actorUserId, organizationId);

  const request = await prisma.membershipRequest.findFirst({
    where: { id: requestId, organizationId, status: "pending" },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  });
  if (!request) {
    throw new AppError(404, "REQUEST_NOT_FOUND", "Join request not found");
  }

  const roleKey = input.roleKey ?? (request.requestedRole as "employee" | "public_user") ?? "employee";

  await prisma.membership.upsert({
    where: {
      organizationId_userId: { organizationId, userId: request.userId },
    },
    create: {
      organizationId,
      userId: request.userId,
      status: "active",
    },
    update: {
      status: "active",
    },
  });

  await setOrgMemberRole(request.userId, organizationId, roleKey);
  clearAuthCacheForUser(request.userId);

  const updated = await prisma.membershipRequest.update({
    where: { id: requestId },
    data: {
      status: "approved",
      reviewedBy: actorUserId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote?.trim() || null,
    },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      organization: { select: { name: true, slug: true } },
    },
  });

  const { emitDomainNotification } = await import("../notifications/notification.emit.js");
  await emitDomainNotification({
    organizationId,
    actorId: actorUserId,
    eventType: NotificationEventTypes.memberAdded,
    entityId: request.userId,
    entityType: "membership",
    title: "Join request approved",
    message: `Your request to join the organization was approved.`,
    metadata: { roleKey },
    recipientUserIds: [request.userId],
  }).catch(() => undefined);

  return toPublicJoinRequest(updated);
}

export async function rejectJoinRequest(
  actorUserId: string,
  organizationId: string,
  requestId: string,
  input: { reviewNote?: string },
) {
  await assertOrgAdmin(actorUserId, organizationId);

  const request = await prisma.membershipRequest.findFirst({
    where: { id: requestId, organizationId, status: "pending" },
  });
  if (!request) {
    throw new AppError(404, "REQUEST_NOT_FOUND", "Join request not found");
  }

  const updated = await prisma.membershipRequest.update({
    where: { id: requestId },
    data: {
      status: "rejected",
      reviewedBy: actorUserId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote?.trim() || null,
    },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      organization: { select: { name: true, slug: true } },
    },
  });

  return toPublicJoinRequest(updated);
}

export async function updateOrgMemberRole(
  actorUserId: string,
  organizationId: string,
  membershipId: string,
  roleKey: "org_admin" | "employee" | "public_user",
) {
  await assertOrgAdmin(actorUserId, organizationId);

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
  });
  if (!membership) {
    throw new AppError(404, "MEMBER_NOT_FOUND", "Membership not found");
  }

  await assertOrgAdminPeerCannotModifyOrgAdmin(
    actorUserId,
    membership.userId,
    organizationId,
    "role",
  );

  await setOrgMemberRole(membership.userId, organizationId, roleKey);
  if (membership.status !== "active") {
    await prisma.membership.update({
      where: { id: membershipId },
      data: { status: "active" },
    });
  }
  return { ok: true as const, roleKey };
}
