import { prisma } from "@trustchain/database";

export type RoleBindingView = {
  roleKey: string;
  roleName: string;
  organizationId: string | null;
};

export async function listRoleBindingsForUser(userId: string): Promise<RoleBindingView[]> {
  const rows = await prisma.roleBinding.findMany({
    where: { userId },
    include: { role: true },
    orderBy: { role: { key: "asc" } },
  });

  return rows.map((row) => ({
    roleKey: row.role.key,
    roleName: row.role.name,
    organizationId: row.organizationId,
  }));
}

export async function userHasRole(
  userId: string,
  roleKeys: string[],
  organizationId?: string | null,
): Promise<boolean> {
  const bindings = await prisma.roleBinding.findMany({
    where: {
      userId,
      role: { key: { in: roleKeys } },
    },
    include: { role: true },
  });

  return bindings.some((binding) => {
    if (binding.role.key === "super_admin") {
      return true;
    }
    if (organizationId == null) {
      return binding.organizationId == null;
    }
    return binding.organizationId === organizationId;
  });
}
