/**
 * Isolated token storage.
 * - Access token: in-memory only (not persisted; survives only for the JS runtime).
 * - Refresh token: sessionStorage (tab-scoped; cleared when the tab closes).
 *
 * Backend does not yet issue httpOnly cookies; this minimizes XSS blast radius
 * versus persisting both tokens in localStorage.
 */

const REFRESH_STORAGE_KEY = "trustchain.web.refreshToken";
const LEGACY_SESSION_KEY = "trustchain.web.session";

let accessTokenMemory: string | null = null;

function getSessionStorage(): Storage | null {
  try {
    if (typeof globalThis.sessionStorage !== "undefined") {
      return globalThis.sessionStorage;
    }
  } catch {
    // Private mode / blocked storage
  }
  return null;
}

export const tokenVault = {
  getAccessToken(): string | null {
    return accessTokenMemory;
  },

  getRefreshToken(): string | null {
    return getSessionStorage()?.getItem(REFRESH_STORAGE_KEY) ?? null;
  },

  setTokens(accessToken: string | null, refreshToken: string | null): void {
    accessTokenMemory = accessToken;
    const storage = getSessionStorage();
    if (!storage) return;
    if (refreshToken) {
      storage.setItem(REFRESH_STORAGE_KEY, refreshToken);
    } else {
      storage.removeItem(REFRESH_STORAGE_KEY);
    }
  },

  clear(): void {
    accessTokenMemory = null;
    getSessionStorage()?.removeItem(REFRESH_STORAGE_KEY);
  },

  /** Remove legacy localStorage session blobs that once held JWTs. */
  purgeLegacyPersistence(): void {
    try {
      globalThis.localStorage?.removeItem(LEGACY_SESSION_KEY);
    } catch {
      // ignore
    }
  },

  hasRefreshToken(): boolean {
    return Boolean(tokenVault.getRefreshToken());
  },
};
