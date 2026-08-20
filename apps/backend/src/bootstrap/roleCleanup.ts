import { RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";

/**
 * Removes redundant global public_user bindings from accounts that already have staff roles.
 */
export async function cleanupRedundantPublicUserRoles(): Promise<void> {
  const publicRole = await prisma.role.findUnique({ where: { key: RoleKeys.publicUser } });
  if (!publicRole) return;

  const staffBindings = await prisma.roleBinding.findMany({
    where: {
      role: { key: { in: [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee] } },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  const userIds = staffBindings.map((b) => b.userId);
  if (userIds.length === 0) return;

  const removed = await prisma.roleBinding.deleteMany({
    where: {
      userId: { in: userIds },
      roleId: publicRole.id,
      organizationId: null,
    },
  });

  if (removed.count > 0) {
    console.log(`Removed ${removed.count} redundant public_user role binding(s)`);
  }
}

/**
 * Platform super admins must not retain org memberships or org_admin bindings from
 * mistaken self-provisioning — they manage tenants via the admin console only.
 */
export async function cleanupSuperAdminOrgBindings(): Promise<void> {
  const superAdminRole = await prisma.role.findUnique({ where: { key: RoleKeys.superAdmin } });
  const orgAdminRole = await prisma.role.findUnique({ where: { key: RoleKeys.orgAdmin } });
  if (!superAdminRole || !orgAdminRole) return;

  const superAdminBindings = await prisma.roleBinding.findMany({
    where: { roleId: superAdminRole.id, organizationId: null },
    select: { userId: true },
  });
  const userIds = [...new Set(superAdminBindings.map((b) => b.userId))];
  if (userIds.length === 0) return;

  const [memberships, orgAdminBindings] = await Promise.all([
    prisma.membership.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.roleBinding.deleteMany({
      where: { userId: { in: userIds }, roleId: orgAdminRole.id },
    }),
  ]);

  if (memberships.count > 0 || orgAdminBindings.count > 0) {
    console.log(
      `Cleaned super admin org bindings: ${memberships.count} membership(s), ${orgAdminBindings.count} org_admin role(s)`,
    );
  }
}
