import * as SecureStore from "expo-secure-store";
import { generateMobileId } from "../utils/ids";
import type { AuthTokens } from "../types/mobile.types";
import { canUseBiometrics, promptBiometrics } from "../security/biometrics/localAuth";

const ACCESS = "tc.mobile.access";
const REFRESH = "tc.mobile.refresh";
const SESSION = "tc.mobile.session";
const BIOMETRICS = "tc.mobile.biometrics";

export async function getOrCreateSessionId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(SESSION);
  if (existing) return existing;
  const id = generateMobileId("session");
  await SecureStore.setItemAsync(SESSION, id);
  return id;
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(ACCESS, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH, tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
}

export async function loadTokens(requireBiometrics: boolean): Promise<AuthTokens | null> {
  if (requireBiometrics) {
    const enabled = (await SecureStore.getItemAsync(BIOMETRICS)) === "1";
    if (enabled && (await canUseBiometrics())) {
      const ok = await promptBiometrics("Unlock TrustChain session");
      if (!ok) return null;
    }
  }
  const accessToken = await SecureStore.getItemAsync(ACCESS);
  const refreshToken = await SecureStore.getItemAsync(REFRESH);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRICS, enabled ? "1" : "0");
}

export async function isBiometricsEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRICS)) === "1";
}

/** Firebase Auth bridge placeholder — API auth remains TrustChain JWT. */
export async function initFirebaseAuthBridge(): Promise<{ ready: boolean; reason?: string }> {
  try {
    // Lazy optional import pattern — no-op when Firebase config absent.
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) return { ready: false, reason: "firebase_unconfigured" };
    return { ready: true };
  } catch {
    return { ready: false, reason: "firebase_init_failed" };
  }
}
