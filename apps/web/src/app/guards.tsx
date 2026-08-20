import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthHomeRedirect } from "../components/AuthHomeRedirect";
import { getHomeRoute } from "../lib/homeRoute";
import { useSessionStore } from "../lib/sessionStore";

export function RequireAuth() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const location = useLocation();
  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function PublicOnly() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const roles = useSessionStore((s) => s.roles);
  const activeOrganizationId = useSessionStore((s) => s.activeOrganizationId);
  if (accessToken) {
    if (!roles.length) {
      return <AuthHomeRedirect />;
    }
    return (
      <Navigate
        to={getHomeRoute(roles, { activeOrganizationId })}
        replace
      />
    );
  }
  return <Outlet />;
}

export function RequireMfaChallenge() {
  const mfaToken = useSessionStore((s) => s.mfaToken);
  if (!mfaToken) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
