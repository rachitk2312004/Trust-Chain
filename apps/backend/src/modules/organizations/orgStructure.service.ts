import { RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { generateOpaqueToken, hashToken } from "../../lib/crypto.js";
import { sendEmail } from "../../integrations/mailer.js";
import { bindRoleToUser } from "../auth/roles.repository.js";
import { findUserByEmail, findUserById } from "../auth/users.repository.js";
import { userHasRole } from "../auth/rbac.repository.js";
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

async function assertOrgMember(userId: string, organizationId: string): Promise<void> {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Organization membership required");
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

export async function listOrgBranches(userId: string, organizationId: string) {
  await assertOrgMember(userId, organizationId);
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

export async function listOrgDepartments(userId: string, organizationId: string) {
  await assertOrgMember(userId, organizationId);
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

export async function listOrgMembers(userId: string, organizationId: string) {
  await assertOrgMember(userId, organizationId);
  const rows = await prisma.membership.findMany({
    where: { organizationId },
    include: {
      user: {
        select: { email: true, firstName: true, lastName: true },
      },
    },
    orderBy: { user: { email: "asc" } },
  });
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    title: row.title,
    status: row.status,
    branchId: row.branchId,
    departmentId: row.departmentId,
  }));
}

export async function patchOrgMember(
  actorUserId: string,
  organizationId: string,
  membershipId: string,
  input: {
    title?: string;
    status?: "active" | "disabled";
    branchId?: string | null;
    departmentId?: string | null;
  },
) {
  await assertOrgAdmin(actorUserId, organizationId);
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

  await sendEmail({
    to: input.email,
    subject: "You are invited to TrustChain",
    text: `You have been invited to join a TrustChain organization.\n\nInvitation token:\n${token}\n\nThis invitation expires in 7 days.`,
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
  await bindRoleToUser({
    userId,
    roleKey: invitation.role_key,
    organizationId: invitation.organization_id,
  });
  await markInvitationAccepted(invitation.id);

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
