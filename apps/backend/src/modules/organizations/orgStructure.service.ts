import { NotificationEventTypes, RoleKeys, AuditEventSources } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { generateOpaqueToken, hashToken } from "../../lib/crypto.js";
import { sendEmail } from "../../integrations/mailer.js";
import { invitationAcceptUrl } from "../../lib/appUrls.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import { bindStaffRoleToUser, revokeOrgScopedRoles } from "../auth/roles.repository.js";
import { findUserByEmail, findUserById } from "../auth/users.repository.js";
import { userHasRole, listRoleBindingsForUser, getCachedRoleBindings, userHasRoleFromBindings } from "../auth/rbac.repository.js";
import { emitDomainNotification } from "../notifications/notification.emit.js";
import {
  createBranch,
  deleteBranch,
  listBranches,
  toPublicBranch,
  updateBranch,
} from "./branches.repository.js";
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  toPublicDepartment,
  updateDepartment,
} from "./departments.repository.js";
import {
  createInvitation,
  findValidInvitationByTokenHash,
  listInvitations,
  markInvitationAccepted,
} from "./invitations.repository.js";
import { createMembership } from "./memberships.repository.js";
import { assertOrgAdminPeerCannotModifyOrgAdmin } from "./orgMemberGuards.js";

async function assertOrgAdmin(userId: string, organizationId: string): Promise<void> {
  const cached = getCachedRoleBindings(userId);
  const allowed = cached
    ? userHasRoleFromBindings(cached, [RoleKeys.superAdmin, RoleKeys.orgAdmin], organizationId)
    : await userHasRole(userId, [RoleKeys.superAdmin, RoleKeys.orgAdmin], organizationId);
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function createOrgBranch(
  userId: string,
  organizationId: string,
  input: Parameters<typeof createBranch>[0],
) {
  await assertOrgAdmin(userId, organizationId);
  const branch = await createBranch({ ...input, organizationId });
  return toPublicBranch(branch);
}

export async function listOrgBranches(_userId: string, organizationId: string) {
  return (await listBranches(organizationId)).map(toPublicBranch);
}

export async function patchOrgBranch(
  userId: string,
  organizationId: string,
  branchId: string,
  input: Parameters<typeof updateBranch>[2],
) {
  await assertOrgAdmin(userId, organizationId);
  const branch = await updateBranch(organizationId, branchId, input);
  if (!branch) throw new AppError(404, "BRANCH_NOT_FOUND", "Branch not found");
  return toPublicBranch(branch);
}

export async function removeOrgBranch(userId: string, organizationId: string, branchId: string) {
  await assertOrgAdmin(userId, organizationId);
  const ok = await deleteBranch(organizationId, branchId);
  if (!ok) throw new AppError(404, "BRANCH_NOT_FOUND", "Branch not found");
}

export async function createOrgDepartment(
  userId: string,
  organizationId: string,
  input: { name: string; code?: string; branchId?: string },
) {
  await assertOrgAdmin(userId, organizationId);
  const department = await createDepartment({ ...input, organizationId });
  return toPublicDepartment(department);
}

export async function listOrgDepartments(_userId: string, organizationId: string) {
  return (await listDepartments(organizationId)).map(toPublicDepartment);
}

export async function patchOrgDepartment(
  userId: string,
  organizationId: string,
  departmentId: string,
  input: Parameters<typeof updateDepartment>[2],
) {
  await assertOrgAdmin(userId, organizationId);
  const department = await updateDepartment(organizationId, departmentId, input);
  if (!department) throw new AppError(404, "DEPARTMENT_NOT_FOUND", "Department not found");
  return toPublicDepartment(department);
}

export async function removeOrgDepartment(
  userId: string,
  organizationId: string,
  departmentId: string,
) {
  await assertOrgAdmin(userId, organizationId);
  const ok = await deleteDepartment(organizationId, departmentId);
  if (!ok) throw new AppError(404, "DEPARTMENT_NOT_FOUND", "Department not found");
}

export async function listOrgMembers(_userId: string, organizationId: string) {
  /** One SQL round trip — Prisma nested includes issue 4 sequential queries over WAN. */
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      title: string | null;
      status: string;
      branchId: string | null;
      departmentId: string | null;
      roleKeys: string[];
      isFoundingAdmin: boolean;
    }>
  >`
    SELECT
      m.id,
      m.user_id AS "userId",
      u.email,
      u.first_name AS "firstName",
      u.last_name AS "lastName",
      m.title,
      m.status,
      m.branch_id AS "branchId",
      m.department_id AS "departmentId",
      COALESCE(
        array_remove(array_agg(DISTINCT r.key) FILTER (WHERE r.key IS NOT NULL), NULL),
        ARRAY[]::text[]
      ) AS "roleKeys",
      (
        SELECT rb2.user_id
        FROM role_bindings rb2
        INNER JOIN roles r2 ON r2.id = rb2.role_id
        WHERE rb2.organization_id = m.organization_id
          AND r2.key = 'org_admin'
        ORDER BY rb2.created_at ASC
        LIMIT 1
      ) = m.user_id AS "isFoundingAdmin"
    FROM memberships m
    INNER JOIN users u ON u.id = m.user_id
    LEFT JOIN role_bindings rb
      ON rb.user_id = m.user_id AND rb.organization_id = m.organization_id
    LEFT JOIN roles r ON r.id = rb.role_id
    WHERE m.organization_id = ${organizationId}::uuid
    GROUP BY
      m.id,
      m.user_id,
      u.email,
      u.first_name,
      u.last_name,
      m.title,
      m.status,
      m.branch_id,
      m.department_id
    ORDER BY u.email ASC
  `;

  return rows;
}

export async function patchOrgMember(
  actorUserId: string,
  organizationId: string,
  membershipId: string,
  input: {
    title?: string;
    status?: "active" | "disabled" | "suspended";
    branchId?: string | null;
    departmentId?: string | null;
  },
) {
  await assertOrgAdmin(actorUserId, organizationId);
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
  });
  if (!membership) {
    throw new AppError(404, "MEMBER_NOT_FOUND", "Membership not found");
  }

  if (input.status !== undefined && input.status !== membership.status) {
    await assertOrgAdminPeerCannotModifyOrgAdmin(
      actorUserId,
      membership.userId,
      organizationId,
      "status",
    );
  }

  if (input.status === "suspended" || input.status === "disabled") {
    await revokeOrgScopedRoles(membership.userId, organizationId, [
      RoleKeys.orgAdmin,
      RoleKeys.employee,
      RoleKeys.publicUser,
    ]);
  }

  if (input.status === "active") {
    const bindings = await listRoleBindingsForUser(membership.userId);
    const hasOrgRole = bindings.some(
      (b) =>
        b.organizationId === organizationId &&
        (b.roleKey === RoleKeys.orgAdmin ||
          b.roleKey === RoleKeys.employee ||
          b.roleKey === RoleKeys.publicUser),
    );
    if (!hasOrgRole) {
      await bindStaffRoleToUser({
        userId: membership.userId,
        roleKey: RoleKeys.employee,
        organizationId,
      });
    }
  }

  const result = await prisma.membership.updateMany({
    where: { id: membershipId, organizationId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
    },
  });
  if (result.count === 0) {
    throw new AppError(404, "MEMBER_NOT_FOUND", "Membership not found");
  }
  return { ok: true as const };
}

export async function inviteToOrganization(
  actorUserId: string,
  organizationId: string,
  input: {
    email: string;
    roleKey: "org_admin" | "employee" | "public_user";
    branchId?: string;
    departmentId?: string;
  },
) {
  await assertOrgAdmin(actorUserId, organizationId);
  const token = generateOpaqueToken();
  const invitation = await createInvitation({
    organizationId,
    email: input.email,
    roleKey: input.roleKey,
    tokenHash: hashToken(token),
    invitedBy: actorUserId,
    branchId: input.branchId,
    departmentId: input.departmentId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const roleLabel =
    input.roleKey === "public_user"
      ? "certificate holder"
      : input.roleKey === "employee"
        ? "employee"
        : "organization admin";

  await sendEmail({
    to: input.email,
    subject: "You're invited to TrustChain",
    text: [
      `You have been invited to join a TrustChain organization as ${roleLabel}.`,
      "",
      "If you already have an account, sign in and accept the invitation:",
      invitationAcceptUrl(),
      "",
      "Invitation token (paste on the invitations page):",
      token,
      "",
      "This invitation expires in 7 days.",
    ].join("\n"),
  });

  const invitee = await findUserByEmail(input.email);

  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "organization.invitation.create",
    actorUserId: actorUserId,
    organizationId,
    resourceType: "invitation",
    resourceId: invitation.id,
    meta: { email: input.email, roleKey: input.roleKey },
  }).catch(() => undefined);

  await emitDomainNotification({
    organizationId,
    actorId: actorUserId,
    eventType: NotificationEventTypes.invitationCreated,
    entityId: invitation.id,
    entityType: "invitation",
    title: "Invitation created",
    message: `${input.email} was invited as ${input.roleKey}.`,
    metadata: { email: input.email, roleKey: input.roleKey },
    recipientUserIds: [invitee?.id],
  });

  return {
    id: invitation.id,
    email: invitation.email,
    roleKey: invitation.role_key,
    expiresAt: invitation.expires_at,
  };
}

export async function listOrgInvitations(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  const rows = await listInvitations(organizationId);
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    roleKey: row.role_key,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }));
}

export async function acceptInvitation(userId: string, token: string) {
  const invitation = await findValidInvitationByTokenHash(hashToken(token));
  if (!invitation) {
    throw new AppError(400, "INVALID_INVITATION", "Invitation is invalid or expired");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  }
  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new AppError(
      403,
      "INVITATION_EMAIL_MISMATCH",
      "Invitation email does not match your account",
    );
  }

  await createMembership({
    organizationId: invitation.organization_id,
    userId,
    branchId: invitation.branch_id,
    departmentId: invitation.department_id,
    status: "active",
  });
  await bindStaffRoleToUser({
    userId,
    roleKey: invitation.role_key,
    organizationId: invitation.organization_id,
  });
  await markInvitationAccepted(invitation.id);

  await emitDomainNotification({
    organizationId: invitation.organization_id,
    actorId: userId,
    eventType: NotificationEventTypes.invitationAccepted,
    entityId: invitation.id,
    entityType: "invitation",
    title: "Invitation accepted",
    message: `${user.email} accepted an organization invitation.`,
    metadata: { email: user.email, roleKey: invitation.role_key },
    recipientUserIds: [invitation.invited_by],
  });
  await emitDomainNotification({
    organizationId: invitation.organization_id,
    actorId: userId,
    eventType: NotificationEventTypes.memberAdded,
    entityId: userId,
    entityType: "membership",
    title: "Member added",
    message: `${user.email} joined the organization.`,
    metadata: { email: user.email, roleKey: invitation.role_key, invitationId: invitation.id },
    recipientUserIds: [userId, invitation.invited_by],
  });

  return {
    organizationId: invitation.organization_id,
    roleKey: invitation.role_key,
  };
}

export async function acceptInvitationByEmailUser(token: string) {
  const invitation = await findValidInvitationByTokenHash(hashToken(token));
  if (!invitation) {
    throw new AppError(400, "INVALID_INVITATION", "Invitation is invalid or expired");
  }
  const user = await findUserByEmail(invitation.email);
  if (!user) {
    throw new AppError(400, "USER_REQUIRED", "Register with the invited email before accepting");
  }
  return acceptInvitation(user.id, token);
}
