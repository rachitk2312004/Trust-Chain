import { prisma } from "@trustchain/database";

export type RoleBindingView = {
  roleKey: string;
  roleName: string;
  organizationId: string | null;
};

const ROLE_CACHE_TTL_MS = 120_000;
const roleCache = new Map<string, { bindings: RoleBindingView[]; expiresAt: number }>();

export function getCachedRoleBindings(userId: string): RoleBindingView[] | null {
  const entry = roleCache.get(userId);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.bindings;
  }
  return null;
}

export function setCachedRoleBindings(userId: string, bindings: RoleBindingView[]): void {
  roleCache.set(userId, { bindings, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
}

export function userHasRoleFromBindings(
  bindings: RoleBindingView[],
  roleKeys: string[],
  organizationId?: string | null,
): boolean {
  return bindings.some((binding) => {
    if (!roleKeys.includes(binding.roleKey)) return false;
    if (binding.roleKey === "super_admin") return true;
    if (organizationId == null) return binding.organizationId == null;
    return binding.organizationId === organizationId;
  });
}

export async function listRoleBindingsForUser(userId: string): Promise<RoleBindingView[]> {
  const cached = getCachedRoleBindings(userId);
  if (cached) return cached;

  const rows = await prisma.roleBinding.findMany({
    where: { userId },
    include: { role: true },
    orderBy: { role: { key: "asc" } },
  });

  const bindings = rows.map((row) => ({
    roleKey: row.role.key,
    roleName: row.role.name,
    organizationId: row.organizationId,
  }));
  setCachedRoleBindings(userId, bindings);
  return bindings;
}

export async function userHasRole(
  userId: string,
  roleKeys: string[],
  organizationId?: string | null,
  bindings?: RoleBindingView[],
): Promise<boolean> {
  const resolved =
    bindings ?? getCachedRoleBindings(userId) ?? (await listRoleBindingsForUser(userId));
  return userHasRoleFromBindings(resolved, roleKeys, organizationId);
}
