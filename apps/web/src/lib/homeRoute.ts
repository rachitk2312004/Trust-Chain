import { RoleKeys } from "@trustchain/config";
import {
  isOrgMember,
  isSuperAdmin,
  showHolderFeatures,
  type RoleBinding,
} from "./permissions";

export type HomeRouteContext = {
  activeOrganizationId?: string | null;
  memberships?: Array<{ organizationId: string }>;
};

export function resolveOrgAdminOrganizationId(
  roles: RoleBinding[],
  ctx: HomeRouteContext = {},
): string | null {
  const { activeOrganizationId, memberships } = ctx;
  if (activeOrganizationId) {
    const adminHere = roles.some(
      (r) => r.roleKey === RoleKeys.orgAdmin && r.organizationId === activeOrganizationId,
    );
    if (adminHere) return activeOrganizationId;
  }
  const binding = roles.find((r) => r.roleKey === RoleKeys.orgAdmin && r.organizationId);
  return binding?.organizationId ?? memberships?.[0]?.organizationId ?? null;
}

export function isOrgAdminOnly(
  roles: RoleBinding[],
  organizationId?: string | null,
): boolean {
  if (isSuperAdmin(roles)) return false;
  if (organizationId) {
    return roles.some(
      (r) => r.roleKey === RoleKeys.orgAdmin && r.organizationId === organizationId,
    );
  }
  return roles.some((r) => r.roleKey === RoleKeys.orgAdmin);
}

export function getHomeRoute(roles: RoleBinding[], ctx: HomeRouteContext = {}): string {
  if (isSuperAdmin(roles)) return "/admin";

  const orgId = resolveOrgAdminOrganizationId(roles, ctx);
  if (isOrgAdminOnly(roles, orgId ?? undefined)) {
    return orgId ? `/organizations/${orgId}` : "/organizations";
  }

  if (isOrgMember(roles, ctx.activeOrganizationId ?? orgId)) {
    return "/dashboard";
  }

  if (showHolderFeatures(roles, ctx.activeOrganizationId)) {
    return "/my-certificates";
  }

  return "/dashboard";
}

/** Keep super admins in the platform console — not the enterprise workspace shell. */
export function shouldRedirectSuperAdminFromWorkspace(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/platform")) return false;
  if (pathname === "/sessions" || pathname === "/settings") return false;
  return true;
}
