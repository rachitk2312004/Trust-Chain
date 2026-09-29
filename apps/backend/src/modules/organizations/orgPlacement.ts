import { RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";

export type OrgPlacement = {
  branchId: string | null;
  departmentId: string | null;
};

export type ActorOrgScope = {
  isAdmin: boolean;
  branchId: string | null;
  departmentId: string | null;
};

export function resolvePlacement(input: {
  organizationId: string;
  branchId?: string | null;
  departmentId?: string | null;
  branch: { id: string; organizationId: string } | null;
  department: { id: string; organizationId: string; branchId: string | null } | null;
}): OrgPlacement {
  if (input.branchId && !input.branch) {
    throw new AppError(400, "BRANCH_NOT_FOUND", "Branch not found in this organization");
  }
  if (input.departmentId && !input.department) {
    throw new AppError(400, "DEPARTMENT_NOT_FOUND", "Department not found in this organization");
  }
  if (input.branch && input.branch.organizationId !== input.organizationId) {
    throw new AppError(400, "BRANCH_NOT_FOUND", "Branch not found in this organization");
  }
  if (input.department && input.department.organizationId !== input.organizationId) {
    throw new AppError(400, "DEPARTMENT_NOT_FOUND", "Department not found in this organization");
  }

  let branchId = input.branchId ?? null;
  const departmentId = input.departmentId ?? null;

  if (input.department?.branchId) {
    if (branchId && branchId !== input.department.branchId) {
      throw new AppError(
        400,
        "BRANCH_DEPARTMENT_MISMATCH",
        "That department belongs to a different branch",
      );
    }
    branchId = input.department.branchId;
  }

  return { branchId, departmentId };
}

export async function loadAndResolvePlacement(
  organizationId: string,
  branchId?: string | null,
  departmentId?: string | null,
): Promise<OrgPlacement> {
  const [branch, department] = await Promise.all([
    branchId
      ? prisma.branch.findFirst({
          where: { id: branchId, organizationId },
          select: { id: true, organizationId: true },
        })
      : Promise.resolve(null),
    departmentId
      ? prisma.department.findFirst({
          where: { id: departmentId, organizationId },
          select: { id: true, organizationId: true, branchId: true },
        })
      : Promise.resolve(null),
  ]);

  return resolvePlacement({
    organizationId,
    branchId,
    departmentId,
    branch,
    department,
  });
}

export async function getActorOrgScope(
  userId: string,
  organizationId: string,
): Promise<ActorOrgScope> {
  const isAdmin = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  const membership = await prisma.membership.findFirst({
    where: { userId, organizationId, status: { in: ["active", "pending"] } },
    select: { branchId: true, departmentId: true },
  });
  return {
    isAdmin,
    branchId: membership?.branchId ?? null,
    departmentId: membership?.departmentId ?? null,
  };
}

/** Staff whose issued work a branch-scoped employee may see: same branch or unassigned. */
export async function visibleStaffUserIds(
  organizationId: string,
  branchId: string,
): Promise<string[]> {
  const rows = await prisma.membership.findMany({
    where: {
      organizationId,
      status: { in: ["active", "pending"] },
      OR: [{ branchId }, { branchId: null }],
    },
    select: { userId: true },
  });
  return [...new Set(rows.map((row) => row.userId))];
}

export async function issuedByFilterForScope(
  userId: string,
  organizationId: string,
): Promise<{ issuedById?: { in: string[] } }> {
  const scope = await getActorOrgScope(userId, organizationId);
  if (scope.isAdmin || !scope.branchId) return {};
  const ids = await visibleStaffUserIds(organizationId, scope.branchId);
  return { issuedById: { in: ids.length ? ids : [userId] } };
}

export async function requestedByFilterForScope(
  userId: string,
  organizationId: string,
): Promise<{ requestedByUserId?: { in: string[] } }> {
  const scope = await getActorOrgScope(userId, organizationId);
  if (scope.isAdmin || !scope.branchId) return {};
  const ids = await visibleStaffUserIds(organizationId, scope.branchId);
  if (!ids.includes(userId)) ids.push(userId);
  return { requestedByUserId: { in: ids } };
}

export async function assertIssuedWorkVisible(
  userId: string,
  organizationId: string,
  issuedById: string,
): Promise<void> {
  const scope = await getActorOrgScope(userId, organizationId);
  if (scope.isAdmin || !scope.branchId || issuedById === userId) return;
  const ids = await visibleStaffUserIds(organizationId, scope.branchId);
  if (!ids.includes(issuedById)) {
    throw new AppError(404, "NOT_FOUND", "Record not found");
  }
}

export async function directoryUserIdsForScope(
  userId: string,
  organizationId: string,
): Promise<Set<string> | null> {
  const scope = await getActorOrgScope(userId, organizationId);
  if (scope.isAdmin || !scope.branchId) return null;

  const [visible, admins] = await Promise.all([
    visibleStaffUserIds(organizationId, scope.branchId),
    prisma.roleBinding.findMany({
      where: {
        organizationId,
        role: { key: RoleKeys.orgAdmin },
      },
      select: { userId: true },
    }),
  ]);

  return new Set([...visible, ...admins.map((row) => row.userId), userId]);
}
