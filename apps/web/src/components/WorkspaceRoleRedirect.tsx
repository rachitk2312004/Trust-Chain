import { Navigate, useLocation } from "react-router-dom";
import {
  getHomeRoute,
  shouldRedirectSuperAdminFromWorkspace,
} from "../lib/homeRoute";
import { isSuperAdmin } from "../lib/permissions";
import { useSessionStore } from "../lib/sessionStore";

/**
 * Keeps super admins in the platform console and sends org admins to their org home.
 */
export function WorkspaceRoleRedirect() {
  const location = useLocation();
  const roles = useSessionStore((s) => s.roles);
  const activeOrganizationId = useSessionStore((s) => s.activeOrganizationId);

  if (!roles.length) return null;

  if (
    isSuperAdmin(roles) &&
    shouldRedirectSuperAdminFromWorkspace(location.pathname)
  ) {
    return <Navigate to="/admin" replace />;
  }

  const home = getHomeRoute(roles, {
    activeOrganizationId,
  });
  if (location.pathname === "/dashboard" && home !== "/dashboard") {
    return <Navigate to={home} replace />;
  }

  return null;
}
