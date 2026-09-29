import { RoleKeys } from "@trustchain/config";
import { isSuperAdmin, type RoleBinding } from "./permissions";
import { useSessionStore } from "./sessionStore";

/** Super admins are platform-only — strip mistaken org_admin bindings from session. */
export function normalizeSessionRoles(roles: RoleBinding[]): RoleBinding[] {
  if (!isSuperAdmin(roles)) return roles;
  return roles.filter(
    (r) => !(r.roleKey === RoleKeys.orgAdmin && r.organizationId != null),
  );
}

export function applySessionRoles(roles: RoleBinding[]): void {
  const normalized = normalizeSessionRoles(roles);
  const { setRoles, setActiveOrganizationId, activeOrganizationId } = useSessionStore.getState();
  setRoles(normalized);
  if (isSuperAdmin(normalized)) {
    setActiveOrganizationId(null);
    return;
  }

  const staffOrgIds = normalized
    .filter(
      (r) =>
        (r.roleKey === RoleKeys.orgAdmin || r.roleKey === RoleKeys.employee) &&
        r.organizationId,
    )
    .map((r) => r.organizationId)
    .filter((id): id is string => Boolean(id));
  const firstStaffOrg = staffOrgIds[0];
  if (
    firstStaffOrg &&
    (!activeOrganizationId || !staffOrgIds.includes(activeOrganizationId))
  ) {
    setActiveOrganizationId(firstStaffOrg);
  }
}
