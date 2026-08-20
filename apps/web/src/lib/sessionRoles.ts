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
  const { setRoles, setActiveOrganizationId } = useSessionStore.getState();
  setRoles(normalized);
  if (isSuperAdmin(normalized)) {
    setActiveOrganizationId(null);
  }
}
