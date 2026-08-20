import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { meQueryKey, meQueryOptions } from "../features/auth/meQuery";
import type { MeResponse } from "../types/api";
import { applySessionRoles, normalizeSessionRoles } from "../lib/sessionRoles";
import { subscribeAuthEvents } from "../lib/authEvents";
import { useSessionStore } from "../lib/sessionStore";
import { tokenVault } from "../lib/tokenVault";
import { refreshAccessToken } from "../services/http";

/**
 * Restores an in-memory access token from the sessionStorage refresh token,
 * loads /me roles, and handles forced logout / session-expiration events.
 */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  const bootStatus = useSessionStore((s) => s.bootStatus);
  const setBootStatus = useSessionStore((s) => s.setBootStatus);
  const clearSession = useSessionStore((s) => s.clearSession);
  const accessToken = useSessionStore((s) => s.accessToken);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    async function bootstrap() {
      tokenVault.purgeLegacyPersistence();
      const existingAccess = tokenVault.getAccessToken();
      const refresh = tokenVault.getRefreshToken();

      if (existingAccess) {
        useSessionStore.getState().syncFromVault();
        setBootStatus("ready");
      } else if (refresh) {
        setBootStatus("bootstrapping");
        try {
          const access = await refreshAccessToken();
          if (!access) {
            clearSession();
            setBootStatus("anonymous");
          } else {
            setBootStatus("ready");
          }
        } catch {
          clearSession();
          setBootStatus("anonymous");
        }
      } else {
        setBootStatus("anonymous");
      }
    }

    void bootstrap();
  }, [clearSession, setBootStatus]);

  useEffect(() => {
    if (!accessToken) return;

    const cached = queryClient.getQueryData<MeResponse>(meQueryKey);
    if (cached) {
      useSessionStore.getState().setUser(cached.user);
      applySessionRoles(cached.roles ?? []);
      return;
    }

    const { roles, user } = useSessionStore.getState();
    if (roles.length > 0 && user) {
      applySessionRoles(roles);
      const normalized = normalizeSessionRoles(roles);
      // Hydrate React Query from persisted session so we don't hit /me on every load.
      queryClient.setQueryData<MeResponse>(meQueryKey, {
        user,
        roles: normalized,
        memberships: [],
      });
      const state = queryClient.getQueryState<MeResponse>(meQueryKey);
      const fresh =
        state?.dataUpdatedAt != null && Date.now() - state.dataUpdatedAt < 10 * 60_000;
      if (!fresh) {
        void queryClient.fetchQuery(meQueryOptions()).catch(() => {});
      }
      return;
    }

    void queryClient.fetchQuery(meQueryOptions()).catch(() => {
      // Non-fatal; permissions stay empty until next successful fetch
    });
  }, [accessToken, queryClient]);

  useEffect(() => {
    return subscribeAuthEvents((event) => {
      navigate("/login", {
        replace: true,
        state: {
          sessionExpired: true,
          authEvent: event.type,
          authMessage: event.message ?? "Please sign in again.",
        },
      });
    });
  }, [navigate]);

  if (bootStatus === "idle" || bootStatus === "bootstrapping") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--tc-muted)]">
        Restoring session…
      </div>
    );
  }

  return <>{children}</>;
}
