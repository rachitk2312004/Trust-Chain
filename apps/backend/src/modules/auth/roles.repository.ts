import { RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";

export async function bindRoleToUser(input: {
  userId: string;
  roleKey: string;
  organizationId?: string | null;
}): Promise<void> {
  const role = await prisma.role.findUnique({ where: { key: input.roleKey } });
  if (!role) {
    throw new Error(`Role not found: ${input.roleKey}`);
  }

  const organizationId = input.organizationId ?? null;

  const existing = await prisma.roleBinding.findFirst({
    where: {
      userId: input.userId,
      roleId: role.id,
      organizationId,
    },
  });

  if (existing) {
    return;
  }

  await prisma.roleBinding.create({
    data: {
      userId: input.userId,
      roleId: role.id,
      organizationId,
    },
  });
}

export async function bindPublicUserRole(userId: string): Promise<void> {
  await bindRoleToUser({ userId, roleKey: RoleKeys.publicUser });
}

export async function unbindPublicUserRole(userId: string): Promise<void> {
  const role = await prisma.role.findUnique({ where: { key: RoleKeys.publicUser } });
  if (!role) return;
  await prisma.roleBinding.deleteMany({
    where: { userId, roleId: role.id, organizationId: null },
  });
}

/** Staff roles replace the default holder role assigned at registration. */
export async function bindStaffRoleToUser(input: {
  userId: string;
  roleKey: string;
  organizationId?: string | null;
}): Promise<void> {
  await bindRoleToUser(input);
  if (isStaffRoleKey(input.roleKey)) {
    await unbindPublicUserRole(input.userId);
  }
}

export async function revokeOrgScopedRoles(
  userId: string,
  organizationId: string,
  roleKeys: string[],
): Promise<void> {
  const roles = await prisma.role.findMany({
    where: { key: { in: roleKeys } },
    select: { id: true },
  });
  if (roles.length === 0) return;
  await prisma.roleBinding.deleteMany({
    where: {
      userId,
      organizationId,
      roleId: { in: roles.map((role) => role.id) },
    },
  });
}

export async function setOrgMemberRole(
  userId: string,
  organizationId: string,
  roleKey: string,
): Promise<void> {
  await revokeOrgScopedRoles(userId, organizationId, [
    RoleKeys.orgAdmin,
    RoleKeys.employee,
    RoleKeys.publicUser,
  ]);
  await bindStaffRoleToUser({ userId, roleKey, organizationId });
}

function isStaffRoleKey(roleKey: string): boolean {
  return (
    roleKey === RoleKeys.superAdmin ||
    roleKey === RoleKeys.orgAdmin ||
    roleKey === RoleKeys.employee
  );
}
