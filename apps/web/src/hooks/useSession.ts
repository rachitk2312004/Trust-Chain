import { useSessionStore } from "../lib/sessionStore";

export function useIsAuthenticated(): boolean {
  return Boolean(useSessionStore((s) => s.accessToken));
}

export function useAuthStatus(): boolean {
  return useSessionStore((s) => Boolean(s.accessToken));
}

export function useCurrentUserFromStore() {
  return useSessionStore((s) => s.user);
}

export function useActiveOrganizationId(): string | null {
  return useSessionStore((s) => s.activeOrganizationId);
}
