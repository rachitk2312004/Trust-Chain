import type { NavigateFunction } from "react-router-dom";
import { authApi } from "../services/authApi";
import { applySessionRoles } from "./sessionRoles";
import { getHomeRoute, resolveWorkspaceOrganizationId } from "./homeRoute";
import { useSessionStore } from "./sessionStore";

export async function completeAuthNavigation(navigate: NavigateFunction): Promise<void> {
  const { data: me } = await authApi.me();
  const store = useSessionStore.getState();
  store.setUser(me.user);
  applySessionRoles(me.roles ?? []);

  const orgId = resolveWorkspaceOrganizationId(me.roles ?? [], {
    activeOrganizationId: useSessionStore.getState().activeOrganizationId,
    memberships: me.memberships,
  });
  if (orgId) {
    useSessionStore.getState().setActiveOrganizationId(orgId);
  }

  navigate(
    getHomeRoute(me.roles ?? [], {
      activeOrganizationId: useSessionStore.getState().activeOrganizationId ?? orgId,
      memberships: me.memberships,
    }),
    { replace: true },
  );
}
