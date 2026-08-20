import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthTokens, PublicUser } from "../types/api";
import type { RoleBinding } from "./permissions";
import { normalizeSessionRoles } from "./sessionRoles";
import { isSuperAdmin } from "./permissions";
import { tokenVault } from "./tokenVault";

function localPrefsStorage(): Storage {
  if (typeof globalThis.localStorage !== "undefined") {
    return globalThis.localStorage;
  }
  const memory = new Map<string, string>();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, String(value));
    },
    removeItem: (key) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: (index) => Array.from(memory.keys())[index] ?? null,
    get length() {
      return memory.size;
    },
  };
}

export type SessionBootStatus = "idle" | "bootstrapping" | "ready" | "anonymous";

type SessionState = {
  /** Mirrored from tokenVault for reactive UI; never persisted. */
  accessToken: string | null;
  refreshToken: string | null;
  user: PublicUser | null;
  roles: RoleBinding[];
  mfaToken: string | null;
  activeOrganizationId: string | null;
  bootStatus: SessionBootStatus;
  setSession: (input: AuthTokens & { user: PublicUser }) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setUser: (user: PublicUser | null) => void;
  setRoles: (roles: RoleBinding[]) => void;
  setMfaToken: (mfaToken: string | null) => void;
  setActiveOrganizationId: (organizationId: string | null) => void;
  setBootStatus: (status: SessionBootStatus) => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
  syncFromVault: () => void;
};

function mirrorTokens(accessToken: string | null, refreshToken: string | null) {
  tokenVault.setTokens(accessToken, refreshToken);
  return { accessToken, refreshToken };
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      roles: [],
      mfaToken: null,
      activeOrganizationId: null,
      bootStatus: "idle",
      setSession: ({ accessToken, refreshToken, user }) =>
        set({
          ...mirrorTokens(accessToken, refreshToken),
          user,
          mfaToken: null,
          bootStatus: "ready",
        }),
      setTokens: (tokens) =>
        set({
          ...mirrorTokens(tokens?.accessToken ?? null, tokens?.refreshToken ?? null),
        }),
      setUser: (user) => set({ user }),
      setRoles: (roles) => set({ roles }),
      setMfaToken: (mfaToken) => set({ mfaToken }),
      setActiveOrganizationId: (organizationId) => set({ activeOrganizationId: organizationId }),
      setBootStatus: (bootStatus) => set({ bootStatus }),
      clearSession: () => {
        tokenVault.clear();
        tokenVault.purgeLegacyPersistence();
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          roles: [],
          mfaToken: null,
          bootStatus: "anonymous",
          // Keep activeOrganizationId so re-login restores the last org preference.
        });
      },
      isAuthenticated: () => Boolean(get().accessToken || tokenVault.getAccessToken()),
      syncFromVault: () =>
        set({
          accessToken: tokenVault.getAccessToken(),
          refreshToken: tokenVault.getRefreshToken(),
        }),
    }),
    {
      name: "trustchain.web.prefs",
      storage: createJSONStorage(localPrefsStorage),
      partialize: (state) => ({
        activeOrganizationId: state.activeOrganizationId,
        user: state.user,
        roles: state.roles,
      }),
      onRehydrateStorage: () => (state) => {
        tokenVault.purgeLegacyPersistence();
        state?.syncFromVault();
        if (state?.roles?.length) {
          state.roles = normalizeSessionRoles(state.roles);
          if (isSuperAdmin(state.roles)) {
            state.activeOrganizationId = null;
          }
        }
      },
    },
  ),
);
