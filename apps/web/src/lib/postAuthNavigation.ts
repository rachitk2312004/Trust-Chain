import type { NavigateFunction } from "react-router-dom";
import { authApi } from "../services/authApi";
import { getHomeRoute, isOrgAdminOnly, resolveOrgAdminOrganizationId } from "./homeRoute";
import { useSessionStore } from "./sessionStore";

export async function completeAuthNavigation(navigate: NavigateFunction): Promise<void> {
  const { data: me } = await authApi.me();
  const store = useSessionStore.getState();
  store.setUser(me.user);
  store.setRoles(me.roles ?? []);

  const orgId = resolveOrgAdminOrganizationId(me.roles ?? [], {
    activeOrganizationId: store.activeOrganizationId,
    memberships: me.memberships,
  });
  if (orgId && isOrgAdminOnly(me.roles ?? [], orgId)) {
    store.setActiveOrganizationId(orgId);
  }

  navigate(
    getHomeRoute(me.roles ?? [], {
      activeOrganizationId: store.activeOrganizationId ?? orgId,
      memberships: me.memberships,
    }),
    { replace: true },
  );
}
