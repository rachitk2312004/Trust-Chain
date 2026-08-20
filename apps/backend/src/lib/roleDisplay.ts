import { RoleKeys } from "@trustchain/config";

export type RoleBindingLike = {
  roleKey: string;
  roleName?: string;
  organizationId?: string | null;
};

const STAFF_ROLE_KEYS = new Set<string>([
  RoleKeys.superAdmin,
  RoleKeys.orgAdmin,
  RoleKeys.employee,
]);

/** Hide global public_user when the account already has a staff role. */
export function rolesForDisplay<T extends RoleBindingLike>(bindings: T[]): T[] {
  const hasStaff = bindings.some((b) => STAFF_ROLE_KEYS.has(b.roleKey));
  if (!hasStaff) return bindings;
  return bindings.filter((b) => b.roleKey !== RoleKeys.publicUser);
}

export function isStaffRoleKey(roleKey: string): boolean {
  return STAFF_ROLE_KEYS.has(roleKey);
}
